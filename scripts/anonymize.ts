import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isRecord } from "../packages/core/src/pack-format";

// A schema allowlist prevents opaque Arc metadata from being copied into fixtures.
const keys = new Set(
	"sidebar containers global spaces items id parentID childrenIds title savedTitle savedURL data tab list splitView easel notes note itemContainer topAppsContainerIDs newContainerIDs pinned unpinned default profile custom _0 directoryBasename profileID customInfo icon iconType emoji_v2 color windowTheme background single style blendedSingleColor red green blue platform".split(
		" ",
	),
);
export function anonymize(raw: unknown): unknown {
	const titles = new Map<string, string>(),
		urls = new Map<string, string>();
	const id = (s: string) =>
		"id-" + createHash("sha256").update(s).digest("hex").slice(0, 20);
	const label = (s: string) => {
		if (!titles.has(s))
			titles.set(s, "Title " + String(titles.size + 1).padStart(4, "0"));
		return titles.get(s);
	};
	function scrub(value: unknown, key: string, depth: number): unknown {
		if (depth > 64)
			throw new Error("Metadata exceeds supported nesting depth.");
		if (typeof value === "string") {
			if (key === "savedURL") {
				if (!value) return "";
				if (!urls.has(value)) {
					const scheme = /^([a-z][a-z0-9+.-]*):/i
						.exec(value)?.[1]
						?.toLowerCase();
					urls.set(
						value,
						scheme && !["http", "https"].includes(scheme)
							? scheme + "://x"
							: "https://site-" +
									String(urls.size + 1).padStart(4, "0") +
									".test/p",
					);
				}
				return urls.get(value);
			}
			if (key === "platform")
				return value === "macos" || value === "windows" ? value : "unknown";
			if (
				[
					"title",
					"savedTitle",
					"directoryBasename",
					"icon",
					"emoji_v2",
					"profile",
				].includes(key)
			)
				return label(value);
			return id(value);
		}
		if (Array.isArray(value)) return value.map((v) => scrub(v, key, depth + 1));
		if (isRecord(value)) {
			const entries = Object.entries(value)
				.filter(([k]) => keys.has(k))
				.map(([k, v]) => [k, scrub(v, k, depth + 1)]);
			if (key === "data" && !entries.length && Object.keys(value).length)
				return { unsupported: {} };
			return Object.fromEntries(entries);
		}
		return typeof value === "number" && !["red", "green", "blue"].includes(key)
			? 0
			: value;
	}
	return scrub(raw, "", 0);
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		process.stdout.write(
			JSON.stringify(
				anonymize(JSON.parse(readFileSync(process.argv[2], "utf8"))),
			) + "\n",
		);
	} catch {
		console.error("Could not anonymize sidebar.");
		process.exitCode = 1;
	}
}
