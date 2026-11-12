import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

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
		"key",
	]) {
		assert(!Object.hasOwn(manifest, field), dir.name + " declares " + field);
	}
	assert(
		manifest.content_security_policy.extension_pages.includes(
			"connect-src 'none'",
		),
	);
	console.log(dir.name + " manifest verified");
}
