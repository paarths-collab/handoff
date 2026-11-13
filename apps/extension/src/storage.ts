import { restoreOwnership } from "./ownership";
import { api } from "./api";
import type { ImportResult } from "./executor";

const key = "handoffLastImport";
export async function sessionToken(
	create = false,
): Promise<string | undefined> {
	const { handoffSession } = await api.storage.session.get("handoffSession");
	if (typeof handoffSession === "string") return handoffSession;
	if (!create) return;
	const token = crypto.randomUUID();
	await api.storage.session.set({ handoffSession: token });
	return token;
}
export async function saveResult(result: ImportResult) {
	await api.storage.local.set({ [key]: result });
}
export async function lastResult(): Promise<ImportResult | undefined> {
	const result = (await api.storage.local.get(key))[key] as
		| ImportResult
		| undefined;
	if (result) await restoreOwnership(result);
	return result;
}
export function exclusive(action: () => Promise<void>) {
	return navigator.locks.request(
		"handoff-import",
		{ ifAvailable: true },
		async (lock) => {
			if (!lock)
				throw Error("Another importer is busy. Try again when it finishes.");
			await action();
		},
	);
}
export interface UndoAdapter {
	tabIds(): Promise<Set<number>>;
	close(id: number): Promise<void>;
	removeBookmark(id: string): Promise<void>;
	removeEmptyFolder(id: string): Promise<void>;
}
// A user may delete an imported bookmark before Undo. Only suppress an API
// error after the browser confirms that the owned ID no longer exists.
async function removeIfPresent(id: string, remove: () => Promise<void>) {
	try {
		await remove();
	} catch (error) {
		const pending = [...(await api.bookmarks.getTree())];
		while (pending.length) {
			const item = pending.pop()!;
			if (item.id === id) throw error;
			if (item.children) for (const child of item.children) pending.push(child);
		}
	}
}
export const undoAdapter: UndoAdapter = {
	async tabIds() {
		return new Set(
			(await api.tabs.query({})).flatMap((t) =>
				t.id === undefined ? [] : [t.id],
			),
		);
	},
	async close(id) {
		await api.tabs.remove(id);
	},
	async removeBookmark(id) {
		await removeIfPresent(id, () => api.bookmarks.remove(id));
	},
	async removeEmptyFolder(id) {
		await removeIfPresent(id, async () => {
			if ((await api.bookmarks.getChildren(id)).length === 0)
				await api.bookmarks.remove(id);
		});
	},
};
export async function undoOwned(
	result: ImportResult,
	current: string | undefined,
	adapter: UndoAdapter,
) {
	if (!current || result.session !== current)
		throw Error("Undo expired when this browser session ended.");
	// Closing owned tabs also closes any windows they empty, without touching new tabs.
	const live = await adapter.tabIds();
	for (const id of [...result.created.tabIds]) {
		if (live.has(id)) await adapter.close(id);
		result.created.tabIds = result.created.tabIds.filter((item) => item !== id);
	}
	for (const id of [...result.created.bookmarks]) {
		await adapter.removeBookmark(id);
		result.created.bookmarks = result.created.bookmarks.filter(
			(item) => item !== id,
		);
	}
	for (const id of [...result.created.folders].reverse()) {
		await adapter.removeEmptyFolder(id);
		result.created.folders = result.created.folders.filter(
			(item) => item !== id,
		);
	}
	result.undone = true;
}
