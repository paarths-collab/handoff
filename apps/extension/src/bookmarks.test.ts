import { expect, it, vi } from "vitest";
import { defaultOptions } from "@handoff/core";
import { library, tab } from "../../../packages/core/test/builders";
import { api } from "./api";
import { moveBookmarks } from "./bookmarks";
import { newResult, skippedItems } from "./executor";

vi.mock("./api", () => ({ api: { bookmarks: { create: vi.fn() } } }));

it("preserves folder nesting and accounts for every exclusion when saving bookmarks", async () => {
	const lib = library(),
		space = lib.spaces[0];
	space.pinned = [
		{
			kind: "folder",
			arcId: "folder",
			title: "Reading",
			children: [tab("one"), tab("two", "about:blank")],
		},
	];
	space.today = [tab("today")];
	let id = 0;
	const create = vi.mocked(api.bookmarks.create);
	create.mockImplementation(async () => ({ id: String(++id), title: "" }));
	const options = { ...defaultOptions(lib), today: "skip" as const };
	const result = newResult("source", "session", "bookmarks");
	await moveBookmarks(
		lib,
		options,
		result,
		new AbortController().signal,
		async () => {},
		() => {},
	);
	expect(
		create.mock.calls.map(([item]) => [item.title, item.parentId]),
	).toEqual([
		["Handoff", undefined],
		["Space 1", "1"],
		["Pinned", "2"],
		["Reading", "3"],
		["Title 0001", "4"],
	]);
	expect(result.created.bookmarks).toEqual(["5"]);
	expect(skippedItems(result).map((item) => [item.arcId, item.reason])).toEqual(
		[
			["two", "scheme"],
			["today", "by-choice"],
		],
	);
});

it("mirrors an opened-tabs import as nested bookmarks without changing its tab accounting", async () => {
	const lib = library(),
		space = lib.spaces[0];
	space.pinned = [
		{
			kind: "folder",
			arcId: "folder",
			title: "Reading",
			children: [tab("one"), tab("two", "https://two.test/")],
		},
	];
	let id = 100;
	const create = vi.mocked(api.bookmarks.create);
	create.mockReset();
	create.mockImplementation(async (item) => {
		if (item.url === "https://two.test/") throw Error("quota");
		return { id: String(++id), title: "" };
	});
	const result = newResult("source", "session", "tabs");
	// As executePlan leaves it: both tabs scheduled, both opened.
	result.scheduled = [
		{ arcId: "one", url: "https://site-0001.test/p" },
		{ arcId: "two", url: "https://two.test/" },
	];
	result.moved = ["one", "two"];
	result.done = 2;
	result.created.tabIds = [7, 8];
	await moveBookmarks(
		lib,
		defaultOptions(lib),
		result,
		new AbortController().signal,
		async () => {},
		() => {},
		true,
	);
	expect(
		create.mock.calls.map(([item]) => [item.title, item.parentId]),
	).toEqual([
		["Handoff", undefined],
		["Space 1", "101"],
		["Pinned", "102"],
		["Reading", "103"],
		["Title 0001", "104"],
		["Title 0001", "104"],
	]);
	expect(result.created.folders).toEqual(["101", "102", "103", "104"]);
	expect(result.created.bookmarks).toEqual(["105"]);
	expect(result.created.tabIds).toEqual([7, 8]);
	expect([result.done, result.moved, result.failed, result.skipped]).toEqual([
		2,
		["one", "two"],
		[],
		[],
	]);
	expect(result.notes).toEqual([
		'Also saved 1 bookmark with nested folders in the "Handoff" bookmarks folder.',
		"1 bookmark could not be saved. The tabs are still open.",
	]);
});
