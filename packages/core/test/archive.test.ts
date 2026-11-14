import { expect, it } from "vitest";
import { Window } from "happy-dom";
import { library, tab } from "./builders";
import {
	parseArcArchive,
	recoverArchivedTabs,
	parsePack,
	toPackJson,
	toBookmarksHtml,
	toArchiveHtml,
	toCsv,
	defaultOptions,
	planImport,
	assertConserved,
} from "../src";
import { walk, sections } from "../src/tree";

const apple = (date: string) => Date.parse(date) / 1000 - 978307200;
function entry(
	url = "https://archive.test/p",
	when: unknown = apple("2026-10-01"),
	space = "space-1",
	reason = "auto",
) {
	return {
		reason,
		archivedAt: when,
		source: { space: { _0: space } },
		sidebarItem: {
			title: "Archived title",
			data: { tab: { savedURL: url, savedTitle: "Saved title" } },
		},
	};
}
function archive(items: unknown[]) {
	const parsed = parseArcArchive(JSON.stringify({ items }));
	if (!parsed.ok) throw Error(parsed.error.kind);
	return parsed.value;
}

it("accounts for every record, excluding manual/unknown reasons and unreadable entries", () => {
	const data = archive([
		"id-a",
		entry(),
		"id-b",
		entry("https://manual.test", 0, "space-1", "manual"),
		entry("https://unknown.test", 0, "space-1", "other"),
		null,
		entry(""),
		{ reason: "auto", sidebarItem: {} },
	]);
	expect(data.counts).toEqual({
		entries: 6,
		manual: 1,
		unknownReason: 1,
		invalid: 3,
	});
	expect(data.tabs).toHaveLength(1);
	expect(parseArcArchive("{")).toMatchObject({
		ok: false,
		error: { kind: "not-json" },
	});
	for (const value of [
		{},
		{ items: {} },
		{ items: [], sidebar: {} },
		{ items: [], format: "handoff-pack" },
	])
		expect(parseArcArchive(JSON.stringify(value))).toMatchObject({
			ok: false,
			error: { kind: "not-arc-file" },
		});
	expect(parseArcArchive(" ".repeat(100 * 1024 * 1024 + 1))).toMatchObject({
		ok: false,
		error: { kind: "too-large" },
	});
});

it("keeps the latest exact URL per Space, excludes existing links and uses UTC month folders", () => {
	const base = library();
	base.favorites = [tab("favorite", "https://favorite.test/")];
	const result = recoverArchivedTabs(
		base,
		archive([
			entry("https://archive.test/p", apple("2026-09-30T23:30:00Z")),
			entry("https://archive.test/p", apple("2026-10-01T00:00:00Z")),
			entry("https://archive.test/p", apple("2026-10-01T00:00:00Z")),
			entry(
				base.spaces[0].pinned[0].kind === "tab"
					? base.spaces[0].pinned[0].url
					: "",
			),
			entry("https://favorite.test/"),
			entry("https://earlier.test", apple("2026-09-01")),
		]),
	);
	expect(result.counts).toMatchObject({
		entries: 6,
		recovered: 2,
		duplicates: 4,
	});
	const root = result.library.spaces[0].today[0];
	expect(root).toMatchObject({
		kind: "folder",
		title: "Recovered archive",
		children: [{ title: "2026-10" }, { title: "2026-09" }],
	});
	expect(base.spaces[0].today).toEqual([]);
	expect(result.library.source.sourceHash).not.toBe(base.source.sourceHash);
	expect(
		recoverArchivedTabs(result.library, archive([entry()])).counts,
	).toMatchObject({ recovered: 0, duplicates: 1 });
});

it("preserves unknown dates, missing Spaces, unusual URLs, source IDs and title text through packs/exports", async () => {
	const base = library();
	const url = "javascript:void(0)";
	const first = entry(url, "invalid", "missing");
	first.sidebarItem.title = 'A & "</script>"';
	const second = entry("https://missing.test", null, "other-missing");
	const result = recoverArchivedTabs(
		base,
		archive([first, second, entry("https://invalid-date.test", 1e100)]),
	);
	expect(result.counts).toMatchObject({
		recovered: 3,
		unknownDate: 3,
		missingSpace: 2,
	});
	expect(result.library.spaces).toHaveLength(3);
	expect(result.library.spaces[0].today[0]).toMatchObject({
		title: "Recovered archive",
		children: [{ title: "Unknown date" }],
	});
	const ids = [...sections(result.library)].flatMap((s) =>
		[...walk(s.nodes)].map((r) => r.node.arcId),
	);
	expect(new Set(ids).size).toBe(ids.length);
	expect(parsePack(toPackJson(result.library))).toEqual({
		ok: true,
		value: result.library,
	});
	const plan = planImport(result.library, defaultOptions(result.library));
	expect(plan.skipped).toContainEqual(
		expect.objectContaining({ url, reason: "scheme" }),
	);
	assertConserved(
		result.library,
		plan.windows.flatMap((w) => w.tabs.map((t) => t.arcId)),
		plan.skipped.map((t) => t.arcId),
	);
	expect(toCsv(result.library)).toContain("Recovered archive / Unknown date");
	const win = new Window({ settings: { disableJavaScriptEvaluation: true } });
	try {
		const doc = new win.DOMParser().parseFromString(
			toBookmarksHtml(result.library),
			"text/html",
		);
		// The javascript: tab stays in the pack and CSV but never becomes a clickable bookmark.
		expect(doc.querySelectorAll("a")).toHaveLength(3);
		expect(
			[...doc.querySelectorAll("a")].some((a) =>
				a.getAttribute("href")?.startsWith("javascript:"),
			),
		).toBe(false);
		const output = new win.DOMParser().parseFromString(
			toArchiveHtml(result.library),
			"text/html",
		);
		expect(
			[...output.querySelectorAll("a")].some(
				(a) => a.getAttribute("href") === url,
			),
		).toBe(false);
		expect(output.querySelectorAll("script")).toHaveLength(2);
	} finally {
		await win.happyDOM.close();
	}
});

it("keeps identical archived URLs from separate known Spaces and conserves a large archive", () => {
	const base = library();
	base.spaces.push({
		...base.spaces[0],
		arcId: "space-2",
		pinned: [],
		today: [],
	});
	const items = Array.from({ length: 5000 }, (_, i) =>
		entry(
			"https://archive.test/" + i,
			apple("2026-01-01"),
			i % 2 ? "space-1" : "space-2",
		),
	);
	items.push(entry("https://archive.test/0", apple("2026-02-01"), "space-1"));
	const result = recoverArchivedTabs(base, archive(items));
	expect(result.counts.recovered).toBe(5001);
	expect(result.library.report.counts.tabs).toBe(5002);
	const plan = planImport(result.library, {
		...defaultOptions(result.library),
		today: "skip",
	});
	expect(plan.skipped).toHaveLength(5001);
	assertConserved(
		result.library,
		plan.windows.flatMap((w) => w.tabs.map((t) => t.arcId)),
		plan.skipped.map((t) => t.arcId),
	);
});
