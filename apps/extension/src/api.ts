import { browser } from "wxt/browser";

// Firefox exposes the same Promise-based methods under its browser namespace.
export const api = browser as unknown as typeof chrome;
export const isFirefox =
	typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox/");
export async function openImporter(extension: typeof chrome) {
	await extension.tabs.create({
		url: extension.runtime.getURL("importer.html"),
	});
}
