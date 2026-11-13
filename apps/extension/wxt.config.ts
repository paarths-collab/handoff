import { defineConfig } from "wxt";
import { resolve } from "node:path";

export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	manifestVersion: 3,
	manifest: ({ browser, mode }) => ({
		name: "Handoff",
		icons: Object.fromEntries(
			[16, 32, 48, 96, 128].map((size) => [size, "icons/" + size + ".png"]),
		),
		description:
			"Move an Arc sidebar into browser tabs or bookmarks on your own computer.",
		version: "1.0.0",
		permissions: ["tabGroups", "storage"],
		optional_permissions: ["tabs", "bookmarks"],
		content_security_policy: {
			extension_pages:
				"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
		},
		...(browser === "firefox"
			? {
					browser_specific_settings: {
						gecko: {
							id: "handoff@addons.local",
							strict_min_version: "140.0",
							data_collection_permissions: { required: ["none"] },
						},
					},
				}
			: { key: mode === "development" ? DEV_PUBLIC_KEY : LOCAL_PUBLIC_KEY }),
	}),
	zip: {
		sourcesRoot: resolve(import.meta.dirname, "../.."),
		includeSources: [
			"package.json",
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
			"tsconfig*.json",
			".nvmrc",
			"apps/*/package.json",
			"apps/extension/{entrypoints,public,src}/**",
			"apps/extension/wxt.config.ts",
			"apps/extension/SOURCE_BUILD.md",
			"packages/{core,ui}/package.json",
			"packages/{core,ui}/src/**",
		],
		excludeSources: [
			"**/node_modules/**",
			"**/.wxt/**",
			"**/.output/**",
			"**/dist/**",
			"**/*.test.ts",
		],
	},
});

// Public half of a throwaway key, used only for a stable development extension ID.
const DEV_PUBLIC_KEY =
	"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAo5AGd5cJcvCY1s5aQRiGyyXxhwrIqujBSnZOiBPNp3MyD+obPj6ysqhXo8lEc0tXqh/Fur6o7h6L6X7RbB51n9gO6BoSUpKjLEH36ZSKwwyAPejz5isB/87V74nOw9fGGfsTsnezeUvLXRkEqymoHjKmwNeRwrMxAOXR9nBrJTRlXIE7vLdxGX4urzM+e7uvhUQlaaEUUoaN8RYbSOZ33A1nh4gdXIL9FnOowRyNusABUn0x3B0U/OIaRsaF+qO+pFol7c9VcimQxZLD4TkXZcjajUtRM8AVG+PFkRRb83IGw8t8BtKxgmFfaWhq3HL18fJS/mqi/RlBrrFh93GrYQIDAQAB";

// Public half of the key for the downloadable extension that people load themselves
// (Load unpacked). It fixes the extension ID so the desktop app can open the importer.
// The private half was discarded: unpacked loading never needs it.
const LOCAL_PUBLIC_KEY =
	"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjIT8m+8I8rvyLhCkpGouZrlp1zvxYeUQHYepqGkNvqV8i036+zB2jcRYiMrDxKaE7dthm6P/eIgOc2rYgYwwdlAQSh/8W3L9IOr/8apV1RWchyGqD3CKlqtSByjQ9RXCUH5Xdia5/ApY4FqfdzVLGr/tS9wvlxA6APQ2qJ5HHG3nC+XglkIhJal0oBtTEMKW0GDklvQphqPony6pu1RlrD7Yf0nhH54Lyy2hzXQYSL5MHVgd36z1xpYtW14EtMmbG5IH/BAko3TxJp3g4JEJ+Ki0kKdZ2I60qGZCly7d3+dte2rWtut6b0KtK1eLRG1cTBRuAvKO/5V5lj/Tz4f5cQIDAQAB";
