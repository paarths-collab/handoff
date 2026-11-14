import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { Window } from "happy-dom";
import {
	generate,
	sidebar,
	snapshot,
	wrap,
} from "../../../scripts/gen-fixture";
import { anonymize } from "../../../scripts/anonymize";
import {
	assertConserved,
	defaultOptions,
	isBookmarkableUrl,
	parseArcSidebar,
	parseInput,
	parsePack,
	planImport,
	toArchiveHtml,
	toBookmarksHtml,
	toCsv,
	toDiagnostic,
	toPackJson,
} from "../src";
import { sections, walk } from "../src/tree";
import type { Library } from "../src";

function get(text: string): Library {
	const result = parseInput(text);
	if (!result.ok) throw new Error(result.error.kind);
	return result.value;
}
const fixture = (name: string) =>
	get(readFileSync("fixtures/" + name + ".json", "utf8"));
function flatten(lib: Library) {
	return [...sections(lib)].flatMap(({ nodes }) =>
		[...walk(nodes)].map((r) => r.node).filter((n) => n.kind === "tab"),
	);
}

describe("published synthetic fixtures", () => {
	for (const name of readdirSync("fixtures").filter((n) => n.endsWith(".json")))
		it(name, () => {
			const text = readFileSync("fixtures/" + name, "utf8");
			expect(snapshot(text)).toEqual(
				JSON.parse(readFileSync("fixtures/expected/" + name, "utf8")),
			);
			const result = parseInput(text);
			if (!result.ok) return;
			const lib = result.value;
			const raw = JSON.parse(text);
			const data = raw.sidebar.containers.find((v: Record<string, unknown>) =>
				Array.isArray(v.items),
			);
			const inputIds = data.items
				.filter((item: { data?: { tab?: unknown } }) => item.data?.tab)
				.map((item: { id: string }) => item.id);
			expect(
				flatten(lib)
					.map((t) => t.arcId)
					.sort(),
			).toEqual(inputIds.sort());
			const plan = planImport(lib, defaultOptions(lib));
			assertConserved(
				lib,
				plan.windows.flatMap((w) => w.tabs.map((t) => t.arcId)),
				plan.skipped.map((s) => s.arcId),
			);
			const packed = get(toPackJson(lib));
			assertConserved(
				lib,
				flatten(packed).map((t) => t.arcId),
				[],
			);
			expect(packed).toEqual(lib);
		});
});
it("10,000 random JSON values return a typed result", () => {
	fc.assert(
		fc.property(
			fc.jsonValue({ maxDepth: 3 }),
			(v) => typeof parseInput(JSON.stringify(v)).ok === "boolean",
		),
		{ numRuns: 10_000, seed: 418 },
	);
});
it("generated sidebar and planner conserve every input tab", () => {
	fc.assert(
		fc.property(
			fc.integer({ min: 0, max: 120 }),
			fc.integer({ min: 1, max: 8 }),
			fc.integer({ min: 0, max: 15 }),
			fc.boolean(),
			(tabs, spaces, folders, skip) => {
				const lib = get(JSON.stringify(wrap(sidebar(tabs, spaces, folders))));
				expect(lib.report.counts.tabs).toBe(tabs);
				const opts = defaultOptions(lib);
				if (skip) {
					opts.spaceIds = opts.spaceIds.slice(1);
					opts.today = "skip";
					opts.favorites = "skip";
				}
				const plan = planImport(lib, opts);
				assertConserved(
					lib,
					plan.windows.flatMap((w) => w.tabs.map((t) => t.arcId)),
					plan.skipped.map((s) => s.arcId),
				);
			},
		),
		{ numRuns: 120, seed: 719 },
	);
});
it("rejects oversized input and tolerates 100,000 nested levels", () => {
	expect(parseInput(" ".repeat(100 * 1024 * 1024 + 1))).toMatchObject({
		ok: false,
		error: { kind: "too-large" },
	});
	expect(
		parseInput("[".repeat(100000) + "0" + "]".repeat(100000)),
	).toMatchObject({ ok: false, error: { kind: "not-arc-file" } });
	expect(parseInput("{}")).toMatchObject({
		ok: false,
		error: { kind: "not-arc-file" },
	});
	expect(parseArcSidebar('{"sidebar":{"containers":[]}}')).toMatchObject({
		ok: false,
		error: { kind: "no-sidebar-data" },
	});
});
it("bounds deep folder output and honors ordered sections with mixed ID/value arrays", () => {
	const raw = sidebar(2, 1, 210);
	for (let i = 1; i < 210; i++)
		raw.items.find((r) => r.id === "folder-" + i)!.parentID =
			"folder-" + (i - 1);
	raw.items.at(-1)!.parentID = "folder-209";
	raw.items.find((r) => r.id === "p-0")!.childrenIds = ["folder-0"];
	const lib = get(
		JSON.stringify(
			wrap({
				...raw,
				items: raw.items.flatMap((v) => [v.id, v]),
				spaces: raw.spaces.flatMap((v) => [v.id, v]),
			}),
		),
	);
	expect(lib.report.warnings.some((w) => w.kind === "depth-limited")).toBe(
		true,
	);
	expect(
		Math.max(...[...walk(lib.spaces[0].pinned)].map((r) => r.path.length)),
	).toBeLessThan(64);
	expect(get(toPackJson(lib))).toEqual(lib);
});
it("handles special keys, missing and duplicate ids, and a missing URL", () => {
	const raw = sidebar(3);
	raw.items.at(-1)!.id = "__proto__";
	raw.items.at(-2)!.id = "constructor";
	raw.items.at(-3)!.id = "constructor";
	raw.items.push({ id: "bad", parentID: "p-0", data: { tab: {} } });
	const lib = get(JSON.stringify(wrap(raw)));
	expect(flatten(lib)).toHaveLength(3);
	expect(lib.report.skipped).toEqual([
		{ arcId: "bad", reason: "no-url", detail: "tab" },
	]);
	expect(get(toPackJson(lib))).toEqual(lib);
	expect(Object.prototype).not.toHaveProperty("polluted");
});
it("validates pack shapes and recomputes counts and source hash", () => {
	const pack = JSON.parse(toPackJson(fixture("tiny")));
	pack.library.report.counts.tabs = 9999;
	pack.library.source.sourceHash = "spoof";
	const lib = get(JSON.stringify(pack));
	expect(lib.report.counts.tabs).toBe(3);
	expect(lib.source.sourceHash).not.toBe("spoof");
	pack.library.spaces[0].today[0].arcId = lib.spaces[0].pinned[0].arcId;
	expect(parsePack(JSON.stringify(pack))).toMatchObject({
		ok: false,
		error: { kind: "invalid-pack" },
	});
	pack.schemaVersion = 4;
	expect(parsePack(JSON.stringify(pack))).toMatchObject({
		ok: false,
		error: { kind: "unsupported-pack-version" },
	});
	expect(parsePack("null")).toMatchObject({
		ok: false,
		error: { kind: "invalid-pack" },
	});
});
it("respects childrenIds order with missing items appended and a warning", () => {
	const raw = sidebar(3);
	raw.items.find((r) => r.id === "p-0")!.childrenIds = ["tab-2", "bogus"];
	const lib = get(JSON.stringify(wrap(raw)));
	expect(lib.spaces[0].pinned.map((n) => n.arcId)).toEqual(["tab-2", "tab-0"]);
	expect(lib.report.warnings).toContainEqual({
		kind: "order-mismatch",
		parentArcId: "p-0",
	});
});
it("applies sections, folder grouping, colors, selections, flattening and duplicate policies", () => {
	const raw = sidebar(10, 2, 2);
	Object.assign(raw.spaces[0], { color: "#ff0000" });
	const lib = get(JSON.stringify(wrap(raw)));
	// Native pinning remains an explicit option; the default groups pinned tabs instead.
	const opts = { ...defaultOptions(lib), pinned: "native" as const };
	let plan = planImport(lib, opts);
	expect(plan.windows).toHaveLength(2);
	expect(plan.windows[0].tabs[0]).toMatchObject({
		arcId: "tab-0",
		pinned: true,
		groupKey: null,
	});
	expect(plan.windows[0].groups[0]).toMatchObject({
		color: "red",
		collapsed: true,
		title: "Folder 1",
	});
	expect(plan.notes.join(" ")).toContain("became group tabs");
	plan = planImport(lib, { ...opts, spaceMode: "group" });
	expect(plan.windows).toHaveLength(1);
	expect(plan.windows[0].groups.map((g) => g.title)).toContain(
		"Space 1 / Folder 1",
	);
	plan = planImport(lib, {
		...opts,
		folderMode: "flatten",
		today: "skip",
		favorites: "skip",
		spaceIds: [lib.spaces[0].arcId],
	});
	expect(plan.windows[0].groups).toHaveLength(0);
	expect(plan.windows[0].tabs.every((t) => t.pinned)).toBe(true);
	expect(plan.skipped.every((t) => t.reason === "by-choice")).toBe(true);
	const dup = fixture("duplicates");
	plan = planImport(dup, {
		...defaultOptions(dup),
		skipUrls: new Set([" https://same.test/p "]),
	});
	expect(plan.skipped).toHaveLength(4);
	expect(plan.skipped.every((s) => s.reason === "duplicate")).toBe(true);
	const schemes = fixture("schemes");
	plan = planImport(schemes, {
		...defaultOptions(schemes),
		openableSchemes: ["javascript:", "https:"],
	});
	expect(plan.totals.tabs).toBe(1);
	expect(plan.skipped.map((s) => s.reason)).toContain("empty-url");
});
it("parses 5,000 tabs and builds their plan within budget", () => {
	const text = JSON.stringify(wrap(sidebar(5000, 4, 40)));
	const start = performance.now();
	const lib = get(text);
	const parsed = performance.now();
	const plan = planImport(lib, defaultOptions(lib));
	expect(plan.totals.tabs).toBe(5000);
	expect(parsed - start).toBeLessThan(200);
	expect(performance.now() - start).toBeLessThan(300);
});

