import {
	libraryLimitError,
	MAX_INPUT_BYTES,
	parseArcArchive,
	recoverArchivedTabs,
	type Library,
	type ArchiveRecoveryResult,
} from "@handoff/core";
import { useEffect, useId, useRef, useState } from "react";

export interface ArchiveRecoveryProps {
	library: Library;
	onChange(library: Library): void;
	chooseFile?(): Promise<string | null>;
}
export function ArchiveRecovery({
	library,
	onChange,
	chooseFile,
}: ArchiveRecoveryProps) {
	const id = useId();
	const current = useRef(0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [recovery, setRecovery] = useState<{
		base: Library;
		result: ArchiveRecoveryResult;
	} | null>(null);
	useEffect(() => {
		current.current++;
		setBusy(false);
		if (
			recovery &&
			library !== recovery.base &&
			library !== recovery.result.library
		) {
			setRecovery(null);
			setError("");
		}
		return () => {
			current.current++;
		};
	}, [library]);
	async function read(load: () => Promise<string | null>) {
		const token = ++current.current;
		setBusy(true);
		setError("");
		try {
			const text = await load();
			if (text === null || token !== current.current) return;
			const parsed = parseArcArchive(text);
			if (!parsed.ok) {
				setError(parsed.error.message);
				return;
			}
			const base =
				recovery && library === recovery.result.library
					? recovery.base
					: library;
			const result = recoverArchivedTabs(base, parsed.value);
			const tooMany = libraryLimitError(result.library);
			if (tooMany) {
				setError(tooMany.message);
				return;
			}
			setRecovery({ base, result });
		} catch (reason) {
			if (token === current.current)
				setError(
					reason instanceof Error && reason.message === "size"
						? "This archive exceeds the 100 MiB limit."
						: "The archive could not be read. Choose a local JSON copy and try again.",
				);
		} finally {
			if (token === current.current) setBusy(false);
		}
	}
	const included = recovery?.result.library === library;
	return (
		<section className="tm-help" aria-label="Archived tab recovery">
			<h2>Recover archived tabs</h2>
			<p>
				Optionally choose <code>StorableArchiveItems.json</code> from the same
				Arc folder. Handoff recovers automatically archived tabs and leaves
				manually closed tabs excluded.
			</p>
			{chooseFile ? (
				<button
					type="button"
					className="tm-btn"
					disabled={busy}
					onClick={() => void read(chooseFile)}
				>
					Choose archive file
				</button>
			) : (
				<label className="tm-pick" htmlFor={id}>
					Choose archive file
					<input
						id={id}
						type="file"
						accept=".json,application/json"
						disabled={busy}
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = "";
							if (file)
								void read(async () => {
									if (file.size > MAX_INPUT_BYTES) throw Error("size");
									return file.text();
								});
						}}
					/>
				</label>
			)}
			{busy && <p role="status">Reading archive…</p>}
			{error && <p role="alert">{error}</p>}
			{recovery && (
				<div>
					<p role="status">
						{recovery.result.counts.recovered} recoverable tabs ·{" "}
						{recovery.result.counts.duplicates} duplicates excluded ·{" "}
						{recovery.result.counts.manual} manually closed excluded ·{" "}
						{recovery.result.counts.invalid} unreadable ·{" "}
						{recovery.result.counts.unknownReason} unknown reasons excluded.
					</p>
					{recovery.result.counts.unknownDate > 0 && (
						<p>
							{recovery.result.counts.unknownDate} tabs will appear under
							Unknown date.
						</p>
					)}
					{recovery.result.counts.missingSpace > 0 && (
						<p>
							{recovery.result.counts.missingSpace} tabs belong to missing
							Spaces and will appear in recovered Spaces.
						</p>
					)}
					<p>
						Recovered tabs appear in Today → Recovered archive → month. Include
						Today tabs when moving them. Exact URLs already present in the same
						Space or Favorites are excluded.
					</p>
					{included ? (
						<button
							className="tm-btn"
							type="button"
							disabled={busy}
							onClick={() => onChange(recovery.base)}
						>
							Remove recovered tabs
						</button>
					) : (
						<button
							className="tm-btn"
							type="button"
							disabled={busy || recovery.result.counts.recovered === 0}
							onClick={() => onChange(recovery.result.library)}
						>
							Add recovered tabs to preview
						</button>
					)}
				</div>
			)}
		</section>
	);
}
