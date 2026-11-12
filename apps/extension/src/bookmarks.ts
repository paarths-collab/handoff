import {
	planImport,
	type ImportOptions,
	type Library,
	type Node,
} from "@tab-mover/core";
import { api } from "./api";
import { openable, type ImportResult } from "./executor";

interface Section {
	title: string;
	nodes: Node[];
	selected: boolean;
	space?: string;
}
export async function moveBookmarks(
	library: Library,
	options: ImportOptions,
	result: ImportResult,
	signal: AbortSignal,
	save: (r: ImportResult) => Promise<void>,
	progress: (n: number, total: number) => void,
) {
	const sections: Section[] = [
		{
			title: "Favorites",
			nodes: library.favorites,
			selected: options.favorites !== "skip",
		},
	];
	for (const space of library.spaces)
		for (const area of ["pinned", "today"] as const) {
			sections.push({
				title: area === "today" ? "Today" : "Pinned",
				space: space.arcId,
				nodes: space[area],
				selected:
					options.spaceIds.includes(space.arcId) &&
					(area === "pinned" || options.today === "include"),
			});
		}
	// First account for all tabs, including exclusions, before changing the browser.
	const plan = planImport(library, options);
	result.scheduled = plan.windows.flatMap((win) =>
		win.tabs.map(({ arcId, url }) => ({ arcId, url })),
	);
	result.skipped.push(...plan.skipped);
	const eligible = new Set(result.scheduled.map((tab) => tab.arcId));
	await save(result);
	if (eligible.size) {
		const folder = async (title: string, parentId?: string) => {
			const created = await api.bookmarks.create({ title, parentId });
			result.created.folders.push(created.id);
			await save(result);
			return created.id;
		};
		const root = await folder("Tab Mover");
		const spaceFolders = new Map<string, string>();
		for (const section of sections) {
			if (signal.aborted) break;
			if (!section.selected || !section.nodes.length) continue;
			let parentId = root;
			if (section.space) {
				const space = library.spaces.find((s) => s.arcId === section.space)!;
				let id = spaceFolders.get(space.arcId);
				if (!id) {
					id = await folder(space.title, root);
					spaceFolders.set(space.arcId, id);
				}
				parentId = id;
			}
			const sectionId = await folder(section.title, parentId);
			const stack = section.nodes
				.map((node) => ({ node, parentId: sectionId }))
				.reverse();
			while (stack.length && !signal.aborted) {
				const { node, parentId } = stack.pop()!;
				if (node.kind === "folder") {
					const id = await folder(node.title, parentId);
					for (let i = node.children.length - 1; i >= 0; i--)
						stack.push({ node: node.children[i], parentId: id });
				} else if (eligible.has(node.arcId) && openable(node.url)) {
					try {
						const bookmark = await api.bookmarks.create({
							parentId,
							url: node.url,
							title: node.title,
						});
						result.created.bookmarks.push(bookmark.id);
						result.moved.push(node.arcId);
						result.done++;
					} catch {
						result.failed.push({
							arcId: node.arcId,
							url: node.url,
							error: "bookmark-create-failed",
						});
					}
					await save(result);
					progress(result.done + result.failed.length, result.scheduled.length);
				}
			}
		}
	}
	result.cancelled = signal.aborted;
	result.finishedAt = new Date().toISOString();
	await save(result);
}
