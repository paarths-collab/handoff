import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "../packages/core/src/pack-format";
const file = "private/StorableSidebar.json";
if (!existsSync(file))
	console.log("Private sidebar comparison deferred (no supplied test file).");
else {
	const needles = new Set<string>();
	const stack: unknown[] = [JSON.parse(readFileSync(file, "utf8"))];
	while (stack.length) {
		const value = stack.pop();
		if (Array.isArray(value)) {
			for (const x of value) stack.push(x);
			continue;
		}
		if (!isRecord(value)) continue;
		for (const [key, v] of Object.entries(value)) {
			if (
				typeof v === "string" &&
				v &&
				(key === "title" || key === "savedTitle")
			)
				needles.add(v);
			if (typeof v === "string" && key === "savedURL") {
				try {
					const host = new URL(v).hostname;
					if (host) needles.add(host);
				} catch {}
			}
			if (typeof v === "object" && v !== null) stack.push(v);
		}
	}
	for (const entry of readdirSync("fixtures", {
		recursive: true,
		withFileTypes: true,
	}))
		if (entry.isFile()) {
			const body = readFileSync(join(entry.parentPath, entry.name), "utf8");
			for (const needle of needles)
				if (
					body.includes(needle) ||
					body.includes(JSON.stringify(needle).slice(1, -1))
				)
					throw new Error("Private text matched a fixture. Inspect locally.");
		}
	console.log("Fixture privacy comparison passed.");
}
