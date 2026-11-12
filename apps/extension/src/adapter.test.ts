import { expect, it, vi } from "vitest";
import { adapter } from "./adapter";
import { api } from "./api";

vi.mock("./api", () => ({
	isFirefox: true,
	api: {
		tabs: {
			create: vi.fn(async () => ({ id: 7 })),
			discard: vi.fn(),
			group: vi.fn(async () => 2),
		},
		tabGroups: { update: vi.fn() },
	},
}));

it("creates Firefox background tabs discarded with their title, and pins root tabs without discarded", async () => {
	const args = {
		arcId: "synthetic",
		windowId: 3,
		title: "Synthetic",
		url: "https://site.test/",
		pinned: false,
	};
	expect(await adapter.createTab(args)).toBe(7);
	expect(api.tabs.create).toHaveBeenCalledWith({
		windowId: 3,
		url: args.url,
		active: false,
		pinned: false,
		discarded: true,
		title: "Synthetic",
	});
	await adapter.createTab({ ...args, pinned: true });
	expect(api.tabs.create).toHaveBeenCalledWith({
		windowId: 3,
		url: args.url,
		active: false,
		pinned: true,
	});
	expect(await adapter.unload(7)).toBe(7);
	expect(api.tabs.discard).not.toHaveBeenCalled();
});

it("applies title, color and collapsed state in the target window", async () => {
	expect(adapter.supportsGroups).toBe(true);
	const group = { title: "Research", color: "cyan" as const, collapsed: true };
	expect(await adapter.group(3, [8, 9], group)).toBe(2);
	expect(api.tabs.group).toHaveBeenCalledWith({
		createProperties: { windowId: 3 },
		tabIds: [8, 9],
	});
	expect(api.tabGroups.update).toHaveBeenCalledWith(2, group);
});
