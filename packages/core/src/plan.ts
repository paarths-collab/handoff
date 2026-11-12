import type { Library, TabNode } from "./model";
import type {
	GroupColor,
	ImportOptions,
	ImportPlan,
	PlannedWindow,
} from "./plan-types";
import { sections, walk } from "./tree";

export function defaultOptions(lib: Library): ImportOptions {
	return {
		spaceIds: lib.spaces.map((s) => s.arcId),
		spaceMode: "window",
		folderMode: "groups",
		today: "include",
		favorites: "pinned-first-window",
		collapseGroups: true,
		openableSchemes: ["http:", "https:"],
	};
}
export function isOpenableUrl(
	value: string,
	schemes: readonly string[] = ["http:", "https:"],
): boolean {
	try {
		const url = new URL(value);
		return (
			(url.protocol === "http:" || url.protocol === "https:") &&
			schemes.includes(url.protocol)
		);
	} catch {
		return false;
	}
}

const hues: [GroupColor, number][] = [
	["red", 0],
	["orange", 30],
	["yellow", 55],
	["green", 120],
	["cyan", 185],
	["blue", 220],
	["purple", 270],
	["pink", 325],
];
const colors: GroupColor[] = [
	"blue",
	"red",
	"yellow",
	"green",
	"pink",
	"purple",
	"cyan",
	"orange",
	"grey",
];
function groupColor(hex: string | null, index: number): GroupColor {
	if (!hex || !/^#[a-f\d]{6}$/i.test(hex)) return colors[index % colors.length];
	const [r, g, b] = [1, 3, 5].map((i) =>
		Number.parseInt(hex.slice(i, i + 2), 16),
	);
	const hi = Math.max(r, g, b),
		d = hi - Math.min(r, g, b);
	if (d < 12) return "grey";
	const h =
		((hi === r ? (g - b) / d : hi === g ? 2 + (b - r) / d : 4 + (r - g) / d) *
			60 +
			360) %
		360;
	const diff = (v: number) => Math.min(Math.abs(h - v), 360 - Math.abs(h - v));
	return hues.reduce((best, p) => (diff(p[1]) < diff(best[1]) ? p : best))[0];
}

export function planImport(lib: Library, opts: ImportOptions): ImportPlan {
	const plan: ImportPlan = {
		windows: [],
		skipped: [],
		notes: [],
		totals: { windows: 0, tabs: 0, pinned: 0, groups: 0 },
	};
	const selected = new Set(opts.spaceIds);
	const skipUrls = new Set(Array.from(opts.skipUrls ?? [], (u) => u.trim()));
	const destinations = new Map<string, PlannedWindow>();
	const palette = new Map<string, GroupColor>();
	const groupKeys = new Map<PlannedWindow, Map<string, string>>();
	for (const [i, space] of lib.spaces.entries()) {
		palette.set(space.arcId, groupColor(space.color, i));
		if (!selected.has(space.arcId)) continue;
		let win = opts.spaceMode === "group" ? plan.windows[0] : undefined;
		if (!win) {
			win = {
				key: "window-" + plan.windows.length,
				spaceArcId: space.arcId,
				tabs: [],
				groups: [],
			};
			plan.windows.push(win);
			groupKeys.set(win, new Map());
		}
		destinations.set(space.arcId, win);
	}
	let unpinned = 0;
	function skipReason(
		tab: TabNode,
		enabled: boolean,
	): ImportPlan["skipped"][number]["reason"] | null {
		if (!enabled) return "by-choice";
		if (!tab.url.trim()) return "empty-url";
		if (!isOpenableUrl(tab.url, opts.openableSchemes)) return "scheme";
		return skipUrls.has(tab.url.trim()) ? "duplicate" : null;
	}
	for (const { space, name, nodes } of sections(lib)) {
		const win = space ? destinations.get(space.arcId) : plan.windows[0];
		const enabled =
			!!win &&
			(name !== "Today" || opts.today === "include") &&
			(name !== "Favorites" || opts.favorites !== "skip");
		const folderIds: string[] = [];
		for (const { node, path } of walk(nodes)) {
			if (node.kind === "folder") {
				folderIds[path.length] = node.arcId;
				continue;
			}
			const reason = skipReason(node, enabled);
			if (reason || !win) {
				plan.skipped.push({
					arcId: node.arcId,
					url: node.url,
					reason: reason ?? "by-choice",
				});
				continue;
			}
			const inFolderGroup = opts.folderMode === "groups" && path.length > 0;
			const pinned =
				name === "Favorites" || (name === "Pinned" && !inFolderGroup);
			let groupKey: string | null = null;
			if (!pinned && space && (inFolderGroup || opts.spaceMode === "group")) {
				const id = JSON.stringify([
					space.arcId,
					inFolderGroup ? folderIds[path.length - 1] : null,
				]);
				const keys = groupKeys.get(win)!;
				groupKey = keys.get(id) ?? null;
				if (!groupKey) {
					groupKey = "group-" + plan.totals.groups++;
					keys.set(id, groupKey);
					const parts = [
						...(opts.spaceMode === "group" ? [space.title] : []),
						...(inFolderGroup ? path : []),
					];
					win.groups.push({
						key: groupKey,
						title: parts.join(" / "),
						color: palette.get(space.arcId)!,
						collapsed: opts.collapseGroups,
					});
				}
				if (name === "Pinned") unpinned++;
			}
			win.tabs.push({
				arcId: node.arcId,
				title: node.title,
				url: node.url.trim(),
				pinned,
				groupKey,
			});
			plan.totals.tabs++;
			if (pinned) plan.totals.pinned++;
		}
	}
	// Native browsers place all pinned tabs before the first unpinned tab.
	for (const win of plan.windows)
		win.tabs = win.tabs
			.filter((t) => t.pinned)
			.concat(win.tabs.filter((t) => !t.pinned));
	if (unpinned)
		plan.notes.push(
			unpinned +
				" pinned " +
				(unpinned === 1
					? "tab inside a folder became a group tab"
					: "tabs inside folders became group tabs") +
				".",
		);
	plan.totals.windows = plan.windows.length;
	return plan;
}
