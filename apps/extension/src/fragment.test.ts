import { gzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { readFragment } from "./fragment";

it("decodes a gzip handoff and rejects incomplete or oversized data", async () => {
	const pack = '{"format":"tab-mover-pack"}';
	expect(
		await readFragment("#pack=" + gzipSync(pack).toString("base64url")),
	).toBe(pack);
	await expect(readFragment("#tab=hello")).rejects.toThrow();
	await expect(readFragment("#pack=invalid=")).rejects.toThrow();
	await expect(
		readFragment(
			"#pack=" +
				gzipSync(Buffer.alloc(16 * 1024 * 1024 + 1)).toString("base64url"),
		),
	).rejects.toThrow();
});
