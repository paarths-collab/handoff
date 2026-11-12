import { api } from "./api";
import { adapter } from "./adapter";
import type { BrowserTabsAdapter, ImportResult } from "./executor";

type Create = Parameters<BrowserTabsAdapter["createTab"]>[0];
type Operation =
	| { type: "window" }
	| { type: "tab"; tab: Create }
	| { type: "unload"; id: number };
interface Owned {
	arcId?: string;
	windowId?: number;
	original: number;
	current: number;
}
const prefix = "tabMoverOwned:";
const ledgerKey = (run: string, id: number) => prefix + run + ":" + id;
const guard = "tab-mover-browser-operation";

// An extension page can disappear while a create/discard promise is in flight.
// The background handler finishes that single browser call and records ownership.
// The importer page continues to own all sequencing, user choices and cancellation.
export function installOwnershipHandler() {
	api.runtime.onMessage.addListener((message, sender, respond) => {
		if (
			sender.id !== api.runtime.id ||
			sender.url?.split(/[?#]/)[0] !== api.runtime.getURL("importer.html") ||
			message?.kind !== "owned-tab-operation"
		)
			return;
		void navigator.locks
			.request(guard, { mode: "shared" }, async () => {
				const { tabMoverActive } =
					await api.storage.session.get("tabMoverActive");
				if (typeof message.run !== "string" || message.run !== tabMoverActive)
					throw Error();
				const operation: Operation = message.operation;
				if (operation.type === "window") {
					const created = await adapter.createWindow();
					const id = created.placeholderTabId;
					try {
						await api.storage.session.set({
							[ledgerKey(message.run, id)]: {
								original: id,
								current: id,
								windowId: created.windowId,
							},
						});
					} catch (error) {
						await adapter.closeTabs([id]);
						throw error;
					}
					return created;
				}
				if (operation.type === "tab") {
					const id = await adapter.createTab(operation.tab);
					try {
						await api.storage.session.set({
							[ledgerKey(message.run, id)]: {
								original: id,
								current: id,
								arcId: operation.tab.arcId,
							},
						});
					} catch (error) {
						await adapter.closeTabs([id]);
						throw error;
					}
					return id;
				}
				if (operation.type === "unload") {
					const key = ledgerKey(message.run, operation.id);
					const entry = (await api.storage.session.get(key))[key] as
						| Owned
						| undefined;
					if (!entry?.arcId) throw Error();
					const current = await adapter.unload(entry.current);
					if (current !== entry.current)
						await api.storage.session.set({ [key]: { ...entry, current } });
					return current;
				}
				throw Error();
			})
			.then(
				(value) => respond({ ok: true, value }),
				() => respond({ ok: false }),
			);
		return true;
	});
}
export function journaledAdapter(run: string): BrowserTabsAdapter {
	async function request<T>(operation: Operation): Promise<T> {
		const response = await api.runtime.sendMessage({
			kind: "owned-tab-operation",
			run,
			operation,
		});
		if (!response?.ok) throw Error("Browser operation failed");
		return response.value as T;
	}
	return {
		...adapter,
		createWindow: () => request({ type: "window" }),
		createTab: (tab) => request({ type: "tab", tab }),
		unload: (id) => request({ type: "unload", id }),
	};
}
export async function startOwnership(run: string) {
	await navigator.locks.request(guard, async () => {
		const keys = Object.keys(await api.storage.session.get(null)).filter(
			(key) => key.startsWith(prefix),
		);
		if (keys.length) await api.storage.session.remove(keys);
		await api.storage.session.set({ tabMoverActive: run });
	});
}
export async function restoreOwnership(result: ImportResult) {
	if (result.undone || result.finishedAt || result.mode !== "tabs") return;
	await navigator.locks.request(guard, async () => {
		const entries = await api.storage.session.get(null);
		const ids = new Set(result.created.tabIds);
		const moved = new Set(result.moved);
		const windows = new Set(result.created.windowIds);
		for (const [key, value] of Object.entries(entries)) {
			if (!key.startsWith(prefix + result.importId + ":")) continue;
			const entry = value as Owned;
			if (entry.original !== entry.current) ids.delete(entry.original);
			ids.add(entry.current);
			if (entry.arcId) moved.add(entry.arcId);
			if (entry.windowId !== undefined) windows.add(entry.windowId);
		}
		result.moved = [...moved];
		result.done = moved.size;
		result.created.tabIds = [...ids];
		result.created.windowIds = [...windows];
	});
}