it.each(["tiny", "deep", "special-chars", "schemes", "duplicates"])(
	"round-trips all exported rows in %s",
	async (name) => {
		const lib = fixture(name),
			// Bookmark files leave out script-capable links such as javascript:.
			tabs = flatten(lib).filter((t) => isBookmarkableUrl(t.url)),
			dropped = flatten(lib).filter((t) => !isBookmarkableUrl(t.url)),
			win = new Window({ settings: { disableJavaScriptEvaluation: true } });
		try {
			const doc = new win.DOMParser().parseFromString(
				toBookmarksHtml(lib),
				"text/html",
			);
			const links = [...doc.querySelectorAll("a")];
			const actualTree = [...doc.querySelectorAll("h3, a")].map((el) => {
				const path: string[] = [];
				for (
					let dl = el.closest("dl");
					dl;
					dl = dl.parentElement?.closest("dl") ?? null
				) {
					const label = dl.previousElementSibling;
					if (label?.tagName === "H3") path.unshift(label.textContent);
				}
				return { path, title: el.textContent, url: el.getAttribute("href") };
			});
			const expectedTree: {
				path: string[];
				title: string;
				url: string | null;
			}[] = [];
			for (const section of sections(lib)) {
				const sectionPath = section.space ? [section.space.title] : [];
				if (section.name === "Pinned")
					expectedTree.push({
						path: [],
						title: section.space!.title,
						url: null,
					});
				expectedTree.push({
					path: sectionPath,
					title: section.name,
					url: null,
				});
				for (const { node, path } of walk(section.nodes))
					if (node.kind === "folder" || isBookmarkableUrl(node.url))
						expectedTree.push({
							path: [...sectionPath, section.name, ...path],
							title: node.title,
							url: node.kind === "tab" ? node.url : null,
						});
			}
			expect(actualTree).toEqual(expectedTree);
			expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(
				tabs.map((t) => [t.title, t.url]),
			);
			expect(
				[...doc.querySelectorAll("h3")].map((h) => h.textContent),
			).toContain("Favorites");
			function idsFor(rows: string[][]) {
				const available = new Map<string, string[]>();
				for (const t of flatten(lib)) {
					const k = JSON.stringify([t.title, t.url]);
					available.set(k, [...(available.get(k) ?? []), t.arcId]);
				}
				return rows.map(
					(pair) => available.get(JSON.stringify(pair))?.shift() ?? "invalid",
				);
			}
			assertConserved(
				lib,
				idsFor(links.map((a) => [a.textContent, a.getAttribute("href") ?? ""])),
				dropped.map((t) => t.arcId),
			);
			// Empty links are dropped too; Move already skips them as "empty-url".
			if (name === "schemes")
				expect(dropped.map((t) => t.url.split(":")[0])).toEqual([
					"javascript",
					"",
				]);
			const archive = new win.DOMParser().parseFromString(
				toArchiveHtml(lib),
				"text/html",
			);
			expect(archive.querySelectorAll("script")).toHaveLength(2);
			expect(archive.querySelectorAll("img,iframe,[onerror]")).toHaveLength(0);
			const archived = get(archive.querySelector("#pack")!.textContent);
			assertConserved(
				lib,
				flatten(archived).map((t) => t.arcId),
				[],
			);
			for (const a of archive.querySelectorAll("a"))
				expect(a.getAttribute("href")).toMatch(/^(https?:|mailto:)/);
			const actualHash = createHash("sha256")
				.update(archive.querySelector("script:not([type])")!.textContent)
				.digest("base64");
			expect(
				archive.querySelector("meta[http-equiv]")!.getAttribute("content"),
			).toContain("sha256-" + actualHash);
			const csv = toCsv(lib);
			const rows = csv
				.trimEnd()
				.split("\r\n")
				.slice(1)
				.map((line) =>
					[...line.matchAll(/"((?:[^"]|"")*)"(?=,|$)/g)].map((m) =>
						m[1].replaceAll('""', '"').replace(/^'(?=[=@+\-\t\r])/u, ""),
					),
				);
			assertConserved(lib, idsFor(rows.map((c) => [c[4], c[5]])), []);
			if (name === "special-chars") expect(csv).toContain("\"'=");
		} finally {
			await win.happyDOM.close();
		}
	},
);
it("emits only aggregate diagnostics", () => {
	const lib = fixture("typical"),
		diag = toDiagnostic(lib, "1.0.0");
	for (const t of flatten(lib)) {
		expect(diag).not.toContain(t.title);
		expect(diag).not.toContain(t.url);
		expect(diag).not.toContain(t.arcId);
	}
	expect(JSON.parse(diag).counts).toEqual(lib.report.counts);
});
it("anonymizes titles, URLs, ids and unrelated metadata while retaining structure", () => {
	const raw = wrap(sidebar(20, 3, 4)),
		before = get(JSON.stringify(raw));
	Object.assign(raw, { opaqueMetadata: "secret detail" });
	const out = JSON.stringify(anonymize(raw)),
		after = get(out);
	expect(after.report.counts).toEqual(before.report.counts);
	expect(out).not.toContain("secret detail");
	expect(out).not.toContain("folder-0");
	expect(out).not.toContain("Space 1");
	expect([...generate().keys()]).toHaveLength(16);
});

