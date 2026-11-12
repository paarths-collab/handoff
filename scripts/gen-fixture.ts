import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseInput } from "../packages/core/src/parse";
import { sections, walk } from "../packages/core/src/tree";

type Item = {
	id: string;
	parentID: string;
	title?: string;
	childrenIds?: string[];
	data: Record<string, unknown>;
};
export function sidebar(count: number, spaceCount = 1, folders = 0) {
	const items: Item[] = [];
	const spaces = Array.from({ length: spaceCount }, (_, i) => ({
		id: "space-" + i,
		title: "Space " + (i + 1),
		newContainerIDs: [{ pinned: {} }, "p-" + i, { unpinned: {} }, "u-" + i],
	}));
	items.push({ id: "fav", parentID: "", data: { itemContainer: {} } });
	for (let i = 0; i < spaceCount; i++)
		for (const prefix of ["p-", "u-"])
			items.push({
				id: prefix + i,
				parentID: "space-" + i,
				data: { itemContainer: {} },
			});
	for (let i = 0; i < folders; i++)
		items.push({
			id: "folder-" + i,
			parentID: "p-" + (i % spaceCount),
			title: "Folder " + (i + 1),
			data: { list: {} },
		});
	for (let i = 0; i < count; i++) {
		const parentID =
			i === 0 && count > 3
				? "fav"
				: i % 3 === 1
					? "u-" + (i % spaceCount)
					: folders
						? "folder-" + (i % folders)
						: "p-" + (i % spaceCount);
		items.push({
			id: "tab-" + i,
			parentID,
			data: {
				tab: {
					savedURL: "https://site-" + String(i).padStart(4, "0") + ".test/p",
					savedTitle: "Title " + String(i).padStart(4, "0"),
				},
			},
		});
	}
	return { spaces, items, topAppsContainerIDs: [{ default: true }, "fav"] };
}
export const wrap = (raw: unknown) => ({
	sidebar: { containers: [{ global: {} }, raw] },
});
export function generate(): Map<string, string> {
	const cases = new Map<string, string>();
	const add = (name: string, raw: unknown) =>
		cases.set(name, JSON.stringify(wrap(raw)));
	add("tiny", sidebar(3));
	add("typical", sidebar(100, 4, 12));
	add("huge", sidebar(600, 4, 40));
	const deep = sidebar(3, 1, 8);
	for (let i = 1; i < 8; i++)
		deep.items.find((r) => r.id === "folder-" + i)!.parentID =
			"folder-" + (i - 1);
	deep.items.at(-1)!.parentID = "folder-7";
	add("deep", deep);
	const untitled = sidebar(2, 1, 1);
	untitled.spaces[0].title = "";
	delete untitled.items.find((r) => r.id === "folder-0")!.title;
	untitled.items.at(-1)!.data.tab = { savedURL: "https://site-2222.test/p" };
	add("untitled", untitled);
	const special = sidebar(3, 1, 1);
	const label =
		'< & > " ' +
		String.fromCharCode(39) +
		" 🧭 שלום </script> " +
		"Long ".repeat(100);
	special.spaces[0].title = label;
	special.items.at(-1)!.title = "=" + label;
	add("special-chars", special);
	cases.set(
		"global-last",
		JSON.stringify({ sidebar: { containers: [sidebar(3), { global: {} }] } }),
	);
	add("empty-spaces", sidebar(0, 2));
	const split = sidebar(3);
	split.items.push(
		{ id: "split", parentID: "p-0", data: { splitView: {} } },
		{ id: "note", parentID: "p-0", data: { notes: {} } },
		{ id: "easel", parentID: "p-0", data: { easel: {} } },
	);
	split.items.find((r) => r.id === "tab-0")!.parentID = "split";
	add("split-easel-notes", split);
	const corrupt = sidebar(4, 1, 2);
	corrupt.items.find((r) => r.id === "folder-1")!.parentID = "folder-0";
	corrupt.items.find((r) => r.id === "folder-0")!.parentID = "folder-1";
	corrupt.items.at(-1)!.parentID = "missing";
	corrupt.items.find((r) => r.id === "p-0")!.childrenIds = ["unknown"];
	add("corrupt", corrupt);
	const profiles = sidebar(4, 2);
	Object.assign(profiles.spaces[0], { profile: { default: true } });
	Object.assign(profiles.spaces[1], {
		profile: { custom: { _0: { directoryBasename: "Profile 0002" } } },
	});
	add("profiles", profiles);
	const schemes = sidebar(6);
	for (const [i, url] of [
		"arc://x",
		"chrome://x",
		"file:///x",
		"javascript:void(0)",
		"",
		"https://site-0001.test/p",
	].entries())
		schemes.items.find((r) => r.id === "tab-" + i)!.data.tab = {
			savedURL: url,
			savedTitle: "Title " + i,
		};
	add("schemes", schemes);
	const dup = sidebar(4);
	for (const item of dup.items)
		if (item.data.tab)
			item.data.tab = {
				savedURL: "https://same.test/p",
				savedTitle: "Repeated",
			};
	add("duplicates", dup);
	cases.set(
		"windows",
		JSON.stringify({ ...wrap(sidebar(6)), platform: "windows" }),
	);
	cases.set("not-arc", '{"tabs":[]}');
	cases.set("truncated", '{"sidebar":');
	return cases;
}
export function snapshot(text: string) {
	const r = parseInput(text);
	if (!r.ok) return { error: r.error.kind };
	return {
		counts: r.value.report.counts,
		layout: [...sections(r.value)].map((s) => ({
			space: s.space?.arcId ?? null,
			section: s.name,
			items: [...walk(s.nodes)].map(({ node, path }) => [
				path.length,
				node.kind,
				node.arcId,
			]),
		})),
		skipped: r.value.report.skipped,
		warnings: r.value.report.warnings,
	};
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	mkdirSync("fixtures/expected", { recursive: true });
	for (const [name, text] of generate()) {
		writeFileSync("fixtures/" + name + ".json", text + "\n");
		writeFileSync(
			"fixtures/expected/" + name + ".json",
			JSON.stringify(snapshot(text), null, 2) + "\n",
		);
	}
}
