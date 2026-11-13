import { describe, expect, it, vi } from "vitest";
import type { ImportPlan } from "@handoff/core";
import {
	executePlan,
	newResult,
	openable,
	skippedItems,
	type BrowserTabsAdapter,
} from "./executor";
import { undoOwned } from "./storage";
vi.mock("./api", () => ({ api: {} }));

const plan: ImportPlan = {
	windows: [
		{
			key: "w",
			spaceArcId: "s",
			tabs: ["a", "b", "c"].map((arcId, i) => ({
				arcId,
				url: "https://site.test/" + arcId,
				title: arcId,
				pinned: i === 0,
				groupKey: i ? "g" : null,
			})),
			groups: [{ key: "g", title: "Reading", color: "blue", collapsed: true }],
		},
	],
	skipped: [],
	notes: [],
	totals: { windows: 1, tabs: 3, groups: 1, pinned: 1 },
};
function adapter(): BrowserTabsAdapter {
	let next = 10;
	return {
		supportsGroups: true,
		createWindow: vi.fn(async () => ({ windowId: 3, placeholderTabId: 1 })),
		createTab: vi.fn(async () => next++),
		unload: vi.fn(async (id) => id + 100),
		group: vi.fn(async () => 7),
		closeTabs: vi.fn(async () => {}),
	};
}
function options() {
	return {
		result: newResult("synthetic", "session", "tabs"),
		save: vi.fn(async () => {}),
		onProgress: vi.fn(),
		batchSize: 2,
		signal: new AbortController().signal,
	};
}
describe("executePlan", () => {
	it("keeps order, returns replaced IDs, groups only unpinned tabs and closes the placeholder", async () => {
		const a = adapter(),
			o = options();
		const result = await executePlan(plan, a, o);
		expect(
			vi.mocked(a.createTab).mock.calls.map(([tab]) => [tab.url, tab.pinned]),
		).toEqual(plan.windows[0].tabs.map((tab) => [tab.url, tab.pinned]));
		expect(result.created.tabIds).toEqual([110, 111, 112]);
		expect(a.group).toHaveBeenCalledWith(
			3,
			[111, 112],
			plan.windows[0].groups[0],
		);
		expect(a.closeTabs).toHaveBeenCalledWith([1]);
		expect(result.done).toBe(3);
		expect(skippedItems(result)).toEqual([]);
		expect(o.save.mock.calls.length).toBeGreaterThanOrEqual(4);
	});
	it("accounts for one failed tab and stops after the current batch on cancel", async () => {
		const a = adapter(),
			o = options(),
			c = new AbortController();
		vi.mocked(a.createTab).mockRejectedValueOnce(Error());
		o.onProgress.mockImplementation(() => {
			c.abort();
		});
		const r = await executePlan(plan, a, { ...o, signal: c.signal });
		expect(r.done).toBe(1);
		expect(r.cancelled).toBe(true);
		expect(skippedItems(r).map(({ arcId, reason }) => [arcId, reason])).toEqual(
			[
				["a", "tab-create-failed"],
				["c", "cancelled"],
			],
		);
	});
	it("preserves a created tab when unloading or grouping fails", async () => {
		const a = adapter();
		vi.mocked(a.unload).mockRejectedValue(Error());
		vi.mocked(a.group).mockRejectedValue(Error());
		const r = await executePlan(plan, a, options());
		expect(r.created.tabIds).toEqual([10, 11, 12]);
		expect(r.notes.length).toBe(1);
	});
	it("creates separate fallback windows when group APIs are unavailable", async () => {
		const a = adapter();
		Object.assign(a, { supportsGroups: false });
		await executePlan(plan, a, options());
		expect(a.createWindow).toHaveBeenCalledTimes(2);
		expect(a.group).not.toHaveBeenCalled();
	});
	it("validates schemes at execution and records window failures", async () => {
		for (const url of [
			"file:///tmp/book",
			"about:blank",
			"data:text/plain,test",
			"chrome://settings",
			"javascript:void(0)",
			"relative",
		])
			expect(openable(url)).toBe(false);
		const p = structuredClone(plan);
		p.windows[0].tabs[0].url = "about:blank";
		const a = adapter();
		const r = await executePlan(p, a, options());
		expect(r.failed[0].error).toBe("scheme");
		expect(a.createTab).toHaveBeenCalledTimes(2);
		vi.mocked(a.createWindow).mockRejectedValue(Error());
		expect((await executePlan(plan, a, options())).failed).toHaveLength(3);
	});
	it("Undo checks session identity and closes only owned live tabs", async () => {
		const r = await executePlan(plan, adapter(), options());
		const a = {
			tabIds: async () => new Set([110, 111, 999]),
			close: vi.fn(async () => {}),
			removeBookmark: vi.fn(),
			removeEmptyFolder: vi.fn(),
		};
		await expect(undoOwned(r, "different", a)).rejects.toThrow();
		expect(a.close).not.toHaveBeenCalled();
		await undoOwned(r, "session", a);
		expect(a.close.mock.calls).toEqual([[110], [111]]);
		expect(r.undone).toBe(true);
	});
});

it.each([true, false])(
	"preserves a selected empty Space and tracks its blank tab for Undo (groups %s)",
	async (supportsGroups) => {
		const a = adapter();
		Object.assign(a, { supportsGroups });
		const empty = structuredClone(plan);
		empty.windows[0].tabs = [];
		empty.windows[0].groups = [];
		const result = await executePlan(empty, a, options());
		expect(result.created.windowIds).toEqual([3]);
		expect(result.created.tabIds).toEqual([1]);
		expect(result.done).toBe(0);
		expect(a.closeTabs).not.toHaveBeenCalled();
	},
);