it.each(["p-0", "u-0", "fav"])(
	"conserves a tab and children at a section anchor %s",
	(id) => {
		const raw = sidebar(3);
		const anchor = raw.items.find((r) => r.id === id)!;
		anchor.title = "Named anchor tab";
		anchor.data = { tab: { savedURL: "https://anchor.test/p" } };
		const lib = get(JSON.stringify(wrap(raw)));
		expect(flatten(lib)).toHaveLength(4);
		const section =
			id === "fav"
				? lib.favorites
				: id === "p-0"
					? lib.spaces[0].pinned
					: lib.spaces[0].today;
		expect(section[0]).toMatchObject({
			arcId: id,
			kind: "tab",
			title: "Named anchor tab",
			url: "https://anchor.test/p",
		});
		expect(get(toPackJson(lib))).toEqual(lib);
		anchor.data = { tab: {} };
		const missing = get(JSON.stringify(wrap(raw)));
		expect(
			flatten(missing)
				.map((n) => n.arcId)
				.sort(),
		).toEqual(["tab-0", "tab-1", "tab-2"]);
		expect(missing.report.skipped).toEqual([
			{ arcId: id, reason: "no-url", detail: "tab" },
		]);
	},
);

it("makes native groups contiguous in first-encounter order and keeps ungrouped neighbors", () => {
	const raw = sidebar(0);
	raw.items.push(
		{ id: "parent", parentID: "u-0", title: "Parent", data: { list: {} } },
		{ id: "child", parentID: "parent", title: "Child", data: { list: {} } },
	);
	for (const [id, parentID] of [
		["before", "u-0"],
		["first", "parent"],
		["nested", "child"],
		["second", "parent"],
		["after", "u-0"],
	]) {
		raw.items.push({
			id,
			parentID,
			data: { tab: { savedURL: "https://site.test/" + id } },
		});
	}
	raw.items.find((r) => r.id === "u-0")!.childrenIds = [
		"before",
		"parent",
		"after",
	];
	raw.items.find((r) => r.id === "parent")!.childrenIds = [
		"first",
		"child",
		"second",
	];
	const lib = get(JSON.stringify(wrap(raw)));
	const plan = planImport(lib, defaultOptions(lib));
	expect(plan.windows[0].groups.map((g) => g.title)).toEqual([
		"Parent",
		"Parent / Child",
	]);
	expect(plan.windows[0].tabs.map((t) => [t.arcId, t.groupKey])).toEqual([
		["before", null],
		["first", "group-0"],
		["second", "group-0"],
		["nested", "group-1"],
		["after", null],
	]);
	expect(plan.notes).toContain(
		"Tab order was adjusted to keep pinned tabs first and each browser group together.",
	);
	const flat = planImport(lib, {
		...defaultOptions(lib),
		folderMode: "flatten",
	});
	expect(flat.notes).toEqual([]);
	expect(flat.windows[0].tabs.map((t) => t.arcId)).toEqual([
		"before",
		"first",
		"nested",
		"second",
		"after",
	]);
});

