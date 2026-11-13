import { expect, it, vi } from "vitest";
import { api } from "./api";
import { newResult } from "./executor";
import { undoAdapter, undoOwned } from "./storage";

vi.mock("./api", () => ({
	api: {
		tabs: { query: vi.fn(async () => []) },
		bookmarks: { remove: vi.fn(), getTree: vi.fn(), getChildren: vi.fn() },
	},
}));

it("finishes Undo when the user already deleted one owned bookmark and folder", async () => {
	const r = newResult("source", "session", "bookmarks");
	r.created.bookmarks = ["deleted", "present"];
	r.created.folders = ["deleted-folder"];
	vi.mocked(api.bookmarks.remove)
		.mockRejectedValueOnce(Error("missing"))
		.mockResolvedValueOnce(undefined);
	vi.mocked(api.bookmarks.getChildren).mockRejectedValue(Error("missing"));
	vi.mocked(
		api.bookmarks.getTree as () => Promise<chrome.bookmarks.BookmarkTreeNode[]>,
	).mockResolvedValue([
		{ id: "root", syncing: false, title: "", children: [] },
	]);
	await undoOwned(r, "session", undoAdapter);
	expect(r.undone).toBe(true);
	expect(r.created.bookmarks).toEqual([]);
	expect(r.created.folders).toEqual([]);
	expect(api.bookmarks.remove).toHaveBeenCalledWith("present");
});

it("preserves an existing ID for retry after a genuine removal failure", async () => {
	vi.mocked(api.bookmarks.remove).mockRejectedValueOnce(Error("denied"));
	vi.mocked(
		api.bookmarks.getTree as () => Promise<chrome.bookmarks.BookmarkTreeNode[]>,
	).mockResolvedValue([
		{
			id: "root",
			syncing: false,
			title: "",
			children: [{ id: "owned", syncing: false, title: "" }],
		},
	]);
	await expect(undoAdapter.removeBookmark("owned")).rejects.toThrow("denied");
});
