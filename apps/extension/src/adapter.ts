import { api, isFirefox } from "./api";
import type { BrowserTabsAdapter } from "./executor";
import { openable } from "./executor";

// Register before checking the current status to avoid losing a fast completion.
// Chromium with only storage + tabGroups does not expose URL change events.
async function loaded(id: number): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (value: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			api.tabs.onUpdated.removeListener(listener);
			resolve(value);
		};
		const listener = (tabId: number, changes: chrome.tabs.OnUpdatedInfo) => {
			if (tabId === id && changes.status === "complete") finish(true);
		};
		const timer = setTimeout(() => finish(false), 900);
		api.tabs.onUpdated.addListener(listener);
		void api.tabs.get(id).then(
			(tab) => {
				if (tab.status === "complete") finish(true);
			},
			() => finish(false),
		);
	});
}

export const adapter: BrowserTabsAdapter = {
	get supportsGroups() {
		return (
			typeof api.tabs.group === "function" &&
			typeof api.tabGroups?.update === "function"
		);
	},
	async createWindow() {
		const win = await api.windows.create({
			focused: false,
			url: "about:blank",
		});
		if (win?.id === undefined || win.tabs?.[0]?.id === undefined)
			throw Error("Window unavailable");
		return { windowId: win.id, placeholderTabId: win.tabs[0].id };
	},
	async createTab({ windowId, url, title, pinned }) {
		if (!openable(url)) throw Error("Unsupported scheme");
		const base = { windowId, url, pinned, active: false };
		// Firefox forbids discarded creation for pinned tabs.
		const props =
			isFirefox && !pinned ? { ...base, discarded: true, title } : base;
		const tab = await api.tabs.create(props);
		if (tab.id === undefined) throw Error("Tab unavailable");
		return tab.id;
	},
	async unload(id) {
		if (isFirefox || !(await loaded(id))) return id;
		const unloaded = await api.tabs.discard(id);
		return unloaded?.id ?? id;
	},
	async group(windowId, ids, group) {
		const id = await api.tabs.group({
			createProperties: { windowId },
			tabIds: ids as [number, ...number[]],
		});
		await api.tabGroups.update(id, {
			title: group.title,
			color: group.color,
			collapsed: group.collapsed,
		});
		return id;
	},
	async closeTabs(ids) {
		await api.tabs.remove(ids);
	},
};
