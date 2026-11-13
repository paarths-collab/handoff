import { describe, expect, it } from "vitest";
import { defaultOptions, isOpenableUrl, planImport } from "../src/plan";
import type { FolderNode, Library, Node, Space } from "../src/model";
import { library, space, tab } from "./builders";

function folder(arcId: string, title: string, children: Node[]): FolderNode {
	return { kind: "folder", arcId, title, children };
}

function lib(spaces: Space[], favorites: Node[] = []): Library {
	return { ...library(), spaces, favorites };
}

// Native pinning is opt-in; the default keeps pinned tabs in groups.
function native(l: Library) {
	return { ...defaultOptions(l), pinned: "native" as const };
}

// One Space per colour, each holding a single folder so the planner creates a group.
function groupColors(colors: (string | null)[]): string[] {
	const spaces = colors.map((color, i) => ({
		...space(`space-${i}`),
		color,
		pinned: [],
		today: [folder(`f-${i}`, "Folder", [tab(`t-${i}`)])],
	}));
	const l = lib(spaces);
	return planImport(l, defaultOptions(l)).windows.map((w) => w.groups[0].color);
}

describe("group colour selection", () => {
	it("maps Space colours to the nearest group hue", () => {
		expect(
			groupColors([
				"#ff0000",
				"#ff8000",
				"#ffdd00",
				"#00ff00",
				"#00ffff",
				"#0055ff",
				"#8000ff",
				"#ff00aa",
			]),
		).toEqual([
			"red",
			"orange",
			"yellow",
			"green",
			"cyan",
			"blue",
			"purple",
			"pink",
		]);
	});

	it("computes hue from the dominant channel and wraps around red", () => {
		// Green-dominant with red above blue, blue-dominant with green above red,
		// and a hue of about 351 degrees, which is closest to red across the wrap.
		expect(groupColors(["#c0ff00", "#0080ff", "#ff0026"])).toEqual([
			"yellow",
			"blue",
			"red",
		]);
	});

	it("treats low-saturation colours as grey only below the threshold", () => {
		expect(groupColors(["#808080", "#7a8085", "#748080"])).toEqual([
			"grey",
			"grey",
			"cyan",
		]);
	});

	it("cycles the palette by Space index for missing or malformed colours", () => {
		const cycled = groupColors(Array.from({ length: 10 }, () => null));
		expect(cycled).toEqual([
			"blue",
			"red",
			"yellow",
			"green",
			"pink",
			"purple",
			"cyan",
			"orange",
			"grey",
			"blue",
		]);
		expect(groupColors(["#ff0000x", "x#ff0000"])).toEqual(["blue", "red"]);
	});
});

describe("pinned tabs, notes and totals", () => {
	it("counts root pinned tabs and reports pinned folder tabs that became group tabs", () => {
		const s: Space = {
			...space("s"),
			pinned: [tab("p1"), folder("f", "Work", [tab("p2"), tab("p3")])],
			today: [folder("tf", "Later", [tab("t1")])],
		};
		const plan = planImport(lib([s]), native(lib([s])));
		expect(plan.totals).toEqual({ windows: 1, tabs: 4, pinned: 1, groups: 2 });
		expect(plan.windows[0].key).toBe("window-0");
		expect(plan.notes).toContain(
			"2 pinned tabs inside folders became group tabs.",
		);
	});

	it("uses the singular note for one pinned folder tab", () => {
		const s: Space = {
			...space("s"),
			pinned: [folder("f", "Work", [tab("p2")])],
		};
		const plan = planImport(lib([s]), native(lib([s])));
		expect(plan.notes).toContain(
			"1 pinned tab inside a folder became a group tab.",
		);
		expect(plan.totals.pinned).toBe(0);
	});

	it("moves later pinned tabs ahead of earlier unpinned tabs in a shared window", () => {
		const a: Space = { ...space("a"), pinned: [], today: [tab("a-today")] };
		const b: Space = { ...space("b"), pinned: [tab("b-pinned")], today: [] };
		const l = lib([a, b]);
		const plan = planImport(l, { ...native(l), spaceMode: "group" });
		expect(plan.windows[0].tabs.map((t) => [t.arcId, t.pinned])).toEqual([
			["b-pinned", true],
			["a-today", false],
		]);
	});
});

