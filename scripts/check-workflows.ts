// Every third-party GitHub Action must be pinned to a full commit SHA, so a moved or
// compromised tag cannot change what runs in CI or in the release pipeline.
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const dir = ".github/workflows";
const unpinned: string[] = [];
for (const name of await readdir(dir)) {
	if (!/\.ya?ml$/.test(name)) continue;
	const lines = (await readFile(`${dir}/${name}`, "utf8")).split("\n");
	lines.forEach((line, i) => {
		const ref = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/)?.[1];
		if (ref && !ref.startsWith("./") && !/@[0-9a-f]{40}$/.test(ref))
			unpinned.push(`${dir}/${name}:${i + 1} ${ref}`);
	});
}
assert.deepEqual(unpinned, [], "Pin these Actions to a full commit SHA");
console.log("All workflow Actions are pinned to commit SHAs.");
