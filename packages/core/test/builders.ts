import type { Library, Space, TabNode } from "../src/model";

export function tab(
	arcId = "tab-1",
	url = "https://site-0001.test/p",
): TabNode {
	return {
		kind: "tab",
		arcId,
		url,
		title: "Title 0001",
		customTitle: null,
		savedTitle: "Title 0001",
	};
}

export function space(arcId = "space-1"): Space {
	return {
		arcId,
		title: "Space 1",
		titleGenerated: false,
		profile: null,
		color: null,
		icon: null,
		pinned: [tab()],
		today: [],
	};
}

export function library(): Library {
	return {
		schemaVersion: 1,
		source: {
			platform: "unknown",
			parsedAt: "2026-01-01T00:00:00Z",
			sourceHash: "synthetic",
		},
		favorites: [],
		spaces: [space()],
		report: {
			counts: {
				spaces: 1,
				tabs: 1,
				folders: 0,
				favorites: 0,
				today: 0,
				skipped: 0,
			},
			skipped: [],
			warnings: [],
		},
	};
}
