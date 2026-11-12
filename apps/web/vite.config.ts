import { readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));
function htmlEntries(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = resolve(dir, entry.name);
		if (
			entry.isDirectory() &&
			!entry.name.startsWith(".") &&
			!["dist", "node_modules", "e2e", "public"].includes(entry.name)
		)
			files.push(...htmlEntries(path));
		else if (
			entry.isFile() &&
			entry.name.endsWith(".html") &&
			entry.name !== "dev.html"
		)
			files.push(path);
	}
	return files;
}
export default defineConfig(({ command }) => ({
	root,
	base: "./",
	// The converter CSP blocks the development refresh preamble and WebSocket.
	plugins: command === "build" ? [react()] : [],
	server: { hmr: false },
	build: {
		rollupOptions: {
			input: Object.fromEntries(
				htmlEntries(root).map((path) => [
					relative(root, path).replace(/\.html$/, ""),
					path,
				]),
			),
		},
	},
}));