it.each([
	["#ff0000", "red"],
	["#ff7f00", "orange"],
	["#ffff00", "yellow"],
	["#00ff00", "green"],
	["#00ffff", "cyan"],
	["#0000ff", "blue"],
	["#8800ff", "purple"],
	["#ff0099", "pink"],
	["#888888", "grey"],
	["invalid", "blue"],
])("maps Space color %s to %s", (hex, color) => {
	const lib = fixture("deep");
	lib.spaces[0].color = hex;
	const plan = planImport(lib, {
		...defaultOptions(lib),
		collapseGroups: false,
	});
	expect(plan.windows[0].groups.length).toBeGreaterThan(0);
	for (const g of plan.windows[0].groups) {
		expect(g.color).toBe(color);
		expect(g.collapsed).toBe(false);
	}
});

it("reads theme channels, emoji, profile labels and a custom tab title before saved title", () => {
	const raw = sidebar(3);
	const nestedColor = { color: { red: 0, green: 0.5, blue: 1 } };
	const theme = {
		background: {
			single: {
				_0: {
					style: { color: { _0: { blendedSingleColor: { _0: nestedColor } } } },
				},
			},
		},
	};
	Object.assign(raw.spaces[0], {
		customInfo: { windowTheme: theme, iconType: { emoji_v2: "🌿" } },
		profile: { custom: { _0: { directoryBasename: "Profile 7" } } },
	});
	const first = raw.items.find((row) => row.id === "tab-0")!;
	first.title = "Custom title";
	const lib = get(
		"\ufeff" + JSON.stringify({ ...wrap(raw), platform: "macos" }),
	);
	expect(lib.spaces[0]).toMatchObject({
		color: "#0080ff",
		icon: "🌿",
		profile: "Profile 7",
		titleGenerated: false,
	});
	expect(lib.source.platform).toEqual("macos");
	expect(lib.spaces[0].pinned[0]).toMatchObject({
		title: "Custom title",
		customTitle: "Custom title",
		savedTitle: "Title 0000",
	});
	expect(defaultOptions(lib)).toEqual({
		spaceIds: ["space-0"],
		spaceMode: "window",
		folderMode: "groups",
		today: "include",
		favorites: "pinned-first-window",
		pinned: "group",
		collapseGroups: true,
		openableSchemes: ["http:", "https:"],
	});
});

