import type { Library, Node } from "../model";
import { sections, walk } from "../tree";

const html = (v: string) =>
	v
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
function folder(title: string, contents: string) {
	return (
		"<DT><H3>" + html(title) + "</H3>\n<DL><p>\n" + contents + "</DL><p>\n"
	);
}
// Bookmark files keep every link that cannot run code when clicked. Script-capable schemes
// (javascript:, data:, vbscript:, blob:) and unknown app handlers are left out.
const bookmarkSchemes = new Set([
	"http:",
	"https:",
	"ftp:",
	"mailto:",
	"file:",
	"about:",
	"arc:",
	"chrome:",
	"edge:",
	"brave:",
	"vivaldi:",
	"opera:",
]);
export function isBookmarkableUrl(value: string): boolean {
	try {
		return bookmarkSchemes.has(new URL(value).protocol);
	} catch {
		return false;
	}
}
function bookmarkNodes(nodes: Node[]) {
	const lines: string[] = [];
	let depth = 0;
	for (const { node, path } of walk(nodes)) {
		while (depth > path.length) {
			lines.push("</DL><p>");
			depth--;
		}
		if (node.kind === "folder") {
			lines.push("<DT><H3>" + html(node.title) + "</H3>", "<DL><p>");
			depth++;
		} else if (isBookmarkableUrl(node.url))
			lines.push(
				'<DT><A HREF="' + html(node.url) + '">' + html(node.title) + "</A>",
			);
	}
	while (depth-- > 0) lines.push("</DL><p>");
	return lines.join("\n") + "\n";
}
export function toBookmarksHtml(
	lib: Library,
	opts?: { spaceIds?: string[] },
): string {
	const selected = opts?.spaceIds ? new Set(opts.spaceIds) : null;
	const blocks = [folder("Favorites", bookmarkNodes(lib.favorites))];
	for (const space of lib.spaces)
		if (!selected || selected.has(space.arcId))
			blocks.push(
				folder(
					space.title,
					folder("Pinned", bookmarkNodes(space.pinned)) +
						folder("Today", bookmarkNodes(space.today)),
				),
			);
	return (
		'<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Handoff bookmarks</TITLE>\n<H1>Handoff bookmarks</H1>\n<DL><p>\n' +
		blocks.join("") +
		"</DL><p>\n"
	);
}

const searchScript = `const search=document.querySelector('#search');search.addEventListener('input',()=>{const q=search.value.toLowerCase().trim();for(const row of document.querySelectorAll('li'))row.hidden=!row.textContent.toLowerCase().includes(q);for(const group of Array.from(document.querySelectorAll('details')).reverse()){group.hidden=!!q&&!group.querySelector('li:not([hidden])');if(q&&!group.hidden)group.open=true}})`;
const scriptHash = "mNpxKvO/IHZPqlYmRlOERxqdvpai1FXbfmZkUdEniKE=";
const archiveCss =
	":root{color-scheme:light dark;font:16px/1.55 system-ui}body{margin:3rem auto;max-width:60rem;padding:0 1.5rem}input{font:inherit;padding:.5rem;width:min(95%,36rem)}details{margin:.4rem 0 .4rem 1rem}summary{cursor:pointer;font-weight:600}ul{padding-left:2rem}li,summary{overflow-wrap:anywhere}small{display:block;opacity:.75}";
function archiveGroup(title: string, contents: string) {
	return (
		"<details open><summary>" +
		html(title) +
		"</summary>" +
		contents +
		"</details>"
	);
}
function archiveNodes(nodes: Node[]): string {
	let depth = 0;
	const out: string[] = ["<ul>"];
	for (const { node, path } of walk(nodes)) {
		while (depth > path.length) {
			out.push("</ul></details></li>");
			depth--;
		}
		if (node.kind === "folder") {
			out.push(
				"<li><details open><summary>" + html(node.title) + "</summary><ul>",
			);
			depth++;
		} else {
			let link = false;
			try {
				link = ["https:", "http:", "mailto:"].includes(
					new URL(node.url).protocol,
				);
			} catch {}
			const title = html(node.title),
				url = html(node.url);
			out.push(
				"<li>" +
					(link
						? '<a href="' +
							url +
							'" rel="noopener noreferrer">' +
							title +
							"</a>"
						: title) +
					"<small>" +
					url +
					"</small></li>",
			);
		}
	}
	while (depth-- > 0) out.push("</ul></details></li>");
	out.push("</ul>");
	return out.join("");
}
export function toArchiveHtml(lib: Library): string {
	const contents = [archiveGroup("Favorites", archiveNodes(lib.favorites))];
	for (const s of lib.spaces)
		contents.push(
			archiveGroup(
				s.title,
				archiveGroup("Pinned", archiveNodes(s.pinned)) +
					archiveGroup("Today", archiveNodes(s.today)),
			),
		);
	if (lib.report.skipped.length)
		contents.push(
			archiveGroup(
				"Skipped items",
				"<ul>" +
					lib.report.skipped
						.map(
							(s) => "<li>" + html(s.reason) + " · " + html(s.detail) + "</li>",
						)
						.join("") +
					"</ul>",
			),
		);
	const embedded = toPackJson(lib).replaceAll("<", "\\u003c");
	return (
		'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-' +
		scriptHash +
		"'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\"><title>Handoff archive</title><style>" +
		archiveCss +
		'</style></head><body><main><h1>Tab archive</h1><label for="search">Search titles and URLs</label><br><input type="search" id="search">' +
		contents.join("") +
		'</main><script type="application/json" id="pack">' +
		embedded +
		"</script><script>" +
		searchScript +
		"</script></body></html>"
	);
}
export function toPackJson(lib: Library): string {
	return JSON.stringify({
		format: "handoff-pack",
		schemaVersion: 1,
		createdAt: new Date().toISOString(),
		library: lib,
	});
}
const csvCell = (s: string) =>
	'"' + (/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
export function toCsv(lib: Library): string {
	const rows = ["space,profile,section,folder_path,title,url"];
	for (const { space, name, nodes } of sections(lib))
		for (const { node, path } of walk(nodes)) {
			if (node.kind === "tab")
				rows.push(
					[
						space?.title ?? "",
						space?.profile ?? "",
						name,
						path.join(" / "),
						node.title,
						node.url,
					]
						.map(csvCell)
						.join(","),
				);
		}
	return rows.join("\r\n") + "\r\n";
}
export function toDiagnostic(lib: Library, appVersion: string): string {
	const warnings = new Map<string, number>();
	for (const w of lib.report.warnings)
		warnings.set(w.kind, (warnings.get(w.kind) ?? 0) + 1);
	const kinds = new Map<string, number>();
	for (const s of lib.report.skipped) {
		const k = ["easel", "notes", "note", "tab", "list", "splitView"].includes(
			s.detail,
		)
			? s.detail
			: "other";
		kinds.set(k, (kinds.get(k) ?? 0) + 1);
	}
	return JSON.stringify(
		{
			appVersion: /^\d+\.\d+\.\d+$/.test(appVersion) ? appVersion : "unknown",
			schemaVersion: 1,
			platform: lib.source.platform,
			counts: lib.report.counts,
			warnings: Object.fromEntries(warnings),
			skippedKinds: Object.fromEntries(kinds),
		},
		null,
		2,
	);
}
