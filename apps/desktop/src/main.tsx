import {
	parseInput,
	toArchiveHtml,
	toBookmarksHtml,
	toCsv,
	toPackJson,
	type Library,
} from "@handoff/core";
import {
	ArchiveRecovery,
	CopyDiagnosticButton,
	PasswordGuide,
	PathHelper,
} from "@handoff/ui";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Browser, ProfileMover } from "./profiles";
import "./style.css";
import brave from "./assets/browsers/brave.png";
import chrome from "./assets/browsers/chrome.png";
import edge from "./assets/browsers/edge.png";
import firefox from "./assets/browsers/firefox.png";
import opera from "./assets/browsers/opera.png";
import safariIcon from "./assets/browsers/safari.png";
import vivaldi from "./assets/browsers/vivaldi.png";
import { DesktopWorkspace, type ExportFormat } from "./workspace";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

type Detected = {
	browser: Browser;
	importer_available: boolean;
	store_available: boolean;
};
type Sidebar = { path: string; size: number; modified: number | null };
const icons: Record<Browser, string> = {
	chrome,
	brave,
	edge,
	vivaldi,
	opera,
	firefox,
};
const names: Record<Browser, string> = {
	chrome: "Chrome",
	brave: "Brave",
	edge: "Edge",
	vivaldi: "Vivaldi",
	opera: "Opera",
	firefox: "Firefox",
};
const filename = (file: Sidebar) => file.path.split(/[\\/]/).pop() || "Sidebar";
function errorMessage(reason: unknown) {
	return typeof reason === "string"
		? reason
		: "This action could not be completed. Try again.";
}