it.each([
	["source", "platform"],
	["source", "parsedAt"],
	["source", "sourceHash"],
	["report", "counts"],
	["report", "warnings"],
	["report", "skipped"],
	["space", "profile"],
	["space", "title"],
	["space", "color"],
	["space", "icon"],
	["space", "pinned"],
	["space", "today"],
	["space", "titleGenerated"],
	["space", "arcId"],
	["tab", "kind"],
	["tab", "title"],
	["tab", "url"],
	["tab", "customTitle"],
	["tab", "savedTitle"],
	["tab", "arcId"],
])("rejects invalid %s.%s before preview", (level, key) => {
	const pack = JSON.parse(toPackJson(fixture("tiny")));
	const parts = new Map([
		["source", pack.library.source],
		["report", pack.library.report],
		["space", pack.library.spaces[0]],
		["tab", pack.library.spaces[0].pinned[0]],
	]);
	parts.get(level)[key] = 19;
	expect(parsePack(JSON.stringify(pack))).toEqual({
		ok: false,
		error: {
			kind: "invalid-pack",
			message: "The pack contains invalid or incomplete library data.",
		},
	});
});

it("measures UTF-8 bytes for inputs below the UTF-16 length limit", () => {
	const limit = 100 * 1024 * 1024;
	// Each Katakana code point uses three bytes. The final emoji adds four.
	const over = "ア".repeat(Math.floor(limit / 3)) + "🌒";
	expect(over.length).toBeLessThan(limit);
	expect(parseInput(over)).toEqual({
		ok: false,
		error: {
			kind: "too-large",
			limitBytes: limit,
			message: "This file exceeds the 100 MiB limit.",
		},
	});
});

