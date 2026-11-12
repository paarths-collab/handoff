import type { Library, Node, ParseError, Space } from "./model";
import type { Result } from "./result";
import { isRecord } from "./pack-format";
import { readPack } from "./read-pack";
import { emptyLibrary, summarize } from "./tree";

export const MAX_INPUT_BYTES = 100 * 1024 * 1024;
type InputResult = Result<Library, ParseError>;
type Row = Record<string, unknown>;
const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
const rows = (x: unknown): Row[] =>
	Array.isArray(x) ? x.filter(isRecord) : [];
const nested = (r: Row, key: string): Row => (isRecord(r[key]) ? r[key] : {});
const validContainer = (x: unknown): x is Row =>
	isRecord(x) && Array.isArray(x.spaces) && Array.isArray(x.items);

function themeColor(custom: Row) {
	let row = custom;
	for (const key of [
		"windowTheme",
		"background",
		"single",
		"_0",
		"style",
		"color",
		"_0",
		"blendedSingleColor",
		"_0",
		"color",
	])
		row = nested(row, key);
	const channels = [row.red, row.green, row.blue];
	if (
		!channels.every(
			(c): c is number => typeof c === "number" && c >= 0 && c <= 1,
		)
	)
		return null;
	return (
		"#" +
		channels
			.map((c) =>
				Math.round(c * 255)
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")
	);
}

function parse(text: string, mode: "arc" | "pack" | "auto"): InputResult {
	if (typeof text !== "string")
		return {
			ok: false,
			error: { kind: "not-json", message: "Choose a JSON file." },
		};
	// UTF-8 needs one to three bytes per UTF-16 code unit. Only ambiguous
	// inputs need encoding; encodeInto stops as soon as the byte budget is full.
	const exceedsLimit =
		text.length > MAX_INPUT_BYTES ||
		(text.length > MAX_INPUT_BYTES / 3 &&
			new TextEncoder().encodeInto(text, new Uint8Array(MAX_INPUT_BYTES)).read <
				text.length);
	if (exceedsLimit)
		return {
			ok: false,
			error: {
				kind: "too-large",
				message: "This file exceeds the 100 MiB limit.",
				limitBytes: MAX_INPUT_BYTES,
			},
		};
	let value: unknown;
	try {
		value = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
	} catch {
		return {
			ok: false,
			error: {
				kind: "not-json",
				message: "The file does not contain complete JSON.",
			},
		};
	}
	if (
		mode === "pack" ||
		(mode === "auto" && isRecord(value) && value.format === "tab-mover-pack")
	)
		return readPack(value);
	if (!isRecord(value) || !isRecord(value.sidebar))
		return {
			ok: false,
			error: {
				kind: "not-arc-file",
				message: "No Arc sidebar was found.",
				hint: "Choose StorableSidebar.json or a Tab Mover pack.",
			},
		};
	const containers = Array.isArray(value.sidebar.containers)
		? value.sidebar.containers
		: [];
	const global = containers.findIndex(
		(r: unknown) => isRecord(r) && Object.hasOwn(r, "global"),
	);
	const next = global >= 0 ? containers[global + 1] : undefined;
	const raw = validContainer(next) ? next : containers.find(validContainer);
	if (!raw)
		return {
			ok: false,
			error: {
				kind: "no-sidebar-data",
				message: "The sidebar contains no usable data container.",
				hint: "Choose the sidebar file from the Arc application data folder.",
			},
		};
	return { ok: true, value: readSidebar(raw, value) };
}

export const parseInput = (text: string) => parse(text, "auto");
export const parseArcSidebar = (text: string) => parse(text, "arc");
export const parsePack = (text: string) => parse(text, "pack");

function readSidebar(raw: Row, top: Row): Library {
	const lib = emptyLibrary();
	if (top.platform === "macos" || top.platform === "windows")
		lib.source.platform = top.platform;
	const items = new Map<string, Row>();
	const byParent = new Map<string, string[]>();
	const rawItems = rows(raw.items);
	const rawSpaces = rows(raw.spaces);
	const reserved = new Set(
		[...rawItems, ...rawSpaces]
			.map((r) => str(r.id))
			.filter((s): s is string => s !== null),
	);
	let serial = 0;
	function fresh(prefix: string) {
		let id: string;
		do {
			id = "tab-mover-" + prefix + "-" + ++serial;
		} while (reserved.has(id));
		reserved.add(id);
		return id;
	}
	const used = new Set<string>();
	function identity(row: Row, prefix: string) {
		const rawId = str(row.id);
		if (!rawId || used.has(rawId)) {
			lib.report.warnings.push({ kind: "unknown-field", path: "item.id" });
			return fresh(prefix);
		}
		used.add(rawId);
		return rawId;
	}
	for (const item of rawItems) {
		const id = identity(item, "item");
		items.set(id, item);
		const parent = str(item.parentID);
		if (parent !== null) {
			let children = byParent.get(parent);
			if (!children) {
				children = [];
				byParent.set(parent, children);
			}
			children.push(id);
		}
	}
	const anchors = new Map<string, Node[]>();
	for (const row of rawSpaces) {
		const arcId = identity(row, "space");
		const custom = nested(row, "customInfo");
		const title = str(row.title);
		const space: Space = {
			arcId,
			title: title || "Space " + (lib.spaces.length + 1),
			titleGenerated: !title,
			color: themeColor(custom) ?? str(custom.color) ?? str(row.color),
			icon:
				str(nested(custom, "iconType").emoji_v2) ??
				str(nested(row, "iconType").emoji_v2) ??
				str(custom.icon) ??
				str(row.icon),
			profile:
				str(row.profile) ??
				str(row.profileID) ??
				str(
					nested(nested(nested(row, "profile"), "custom"), "_0")
						.directoryBasename,
				) ??
				(Object.hasOwn(nested(row, "profile"), "default") ? "Default" : null),
			pinned: [],
			today: [],
		};
		if (!title)
			lib.report.warnings.push({
				kind: "generated-title",
				target: "space",
				arcId,
			});
		lib.spaces.push(space);
		anchors.set(arcId, space.pinned);
		const ids = Array.isArray(row.newContainerIDs) ? row.newContainerIDs : [];
		for (let i = 0; i < ids.length - 1; i++) {
			const marker = ids[i],
				id = ids[i + 1];
			if (isRecord(marker) && typeof id === "string") {
				if (Object.hasOwn(marker, "pinned")) anchors.set(id, space.pinned);
				if (Object.hasOwn(marker, "unpinned")) anchors.set(id, space.today);
			}
		}
	}
	const favorites = raw.topAppsContainerIDs;
	const favs = Array.isArray(favorites)
		? favorites
		: isRecord(favorites)
			? Object.values(favorites)
			: [favorites];
	for (const id of favs)
		if (typeof id === "string" && (items.has(id) || byParent.has(id)))
			anchors.set(id, lib.favorites);
	const visited = new Set<string>();
	const deepBuckets = new Map<Node[], Node[]>();
	function children(id: string): string[] {
		const actual = byParent.get(id) ?? [];
		const order = items.get(id)?.childrenIds;
		if (!Array.isArray(order)) return actual;
		const allowed = new Set(actual);
		const ordered: string[] = [];
		let mismatch = false;
		for (const child of order) {
			if (typeof child !== "string" || !allowed.delete(child)) mismatch = true;
			else ordered.push(child);
		}
		if (mismatch || allowed.size)
			lib.report.warnings.push({ kind: "order-mismatch", parentArcId: id });
		for (const child of allowed) ordered.push(child);
		return ordered;
	}
	function appendTab(id: string, data: Row, title: string | null, out: Node[]) {
		const tab = nested(data, "tab");
		const url = str(tab.savedURL);
		const savedTitle = str(tab.savedTitle);
		if (url === null)
			lib.report.skipped.push({
				arcId: id,
				reason: "no-url",
				detail: "tab",
			});
		else {
			let display = title || savedTitle;
			if (!display) {
				try {
					display = new URL(url).hostname || url;
				} catch {
					display = url;
				}
				lib.report.warnings.push({
					kind: "generated-title",
					target: "tab",
					arcId: id,
				});
			}
			out.push({
				kind: "tab",
				arcId: id,
				title: display || "Untitled tab",
				customTitle: title,
				savedTitle,
				url,
			});
		}
	}
	type Frame = { ids: string[]; index: number; out: Node[]; depth: number };
	function visit(ids: string[], section: Node[]) {
		const stack: Frame[] = [{ ids, index: 0, out: section, depth: 0 }];
		while (stack.length) {
			const f = stack[stack.length - 1];
			if (f.index === f.ids.length) {
				stack.pop();
				continue;
			}
			const id = f.ids[f.index++];
			if (anchors.has(id)) continue;
			if (visited.has(id)) {
				lib.report.warnings.push({ kind: "cycle-broken", arcId: id });
				continue;
			}
			const item = items.get(id);
			if (!item) continue;
			visited.add(id);
			const data = nested(item, "data");
			const title = str(item.title);
			const sub = children(id);
			let out = f.out,
				depth = f.depth;
			if (depth >= 62) {
				let bucket = deepBuckets.get(section);
				if (!bucket) {
					bucket = [];
					section.push({
						kind: "folder",
						arcId: fresh("deep"),
						title: "Deeply nested items",
						children: bucket,
					});
					deepBuckets.set(section, bucket);
				}
				out = bucket;
				depth = 1;
				lib.report.warnings.push({ kind: "depth-limited", arcId: id });
			}
			if (Object.hasOwn(data, "tab")) {
				appendTab(id, data, title, out);
			} else if (Object.hasOwn(data, "splitView"))
				lib.report.warnings.push({ kind: "split-view-flattened", arcId: id });
			else if (
				Object.hasOwn(data, "list") ||
				(Object.keys(data).length === 0 &&
					(sub.length || title || Array.isArray(item.childrenIds)))
			) {
				const next: Node[] = [];
				out.push({
					kind: "folder",
					arcId: id,
					title: title || "Untitled folder",
					children: next,
				});
				if (!title)
					lib.report.warnings.push({
						kind: "generated-title",
						target: "folder",
						arcId: id,
					});
				out = next;
				depth++;
			} else
				lib.report.skipped.push({
					arcId: id,
					reason: "unsupported-kind",
					detail: Object.keys(data)[0] ?? "unknown",
				});
			if (sub.length) stack.push({ ids: sub, index: 0, out, depth });
		}
	}
	for (const [id, section] of anchors) {
		const item = items.get(id);
		if (item) {
			const data = nested(item, "data");
			if (Object.hasOwn(data, "tab"))
				appendTab(id, data, str(item.title), section);
		}
		visited.add(id);
		visit(children(id), section);
	}
	let recovered: Node[] | undefined;
	function recover(id: string) {
		if (!recovered) {
			if (!lib.spaces.length)
				lib.spaces.push({
					arcId: fresh("space"),
					title: "Recovered space",
					titleGenerated: true,
					profile: null,
					color: null,
					icon: null,
					pinned: [],
					today: [],
				});
			recovered = [];
			lib.spaces[0].pinned.push({
				kind: "folder",
				arcId: fresh("recovered"),
				title: "Recovered items",
				children: recovered,
			});
		}
		lib.report.warnings.push({ kind: "orphan-recovered", arcId: id });
		visit([id], recovered);
	}
	// Recover orphan roots first, preserving their descendants even in reverse file order.
	for (const [id, row] of items)
		if (!visited.has(id) && !items.has(str(row.parentID) ?? "")) recover(id);
	for (const id of items.keys()) if (!visited.has(id)) recover(id);
	return summarize(lib);
}