function App() {
	const [found, setFound] = useState<Sidebar[]>([]);
	const [browsers, setBrowsers] = useState<Detected[]>([]);
	const [target, setTarget] = useState<Browser | "">("");
	// Safari has no profiles or extension hook, so it moves through a bookmarks import.
	const [safari, setSafari] = useState(false);
	const onMac = /Mac/.test(navigator.platform);
	const [library, setLibrary] = useState<Library | null>(null);
	const [source, setSource] = useState("");
	const [sourcePath, setSourcePath] = useState("");
	const [selected, setSelected] = useState(new Set<string>());
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [savedPack, setSavedPack] = useState(false);
	const [showSafari, setShowSafari] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [format, setFormat] = useState<ExportFormat>("bookmarks");
	// After the preview, Send to browser opens the next steps, in the order the film shows.
	const [sending, setSending] = useState(false);
	useEffect(() => {
		if (!isTauri()) return;
		const window = getCurrentWindow();
		window
			.setSize(new LogicalSize(expanded ? 1080 : 560, expanded ? 800 : 740))
			.then(() => window.center())
			.catch(() =>
				setError("Could not resize the window. You can resize it manually."),
			);
	}, [expanded]);
	const browser = browsers.find((item) => item.browser === target);

	useEffect(() => {
		let active = true;
		invoke<Sidebar[]>("find_arc_files")
			.then((files) => {
				if (active)
					setFound(
						[...files].sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0)),
					);
			})
			.catch(() => {
				if (active) setStatus("Choose a sidebar file to begin.");
			});
		invoke<Detected[]>("detect_browsers")
			.then((list) => {
				if (active) {
					setBrowsers(list);
					setTarget(list[0]?.browser ?? "");
				}
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, []);

	async function perform(work: () => Promise<void>) {
		if (busy) return;
		setBusy(true);
		setError("");
		setStatus("");
		try {
			await work();
		} catch (reason) {
			setError(errorMessage(reason));
		} finally {
			setBusy(false);
		}
	}

	async function load(file: Sidebar | null) {
		if (!file) return;
		const text = await invoke<string>("read_arc_file", { path: file.path });
		const result = parseInput(text);
		if (!result.ok) throw result.error.message;
		setLibrary(result.value);
		setSelected(new Set(result.value.spaces.map((space) => space.arcId)));
		setSource(filename(file));
		setSourcePath(file.path);
		setSavedPack(false);
		setShowSafari(false);
		setSending(false);
		// Go straight to the full preview with the sidebar, as in the film.
		setExpanded(true);
	}

	async function save(kind: "bookmarks" | "csv" | "archive" | "pack") {
		if (!library) return;
		setShowSafari(false);
		if (kind === "archive") {
			if (
				await invoke<boolean>("save_archive", {
					html: toArchiveHtml(library),
					pack: toPackJson(library),
				})
			)
				setStatus(
					"Archive saved. Open archive.html inside the new Arc Archive folder.",
				);
			return;
		}
		const contents =
			kind === "pack"
				? toPackJson(library)
				: kind === "csv"
					? toCsv(library)
					: toBookmarksHtml(library, { spaceIds: [...selected] });
		if (!(await invoke<boolean>("save_export", { format: kind, contents })))
			return;
		if (kind === "bookmarks") {
			setShowSafari(true);
			setStatus("Bookmarks saved.");
		} else if (kind === "csv") setStatus("Spreadsheet saved.");
		else {
			setSavedPack(true);
			setStatus(
				"Pack saved. Drop it into the Handoff extension and review the preview before moving tabs.",
			);
			if (
				browser?.importer_available &&
				(await invoke<boolean | null>("extension_installed", {
					browser: browser.browser,
				}))
			) {
				await invoke("open_in_browser", {
					browser: browser.browser,
					destination: "importer",
				});
			}
		}
	}
	async function chooseFile() {
		await load(await invoke<Sidebar | null>("pick_sidebar"));
	}
	return (
		<div className="desktop-shell">
			{!(library && sending) && (
				<DesktopWorkspace
					key={library?.source.sourceHash ?? "empty"}
					library={library}
					source={source}
					sourceDetails={sourcePath}
					selected={selected}
					onSelection={setSelected}
					expanded={expanded}
					onToggle={() => setExpanded((value) => !value)}
					format={format}
					onFormat={setFormat}
					onPick={() => perform(chooseFile)}
					onExport={() => perform(() => save(format))}
					busy={busy}
					primary={{
						label: "Send to browser",
						onClick: () => {
							setSending(true);
							setExpanded(true);
						},
					}}
					candidates={found.map((file) => (
						<button
							type="button"
							key={file.path}
							disabled={busy}
							onClick={() => perform(() => load(file))}
						>
							<span>
								<strong>{filename(file)}</strong>
								<span className="ws-candidate-path">{file.path}</span>
							</span>
							<small>{Math.ceil(file.size / 1024).toLocaleString()} KB</small>
						</button>
					))}
					help={
						<PathHelper
							platform={
								/Mac/.test(navigator.platform)
									? "macos"
									: /Win/.test(navigator.platform)
										? "windows"
										: "unknown"
							}
						/>
					}
				/>
			)}
			{library && sending && (
				<section className="desktop-send" aria-labelledby="send-heading">
					<div className="desktop-send-heading">
						<button
							type="button"
							className="desktop-back"
							disabled={busy}
							onClick={() => setSending(false)}
						>
							← Back to preview
						</button>
						<h2 id="send-heading">Send to browser</h2>
						<p>
							{selected.size} {selected.size === 1 ? "Space" : "Spaces"}{" "}
							selected. Choose a browser, then a profile for each Space.
						</p>
					</div>
					<section className="desktop-step" aria-labelledby="browser-heading">
						<h3 id="browser-heading">Destination browser</h3>
						{browsers.length > 0 || onMac ? (
							<div
								className="browser-tiles"
								role="radiogroup"
								aria-labelledby="browser-heading"
							>
								{browsers.map(({ browser: b }) => (
									<button
										key={b}
										type="button"
										role="radio"
										aria-checked={!safari && b === target}
										disabled={busy}
										onClick={() => {
											setTarget(b);
											setSafari(false);
											setSavedPack(false);
										}}
									>
										<img src={icons[b]} alt="" width="28" height="28" />
										{names[b]}
									</button>
								))}
								{onMac && (
									<button
										type="button"
										role="radio"
										aria-checked={safari}
										disabled={busy}
										onClick={() => setSafari(true)}
									>
										<img src={safariIcon} alt="" width="28" height="28" />
										Safari
									</button>
								)}
							</div>
						) : (
							<p>
								No supported browser was found. Save bookmarks below instead.
							</p>
						)}
					</section>
					{safari ? (
						<section className="desktop-step guide" aria-label="Move to Safari">
							<h2>Move to Safari</h2>
							<p>
								Safari can't open Spaces directly. Save them as bookmarks, then
								import the file in Safari. Each Space becomes a bookmarks
								folder.
							</p>
							<button
								className="primary"
								disabled={busy}
								onClick={() => perform(() => save("bookmarks"))}
							>
								Save Safari bookmarks
							</button>
							<ol>
								<li>
									Open Safari and choose File → Import Browsing Data from File
									or Folder. In older versions choose File → Import From →
									Bookmarks HTML File.
								</li>
								<li>Select the saved bookmarks file and confirm the import.</li>
								<li>Open Bookmarks and expand an imported Space.</li>
							</ol>
						</section>
					) : (
						browser && (
							<ProfileMover
								library={library}
								selected={selected}
								browser={browser.browser}
								browserName={names[browser.browser]}
								busy={busy}
								perform={perform}
								setStatus={setStatus}
							/>
						)
					)}
					<section className="desktop-step export-grid">
						<section>
							<h2>Keep every folder</h2>
							<button
								className="file-button"
								disabled={busy}
								onClick={() => perform(() => save("bookmarks"))}
							>
								<strong>Safari bookmarks</strong>
								<small>Selected Spaces and Favorites · HTML</small>
							</button>
							<button
								className="file-button"
								disabled={busy}
								onClick={() => perform(() => save("archive"))}
							>
								<strong>Arc Archive</strong>
								<small>Full searchable library · HTML and JSON</small>
							</button>
							<button
								className="file-button"
								disabled={busy}
								onClick={() => perform(() => save("csv"))}
							>
								<strong>Spreadsheet</strong>
								<small>All tabs and folder paths · CSV</small>
							</button>
						</section>
					</section>
					{showSafari && !safari && (
						<section className="guide">
							<h2>Import in Safari</h2>
							<ol>
								<li>
									Open Safari and choose File → Import Browsing Data from File
									or Folder. In older versions choose File → Import From →
									Bookmarks HTML File.
								</li>
								<li>
									Select your saved bookmarks HTML file and confirm the import.
								</li>
								<li>Open Bookmarks and expand an imported Space.</li>
							</ol>
						</section>
					)}
					<details className="desktop-more">
						<summary>Tab groups with the Handoff extension</summary>
						<p>
							Opening in profiles makes plain tabs. For tab groups, save a pack
							and open it in the Handoff extension.
						</p>
						<button
							className="primary"
							disabled={busy}
							onClick={() => perform(() => save("pack"))}
						>
							Save browser pack
						</button>
						{savedPack && (
							<div className="handoff">
								{browser?.importer_available && (
									<button
										disabled={busy}
										onClick={() =>
											perform(() =>
												invoke("open_in_browser", {
													browser: browser.browser,
													destination: "importer",
												}),
											)
										}
									>
										I already have the extension · Open importer
									</button>
								)}
								{browser?.store_available ? (
									<button
										disabled={busy}
										onClick={() =>
											perform(() =>
												invoke("open_in_browser", {
													browser: browser.browser,
													destination: "store",
												}),
											)
										}
									>
										Install extension
									</button>
								) : (
									<p>
										{browser?.browser === "firefox"
											? "No extension yet? In Firefox, open about:debugging, choose This Firefox, then Load Temporary Add-on and pick the Firefox file from the Handoff download. Firefox removes it when it restarts."
											: `No extension yet? Open ${browser ? names[browser.browser] : "your browser"}'s extensions page, turn on Developer mode, choose Load unpacked and pick the Handoff Extension folder from the download. Then open Handoff from the toolbar.`}
									</p>
								)}
							</div>
						)}
					</details>
					<ArchiveRecovery
						library={library}
						onChange={(next) => {
							setLibrary(next);
							setSelected(
								new Set(
									next.spaces
										.filter(
											(space) =>
												selected.has(space.arcId) ||
												!library.spaces.some(
													(old) => old.arcId === space.arcId,
												),
										)
										.map((space) => space.arcId),
								),
							);
							setSavedPack(false);
						}}
						chooseFile={async () => {
							const file = await invoke<Sidebar | null>("pick_sidebar");
							return file
								? invoke<string>("read_arc_file", { path: file.path })
								: null;
						}}
					/>
					<PasswordGuide destination={browser?.browser ?? "chrome"} />
					<CopyDiagnosticButton appVersion="1.0.1" library={library} />
				</section>
			)}
			<p className="desktop-status" role="status" aria-label="File operation">
				{busy ? "Working…" : status}
			</p>
			{error && (
				<p className="desktop-error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
createRoot(document.getElementById("root")!).render(<App />);