describe("pinned tabs kept as groups (default)", () => {
	it("groups Favorites and root pinned tabs by section, keeping pinned folders as folder groups", () => {
		const s: Space = {
			...space("s"),
			color: "#00ff00",
			pinned: [tab("p1"), folder("f", "Work", [tab("p2")]), tab("p3")],
			today: [tab("t1")],
		};
		const l = lib([s], [tab("fav", "https://fav.test/")]);
		const plan = planImport(l, defaultOptions(l));
		const win = plan.windows[0];
		expect(win.groups.map((g) => [g.title, g.color])).toEqual([
			["Favorites", "green"],
			["Pinned", "green"],
			["Work", "green"],
		]);
		const byKey = new Map(win.groups.map((g) => [g.key, g.title]));
		expect(
			win.tabs.map((t) => [
				t.arcId,
				t.pinned,
				t.groupKey && byKey.get(t.groupKey),
			]),
		).toEqual([
			["fav", false, "Favorites"],
			["p1", false, "Pinned"],
			["p3", false, "Pinned"],
			["p2", false, "Work"],
			["t1", false, null],
		]);
		expect(plan.totals).toEqual({ windows: 1, tabs: 5, pinned: 0, groups: 3 });
		expect(plan.notes).toContain(
			"3 pinned tabs and Favorites were kept in groups instead of being pinned.",
		);
		expect(plan.notes.join(" ")).not.toContain("became group tabs");
	});

	it("prefixes the Space name when Spaces share one window", () => {
		const a: Space = { ...space("a"), title: "Home", pinned: [tab("a1")] };
		const b: Space = { ...space("b"), title: "Work", pinned: [tab("b1")] };
		const l = lib([a, b]);
		const plan = planImport(l, { ...defaultOptions(l), spaceMode: "group" });
		expect(plan.windows[0].groups.map((g) => g.title)).toEqual([
			"Home / Pinned",
			"Work / Pinned",
		]);
		expect(plan.notes).toContain(
			"2 pinned tabs and Favorites were kept in groups instead of being pinned.",
		);
	});

	it("puts flattened pinned folders into the Pinned group and uses the singular note", () => {
		const s: Space = {
			...space("s"),
			pinned: [folder("f", "Work", [tab("p2")])],
		};
		const l = lib([s]);
		const plan = planImport(l, { ...defaultOptions(l), folderMode: "flatten" });
		expect(plan.windows[0].groups.map((g) => g.title)).toEqual(["Pinned"]);
		expect(plan.notes).toContain(
			"1 pinned tab or Favorite was kept in a group instead of being pinned.",
		);
	});
});

describe("section choices and URL handling", () => {
	it("pins Favorites in the first window or skips them by choice", () => {
		const l = lib([space("s")], [tab("fav", "https://fav.test/")]);
		const kept = planImport(l, native(l));
		expect(kept.windows[0].tabs[0]).toMatchObject({
			arcId: "fav",
			pinned: true,
		});
		expect(kept.totals.pinned).toBe(2);

		const skipped = planImport(l, { ...native(l), favorites: "skip" });
		expect(skipped.skipped).toEqual([
			{ arcId: "fav", url: "https://fav.test/", reason: "by-choice" },
		]);
		expect(skipped.windows[0].tabs.map((t) => t.arcId)).toEqual(["tab-1"]);
	});

	it("includes or skips Today tabs as chosen", () => {
		const s: Space = {
			...space("s"),
			today: [tab("today", "https://t.test/")],
		};
		const l = lib([s]);
		expect(planImport(l, defaultOptions(l)).totals.tabs).toBe(2);
		const skipped = planImport(l, { ...defaultOptions(l), today: "skip" });
		expect(skipped.totals.tabs).toBe(1);
		expect(skipped.skipped.map((x) => [x.arcId, x.reason])).toEqual([
			["today", "by-choice"],
		]);
	});

	it("trims URLs for planning, empty checks and duplicate matching", () => {
		const s: Space = {
			...space("s"),
			pinned: [],
			today: [
				tab("padded", "  https://a.test/x  "),
				tab("blank", "   "),
				tab("dup", " https://b.test/y\t"),
			],
		};
		const l = lib([s]);
		const plan = planImport(l, {
			...defaultOptions(l),
			skipUrls: new Set([" https://b.test/y "]),
		});
		expect(plan.windows[0].tabs.map((t) => t.url)).toEqual([
			"https://a.test/x",
		]);
		expect(plan.skipped.map((x) => [x.arcId, x.reason])).toEqual([
			["blank", "empty-url"],
			["dup", "duplicate"],
		]);
	});

	it("opens only HTTP(S) URLs, whatever schemes are configured", () => {
		expect(isOpenableUrl("https://a.test/")).toBe(true);
		expect(isOpenableUrl("http://a.test/")).toBe(true);
		expect(isOpenableUrl("not a url")).toBe(false);
		expect(isOpenableUrl("javascript:alert(1)", ["javascript:"])).toBe(false);
		expect(isOpenableUrl("ftp://a.test/", ["ftp:"])).toBe(false);
		expect(isOpenableUrl("https://a.test/", ["http:"])).toBe(false);
		expect(isOpenableUrl("http://a.test/", ["http:"])).toBe(true);
	});
});
