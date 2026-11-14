import {
	parseInput,
	toArchiveHtml,
	toBookmarksHtml,
	toCsv,
	toPackJson,
	type Library,
} from "@handoff/core";
import { PathHelper, PreviewTree } from "@handoff/ui";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import exampleText from "./example.json?raw";
import { Icon, Mark } from "./icons";
import "./workspace.css";

const exampleResult = parseInput(exampleText);
if (!exampleResult.ok)
	throw new Error("The example sidebar could not be loaded.");
const example = exampleResult.value;
const stages = ["Source", "Review", "Export"] as const;
const titles = [
	"Open your sidebar.",
	"Review your Spaces.",
	"Take it with you.",
];
const intros = [
	<>
		Preview your <strong>Spaces, folders and tabs.</strong> Choose what moves
		with you.
	</>,
	<>
		Explore your sidebar. Select the <strong>Spaces to include</strong> in your
		bookmarks.
	</>,
	<>
		Save your <strong>browser bookmarks</strong> or keep a copy of your full
		sidebar.
	</>,
];
const formats = [
	{
		id: "bookmarks",
		title: "Browser bookmarks",
		detail: "Selected Spaces and Favorites",
		extension: "HTML",
		name: "bookmarks.html",
		mime: "text/html",
	},
	{
		id: "pack",
		title: "Handoff pack",
		detail: "Full library for the Handoff extension",
		extension: "JSON",
		name: "handoff-pack.json",
		mime: "application/json",
	},
	{
		id: "archive",
		title: "Searchable archive",
		detail: "Full library in an offline page",
		extension: "HTML",
		name: "archive.html",
		mime: "text/html",
	},
	{
		id: "csv",
		title: "Spreadsheet",
		detail: "All tabs and folder paths",
		extension: "CSV",
		name: "tabs.csv",
		mime: "text/csv",
	},
] as const;
type Platform = "macos" | "windows";
function initialPlatform(): Platform {
	const query = new URLSearchParams(location.search).get("platform");
	return query === "windows" ||
		(query !== "macos" && /win/i.test(navigator.platform))
		? "windows"
		: "macos";
}
function App() {
	const [platform, setPlatform] = useState<Platform>(initialPlatform);
	const [stage, setStage] = useState(0);
	const [library, setLibrary] = useState<Library>(example);
	const [source, setSource] = useState({
		name: "StorableSidebar.json",
		bytes: new Blob([exampleText]).size,
		sample: true,
	});
	const [selected, setSelected] = useState(
		() => new Set(example.spaces.map((s) => s.arcId)),
	);
	const [format, setFormat] =
		useState<(typeof formats)[number]["id"]>("bookmarks");
	const [error, setError] = useState(""),
		[status, setStatus] = useState(""),
		[loading, setLoading] = useState(false);
	const [drag, setDrag] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null),
		sequence = useRef(0),
		heading = useRef<HTMLHeadingElement>(null),
		help = useRef<HTMLDialogElement>(null);
	const counts = library.report.counts;
	const tag = source.sample ? "Example sidebar" : "Your sidebar";
	useEffect(() => {
		function scroll() {
			const max = document.documentElement.scrollHeight - innerHeight;
			document.documentElement.style.setProperty(
				"--scroll",
				String(max > 0 ? Math.max(0, Math.min(1, scrollY / max)) : 0),
			);
		}
		const observer = new ResizeObserver(scroll);
		observer.observe(document.body);
		addEventListener("scroll", scroll, { passive: true });
		scroll();
		return () => {
			observer.disconnect();
			removeEventListener("scroll", scroll);
		};
	}, []);
	function go(next: number) {
		setStage(next);
		setStatus("");
		window.scrollTo({ top: 0, behavior: "instant" });
		requestAnimationFrame(() =>
			heading.current?.focus({ preventScroll: true }),
		);
	}
	function switchPlatform(next: Platform) {
		setPlatform(next);
		const url = new URL(location.href);
		url.searchParams.set("platform", next);
		history.replaceState(null, "", url);
	}
	async function load(file?: File) {
		if (!file) return;
		const id = ++sequence.current;
		setLoading(true);
		setError("");
		setStatus("");
		try {
			if (file.size > 100 * 1024 * 1024)
				throw new Error("Choose a JSON file smaller than 100 MB.");
			const result = parseInput(await file.text());
			if (id !== sequence.current) return;
			if (!result.ok) throw new Error(result.error.message);
			setLibrary(result.value);
			setSelected(new Set(result.value.spaces.map((s) => s.arcId)));
			setSource({ name: file.name, bytes: file.size, sample: false });
			setStatus("File ready to review.");
		} catch (e) {
			if (id === sequence.current)
				setError(
					e instanceof Error ? e.message : "The file could not be opened.",
				);
		} finally {
			if (id === sequence.current) setLoading(false);
		}
	}
	function download() {
		const output = formats.find((f) => f.id === format)!;
		try {
			const text =
				format === "bookmarks"
					? toBookmarksHtml(library, { spaceIds: [...selected] })
					: format === "archive"
						? toArchiveHtml(library)
						: format === "csv"
							? toCsv(library)
							: toPackJson(library);
			const url = URL.createObjectURL(
				new Blob([text], { type: output.mime + ";charset=utf-8" }),
			);
			const a = document.createElement("a");
			a.href = url;
			a.download = output.name;
			document.body.append(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 30000);
			setStatus("Download started for " + output.name + ".");
		} catch {
			setError("The export could not be created. Try another format.");
		}
	}
	function showHelp() {
		help.current?.showModal();
		const details = help.current?.querySelector("details");
		if (details) details.open = true;
	}
	const canExport =
		format !== "bookmarks" || selected.size > 0 || library.favorites.length > 0;
	return (
		<div className="app" data-platform={platform}>
			<div className="chrome" aria-hidden="true">
				<div className="traffic">
					<i />
					<i />
					<i />
				</div>
				<span>Handoff</span>
				<div className="win-tools">─　 □　 ×</div>
			</div>
			<header className="bar">
				<div className="bar-inner">
					<div className="brand">
						<Mark />
						Handoff
					</div>
					<nav aria-label="Transfer steps">
						{stages.map((name, index) => (
							<button
								key={name}
								aria-current={index === stage ? "step" : undefined}
								onClick={() => go(index)}
							>
								{name}
							</button>
						))}
					</nav>
					<button
						className="help-button"
						onClick={showHelp}
						aria-label="File location"
					>
						<Icon name="help" size={16} />
						<span>File location</span>
					</button>
					<div className="switch" role="group" aria-label="Platform preview">
						{(["macos", "windows"] as const).map((os) => (
							<button
								key={os}
								aria-pressed={platform === os}
								onClick={() => switchPlatform(os)}
							>
								<Icon name={os === "macos" ? "mac" : "windows"} size={14} />
								{os === "macos" ? "macOS" : "Windows"}
							</button>
						))}
					</div>
				</div>
			</header>
			<main>
				<div className="content" key={stage}>
					<section className={"hero stage-" + stage}>
						<div className="hero-text">
							<h1 ref={heading} tabIndex={-1}>
								{titles[stage].split(" ").map((word, index) => (
									<span className="word" key={word}>
										<span style={{ animationDelay: index * 55 + "ms" }}>
											{word}
										</span>{" "}
									</span>
								))}
							</h1>
							<p>{intros[stage]}</p>
						</div>
					</section>
					{stage === 0 && (
						<>
							<section
								className={"panel source" + (drag ? " dropping" : "")}
								onDragOver={(e) => {
									e.preventDefault();
									setDrag(true);
								}}
								onDragLeave={(e) => {
									if (!e.currentTarget.contains(e.relatedTarget as Node))
										setDrag(false);
								}}
								onDrop={(e) => {
									e.preventDefault();
									setDrag(false);
									void load(e.dataTransfer.files[0]);
								}}
							>
								<div className="panel-heading">
									<div>
										<h2>Arc sidebar</h2>
									</div>
									<span className="ready">
										<i />
										{loading ? "Reading file" : "Ready to preview"}
									</span>
								</div>
								<div className="file-row">
									<div className="file-art" aria-hidden="true">
										<i />
										<b>{"{ }"}</b>
									</div>
									<div className="file-info">
										<strong>{source.name}</strong>
										<p>
											{tag} <i>·</i>{" "}
											{Math.max(1, Math.round(source.bytes / 1024))} KB <i>·</i>{" "}
											JSON
										</p>
									</div>
								</div>
								<div className="card-bottom">
									<button
										className="secondary"
										disabled={loading}
										onClick={() => fileInput.current?.click()}
									>
										<Icon name="review" size={16} />
										Choose another file
									</button>
									<input
										ref={fileInput}
										type="file"
										accept=".json,application/json"
										aria-label="Choose sidebar JSON"
										hidden
										onChange={(e) => {
											void load(e.target.files?.[0]);
											e.target.value = "";
										}}
									/>
									<button
										className="primary"
										disabled={loading}
										onClick={() => go(1)}
									>
										Preview sidebar <Icon name="arrow" size={17} />
									</button>
								</div>
							</section>
							<section className="overview">
								<div className="section-head">
									<h2>Sidebar overview</h2>
									<span>{tag}</span>
								</div>
								<div className="stats">
									{(
										[
											["spaces", "Spaces", counts.spaces],
											["review", "Folders", counts.folders],
											["tabs", "Tabs", counts.tabs],
										] as const
									).map(([icon, label, count]) => (
										<div key={label}>
											<Icon name={icon} />
											<b>{count}</b>
											<span>{label}</span>
										</div>
									))}
								</div>
							</section>
						</>
					)}
					{stage === 1 && (
						<section className="panel">
							<div className="panel-heading">
								<div>
									<h2>Your library</h2>
								</div>
								<span className="subtle">{tag}</span>
							</div>
							<PreviewTree
								key={library.source.sourceHash}
								library={library}
								selectedSpaceIds={selected}
								onChange={setSelected}
							/>
							<div className="card-bottom">
								<button className="secondary" onClick={() => go(0)}>
									<Icon name="back" size={16} />
									Source
								</button>
								<button className="primary" onClick={() => go(2)}>
									Choose export <Icon name="arrow" size={16} />
								</button>
							</div>
						</section>
					)}
					{stage === 2 && (
						<section className="panel">
							<div className="panel-heading">
								<div>
									<h2>Choose a format</h2>
								</div>
								<span className="subtle">{selected.size} Spaces selected</span>
							</div>
							<div className="formats">
								{formats.map((f) => (
									<label key={f.id}>
										<input
											type="radio"
											name="format"
											value={f.id}
											checked={format === f.id}
											onChange={() => {
												setFormat(f.id);
												setStatus("");
											}}
										/>
										<span>
											<strong>{f.title}</strong>
											<small>{f.detail}</small>
										</span>
										<kbd>{f.extension}</kbd>
									</label>
								))}
							</div>
							<div className="card-bottom">
								<button className="secondary" onClick={() => go(1)}>
									<Icon name="back" size={16} />
									Review
								</button>
								<button
									className="primary"
									disabled={!canExport}
									onClick={download}
								>
									Download export <Icon name="export" size={16} />
								</button>
							</div>
						</section>
					)}
					{error && (
						<p role="alert" className="error">
							{error}
						</p>
					)}
					<p className="status" role="status">
						{status}
					</p>
					<footer>
						<span>
							<Icon name="lock" size={14} />
							Your files stay on this device.
						</span>
						<button onClick={showHelp}>
							Where is my Arc file? <span>↗</span>
						</button>
					</footer>
				</div>
			</main>
			<dialog ref={help} className="location">
				<button
					className="close"
					onClick={() => help.current?.close()}
					aria-label="Close file location"
				>
					×
				</button>
				<p className="label">{platform === "macos" ? "macOS" : "Windows"}</p>
				<PathHelper key={platform} platform={platform} />
			</dialog>
		</div>
	);
}
createRoot(document.getElementById("root")!).render(<App />);
