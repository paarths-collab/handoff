import {
	parseInput,
	toArchiveHtml,
	toBookmarksHtml,
	toCsv,
	toPackJson,
	type Library,
} from "@handoff/core";
import {
	CopyDiagnosticButton,
	PasswordGuide,
	PathHelper,
	PreviewTree,
} from "@handoff/ui";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Browser, ProfileMover } from "./profiles";
import "./style.css";

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
	const [selected, setSelected] = useState(new Set<string>());
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [savedPack, setSavedPack] = useState(false);
	const [showSafari, setShowSafari] = useState(false);
	const browser = browsers.find((item) => item.browser === target);

	useEffect(() => {
		let active = true;
		invoke<Sidebar[]>("find_arc_files")
			.then((files) => {
				if (active) setFound(files);
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
	return (
		<div className="desk">
			<header>
				<span className="app-mark" aria-hidden="true">
					⇥
				</span>
				<strong>Handoff</strong>
				<span className="platform">Desktop</span>
			</header>
			<main>
				<h1>{library ? "Your sidebar" : "Open your sidebar"}</h1>
				{library ? (
					<>
						<div className="source">
							<span>{source}</span>
							<button
								disabled={busy}
								onClick={() =>
									perform(async () =>
										load(await invoke<Sidebar | null>("pick_sidebar")),
									)
								}
							>
								Choose another file
							</button>
						</div>
						<PreviewTree
							library={library}
							selectedSpaceIds={selected}
							onChange={setSelected}
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
										Select your saved bookmarks HTML file and confirm the
										import.
									</li>
									<li>Open Bookmarks and expand an imported Space.</li>
								</ol>
							</section>
						)}
						<PasswordGuide destination={browser?.browser ?? "chrome"} />
						<CopyDiagnosticButton appVersion="1.0.0" library={library} />
					</>
				) : (
					<>
						<p className="intro">
							Preview your Spaces, folders and tabs, then choose where to take
							them. Your file stays on this computer.
						</p>
						<section className="choose">
							<h2>{found.length ? "Arc sidebar found" : "Choose a file"}</h2>
							{found.map((file, index) => (
								<div className="candidate" key={file.path}>
									<div>
										<strong>{filename(file)}</strong>
										<small>
											{Math.ceil(file.size / 1024).toLocaleString()} KB
											{file.modified
												? " · " +
													new Date(file.modified * 1000).toLocaleDateString()
												: ""}
										</small>
									</div>
									<button
										disabled={busy}
										className="primary"
										onClick={() => perform(() => load(file))}
									>
										{found.length > 1
											? "Preview file " + (index + 1)
											: "Preview sidebar"}
									</button>
								</div>
							))}
							<button
								className={found.length ? "" : "primary"}
								disabled={busy}
								onClick={() =>
									perform(async () =>
										load(await invoke<Sidebar | null>("pick_sidebar")),
									)
								}
							>
								{found.length
									? "Choose another file"
									: "Choose sidebar or pack"}
							</button>
						</section>
						<PathHelper
							platform={
								/Mac/.test(navigator.platform)
									? "macos"
									: /Win/.test(navigator.platform)
										? "windows"
										: "unknown"
							}
						/>
					</>
				)}
				<p className="status" role="status" aria-label="File operation">
					{busy ? "Working…" : status}
				</p>
				{error && (
					<p className="problem" role="alert">
						{error}
					</p>
				)}
			</main>
		</div>
	);
}
createRoot(document.getElementById("root")!).render(<App />);
