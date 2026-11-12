import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const tiny = fileURLToPath(
	new URL("../../../fixtures/tiny.json", import.meta.url),
);

test("offline converter previews a sidebar and downloads all four formats", async ({
	page,
	context,
}) => {
	await page.goto("/convert.html");
	const choose = page.getByLabel("Choose a file");
	await expect(choose).toBeAttached();
	await page.waitForLoadState("networkidle");
	const requests: string[] = [];
	page.on("request", (request) => requests.push(request.resourceType()));
	await context.setOffline(true);
	await choose.setInputFiles(tiny);
	await expect(
		page.getByRole("heading", { name: "Preview your sidebar" }),
	).toBeFocused();
	const tree = page.getByRole("tree");
	await tree.focus();
	await tree.press("Home");
	await tree.press("End");
	await expect(tree).toBeFocused();
	for (const [title, filename, text] of [
		["Bookmarks", "bookmarks.html", "NETSCAPE-Bookmark-file-1"],
		["Arc Archive", "archive.html", "<html"],
		["Tab Mover pack", "tab-mover-pack.json", "tab-mover-pack"],
		["Spreadsheet", "tabs.csv", "folder_path"],
	]) {
		const done = page.waitForEvent("download");
		const button = page.getByRole("button", {
			name: "Download " + title,
			exact: true,
		});
		await button.focus();
		await button.press("Enter");
		const download = await done;
		expect(download.suggestedFilename()).toBe(filename);
		expect(
			(await readFile((await download.path())!, "utf8")).toLowerCase(),
		).toContain(text.toLowerCase());
	}
	expect(requests).toEqual([]);
});

test("file errors allow another selection", async ({ page }) => {
	await page.goto("/convert.html");
	const choose = page.getByLabel("Choose a file");
	await choose.setInputFiles({
		name: "broken.json",
		mimeType: "application/json",
		buffer: Buffer.from("{"),
	});
	await expect(page.getByRole("alert")).toBeVisible();
	await choose.setInputFiles(tiny);
	await expect(page.getByRole("tree")).toBeVisible();
	await page.getByRole("button", { name: "Choose another file" }).click();
	await expect(choose).toBeFocused();
});

test("the converter previews the fixture libraries and reports malformed inputs", async ({
	page,
}) => {
	const fixtures = new URL("../../../fixtures/", import.meta.url);
	const examples = (await readdir(fixtures)).filter((name) =>
		name.endsWith(".json"),
	);
	expect(examples).toContain("typical.json");
	await page.goto("/convert.html");
	const choose = page.getByLabel("Choose a file");
	for (const name of examples) {
		await choose.setInputFiles(fileURLToPath(new URL(name, fixtures)));
		if (["not-arc.json", "truncated.json"].includes(name)) {
			await expect(page.getByRole("alert")).toBeVisible();
		} else {
			await expect(
				page.getByRole("heading", { name: "Preview your sidebar" }),
			).toBeVisible();
			await page.getByRole("button", { name: "Choose another file" }).click();
		}
	}
});

test("a large preview supports keyboard selection and virtual navigation", async ({
	page,
}) => {
	const sidebar = JSON.parse(await readFile(tiny, "utf8"));
	const data = sidebar.sidebar.containers.find((entry: { items?: unknown[] }) =>
		Array.isArray(entry.items),
	);
	const tab = data.items.find(
		(item: { data?: { tab?: unknown } }) => item?.data?.tab,
	);
	for (let n = 0; n < 1500; n++)
		data.items.push({ ...tab, id: "virtual-" + n, title: "Virtual tab " + n });
	await page.goto("/convert.html");
	await page
		.getByLabel("Choose a file")
		.setInputFiles({
			name: "large.json",
			mimeType: "application/json",
			buffer: Buffer.from(JSON.stringify(sidebar)),
		});
	const tree = page.getByRole("tree");
	await tree.focus();
	expect(await page.getByRole("treeitem").count()).toBeLessThan(100);
	await tree.press("End");
	const active = await tree.getAttribute("aria-activedescendant");
	await expect(page.locator(`[id="${active}"]`)).toBeInViewport();
	await tree.press("Home");
	const space = page.getByRole("treeitem", { checked: true }).first();
	await expect(space).toBeAttached();
	await tree.press(" ");
	await expect(page.getByText("0 of 1 Spaces selected")).toBeVisible();
});
