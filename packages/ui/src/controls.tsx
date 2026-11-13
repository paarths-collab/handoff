import { toDiagnostic } from "@handoff/core";
import { useId, useState } from "react";
import type {
	CopyDiagnosticButtonProps,
	OptionsPanelProps,
	ProgressViewProps,
	ResultReportProps,
} from "./types";

export function OptionsPanel({
	value,
	onChange,
	capabilities,
}: OptionsPanelProps) {
	return (
		<fieldset className="tm-options">
			<legend>Move options</legend>
			<label>
				Spaces
				<select
					value={capabilities.groups ? value.spaceMode : "window"}
					onChange={(e) =>
						onChange({
							...value,
							spaceMode: e.target.value === "group" ? "group" : "window",
						})
					}
				>
					<option value="window">One window per Space</option>
					{capabilities.groups && (
						<option value="group">Groups in one window</option>
					)}
				</select>
			</label>
			{capabilities.groups && (
				<label>
					Folders
					<select
						value={value.folderMode}
						onChange={(e) =>
							onChange({
								...value,
								folderMode: e.target.value === "groups" ? "groups" : "flatten",
							})
						}
					>
						<option value="groups">Make tab groups</option>
						<option value="flatten">Flatten folders</option>
					</select>
				</label>
			)}
			<label>
				<input
					type="checkbox"
					checked={value.today === "include"}
					onChange={(e) =>
						onChange({ ...value, today: e.target.checked ? "include" : "skip" })
					}
				/>
				Include Today tabs
			</label>
			<label>
				<input
					type="checkbox"
					checked={value.favorites !== "skip"}
					onChange={(e) =>
						onChange({
							...value,
							favorites: e.target.checked ? "pinned-first-window" : "skip",
						})
					}
				/>
				Include Favorites in the first window
			</label>
			{capabilities.groups && (
				<label>
					<input
						type="checkbox"
						checked={value.pinned === "group"}
						onChange={(e) =>
							onChange({
								...value,
								pinned: e.target.checked ? "group" : "native",
							})
						}
					/>
					Keep pinned tabs and Favorites as groups instead of pinning
				</label>
			)}
			{capabilities.groups && (
				<label>
					<input
						type="checkbox"
						checked={value.collapseGroups}
						onChange={(e) =>
							onChange({ ...value, collapseGroups: e.target.checked })
						}
					/>
					Start with groups collapsed
				</label>
			)}
		</fieldset>
	);
}

export function ProgressView({ done, total, onCancel }: ProgressViewProps) {
	const [cancelled, setCancelled] = useState(false);
	return (
		<section className="tm-progress" aria-label="Move progress">
			<p role="status">
				{cancelled
					? "Finishing the current batch…"
					: `Moving tabs · ${done} of ${total}`}
			</p>
			<progress
				max={Math.max(1, total)}
				value={Math.min(done, total)}
				aria-label="Tabs processed"
			/>
			<button
				className="tm-btn"
				type="button"
				disabled={cancelled}
				onClick={() => {
					setCancelled(true);
					onCancel();
				}}
			>
				Cancel move
			</button>
		</section>
	);
}

export function ResultReport({
	plan,
	result,
	onUndo,
	onDownloadSkipped,
}: ResultReportProps) {
	const remaining = Math.max(
		0,
		plan.totals.tabs - result.done - result.failed.length,
	);
	const byReason = new Map<string, number>();
	for (const tab of plan.skipped)
		byReason.set(tab.reason, 1 + (byReason.get(tab.reason) ?? 0));
	const reasons = {
		"by-choice": "Excluded by your options",
		"empty-url": "Empty address",
		scheme: "Unsupported address type",
		duplicate: "Already open",
	};
	return (
		<section className="tm-result" aria-label="Move result">
			<h2>{result.cancelled ? "Move cancelled" : "Move complete"}</h2>
			<p role="status">
				{result.done} moved · {plan.skipped.length} skipped ·{" "}
				{result.failed.length} failed
				{remaining > 0 && ` · ${remaining} pending`}
			</p>
			{byReason.size > 0 && (
				<ul>
					{[...byReason].map(([reason, n]) => (
						<li key={reason}>
							{reasons[reason as keyof typeof reasons]} · {n}
						</li>
					))}
				</ul>
			)}
			{plan.notes.map((note, i) => (
				<p key={i}>{note}</p>
			))}
			<div className="tm-actions">
				<button className="tm-btn" type="button" onClick={onDownloadSkipped}>
					Download skipped list
				</button>
				{onUndo && (
					<button className="tm-btn" type="button" onClick={onUndo}>
						Undo last move
					</button>
				)}
			</div>
			{onUndo && <small>Undo is available during this browser session.</small>}
		</section>
	);
}

export function CopyDiagnosticButton({
	library,
	appVersion,
}: CopyDiagnosticButtonProps) {
	const id = useId();
	const [status, setStatus] = useState("");
	const [manual, setManual] = useState("");
	async function copy() {
		const report = toDiagnostic(library, appVersion);
		try {
			await navigator.clipboard.writeText(report);
			setStatus("Diagnostic copied.");
			setManual("");
		} catch {
			setStatus("Select and copy the diagnostic below.");
			setManual(report);
		}
	}
	return (
		<div className="tm-diagnostic">
			<button className="tm-link" type="button" onClick={() => void copy()}>
				Copy diagnostic
			</button>
			<span role="status">{status}</span>
			{manual && (
				<>
					<label htmlFor={id}>Diagnostic report</label>
					<textarea
						id={id}
						readOnly
						value={manual}
						onFocus={(event) => event.currentTarget.select()}
					/>
				</>
			)}
		</div>
	);
}
