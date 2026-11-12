import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("desktop UI previews a discovered sidebar, saves exports and hands off a pack", async ({
	page,
}) => {
	const root = new URL("../dist/", import.meta.url);
	const input = await readFile(
		new URL("../../../fixtures/tiny.json", import.meta.url),
		"utf8",
	);
	const actions: { command: string; args: Record<string, string> }[] = [];
	await page.route("http://desktop.test/**", async (route) => {
		const name =
			new URL(route.request().url()).pathname.slice(1) || "index.html";
		if (name !== "index.html" && !/^assets\/[\w.-]+\.(js|css)$/.test(name))
			return route.abort();
		await route.fulfill({
			body: await readFile(new URL(name, root)),
			contentType: name.endsWith(".js")
				? "application/javascript"
				: name.endsWith(".css")
					? "text/css"
					: "text/html",
		});
	});
	await page.exposeFunction(
		"testNativeInvoke",
		(command: string, args: Record<string, string>) => {
			actions.push({ command, args });
			if (command === "find_arc_files")
				return [{ path: "fixture.json", size: input.length, modified: null }];
			if (command === "detect_browsers")
				return [
					{
						browser: "chrome",
						importer_available: true,
						store_available: false,
					},
				];
			if (command === "read_arc_file") return input;
			if (
				command === "save_export" ||
				command === "save_archive" ||
				command === "extension_installed"
			)
				return true;
			if (command === "open_in_browser") return null;
			throw new Error("Unexpected native command");
		},
	);
	await page.addInitScript(() => {
		const mock = window as unknown as {
			__TAURI_INTERNALS__: unknown;
			testNativeInvoke: unknown;
		};
		mock.__TAURI_INTERNALS__ = { invoke: mock.testNativeInvoke };
	});
	await page.goto("http://desktop.test/");
	await page.getByRole("button", { name: "Preview sidebar" }).click();
	await expect(page.getByRole("tree")).toBeVisible();
	await expect(page.locator(".tm-counts")).toContainText("3 tabs");
	expect(actions.some((x) => x.command === "open_in_browser")).toBe(false);
	await page.getByRole("button", { name: /Safari bookmarks/ }).click();
	await expect(
		page.getByRole("heading", { name: "Import in Safari" }),
	).toBeVisible();
	await page.getByRole("button", { name: /Arc Archive/ }).click();
	await expect(
		page.getByRole("status", { name: "File operation" }),
	).toContainText("Archive saved");
	await page.getByRole("button", { name: /Spreadsheet/ }).click();
	await expect(
		page.getByRole("status", { name: "File operation" }),
	).toContainText("Spreadsheet saved");
	await page.getByRole("button", { name: "Save browser pack" }).click();
	await expect.poll(() => actions.at(-1)?.command).toBe("open_in_browser");
	expect(actions.at(-1)?.args).toEqual({
		browser: "chrome",
		destination: "importer",
	});
	const exports = actions
		.filter((a) => a.command === "save_export")
		.map((a) => a.args);
	expect(exports.map((x) => x.format)).toEqual(["bookmarks", "csv", "pack"]);
	expect(exports[0].contents).toContain("NETSCAPE-Bookmark-file-1");
	expect(exports[1].contents).toContain("folder_path");
	expect(JSON.parse(exports[2].contents).library.report.counts.tabs).toBe(3);
	expect(
		actions.find((x) => x.command === "save_archive")?.args.html,
	).toContain("Tab archive");
});