it("chooses the data container following global, then falls back to a usable container", () => {
	const first = sidebar(1),
		second = sidebar(2);
	const parseContainers = (containers: unknown[]) =>
		get(JSON.stringify({ sidebar: { containers } }));
	expect(
		parseContainers([first, "unused", { global: {} }, second]).report.counts
			.tabs,
	).toBe(2);
	expect(
		parseContainers([{}, first, { global: {} }, { items: [] }]).report.counts
			.tabs,
	).toBe(1);
	expect(parseContainers([{ items: [] }, second]).report.counts.tabs).toBe(2);
	expect(parseInput('{"sidebar":{}}')).toMatchObject({
		ok: false,
		error: { kind: "no-sidebar-data" },
	});
});

it("assigns unused ids to missing, empty or colliding item identities", () => {
	const raw = sidebar(3);
	const items = raw.items.map((row) => {
		if (row.id === "tab-0") return { ...row, id: "handoff-item-1" };
		if (row.id === "tab-1") return { ...row, id: undefined };
		if (row.id === "tab-2") return { ...row, id: "" };
		return row;
	});
	const lib = get(
		JSON.stringify(wrap({ ...raw, items: ["bare", {}, ...items] })),
	);
	const ids = flatten(lib).map((t) => t.arcId);
	expect(ids).toHaveLength(3);
	expect(ids).toContain("handoff-item-1");
	expect(new Set(ids).size).toBe(3);
	expect(
		lib.report.warnings.filter((w) => w.kind === "unknown-field"),
	).toHaveLength(3);
	expect(get(toPackJson(lib))).toEqual(lib);
});

