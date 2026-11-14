import type { ParseError } from "./model";
import type { Result } from "./result";

export const MAX_INPUT_BYTES = 100 * 1024 * 1024;
export function readJson(text: string): Result<unknown, ParseError> {
	if (typeof text !== "string")
		return {
			ok: false,
			error: { kind: "not-json", message: "Choose a JSON file." },
		};
	// UTF-8 needs one to three bytes per UTF-16 code unit. Only ambiguous
	// inputs need encoding; encodeInto stops as soon as the byte budget is full.
	const exceedsLimit =
		text.length > MAX_INPUT_BYTES ||
		(text.length > MAX_INPUT_BYTES / 3 &&
			new TextEncoder().encodeInto(text, new Uint8Array(MAX_INPUT_BYTES)).read <
				text.length);
	if (exceedsLimit)
		return {
			ok: false,
			error: {
				kind: "too-large",
				message: "This file exceeds the 100 MiB limit.",
				limitBytes: MAX_INPUT_BYTES,
			},
		};
	let value: unknown;
	try {
		value = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
	} catch {
		return {
			ok: false,
			error: {
				kind: "not-json",
				message: "The file does not contain complete JSON.",
			},
		};
	}
	return { ok: true, value };
}
