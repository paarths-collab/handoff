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
import { DesktopWorkspace, type ExportFormat } from "./workspace";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

type Detected = {
	browser: Browser;
	importer_available: boolean;
	store_available: boolean;
};
type Sidebar = { path: string; size: number; modified: number | null };
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
	const [showTools, setShowTools] = useState(false);
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
				onTools={() => setShowTools((value) => !value)}
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
			{library && showTools && (
				<section className="desktop-tools" aria-label="Migration tools">
					<div className="desktop-tools-heading">
						<h2>Migration tools</h2>
						<button type="button" onClick={() => setShowTools(false)}>
							Close tools
						</button>
					</div>

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
					<div className="export-grid">
						<section>
							<h2>Send to browser</h2>
							<p>
								Save your full library as a pack, then open it in the Handoff
								extension.
							</p>
							{browsers.length > 0 && (
								<label>
									Destination browser
									<select
										value={target}
										disabled={busy}
										onChange={(e) => {
											setTarget(e.target.value as Browser);
											setSavedPack(false);
										}}
									>
										{browsers.map(({ browser: b }) => (
											<option key={b} value={b}>
												{names[b]}
											</option>
										))}
									</select>
								</label>
							)}
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
						</section>
						<section>
							<h2>Save an export</h2>
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
					</div>
					{browser && (
						<ProfileMover
							library={library}
							selected={selected}
							browser={browser.browser}
							browserName={names[browser.browser]}
							busy={busy}
							perform={perform}
							setStatus={setStatus}
						/>
					)}
					{showSafari && (
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
					<PasswordGuide destination={browser?.browser ?? "chrome"} />
					<CopyDiagnosticButton appVersion="1.0.0" library={library} />
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
