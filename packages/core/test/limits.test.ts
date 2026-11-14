import { expect, it } from "vitest";
import {
	LIMITS,
	libraryLimitError,
	moveLimitMessage,
	parsePack,
	toPackJson,
} from "../src";
import { library, space, tab } from "./builders";

const tabs = (n: number) =>
	Array.from({ length: n }, (_, i) => tab(`t${i}`, `https://site.test/${i}`));

it("rejects packs with too many Spaces before preview", () => {
	const lib = library();
	lib.spaces = Array.from({ length: LIMITS.spaces + 1 }, (_, i) => ({
		...space(`space-${i}`),
		pinned: [tab(`t${i}`, `https://site.test/${i}`)],
	}));
	const result = parsePack(toPackJson(lib));
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.error.kind).toBe("too-many");
});

it("accepts the node limit and rejects one more", () => {
	const lib = library();
	lib.spaces = [];
	lib.favorites = tabs(LIMITS.nodes);
	expect(libraryLimitError(lib)).toBeNull();
	lib.favorites.push(tab("extra", "https://site.test/extra"));
	expect(libraryLimitError(lib)?.kind).toBe("too-many");
	expect(parsePack(toPackJson(lib)).ok).toBe(false);
});

it("rejects links longer than 64 KB", () => {
	const lib = library();
	lib.favorites = [
		tab("long", `https://site.test/${"a".repeat(LIMITS.urlLength)}`),
	];
	expect(libraryLimitError(lib)?.message).toMatch(/64 KB/);
});

it("caps one Move at 5,000 tabs", () => {
	expect(moveLimitMessage(LIMITS.tabsPerMove)).toBeNull();
	expect(moveLimitMessage(LIMITS.tabsPerMove + 1)).toMatch(/5,000 tabs/);
});
