import { expect, it, vi } from "vitest";
import { defaultOptions } from "@tab-mover/core";
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
		["Tab Mover", undefined],
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
