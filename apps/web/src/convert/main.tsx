import {
	toArchiveHtml,
	toBookmarksHtml,
	toCsv,
	toPackJson,
	type Library,
	type ParseError,
	type Result,
} from "@tab-mover/core";
import {
	CopyDiagnosticButton,
	FileDrop,
	PathHelper,
	PreviewTree,
} from "@tab-mover/ui";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./page.css";

const formats = [
	{
		id: "bookmarks",
		title: "Bookmarks",
		ext: "HTML",
		description:
			"Import your selected Spaces and Favorites into another browser.",
		name: "bookmarks.html",
		mime: "text/html",
	},
	{
		id: "archive",
		title: "Arc Archive",
		ext: "HTML",
		description:
			"Search and browse your entire sidebar in a single offline page.",
		name: "archive.html",
		mime: "text/html",
	},
	{
		id: "pack",
		title: "Tab Mover pack",
		ext: "JSON",
		description: "Keep your complete library for a future move with Tab Mover.",
		name: "tab-mover-pack.json",
		mime: "application/json",
	},
	{
		id: "csv",
		title: "Spreadsheet",
		ext: "CSV",
		description: "Explore all tabs, folders and URLs in a spreadsheet.",
		name: "tabs.csv",
		mime: "text/csv",
	},
] as const;

function Converter() {
	const [lib, setLib] = useState<Library | null>(null);
	const [fileName, setFileName] = useState("");
	const [error, setError] = useState<ParseError | null>(null);
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [downloadStatus, setDownloadStatus] = useState("");
	const heading = useRef<HTMLHeadingElement>(null);
	const objectUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	useEffect(
		() => () => {
			for (const [url, timer] of objectUrls.current) {
				clearTimeout(timer);
				URL.revokeObjectURL(url);
			}
		},
		[],
	);
	useEffect(() => {
		if (lib) heading.current?.focus();
	}, [lib]);

	function load(result: Result<Library, ParseError>, name: string) {
		setError(result.ok ? null : result.error);
		setDownloadStatus("");
		if (!result.ok) {
			setLib(null);
			return;
		}
		setSelected(new Set(result.value.spaces.map((space) => space.arcId)));
		setFileName(name);
		setLib(result.value);
	}
	function download(format: (typeof formats)[number]) {
		if (!lib) return;
		try {
			let data: string;
			switch (format.id) {
				case "bookmarks":
					data = toBookmarksHtml(lib, { spaceIds: [...selected] });
					break;
				case "archive":
					data = toArchiveHtml(lib);
					break;
				case "pack":
					data = toPackJson(lib);
					break;
				case "csv":
					data = toCsv(lib);
					break;
			}
			const url = URL.createObjectURL(
				new Blob([data], { type: format.mime + ";charset=utf-8" }),
			);
			const timer = setTimeout(() => {
				URL.revokeObjectURL(url);
				objectUrls.current.delete(url);
			}, 30000);
			objectUrls.current.set(url, timer);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = format.name;
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			setDownloadStatus(`Download started for ${format.name}.`);
		} catch {
			setDownloadStatus(
				"The download could not be created. Try again or choose another format.",
			);
		}
	}
	return (
		<>
			<header className="converter-nav">
				<a className="converter-brand" href="./index.html">
					<span className="converter-mark" aria-hidden="true" />
					Tab Mover
				</a>
				<span className="converter-nav-current">Sidebar converter</span>
			</header>
			<main className="converter-main">
				<div className="converter-lead">
					<h1>Sidebar converter</h1>
					<p>
						Turn your Arc Spaces, folders and tabs into files you can keep or
						import into another browser.
					</p>
				</div>
				<div className="converter-layout">
					<section className="converter-card">
						{lib ? (
							<>
								<div className="converter-card-head">
									<h2 tabIndex={-1} ref={heading}>
										Preview your sidebar
									</h2>
									<button
										className="tm-link"
										type="button"
										onClick={() => {
											setLib(null);
											setError(null);
											setDownloadStatus("");
											requestAnimationFrame(() =>
												document
													.querySelector<HTMLInputElement>(".tm-pick input")
													?.focus(),
											);
										}}
									>
										Choose another file
									</button>
								</div>
								<p className="converter-file-name">{fileName}</p>
								<PreviewTree
									key={lib.source.sourceHash}
									library={lib}
									selectedSpaceIds={selected}
									onChange={setSelected}
								/>
								<CopyDiagnosticButton library={lib} appVersion="1.0.0" />
							</>
						) : (
							<>
								<h2>Open your sidebar</h2>
								<FileDrop onLoaded={load} />
								{error && (
									<div className="converter-error" role="alert">
										<b>Couldn’t open this file</b>
										<p>
											{error.message} {"hint" in error && error.hint}
										</p>
									</div>
								)}
								<PathHelper platform="unknown" />
							</>
						)}
					</section>
					<aside className="converter-side" aria-label="Privacy and exports">
						<div className="converter-privacy">
							<div className="converter-lock" aria-hidden="true" />
							<h2>On your device</h2>
							<p>
								This page’s security policy blocks network connections. Your
								file stays in this browser.
							</p>
						</div>
						{lib && (
							<section className="converter-formats">
								<h2>Download a file</h2>
								{formats.map((format) => (
									<button
										className="converter-format"
										type="button"
										key={format.id}
										onClick={() => download(format)}
										aria-label={`Download ${format.title}`}
									>
										<span className="converter-format-title">
											{format.title}
											<small>{format.ext}</small>
										</span>
										<span>{format.description}</span>
									</button>
								))}
								<p role="status">{downloadStatus}</p>
							</section>
						)}
						{!lib && (
							<div className="converter-before">
								<h2>Available formats</h2>
								<ul>
									{formats.map((format) => (
										<li key={format.id}>
											{format.title}
											<small>{format.ext}</small>
										</li>
									))}
								</ul>
							</div>
						)}
					</aside>
				</div>
			</main>
		</>
	);
}
createRoot(document.getElementById("root")!).render(<Converter />);
