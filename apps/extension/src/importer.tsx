import { startOwnership, journaledAdapter } from "./ownership";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	defaultOptions,
	moveLimitMessage,
	parsePack,
	planImport,
	type ImportOptions,
	type Library,
	type ParseError,
	type Result,
} from "@handoff/core";
import {
	ArchiveRecovery,
	CopyDiagnosticButton,
	FileDrop,
	OptionsPanel,
	PasswordGuide,
	type PasswordDestination,
	PathHelper,
	SidebarWorkspace,
	type ExportFormat,
	ProgressView,
	ResultReport,
} from "@handoff/ui";
import { api, isFirefox } from "./api";
import { adapter } from "./adapter";
import {
	executePlan,
	newResult,
	skippedItems,
	type ImportResult,
} from "./executor";
import { moveBookmarks } from "./bookmarks";
import { readFragment } from "./fragment";
import {
	exclusive,
	lastResult,
	saveResult,
	sessionToken,
	undoAdapter,
	undoOwned,
} from "./storage";

function destination(): PasswordDestination {
	if (isFirefox) return "firefox";
	const ua = navigator.userAgent;
	if (/\bEdg\//.test(ua)) return "edge";
	if (/\bOPR\//.test(ua)) return "opera";
	if (/\bVivaldi\//.test(ua)) return "vivaldi";
	if ("brave" in navigator) return "brave";
	return "chrome";
}
function download(result: ImportResult) {
	const href = URL.createObjectURL(
		new Blob([JSON.stringify(skippedItems(result), null, 2)], {
			type: "application/json",
		}),
	);
	const a = document.createElement("a");
	a.href = href;
	a.download = "handoff-skipped.json";
	a.click();
	setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function Importer({ fragment }: { fragment: string }) {
	const [library, setLibrary] = useState<Library>();
	const [sourceName, setSourceName] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [showOptions, setShowOptions] = useState(false);
	const picker = useRef<HTMLDivElement>(null);
	const [options, setOptions] = useState<ImportOptions>();
	const [notice, setNotice] = useState("");
	const [mode, setMode] = useState<"tabs" | "bookmarks">("tabs");
	const [keepBookmarks, setKeepBookmarks] = useState(false);
	const [previous, setPrevious] = useState<ImportResult>();
	const [report, setReport] = useState<ImportResult>();
	const [canUndo, setCanUndo] = useState(false);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState({ done: 0, total: 0 });
	const controller = useRef<AbortController | null>(null);
	const plan = useMemo(
		() => (library && options ? planImport(library, options) : undefined),
		[library, options],
	);
	const refresh = async () => {
		const [last, session] = await Promise.all([lastResult(), sessionToken()]);
		setPrevious(last);
		setCanUndo(!!session && last?.session === session && !last.undone);
	};
	const load = (parsed: Result<Library, ParseError>, name: string) => {
		setReport(undefined);
		if (!parsed.ok) {
			setLibrary(undefined);
			setSourceName("");
			setExpanded(false);
			setOptions(undefined);
			setNotice(parsed.error.message);
			return;
		}
		setLibrary(parsed.value);
		setSourceName(name);
		// Without native groups, a pinned group would become its own window.
		setOptions({
			...defaultOptions(parsed.value),
			...(adapter.supportsGroups ? {} : { pinned: "native" as const }),
		});
		setMode("tabs");
		setKeepBookmarks(false);
		setNotice("");
	};
	useEffect(() => {
		void refresh().catch(() => setNotice("The last import could not be read."));
		if (fragment)
			void readFragment(fragment)
				.then((text) => load(parsePack(text), "Sidebar received from Handoff"))
				.catch(() =>
					setNotice(
						"The handoff could not be read. Choose the pack file instead.",
					),
				);
	}, [fragment]);
	const permission = async (name: "tabs" | "bookmarks") => {
		try {
			if (await api.permissions.request({ permissions: [name] })) return true;
		} catch {}
		setNotice(
			"Permission was declined or unavailable. You can still move tabs with the default options.",
		);
		return false;
	};
	const toggleDuplicate = async (enabled: boolean) => {
		if (!options) return;
		if (!enabled) {
			setOptions({ ...options, skipUrls: undefined });
			return;
		}
		if (await permission("tabs")) {
			try {
				const tabs = await api.tabs.query({});
				setOptions({
					...options,
					skipUrls: new Set(tabs.flatMap((t) => (t.url ? [t.url.trim()] : []))),
				});
			} catch {
				setNotice("Open tabs could not be read.");
			}
		}
	};
	const run = async () => {
		if (!library || !options || !plan || busy) return;
		const limit = moveLimitMessage(plan.totals.tabs);
		if (limit) {
			setNotice(limit);
			return;
		}
		setNotice("");
		setBusy(true);
		try {
			await exclusive(async () => {
				const abort = new AbortController();
				controller.current = abort;
				const token = await sessionToken(true);
				if (!token) throw Error("Session storage unavailable");
				const result = newResult(library.source.sourceHash, token, mode);
				await startOwnership(result.importId);
				result.skipped.push(
					...library.report.skipped.map(({ arcId, reason }) => ({
						arcId,
						reason,
					})),
				);
				const onProgress = (done: number, total: number) =>
					setProgress({ done, total });
				onProgress(0, plan.totals.tabs);
				if (mode === "tabs") {
					await executePlan(plan, journaledAdapter(result.importId), {
						batchSize: 10,
						signal: abort.signal,
						result,
						save: saveResult,
						onProgress,
					});
					if (keepBookmarks && !abort.signal.aborted)
						try {
							await moveBookmarks(
								library,
								options,
								result,
								abort.signal,
								saveResult,
								onProgress,
								true,
							);
						} catch {
							result.notes.push(
								"The bookmarks copy could not be saved. The tabs are still open.",
							);
							await saveResult(result);
						}
				} else
					await moveBookmarks(
						library,
						options,
						result,
						abort.signal,
						saveResult,
						onProgress,
					);
				setReport({ ...result });
				await refresh();
			});
		} catch {
			setNotice(
				"The move could not finish. Check the last import below. Another importer may be busy or local storage may be full.",
			);
			await refresh().catch(() => {});
		} finally {
			controller.current = null;
			setBusy(false);
		}
	};
	const undo = async (result: ImportResult) => {
		if (busy) return;
		const count =
			result.created.tabIds.length + result.created.bookmarks.length;
		if (
			!window.confirm(
				"Undo this import? Remove " +
					count +
					" owned tabs or bookmarks and any empty folders created for them.",
			)
		)
			return;
		setBusy(true);
		try {
			await exclusive(async () => {
				const latest = await lastResult();
				if (!latest || latest.importId !== result.importId || latest.undone)
					throw Error("Last import changed");
				try {
					await undoOwned(latest, await sessionToken(), undoAdapter);
				} finally {
					await saveResult(latest);
				}
				setReport(undefined);
				setNotice("Import undone.");
				await refresh();
			});
		} catch {
			setNotice(
				"Undo could not finish. It requires the same browser session and an idle importer.",
			);
			await refresh().catch(() => {});
		} finally {
			setBusy(false);
		}
	};
	const platform = /Win/.test(navigator.platform)
		? "windows"
		: /Mac/.test(navigator.platform)
			? "macos"
			: "unknown";
	async function changeMode(format: ExportFormat) {
		if (format === "pack") setMode("tabs");
		else if (await permission("bookmarks")) setMode("bookmarks");
	}
	return (
		<main className={`importer-workspace ${expanded ? "expanded" : "compact"}`}>
			{!busy && !report && (
				<SidebarWorkspace
					key={library?.source.sourceHash ?? "empty"}
					library={library ?? null}
					source={sourceName}
					selected={new Set(options?.spaceIds ?? [])}
					onSelection={(ids) => {
						if (options) setOptions({ ...options, spaceIds: [...ids] });
					}}
					expanded={expanded && !!library}
					onToggle={() => setExpanded((value) => !value)}
					format={mode === "tabs" ? "pack" : "bookmarks"}
					onFormat={(format) => void changeMode(format)}
					formatOptions={[
						{
							value: "pack",
							label: adapter.supportsGroups
								? "Tabs and groups"
								: "Browser tabs",
						},
						{ value: "bookmarks", label: "Nested bookmarks" },
					]}
					importMode
					actionCount={plan?.totals.tabs ?? 0}
					actionAccessibleName="Move"
					onPick={() =>
						picker.current
							?.querySelector<HTMLInputElement>('input[type="file"]')
							?.click()
					}
					onExport={() => void run()}
					busy={busy}
					onTools={() => setShowOptions((value) => !value)}
					toolsLabel="Import options"
					candidates={null}
					filePicker={
						<div ref={picker}>
							<FileDrop onLoaded={load} />
						</div>
					}
					help={<PathHelper platform={platform} />}
					emptyIntro="Choose your Arc sidebar or a Handoff pack to preview its actual Spaces, folders and tabs. Your file stays in this browser."
				/>
			)}
			{notice && (
				<p className="notice" role="status">
					{notice}
				</p>
			)}

			{previous && !busy && !report && (
				<section className="previous">
					<h2>Last import</h2>
					<p>
						{previous.done}{" "}
						{previous.mode === "bookmarks" ? "bookmarks" : "tabs"} moved.{" "}
						{previous.undone
							? "Undone."
							: previous.cancelled
								? "Cancelled."
								: !previous.finishedAt
									? "Interrupted or still open in another importer."
									: ""}
					</p>
					{library?.source.sourceHash === previous.sourceHash && (
						<p>You have imported this sidebar before.</p>
					)}
					<p>
						Undo is available for the last import during this browser session.
						Moving again replaces that Undo.
					</p>
					<div className="actions">
						<button onClick={() => download(previous)}>
							Download last skipped list
						</button>
						{canUndo && (
							<button onClick={() => void undo(previous)}>
								Undo last import
							</button>
						)}
					</div>
				</section>
			)}
			{busy && (
				<ProgressView
					{...progress}
					onCancel={() => controller.current?.abort()}
				/>
			)}
			{library && options && plan && !busy && !report && (
				<details
					className="extension-options"
					open={showOptions}
					onToggle={(event) => setShowOptions(event.currentTarget.open)}
				>
					<summary>Import options and recovery</summary>

					<ArchiveRecovery
						library={library}
						onChange={(next) => {
							setLibrary(next);
							setOptions({
								...options,
								spaceIds: [
									...options.spaceIds,
									...next.spaces
										.filter(
											(space) =>
												!library.spaces.some(
													(old) => old.arcId === space.arcId,
												),
										)
										.map((space) => space.arcId),
								],
							});
						}}
					/>
					<OptionsPanel
						value={options}
						onChange={setOptions}
						capabilities={{
							groups: adapter.supportsGroups,
							bookmarks: mode === "bookmarks",
						}}
					/>
					{!adapter.supportsGroups && (
						<p>
							{isFirefox ? "Use bookmarks to preserve folder nesting. " : ""}
							Ungrouped imports use a window for each planned group.
						</p>
					)}
					<div className="checks">
						<label>
							<input
								type="checkbox"
								checked={!!options.skipUrls}
								onChange={(e) => void toggleDuplicate(e.target.checked)}
							/>{" "}
							Skip tabs I already have open
						</label>
						<label>
							<input
								type="checkbox"
								checked={mode === "tabs" && keepBookmarks}
								disabled={mode === "bookmarks"}
								onChange={async (e) => {
									if (!e.target.checked) setKeepBookmarks(false);
									else if (await permission("bookmarks"))
										setKeepBookmarks(true);
								}}
							/>{" "}
							Also keep a bookmarks copy with nested folders (stays after you
							close the tabs)
						</label>
						<label>
							<input
								type="checkbox"
								checked={mode === "bookmarks"}
								onChange={async (e) => {
									if (!e.target.checked) setMode("tabs");
									else if (await permission("bookmarks")) setMode("bookmarks");
								}}
							/>{" "}
							Bookmarks only (don't open tabs)
						</label>
					</div>
					<CopyDiagnosticButton library={library} appVersion="1.0.1" />
				</details>
			)}

			{report && plan && !busy && (
				<>
					<ResultReport
						plan={plan}
						result={report}
						onUndo={canUndo ? () => void undo(report) : undefined}
						onDownloadSkipped={() => download(report)}
					/>
					{report.notes
						.filter((note) => !plan.notes.includes(note))
						.map((note, i) => (
							<p key={i}>{note}</p>
						))}
					<p>
						{skippedItems(report).length} skipped or unfinished. Undo is
						available in this browser session.
					</p>
					<div className="actions">
						<button
							onClick={() => {
								setReport(undefined);
								setLibrary(undefined);
								setSourceName("");
								setOptions(undefined);
							}}
						>
							Choose another file
						</button>
						{library && (
							<CopyDiagnosticButton library={library} appVersion="1.0.1" />
						)}
					</div>
					<PasswordGuide destination={destination()} />
				</>
			)}
		</main>
	);
}