it("uses supported metadata fallbacks and preserves explicit unknowns", () => {
	const raw = sidebar(3, 3);
	Object.assign(raw.spaces[0], {
		color: "#00ff00",
		icon: "Fallback icon",
		profileID: "Profile ID",
		customInfo: { color: "#ff00ff", icon: "Custom icon" },
	});
	const blend = { _0: { color: { red: 1.5, green: 0, blue: 0 } } };
	const style = { color: { _0: { blendedSingleColor: blend } } };
	const customInfo = {
		windowTheme: { background: { single: { _0: { style } } } },
	};
	Object.assign(raw.spaces[1], {
		color: "#00ff00",
		icon: "Fallback icon",
		profile: "Profile label",
		customInfo,
	});
	Object.assign(raw.spaces[2], { title: null });
	const lib = get(JSON.stringify(wrap(raw)));
	expect(lib.spaces[0]).toMatchObject({
		color: "#ff00ff",
		icon: "Custom icon",
		profile: "Profile ID",
	});
	expect(lib.spaces[1]).toMatchObject({
		color: "#00ff00",
		icon: "Fallback icon",
		profile: "Profile label",
	});
	expect(lib.spaces[2]).toMatchObject({
		title: "Space 3",
		titleGenerated: true,
		color: null,
		icon: null,
		profile: null,
	});
});

it("returns actionable, input-free messages for unsupported or damaged files", () => {
	expect(parseInput(null as unknown as string)).toEqual({
		ok: false,
		error: { kind: "not-json", message: "Choose a JSON file." },
	});
	expect(parseInput("{")).toEqual({
		ok: false,
		error: {
			kind: "not-json",
			message: "The file does not contain complete JSON.",
		},
	});
	expect(parseInput("[]")).toEqual({
		ok: false,
		error: {
			kind: "not-arc-file",
			message: "No Arc sidebar was found.",
			hint: "Choose StorableSidebar.json or a Handoff pack.",
		},
	});
	expect(parseInput('{"sidebar":{}}')).toEqual({
		ok: false,
		error: {
			kind: "no-sidebar-data",
			message: "The sidebar contains no usable data container.",
			hint: "Choose the sidebar file from the Arc application data folder.",
		},
	});
});

it("uses direct Space parents and keyed Favorites, and retains untyped folders and tab title fallbacks", () => {
	const raw = sidebar(0);
	Object.assign(raw.spaces[0], {
		profile: { default: true },
		iconType: { emoji_v2: "📔" },
	});
	raw.items.push({
		id: "untyped-list",
		parentID: "space-0",
		data: {},
		childrenIds: ["host", "raw", "empty"],
	});
	for (const [id, url] of [
		["host", "https://site.test/path"],
		["raw", "unparseable"],
		["empty", ""],
	])
		raw.items.push({
			id,
			parentID: "untyped-list",
			data: { tab: { savedURL: url } },
		});
	raw.items.push({
		id: "starred",
		parentID: "fav",
		data: { tab: { savedURL: "https://fav.test", savedTitle: "Saved" } },
	});
	const lib = get(
		JSON.stringify(wrap({ ...raw, topAppsContainerIDs: { default: "fav" } })),
	);
	expect(lib.spaces[0]).toMatchObject({
		icon: "📔",
		profile: "Default",
		pinned: [
			{
				kind: "folder",
				title: "Untitled folder",
				children: [
					{ arcId: "host", title: "site.test" },
					{ arcId: "raw", title: "unparseable" },
					{ arcId: "empty", title: "Untitled tab" },
				],
			},
		],
	});
	expect(lib.favorites).toMatchObject([{ arcId: "starred", title: "Saved" }]);
	expect(
		lib.report.warnings.filter((w) => w.kind === "order-mismatch"),
	).toEqual([]);
});
