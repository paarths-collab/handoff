import type { Library } from "./model";
import { sections, walk } from "./tree";
export function assertConserved(
	input: Library,
	outputTabArcIds: string[],
	skippedArcIds: string[],
): void {
	const counts = new Map<string, number>();
	for (const { nodes } of sections(input))
		for (const { node } of walk(nodes))
			if (node.kind === "tab")
				counts.set(node.arcId, (counts.get(node.arcId) ?? 0) + 1);
	for (const id of [...outputTabArcIds, ...skippedArcIds]) {
		const count = counts.get(id) ?? 0;
		if (count === 0) throw new Error("Unexpected or duplicated output tab.");
		if (count === 1) counts.delete(id);
		else counts.set(id, count - 1);
	}
	if (counts.size) throw new Error("Some input tabs were omitted.");
}
