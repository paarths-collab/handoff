import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import {
	parseInput,
	parseArcArchive,
	recoverArchivedTabs,
	defaultOptions,
	planImport,
} from "../../../packages/core/src/index";

const directory = resolve("apps/extension");
async function workerOrigin(ctx: BrowserContext, observer: boolean) {
	const matches = (url: string) => url.endsWith("/observer.js") === observer;
	const worker =
		ctx.serviceWorkers().find((w) => matches(w.url())) ??
		(await ctx.waitForEvent("serviceworker", {
			predicate: (w) => matches(w.url()),
		}));
	return worker.url().split("/").slice(0, 3).join("/");
}

for (const name of [
	"tiny",
	"archive",
	"empty-spaces",
	"typical",
	"huge",
	"special-chars",
	"interrupted",
	"cancelled",
]) {
	test(
		"imports " + name + " in native windows and groups",
		async ({}, info) => {
			const fault = name === "interrupted" || name === "cancelled";
			const file = resolve(
				"fixtures",
				(fault ? "typical" : name === "archive" ? "tiny" : name) + ".json",
			);
			const parsed = parseInput(await readFile(file, "utf8"));
			if (!parsed.ok) throw Error("Invalid test fixture");
			const archive = parseArcArchive(
				await readFile(resolve("fixtures/archive/recovery.json"), "utf8"),
			);
			if (!archive.ok) throw Error("Invalid archive fixture");
			const lib =
				name === "archive"
					? recoverArchivedTabs(parsed.value, archive.value).library
					: parsed.value;
			const options = defaultOptions(lib);
			if (name === "archive") options.collapseGroups = false;
			const plan = planImport(lib, options);
			const profile = await mkdtemp(join(tmpdir(), "handoff-browser-"));
			const paths = [
				resolve(directory, ".output/chrome-mv3"),
				resolve(directory, "e2e/observer"),
			].join(",");
			const context = await chromium.launchPersistentContext(profile, {
				channel: "chromium",
				headless: true,
				executablePath: process.env.HANDOFF_BROWSER,
				args: [
					"--disable-extensions-except=" + paths,
					"--load-extension=" + paths,
					"--disable-background-networking",
					"--host-resolver-rules=MAP *.test ~NOTFOUND",
				],
			});
			try {
				// Browser loads test pages locally without contacting any fixture domains.
				await context.route("**/*.test/**", (route) =>
					route.fulfill({
						contentType: "text/html",
						body: "<title>Synthetic page</title>",
					}),
				);
				const [origin, observerOrigin] = await Promise.all([
					workerOrigin(context, false),
					workerOrigin(context, true),
				]);
				const observer = await context.newPage();
				await observer.goto(observerOrigin + "/observer.html");
				const importer = await context.newPage();
				await importer.goto(origin + "/importer.html");
				await importer.locator("input[type=file]").setInputFiles(file);
				await expect(
					importer.getByRole("button", { name: "Move", exact: true }),
				).toBeVisible();
				if (name === "archive") {
					await importer
						.getByRole("button", { name: "Preview sidebar", exact: true })
						.click();
					await importer
						.getByRole("button", { name: "Import options", exact: true })
						.click();
					const beforeRecovery = await observer.evaluate(async () =>
						(await chrome.windows.getAll()).map((window) => window.id),
					);
					// Leave recovery groups expanded so recovered links are visible.
					await importer.getByLabel("Start with groups collapsed").uncheck();
					const recovery = importer.getByRole("region", {
						name: "Archived tab recovery",
					});
					await recovery
						.getByLabel("Choose archive file")
						.setInputFiles(resolve("fixtures/archive/recovery.json"));
					await expect(recovery.getByRole("status")).toContainText(
						"2 recoverable tabs",
					);
					await recovery
						.getByRole("button", { name: "Add recovered tabs to preview" })
						.click();
					await expect(importer.locator(".ws-totals")).toContainText("5 tabs");
					expect(
						await observer.evaluate(async () =>
							(await chrome.windows.getAll()).map((window) => window.id),
						),
					).toEqual(beforeRecovery);
				}
				const before = await observer.evaluate(async () =>
					(await chrome.windows.getAll({ populate: true })).map((w) => w.id),
				);
				await importer
					.getByRole("button", { name: "Move", exact: true })
					.click();
				if (fault) {
					await importer.waitForFunction(
						async () =>
							Object.keys(await chrome.storage.session.get(null)).filter(
								(key) => key.startsWith("handoffOwned:"),
							).length >= 2,
					);
					let page = importer;
					if (name === "interrupted") {
						await importer.close();
						page = await context.newPage();
						await page.goto(origin + "/importer.html");
						await expect(
							page.getByText(/Interrupted or still open/),
						).toBeVisible();
					} else {
						await page.getByRole("button", { name: "Cancel move" }).click();
						await expect(
							page.getByRole("heading", { name: "Move cancelled" }),
						).toBeVisible();
					}
					page.once("dialog", (dialog) => dialog.accept());
					await page.getByRole("button", { name: /^Undo last/ }).click();
					await expect(
						page.getByText("Import undone.", { exact: true }),
					).toBeVisible();
					expect(
						await observer.evaluate(async () =>
							(await chrome.windows.getAll()).map((w) => w.id),
						),
					).toEqual(before);
					return;
				}
				await expect(
					importer.getByRole("heading", { name: "Move complete" }),
				).toBeVisible({ timeout: 110000 });
				const state = await observer.evaluate(async (initial) => {
					const all = await chrome.windows.getAll({ populate: true });
					const groups = await chrome.tabGroups.query({});
					return all
						.filter((w) => !initial.includes(w.id))
						.map((w) => ({
							id: w.id,
							tabs: w.tabs?.map((t) => ({
								url: t.url ?? t.pendingUrl,
								pinned: t.pinned,
								group: groups.find((g) => g.id === t.groupId)?.title ?? null,
							})),
							groups: groups
								.filter((g) => g.windowId === w.id)
								.map((g) => ({
									title: g.title ?? "",
									color: g.color,
									collapsed: g.collapsed,
								})),
						}));
				}, before);
				await info.attach("browser-state", {
					contentType: "application/json",
					body: Buffer.from(JSON.stringify(state)),
				});
				expect(state).toHaveLength(plan.windows.length);
				for (const [i, w] of plan.windows.entries()) {
					const actual = state[i];
					const expectedTabs =
						w.tabs.length === 0
							? [{ url: "about:blank", pinned: false, group: null }]
							: w.tabs.map((t) => ({
									url: new URL(t.url).href,
									pinned: t.pinned,
									group:
										w.groups.find((g) => g.key === t.groupKey)?.title ?? null,
								}));
					expect(actual.tabs).toEqual(expectedTabs);
					const sort = (a: { title: string }, b: { title: string }) =>
						a.title.localeCompare(b.title);
					expect(actual.groups.sort(sort)).toEqual(
						w.groups
							.map(({ title, color, collapsed }) => ({
								title,
								color,
								collapsed,
							}))
							.sort(sort),
					);
				}
				if (name === "tiny" || name === "archive") {
					const added = await observer.evaluate(
						async (windowId) =>
							(await chrome.tabs.create({ windowId, url: "about:blank" })).id,
						state[0].id,
					);
					importer.once("dialog", (dialog) => dialog.accept());
					await importer
						.getByRole("button", { name: "Undo last move" })
						.click();
					await expect(
						importer.getByText("Import undone.", { exact: true }),
					).toBeVisible();
					expect(
						await observer.evaluate(
							async (windowId) =>
								(await chrome.tabs.query({ windowId })).map((t) => t.id),
							state[0].id,
						),
					).toEqual([added]);
				}
			} finally {
				await context.close();
				await rm(profile, { recursive: true, force: true });
			}
		},
	);
}
