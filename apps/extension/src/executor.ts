import type {
	GroupColor,
	ImportPlan,
	PlannedTab,
	PlannedWindow,
} from "@tab-mover/core";

export interface BrowserTabsAdapter {
	readonly supportsGroups: boolean;
	createWindow(): Promise<{ windowId: number; placeholderTabId: number }>;
	createTab(tab: {
		arcId: string;
		windowId: number;
		url: string;
		title: string;
		pinned: boolean;
	}): Promise<number>;
	unload(tabId: number): Promise<number>;
	group(
		windowId: number,
		tabIds: number[],
		group: { title: string; color: GroupColor; collapsed: boolean },
	): Promise<number>;
	closeTabs(tabIds: number[]): Promise<void>;
}

export interface SkippedItem {
	arcId: string;
	url?: string;
	reason: string;
}
export interface ImportResult {
	importId: string;
	sourceHash: string;
	session: string;
	startedAt: string;
	finishedAt?: string;
	mode: "tabs" | "bookmarks";
	created: {
		windowIds: number[];
		tabIds: number[];
		groupIds: number[];
		bookmarks: string[];
		folders: string[];
	};
	scheduled: { arcId: string; url: string }[];
	moved: string[];
	skipped: SkippedItem[];
	done: number;
	failed: { arcId: string; url: string; error: string }[];
	cancelled: boolean;
	notes: string[];
	undone?: boolean;
}
export function newResult(
	sourceHash: string,
	session: string,
	mode: ImportResult["mode"],
): ImportResult {
	return {
		importId: crypto.randomUUID(),
		sourceHash,
		session,
		startedAt: new Date().toISOString(),
		mode,
		created: {
			windowIds: [],
			tabIds: [],
			groupIds: [],
			bookmarks: [],
			folders: [],
		},
		scheduled: [],
		moved: [],
		skipped: [],
		done: 0,
		failed: [],
		cancelled: false,
		notes: [],
	};
}
export function openable(url: string): boolean {
	try {
		const scheme = new URL(url).protocol;
		return scheme === "http:" || scheme === "https:";
	} catch {
		return false;
	}
}

export function skippedItems(result: ImportResult): SkippedItem[] {
	const attempted = new Set([
		...result.moved,
		...result.failed.map((item) => item.arcId),
	]);
	return [
		...result.skipped,
		...result.failed.map((item) => ({ ...item, reason: item.error })),
		...result.scheduled
			.filter((item) => !attempted.has(item.arcId))
			.map((item) => ({
				...item,
				reason: result.cancelled ? "cancelled" : "interrupted",
			})),
	];
}

interface RunOptions {
	result: ImportResult;
	batchSize: number;
	signal: AbortSignal;
	save: (result: ImportResult) => Promise<void>;
	onProgress: (done: number, total: number) => void;
}

// Browsers without group APIs get one window per group, in planned order.
function targetWindows(plan: ImportPlan, groups: boolean): PlannedWindow[] {
	if (groups) return plan.windows;
	return plan.windows.flatMap((window) => {
		if (window.tabs.length === 0) return [window];
		const byGroup = new Map<string | null, PlannedTab[]>();
		for (const tab of window.tabs) {
			const section = byGroup.get(tab.groupKey) ?? [];
			section.push(tab);
			byGroup.set(tab.groupKey, section);
		}
		return Array.from(byGroup.values(), (tabs) => ({
			...window,
			tabs,
			groups: [],
		}));
	});
}

export async function executePlan(
	plan: ImportPlan,
	adapter: BrowserTabsAdapter,
	opts: RunOptions,
): Promise<ImportResult> {
	const { result, save, signal } = opts;
	const size = Math.max(1, Math.floor(opts.batchSize) || 1);
	result.scheduled = plan.windows.flatMap((win) =>
		win.tabs.map(({ arcId, url }) => ({ arcId, url })),
	);
	result.skipped.push(...plan.skipped);
	result.notes.push(...plan.notes);
	const total = result.scheduled.length;
	await save(result);
	for (const window of targetWindows(plan, adapter.supportsGroups)) {
		if (signal.aborted) break;
		let created: Awaited<ReturnType<BrowserTabsAdapter["createWindow"]>>;
		try {
			created = await adapter.createWindow();
		} catch {
			result.failed.push(
				...window.tabs.map(({ arcId, url }) => ({
					arcId,
					url,
					error: "window-create-failed",
				})),
			);
			await save(result);
			continue;
		}
		const { windowId, placeholderTabId } = created;
		result.created.windowIds.push(windowId);
		result.created.tabIds.push(placeholderTabId);
		await save(result);
		if (window.tabs.length === 0) {
			result.notes.push("An empty selected Space opened as a blank window.");
			continue;
		}
		const groupIds = new Map<string, number[]>();
		for (let i = 0; i < window.tabs.length && !signal.aborted; i += size) {
			const createdTabs: { tab: PlannedTab; id: number; index: number }[] = [];
			for (const tab of window.tabs.slice(i, i + size)) {
				if (!openable(tab.url)) {
					result.failed.push({
						arcId: tab.arcId,
						url: tab.url,
						error: "scheme",
					});
					continue;
				}
				try {
					const id = await adapter.createTab({
						arcId: tab.arcId,
						windowId,
						url: tab.url,
						title: tab.title,
						pinned: tab.pinned,
					});
					const index = result.created.tabIds.push(id) - 1;
					result.moved.push(tab.arcId);
					result.done++;
					createdTabs.push({ tab, id, index });
				} catch {
					result.failed.push({
						arcId: tab.arcId,
						url: tab.url,
						error: "tab-create-failed",
					});
				}
			}
			// Journal original IDs before an unload can replace them.
			await save(result);
			const settled = await Promise.all(
				createdTabs.map(async ({ id }) => {
					try {
						return await adapter.unload(id);
					} catch {
						return id;
					}
				}),
			);
			createdTabs.forEach(({ tab, index }, j) => {
				const current = settled[j];
				result.created.tabIds[index] = current;
				if (tab.groupKey && !tab.pinned) {
					const ids = groupIds.get(tab.groupKey) ?? [];
					ids.push(current);
					groupIds.set(tab.groupKey, ids);
				}
			});
			await save(result);
			opts.onProgress(result.done + result.failed.length, total);
		}
		for (const group of window.groups) {
			const ids = groupIds.get(group.key);
			if (!ids?.length) continue;
			try {
				result.created.groupIds.push(await adapter.group(windowId, ids, group));
			} catch {
				result.notes.push(
					"A group could not be created. Its tabs are in the imported window.",
				);
			}
		}
		try {
			await adapter.closeTabs([placeholderTabId]);
			result.created.tabIds = result.created.tabIds.filter(
				(id) => id !== placeholderTabId,
			);
		} catch {
			result.notes.push(
				"A blank setup tab could not be closed. Undo can retry.",
			);
		}
		await save(result);
	}
	result.cancelled = signal.aborted;
	result.finishedAt = new Date().toISOString();
	await save(result);
	return result;
}
