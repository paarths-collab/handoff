import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = resolve("apps/extension/.output");
const dirs = (await readdir(root, { withFileTypes: true })).filter(
	(e) => e.isDirectory() && /^(chrome|firefox)-mv[23]$/.test(e.name),
);
for (const target of ["chrome", "firefox"])
	assert(
		dirs.some((dir) => dir.name.startsWith(target)),
		"Missing built manifest for " + target,
	);
for (const dir of dirs) {
	const manifest = JSON.parse(
		await readFile(resolve(root, dir.name, "manifest.json"), "utf8"),
	);
	assert.deepEqual(manifest.permissions.toSorted(), ["storage", "tabGroups"]);
	assert.deepEqual(manifest.optional_permissions.toSorted(), [
		"bookmarks",
		"tabs",
	]);
	for (const field of [
		"host_permissions",
		"optional_host_permissions",
		"content_scripts",
		"web_accessible_resources",
		"externally_connectable",
	]) {
		assert(!Object.hasOwn(manifest, field), dir.name + " declares " + field);
	}
	// Chromium builds are loaded by hand, so they carry the key that fixes their ID.
	// Must match LOCAL_ID in apps/desktop/src-tauri/src/browsers.rs.
	if (dir.name.startsWith("chrome")) {
		const hex = createHash("sha256")
			.update(Buffer.from(manifest.key, "base64"))
			.digest("hex")
			.slice(0, 32);
		const id = [...hex]
			.map((c) => String.fromCharCode(97 + Number.parseInt(c, 16)))
			.join("");
		assert.equal(id, "fbaodfmbgdgjoedphimkhagfggglpiog", dir.name + " ID");
	} else assert(!Object.hasOwn(manifest, "key"), dir.name + " declares key");
	assert(
		manifest.content_security_policy.extension_pages.includes(
			"connect-src 'none'",
		),
	);
	console.log(dir.name + " manifest verified");
}
