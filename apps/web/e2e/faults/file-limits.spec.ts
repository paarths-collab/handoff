import { expect, test } from "@playwright/test";
import { mkdir, open } from "node:fs/promises";
import { sidebar, wrap } from "../../../../scripts/gen-fixture";

test("recover from a file over 100 MiB and preview 50,000 tabs", async ({ page }, info) => {
	const directory = info.outputPath("files");
	await mkdir(directory, { recursive: true });
	const path = info.outputPath("files", "oversized.json");
	const oversized = await open(path, "wx");
	try {
		await oversized.truncate(100 * 1024 * 1024 + 1);
	} finally {
		await oversized.close();
	}

	await page.goto("/convert.html");
	const picker = page.getByLabel("Choose a file");
	await picker.setInputFiles(path);
	await expect(page.getByRole("alert")).toContainText("100 MB limit");

	const raw = wrap(sidebar(50_000, 4, 40));
	await picker.setInputFiles({
		name: "synthetic-large.json",
		mimeType: "application/json",
		buffer: Buffer.from(JSON.stringify(raw)),
	});
	await expect(page.locator(".tm-counts")).toContainText("50000 tabs");
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(page.getByRole("tree")).toBeVisible();
	expect(await page.getByRole("treeitem").count()).toBeLessThan(100);
});
