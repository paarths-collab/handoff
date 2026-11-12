import { expect, it } from "vitest";
import { defaultOptions, parsePack, planImport, toPackJson } from "../../src";
import { library, space, tab } from "../builders";

function envelope() {
	const lib = library();
	lib.favorites.push({
		kind: "folder",
		arcId: "folder",
		title: "Favorites",
		children: [tab("nested-tab")],
	});
	lib.report.skipped = [
		{ arcId: "without-url", reason: "no-url", detail: "tab" },
		{ arcId: "unsupported", reason: "unsupported-kind", detail: "easel" },
	];
	lib.report.warnings = [
		{ kind: "order-mismatch", parentArcId: "folder" },
		{ kind: "unknown-field", path: "item.id" },
		{ kind: "orphan-recovered", arcId: "nested-tab" },
		{ kind: "cycle-broken", arcId: "folder" },
		{ kind: "depth-limited", arcId: "folder" },
		{ kind: "split-view-flattened", arcId: "split" },
		{ kind: "generated-title", target: "folder", arcId: "folder" },
		{ kind: "generated-title", target: "tab", arcId: "tab-1" },
		{ kind: "generated-title", target: "space", arcId: "space-1" },
	];
	return JSON.parse(toPackJson(lib));
}

it("transports every report variant and nullable metadata across a pack round trip", () => {
	const pack = envelope();
	pack.library.spaces[0].pinned[0].savedTitle = null;
	const parsed = parsePack(JSON.stringify(pack));
	expect(parsed.ok).toBe(true);
	if (!parsed.ok) throw Error(parsed.error.kind);
	expect(parsed.value.report.warnings).toEqual(pack.library.report.warnings);
	expect(parsed.value.report.skipped).toEqual(pack.library.report.skipped);
	expect(parsed.value.report.counts).toEqual({
		spaces: 1,
		folders: 1,
		favorites: 1,
		today: 0,
		tabs: 2,
		skipped: 2,
	});
	expect(parsed.value.spaces).toEqual(pack.library.spaces);
	expect(parsed.value.favorites).toEqual(pack.library.favorites);
	expect(parsePack(toPackJson(parsed.value))).toEqual(parsed);
});

it.each([
	["report", null],
	["report", []],
	["report", { skipped: [], warnings: [] }],
	["favorites", null],
	["favorites", {}],
	["spaces", {}],
	["spaces", [null]],
	["source", []],
	["schemaVersion", "1"],
])("rejects malformed library field %s", (field, bad) => {
	const pack = envelope();
	pack.library[field as string] = bad;
	expect(parsePack(JSON.stringify(pack))).toMatchObject({
		ok: false,
		error: { kind: "invalid-pack" },
	});
});

it.each([
	null,
	{ kind: "order-mismatch", parentArcId: null },
	{ kind: "unknown-field", path: false },
	{ kind: "orphan-recovered" },
	{ kind: "generated-title", target: "section", arcId: "space-1" },
	{ kind: "new-warning", arcId: "tab-1" },
])("rejects malformed warnings instead of dropping them", (warning) => {
	const pack = envelope();
	pack.library.report.warnings.push(warning);
	expect(parsePack(JSON.stringify(pack))).toMatchObject({
		ok: false,
		error: { kind: "invalid-pack" },
	});
});

it.each([
	null,
	{ arcId: "", reason: "no-url", detail: "tab" },
	{ arcId: "tab-1", reason: "no-url", detail: "tab" },
	{ arcId: "without-url", reason: "no-url", detail: "tab" },
	{ arcId: "new", reason: "missing", detail: "tab" },
	{ arcId: "new", reason: "no-url" },
])("rejects invalid or repeated skipped identities", (entry) => {
	const pack = envelope();
	pack.library.report.skipped.push(entry);
	expect(parsePack(JSON.stringify(pack))).toMatchObject({
		ok: false,
		error: { kind: "invalid-pack" },
	});
});

it("requires the pack envelope and distinguishes a newer version", () => {
	const pack = envelope();
	for (const broken of [
		[],
		null,
		pack.library,
		{ ...pack, format: "archive" },
		{ ...pack, createdAt: undefined },
		{ ...pack, library: null },
	]) {
		expect(parsePack(JSON.stringify(broken))).toMatchObject({
			ok: false,
			error: { kind: "invalid-pack" },
		});
	}
	expect(
		parsePack(JSON.stringify({ ...pack, schemaVersion: 2 })),
	).toMatchObject({ ok: false, error: { kind: "unsupported-pack-version" } });
});

it("requires nullable fields to be present and every folder to carry a child array", () => {
	for (const name of [
		"profile",
		"color",
		"icon",
		"savedTitle",
		"customTitle",
		"children",
	]) {
		const pack = envelope();
		const root = pack.library.spaces[0];
		const field =
			name === "children"
				? pack.library.favorites[0]
				: ["savedTitle", "customTitle"].includes(name)
					? root.pinned[0]
					: root;
		delete field[name];
		expect(parsePack(JSON.stringify(pack))).toMatchObject({
			ok: false,
			error: { kind: "invalid-pack" },
		});
	}
	const pack = envelope();
	pack.library.favorites[0].children = {};
	expect(parsePack(JSON.stringify(pack))).toMatchObject({
		ok: false,
		error: { kind: "invalid-pack" },
	});
});

it("cycles nine default group colors and preserves sidebar order for a repeated selection", () => {
	const lib = library();
	lib.spaces = Array.from({ length: 10 }, (_, index) => ({
		...space("space-" + index),
		pinned: [],
		today: [tab("tab-" + index)],
	}));
	const opts = { ...defaultOptions(lib), spaceMode: "group" as const };
	const groups = planImport(lib, opts).windows[0].groups;
	const palette = groups.slice(0, 9).map((g) => g.color);
	expect(new Set(palette)).toEqual(
		new Set([
			"blue",
			"red",
			"yellow",
			"green",
			"pink",
			"purple",
			"cyan",
			"orange",
			"grey",
		]),
	);
	expect(groups[9].color).toBe(palette[0]);
	const reduced = planImport(lib, {
		...opts,
		spaceIds: ["space-9", "unknown", "space-0", "space-9"],
	});
	expect(reduced.windows[0].tabs.map((t) => t.arcId)).toEqual([
		"tab-0",
		"tab-9",
	]);
	expect(reduced.skipped).toHaveLength(8);
	expect(reduced.skipped.every((tab) => tab.reason === "by-choice")).toBe(true);
});
