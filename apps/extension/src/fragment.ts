const maxFragment = 2 * 1024 * 1024;
const maxJson = 16 * 1024 * 1024;

export async function readFragment(fragment: string): Promise<string> {
	if (!fragment.startsWith("#pack=") || fragment.length > maxFragment)
		throw Error("Invalid fragment");
	const payload = fragment.slice(6);
	if (!/^[A-Za-z0-9_-]+$/.test(payload)) throw Error("Invalid encoding");
	const binary = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	const reader = new Blob([bytes])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"))
		.getReader();
	const decoder = new TextDecoder("utf-8", { fatal: true });
	let size = 0;
	const chunks: string[] = [];
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxJson) throw Error("Fragment too large");
			chunks.push(decoder.decode(value, { stream: true }));
		}
		chunks.push(decoder.decode());
		return chunks.join("");
	} finally {
		await reader.cancel();
	}
}
