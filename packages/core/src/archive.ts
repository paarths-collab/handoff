import type { Library, ParseError, FolderNode, Node, Space } from "./model";
import type { Result } from "./result";
import { readJson } from "./json";
import { isRecord } from "./pack-format";
import { sections, summarize, walk } from "./tree";

interface ArchivedTab {
	url: string;
	title: string;
	customTitle: string | null;
	savedTitle: string | null;
	spaceId: string | null;
	archivedAt: number | null;
}
export interface ArcArchive {
	tabs: ArchivedTab[];
	counts: {
		entries: number;
		manual: number;
		unknownReason: number;
		invalid: number;
	};
}
export interface ArchiveRecoveryResult {
	library: Library;
	counts: ArcArchive["counts"] & {
		recovered: number;
		duplicates: number;
		unknownDate: number;
		missingSpace: number;
	};
}
const text = (value: unknown) => (typeof value === "string" ? value : null);
const appleEpoch = 978307200;

export function parseArcArchive(input: string): Result<ArcArchive, ParseError> {
	const decoded = readJson(input);
	if (!decoded.ok) return decoded;
	const raw = decoded.value;
	if (
		!isRecord(raw) ||
		!Array.isArray(raw.items) ||
		"sidebar" in raw ||
		"format" in raw
	) {
		return {
			ok: false,
			error: {
				kind: "not-arc-file",
				message: "No Arc archive was found.",
				hint: "Choose StorableArchiveItems.json from the same folder as your sidebar.",
			},
		};
	}
	const archive: ArcArchive = {
		tabs: [],
		counts: { entries: 0, manual: 0, unknownReason: 0, invalid: 0 },
	};
	// Some versions alternate IDs and records. IDs identify entries, not tabs.
	for (const entry of raw.items) {
		if (typeof entry === "string") continue;
		archive.counts.entries++;
		if (!isRecord(entry)) {
			archive.counts.invalid++;
			continue;
		}
		if (entry.reason === "manual") {
			archive.counts.manual++;
			continue;
		}
		if (entry.reason !== "auto") {
			archive.counts.unknownReason++;
			continue;
		}
		const item = isRecord(entry.sidebarItem) ? entry.sidebarItem : {};
		const data = isRecord(item.data) ? item.data : {};
		const tab = isRecord(data.tab) ? data.tab : {};
		const url = text(tab.savedURL);
		if (!url?.trim()) {
			archive.counts.invalid++;
			continue;
		}
		const source = isRecord(entry.source) ? entry.source : {};
		const space = isRecord(source.space) ? source.space : {};
		const date =
			typeof entry.archivedAt === "number" &&
			Number.isFinite(entry.archivedAt) &&
			Number.isFinite(
				new Date((entry.archivedAt + appleEpoch) * 1000).getTime(),
			)
				? entry.archivedAt
				: null;
		const customTitle = text(item.title),
			savedTitle = text(tab.savedTitle);
		archive.tabs.push({
			url,
			title: customTitle || savedTitle || url,
			customTitle,
			savedTitle,
			spaceId: text(space._0),
			archivedAt: date,
		});
	}
	return { ok: true, value: archive };
}

/** Merge into ordinary folders so existing planners, packs and exporters share one tree. */
export function recoverArchivedTabs(
	base: Library,
	archive: ArcArchive,
): ArchiveRecoveryResult {
	const library = structuredClone(base);
	const counts = {
		...archive.counts,
		recovered: 0,
		duplicates: 0,
		unknownDate: 0,
		missingSpace: 0,
	};
	const ids = new Set<string>(library.report.skipped.map((item) => item.arcId));
	const spaces = new Map(library.spaces.map((space) => [space.arcId, space]));
	for (const space of library.spaces) ids.add(space.arcId);
	const urls = new Map<string, Set<string>>();
	const favorites = new Set<string>();
	for (const section of sections(library)) {
		const seen = section.space
			? (urls.get(section.space.arcId) ?? new Set<string>())
			: favorites;
		for (const { node } of walk(section.nodes)) {
			ids.add(node.arcId);
			if (node.kind === "tab") seen.add(node.url);
		}
		if (section.space) urls.set(section.space.arcId, seen);
	}
	let serial = 0;
	function fresh() {
		let id: string;
		do {
			id = "handoff-archive-" + ++serial;
		} while (ids.has(id));
		ids.add(id);
		return id;
	}
	// Keep the latest occurrence of an exact URL per source Space, including tied dates.
	const candidates = new Map<string | null, Map<string, ArchivedTab>>();
	for (const tab of archive.tabs) {
		let bucket = candidates.get(tab.spaceId);
		if (!bucket) {
			bucket = new Map();
			candidates.set(tab.spaceId, bucket);
		}
		const previous = bucket.get(tab.url);
		if (previous) counts.duplicates++;
		if (
			!previous ||
			(tab.archivedAt ?? -Infinity) > (previous.archivedAt ?? -Infinity)
		)
			bucket.set(tab.url, tab);
	}
	let recoveredSpaces = 0;
	for (const [sourceId, tabs] of candidates) {
		let space: Space | undefined =
			sourceId === null ? undefined : spaces.get(sourceId);
		const months = new Map<string, Node[]>();
		for (const tab of tabs.values()) {
			if (
				favorites.has(tab.url) ||
				(sourceId !== null && urls.get(sourceId)?.has(tab.url))
			) {
				counts.duplicates++;
				continue;
			}
			const month =
				tab.archivedAt === null
					? "Unknown date"
					: new Date((tab.archivedAt + appleEpoch) * 1000)
							.toISOString()
							.slice(0, 7);
			if (tab.archivedAt === null) counts.unknownDate++;
			if (!space) counts.missingSpace++;
			const nodes = months.get(month) ?? [];
			nodes.push({
				kind: "tab",
				arcId: fresh(),
				url: tab.url,
				title: tab.title,
				customTitle: tab.customTitle,
				savedTitle: tab.savedTitle,
			});
			months.set(month, nodes);
			counts.recovered++;
		}
		if (months.size === 0) continue;
		if (!space) {
			space = {
				arcId: fresh(),
				title: "Recovered archived Space " + ++recoveredSpaces,
				titleGenerated: true,
				profile: null,
				color: null,
				icon: null,
				pinned: [],
				today: [],
			};
			library.spaces.push(space);
		}
		const children: FolderNode[] = [...months.keys()]
			.sort((a, b) =>
				a === "Unknown date"
					? 1
					: b === "Unknown date"
						? -1
						: b.localeCompare(a),
			)
			.map((month) => ({
				kind: "folder",
				arcId: fresh(),
				title: month,
				children: months.get(month)!,
			}));
		// Today keeps recovered tabs unpinned. Existing Today options apply to recovery too.
		space.today.push({
			kind: "folder",
			arcId: fresh(),
			title: "Recovered archive",
			children,
		});
	}
	return { library: summarize(library), counts };
}
