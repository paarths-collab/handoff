import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { it, expect, vi } from "vitest";
import { sidebar, wrap } from "../../../scripts/gen-fixture";
import { library, tab } from "./builders";
import {
	parseInput,
	parsePack,
	toArchiveHtml,
	toBookmarksHtml,
	toCsv,
	toDiagnostic,
	toPackJson,
} from "../src";

function read(text: string) {
	const result = parseInput(text);
	if (!result.ok) throw new Error(result.error.kind);
	return result.value;
}

it("reproduces the reviewed tiny-library golden exports", () => {
	vi.useFakeTimers({ now: new Date("2025-01-02T03:04:05Z"), toFake: ["Date"] });
	try {
		const lib = read(readFileSync("fixtures/tiny.json", "utf8"));
		const golden = (file: string) =>
			readFileSync("packages/core/test/golden/" + file, "utf8");
		expect(toBookmarksHtml(lib)).toBe(golden("bookmarks.html"));
		expect(toArchiveHtml(lib).replaceAll("><", ">\n<") + "\n").toBe(
			golden("archive.html"),
		);
		expect(toCsv(lib)).toBe(golden("tabs.csv"));
		expect(JSON.stringify(JSON.parse(toPackJson(lib)), null, 2) + "\n").toBe(
			golden("pack.json"),
		);
		expect(toDiagnostic(lib, "1.0.0") + "\n").toBe(golden("diagnostic.json"));
	} finally {
		vi.useRealTimers();
	}
});

it("includes Favorites and only the selected Spaces in bookmarks", async () => {
	const win = new Window({ settings: { disableJavaScriptEvaluation: true } });
	try {
		const lib = read(JSON.stringify(wrap(sidebar(8, 2))));
		for (const ids of [[], ["space-1"]]) {
			const doc = new win.DOMParser().parseFromString(
				toBookmarksHtml(lib, { spaceIds: ids }),
				"text/html",
			);
			expect(
				[...doc.querySelectorAll("h3")].map((el) => el.textContent),
			).toEqual(
				ids.length
					? ["Favorites", "Space 2", "Pinned", "Today"]
					: ["Favorites"],
			);
			expect(
				[...doc.querySelectorAll("a")].map((el) => el.textContent),
			).toEqual(
				ids.length
					? [
							"Title 0000",
							"Title 0003",
							"Title 0005",
							"Title 0001",
							"Title 0007",
						]
					: ["Title 0000"],
			);
		}
	} finally {
		await win.happyDOM.close();
	}
});

it.each(["=", "+", "-", "@", "\t", "\r"])(
	"quotes RFC 4180 fields and protects every user-controlled column with prefix %j",
	(prefix) => {
		const lib = library(),
			s = lib.spaces[0];
		s.title = prefix + "Space";
		s.profile = prefix + "Profile";
		const t = tab("first", prefix + "URL");
		t.title = prefix + 'Title, "quoted"\nsecond line';
		s.pinned = [
			{
				kind: "folder",
				arcId: "parent",
				title: prefix + "Parent",
				children: [
					{ kind: "folder", arcId: "child", title: "Child", children: [t] },
				],
			},
		];
		expect(toCsv(lib)).toBe(
			"space,profile,section,folder_path,title,url\r\n" +
				"\"'" +
				prefix +
				'Space","\'' +
				prefix +
				'Profile","Pinned","\'' +
				prefix +
				'Parent / Child","\'' +
				prefix +
				'Title, ""quoted""\nsecond line","\'' +
				prefix +
				'URL"\r\n',
		);
	},
);

