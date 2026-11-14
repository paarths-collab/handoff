import { defineConfig } from "@playwright/test";

export default defineConfig({
	testMatch: [
		"**/apps/desktop/e2e/**/*.spec.ts",
		"**/apps/extension/e2e/**/*.spec.ts",
	],
	testIgnore: ["**/.worktrees/**", "**/node_modules/**"],
	workers: 1,
	timeout: 120000,
	reporter: [["list"], ["html", { open: "never" }]],
	use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
});
