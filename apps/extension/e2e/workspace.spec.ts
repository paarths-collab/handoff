import { chromium, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

for (const platform of ["MacIntel", "Win32", "Linux x86_64"]) {
	test(`compact and expanded extension views show only the selected file and keep selections (${platform})`, async () => {
		const profile = await mkdtemp(join(tmpdir(), "handoff-workspace-"));
		const extension = resolve("apps/extension/.output/chrome-mv3");
		const context = await chromium.launchPersistentContext(profile, {
			channel: "chromium",
			headless: true,
			executablePath: process.env.HANDOFF_BROWSER,
			args: [
				`--disable-extensions-except=${extension}`,
				`--load-extension=${extension}`,
			],
		});
		try {
			await context.addInitScript((value) => {
				Object.defineProperty(navigator, "platform", {
					value,
					configurable: true,
				});
			}, platform);
			const worker =
				context.serviceWorkers()[0] ??
				(await context.waitForEvent("serviceworker"));
			const origin = worker.url().split("/").slice(0, 3).join("/");
			const page = await context.newPage();
			await page.goto(origin + "/importer.html");
			await expect(page.locator(".handoff-workspace")).toHaveClass(
				/is-compact/,
			);
			await expect(page.locator(".ws-export")).toHaveCount(0);
			await expect(page.locator(".ws-space")).toHaveCount(0);
			await expect(page.locator(".ws-source")).toBeHidden();
			await expect(page.locator(".ws-filebar")).toHaveCount(0);
			await expect(page.locator(".tm-help")).toContainText(
				"StorableSidebar.json",
			);
			await expect(
				page.getByRole("button", { name: /example|sample/i }),
			).toHaveCount(0);
			const before = await worker.evaluate(async () => ({
				tabs: (await chrome.tabs.query({})).length,
				windows: (await chrome.windows.getAll()).length,
			}));
			const picker = page.getByLabel("Choose a file", { exact: true });
			await picker.setInputFiles({
				name: "my-selected-sidebar.json",
				mimeType: "application/json",
				buffer: Buffer.from(
					await (await import("node:fs/promises")).readFile(
						resolve("fixtures/tiny.json"),
					),
				),
			});
			await expect(page.locator(".ws-source")).toContainText(
				"my-selected-sidebar.json",
			);
			await page
				.getByRole("button", { name: "Preview sidebar", exact: true })
				.click();
			await expect(page.locator(".handoff-workspace")).toHaveClass(
				/is-expanded/,
			);
			await expect(page.locator(".ws-filebar")).toContainText(
				"my-selected-sidebar.json",
			);
			const checkbox = page
				.locator('.ws-spaces input[type="checkbox"]')
				.first();
			await checkbox.uncheck();
			await page.evaluate(() => {
				chrome.permissions.request = async () => true;
			});
			await page
				.getByRole("combobox", { name: "Export format" })
				.selectOption("bookmarks");
			await expect(
				page.getByRole("combobox", { name: "Export format" }),
			).toHaveValue("bookmarks");
			const count = await page
				.getByRole("button", { name: "Move", exact: true })
				.textContent();
			await page
				.getByRole("button", { name: "Compact view", exact: true })
				.click();
			await expect(
				page.getByRole("button", { name: "Move", exact: true }),
			).toHaveText(count!);
			await page
				.getByRole("button", { name: "Preview sidebar", exact: true })
				.click();
			await expect(checkbox).not.toBeChecked();
			await expect(
				page.getByRole("combobox", { name: "Export format" }),
			).toHaveValue("bookmarks");
			const chooser = page.waitForEvent("filechooser");
			await page
				.getByRole("button", { name: "Change file", exact: true })
				.click();
			await (await chooser).setFiles(resolve("fixtures/empty-spaces.json"));
			await expect(page.locator(".ws-filebar")).toContainText(
				"empty-spaces.json",
			);
			await picker.setInputFiles({
				name: "broken.json",
				mimeType: "application/json",
				buffer: Buffer.from("{"),
			});
			await expect(page.locator(".ws-source")).not.toBeVisible();
			await expect(page.locator(".ws-space")).toHaveCount(0);
			await expect(
				page.getByRole("button", { name: "Move", exact: true }),
			).toHaveCount(0);
			const after = await worker.evaluate(async () => ({
				tabs: (await chrome.tabs.query({})).length,
				windows: (await chrome.windows.getAll()).length,
			}));
			expect(after).toEqual(before);
		} finally {
			await context.close();
			await rm(profile, { recursive: true, force: true });
		}
	});
}
