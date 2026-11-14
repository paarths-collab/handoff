import type { Library, ParseError } from "./model";
import { sections, walk } from "./tree";

/**
 * Hard ceilings for any sidebar, pack or recovered archive, and for one Move. Real Arc
 * sidebars stay far below them; they stop a crafted file from exhausting the app or browser.
 */
export const LIMITS = {
	spaces: 1_000,
	nodes: 100_000,
	urlLength: 65_536,
	tabsPerMove: 5_000,
} as const;

const tooMany = (message: string): ParseError => ({
	kind: "too-many",
	message,
	hint: "Check that this is your own Arc sidebar or Handoff pack.",
});

/** Returns an error when a library is larger than Handoff will preview or move. */
export function libraryLimitError(lib: Library): ParseError | null {
	if (lib.spaces.length > LIMITS.spaces)
		return tooMany(
			`This file has more than ${LIMITS.spaces.toLocaleString("en-US")} Spaces.`,
		);
	let nodes = 0;
	for (const { nodes: list } of sections(lib))
		for (const { node } of walk(list)) {
			if (++nodes > LIMITS.nodes)
				return tooMany(
					`This file has more than ${LIMITS.nodes.toLocaleString("en-US")} tabs and folders.`,
				);
			if (node.kind === "tab" && node.url.length > LIMITS.urlLength)
				return tooMany("This file contains a link longer than 64 KB.");
		}
	return null;
}

/** Returns a message when one Move would open or bookmark too many tabs at once. */
export function moveLimitMessage(tabs: number): string | null {
	return tabs > LIMITS.tabsPerMove
		? `Handoff moves up to ${LIMITS.tabsPerMove.toLocaleString("en-US")} tabs at a time. Choose fewer Spaces and move the rest in another run.`
		: null;
}
