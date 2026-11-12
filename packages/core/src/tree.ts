import type { Library, Node, ParseReport, Space } from "./model";

export function* walk(
	nodes: Node[],
): Generator<{ node: Node; path: string[] }> {
	const stack = [{ nodes, index: 0, path: [] as string[] }];
	while (stack.length) {
		const frame = stack[stack.length - 1];
		if (frame.index === frame.nodes.length) {
			stack.pop();
			continue;
		}
		const node = frame.nodes[frame.index++];
		yield { node, path: frame.path };
		if (node.kind === "folder")
			stack.push({
				nodes: node.children,
				index: 0,
				path: [...frame.path, node.title],
			});
	}
}

export function* sections(
	lib: Pick<Library, "favorites" | "spaces">,
): Generator<{
	space: Space | null;
	name: "Favorites" | "Pinned" | "Today";
	nodes: Node[];
}> {
	yield { space: null, name: "Favorites", nodes: lib.favorites };
	for (const space of lib.spaces) {
		yield { space, name: "Pinned", nodes: space.pinned };
		yield { space, name: "Today", nodes: space.today };
	}
}

export function summarize(lib: Library) {
	const counts: ParseReport["counts"] = {
		spaces: lib.spaces.length,
		tabs: 0,
		folders: 0,
		favorites: 0,
		today: 0,
		skipped: lib.report.skipped.length,
	};
	// A repeat-import hint, computed from normalized content rather than trusted pack metadata.
	let hash = 2166136261;
	const add = (value: string) => {
		for (let i = 0; i < value.length; i++)
			hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
		hash = Math.imul(hash ^ 0xffff, 16777619);
	};
	for (const section of sections(lib)) {
		add(section.space?.arcId ?? "");
		add(section.name);
		for (const { node, path } of walk(section.nodes)) {
			add(String(path.length));
			add(node.arcId);
			add(node.title);
			if (node.kind === "folder") counts.folders++;
			else {
				counts.tabs++;
				add(node.url);
				if (section.name === "Favorites") counts.favorites++;
				if (section.name === "Today") counts.today++;
			}
		}
	}
	lib.source.sourceHash = (hash >>> 0).toString(16).padStart(8, "0");
	lib.report.counts = counts;
	return lib;
}

export function emptyLibrary(): Library {
	return {
		schemaVersion: 1,
		source: {
			platform: "unknown",
			parsedAt: new Date().toISOString(),
			sourceHash: "",
		},
		favorites: [],
		spaces: [],
		report: {
			skipped: [],
			warnings: [],
			counts: {
				spaces: 0,
				tabs: 0,
				folders: 0,
				favorites: 0,
				today: 0,
				skipped: 0,
			},
		},
	};
}
