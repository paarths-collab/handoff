import { expect, type Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setup(page: Page, named = true) {
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
			if (command === "list_profiles")
				return named
					? {
							named: true,
							profiles: [
								{ directory: "Default", name: "Personal" },
								{ directory: "Profile 3", name: "Work" },
							],
						}
					: {
							named: false,
							profiles: [
								{ directory: "Default", name: "Default" },
								{ directory: "Profile 3", name: "Profile 3" },
							],
						};
			if (command === "open_privacy_settings") return null;
			if (command === "open_in_profile") return null;
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
	return actions;
}

test("desktop UI previews a discovered sidebar, saves exports and hands off a pack", async ({
	page,
}) => {
	const actions = await setup(page);
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

test("desktop UI opens each Space in its chosen browser profile only after a click", async ({
	page,
}) => {
	const actions = await setup(page);
	const section = page.locator("section.profiles");
	await expect(
		section.getByRole("heading", { name: "Open in Chrome profiles" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Move your saved passwords" }),
	).toBeVisible();
	expect(actions.some((x) => x.command === "open_in_profile")).toBe(false);
	const row = section
		.locator(".profile-rows label")
		.filter({ hasNotText: "Favorites" })
		.first();
	await row.locator("select").selectOption("Profile 3");
	await section
		.getByRole("button", { name: "Open 3 tabs in 1 profile" })
		.click();
	await expect
		.poll(() => actions.filter((x) => x.command === "open_in_profile").length)
		.toBe(1);
	const open = actions.find((x) => x.command === "open_in_profile")!
		.args as unknown as { browser: string; profile: string; urls: string[] };
	expect(open.browser).toBe("chrome");
	expect(open.profile).toBe("Profile 3");
	expect(open.urls).toHaveLength(3);
	expect(open.urls.every((u) => /^https?:\/\//.test(u))).toBe(true);
	await expect(
		page.getByRole("status", { name: "File operation" }),
	).toContainText("Opened 3 tabs in 1 Chrome profile.");
	await section
		.getByRole("button", { name: "Save bookmarks for Work" })
		.click();
	await expect.poll(() => actions.at(-1)?.command).toBe("save_export");
	expect(actions.at(-1)?.args.format).toBe("bookmarks");
	expect(actions.at(-1)?.args.contents).toContain("NETSCAPE-Bookmark-file-1");
});

test("without permission to read names, profiles can be shown, named and used", async ({
	page,
}) => {
	const actions = await setup(page, false);
	const section = page.locator("section.profiles");
	await expect(section.getByText("macOS is blocking Handoff")).toBeVisible();
	await section
		.locator(".label-row")
		.filter({ hasText: "Profile 3" })
		.getByRole("button", { name: "Show" })
		.click();
	await expect.poll(() => actions.at(-1)?.command).toBe("open_in_profile");
	expect(actions.at(-1)?.args).toEqual({
		browser: "chrome",
		profile: "Profile 3",
		urls: [],
	});
	await section.getByLabel("Name for Profile 3").fill("Work");
	const row = section
		.locator(".profile-rows label")
		.filter({ hasNotText: "Favorites" })
		.first();
	await expect(row.locator("select option", { hasText: "Work" })).toHaveCount(
		1,
	);
	await row.locator("select").selectOption({ label: "Work" });
	await section
		.getByRole("button", { name: /Open 3 tabs in 1 profile/ })
		.click();
	await expect
		.poll(() => actions.filter((x) => x.command === "open_in_profile").length)
		.toBe(2);
	expect(actions.at(-1)?.args.profile).toBe("Profile 3");
	await section.getByRole("button", { name: /allow Full Disk Access/ }).click();
	await expect
		.poll(() => actions.at(-1)?.command)
		.toBe("open_privacy_settings");
});