it("renders named safe archive links and preserves other URLs as text", async () => {
	const win = new Window({ settings: { disableJavaScriptEvaluation: true } });
	try {
		const lib = library();
		const urls = [
			"http://site.test/a",
			"https://site.test/a",
			"mailto:demo@site.test",
			"about:blank",
			"file:///tmp/sample",
			"chrome://settings",
			"invalid",
			"",
		];
		lib.spaces[0].pinned = urls.map((url, i) => ({
			...tab("t" + i, url),
			title: "Title " + i,
		}));
		const doc = new win.DOMParser().parseFromString(
			toArchiveHtml(lib),
			"text/html",
		);
		expect(
			[...doc.querySelectorAll("small")].map((el) => el.textContent),
		).toEqual(urls);
		expect(
			[...doc.querySelectorAll("a")].map((el) => [
				el.textContent,
				el.getAttribute("href"),
				el.getAttribute("rel"),
			]),
		).toEqual(
			urls.slice(0, 3).map((u, i) => ["Title " + i, u, "noopener noreferrer"]),
		);
		expect([...doc.querySelectorAll("li")].map((el) => el.textContent)).toEqual(
			urls.map((u, i) => "Title " + i + u),
		);
		expect(doc.querySelector("input[type=search]")!.id).toBe(
			doc.querySelector("label")!.getAttribute("for"),
		);
	} finally {
		await win.happyDOM.close();
	}
});

it("aggregates repeated warning and skipped-kind counts and redacts unknown kinds", () => {
	const raw = sidebar(0);
	for (const [i, detail] of [
		"notes",
		"notes",
		"easel",
		"opaque-kind",
		"opaque-kind",
	].entries())
		raw.items.push({
			id: "unsupported-" + i,
			parentID: "missing",
			data: { [detail]: {} },
		});
	const lib = read(JSON.stringify(wrap(raw)));
	const diag = JSON.parse(toDiagnostic(lib, "unexpected-version"));
	expect(diag).toMatchObject({
		appVersion: "unknown",
		counts: { skipped: 5 },
		skippedKinds: { notes: 2, easel: 1, other: 2 },
		warnings: { "orphan-recovered": 5 },
	});
	expect(JSON.stringify(diag)).not.toContain("opaque-kind");
	expect(toArchiveHtml(lib)).toContain("<summary>Skipped items</summary>");
});

it("recovers orphan-only sidebars and supplies missing metadata, labels and source defaults", () => {
	const lib = read(
		JSON.stringify(
			wrap({
				spaces: [],
				items: [
					{
						id: "lonely",
						parentID: "lost",
						data: { tab: { savedURL: "https://orphan.test/p" } },
					},
				],
			}),
		),
	);
	expect(lib.source.platform).toBe("unknown");
	expect(lib.report.counts).toEqual({
		spaces: 1,
		tabs: 1,
		folders: 1,
		favorites: 0,
		today: 0,
		skipped: 0,
	});
	expect(lib.spaces[0]).toMatchObject({
		title: "Recovered space",
		titleGenerated: true,
		icon: null,
		profile: null,
		color: null,
		today: [],
		pinned: [
			{
				title: "Recovered items",
				children: [
					{
						title: "orphan.test",
						customTitle: null,
						savedTitle: null,
						arcId: "lonely",
					},
				],
			},
		],
	});
	expect(lib.report.warnings).toEqual([
		{ kind: "orphan-recovered", arcId: "lonely" },
		{ kind: "generated-title", target: "tab", arcId: "lonely" },
	]);
	expect(parsePack(toPackJson(lib))).toEqual({ ok: true, value: lib });
});

it.each(["profile", "icon", "color", "savedTitle", "customTitle"])(
	"preserves explicit null and rejects an omitted pack field %s",
	(field) => {
		const pack = JSON.parse(toPackJson(library()));
		const obj =
			field === "savedTitle" || field === "customTitle"
				? pack.library.spaces[0].pinned[0]
				: pack.library.spaces[0];
		obj[field] = null;
		expect(parsePack(JSON.stringify(pack)).ok).toBe(true);
		delete obj[field];
		expect(parsePack(JSON.stringify(pack))).toMatchObject({
			ok: false,
			error: { kind: "invalid-pack" },
		});
	},
);
