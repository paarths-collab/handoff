import type { Library, Node, Space } from "@handoff/core";
import { PreviewTree } from "./preview";
import { useState, type ReactNode } from "react";
import mark from "./assets/handoff-mark.png";
import "./workspace.css";

export type ExportFormat = "bookmarks" | "archive" | "pack" | "csv";
const formats: { value: ExportFormat; label: string }[] = [
	{ value: "bookmarks", label: "Bookmarks HTML" },
	{ value: "archive", label: "Offline archive" },
	{ value: "pack", label: "Handoff pack" },
	{ value: "csv", label: "Spreadsheet CSV" },
];
export function nodeCounts(nodes: Node[]) {
	let tabs = 0,
		folders = 0;
	const stack = [...nodes];
	while (stack.length) {
		const node = stack.pop()!;
		if (node.kind === "tab") tabs++;
		else {
			folders++;
			stack.push(...node.children);
		}
	}
	return { tabs, folders };
}
const spaceCounts = (space: Space) =>
	nodeCounts([...space.pinned, ...space.today]);
function Icon({
	kind,
}: {
	kind: "file" | "folder" | "tab" | "download" | "lock";
}) {
	const paths = {
		file: <path d="M6 3h8l4 4v14H6zM14 3v5h4" />,
		folder: <path d="M3 6h7l2 3h9v11H3z" />,
		tab: (
			<>
				<rect x="3" y="4" width="18" height="16" rx="1" />
				<path d="M3 9h18" />
			</>
		),
		download: <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />,
		lock: (
			<>
				<rect x="5" y="10" width="14" height="11" rx="2" />
				<path d="M8 10V7a4 4 0 0 1 8 0v3" />
			</>
		),
	};
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			aria-hidden="true"
		>
			{paths[kind]}
		</svg>
	);
}
function Branch({ node, open = false }: { node: Node; open?: boolean }) {
	if (node.kind === "tab")
		return (
			<div className="ws-tab" title={node.url}>
				<Icon kind="tab" />
				<span>{node.title}</span>
			</div>
		);
	const count = nodeCounts(node.children).tabs;
	return (
		<details className="ws-folder" open={open}>
			<summary>
				<Icon kind="folder" />
				<span>{node.title}</span>
				<small>{count} tabs</small>
			</summary>
			<div className="ws-children">
				{node.children.map((child) => (
					<Branch key={child.arcId} node={child} />
				))}
			</div>
		</details>
	);
}
export interface SidebarWorkspaceProps {
	library: Library | null;
	source: string;
	selected: Set<string>;
	onSelection: (selected: Set<string>) => void;
	expanded: boolean;
	onToggle: () => void;
	format: ExportFormat;
	onFormat: (format: ExportFormat) => void;
	onPick: () => void;
	onExport: () => void;
	busy: boolean;
	onTools?: () => void;
	/** Replaces the export controls with one main action, such as Send to browser. */
	primary?: { label: string; onClick: () => void };
	candidates: ReactNode;
	help: ReactNode;
	importMode?: boolean;
	toolsLabel?: string;
	actionCount?: number;
	actionAccessibleName?: string;
	formatOptions?: { value: ExportFormat; label: string }[];
	filePicker?: ReactNode;
	emptyIntro?: string;
	sourceDetails?: string;
}
export function SidebarWorkspace(props: SidebarWorkspaceProps) {
	const { library, selected, expanded, busy } = props;
	const [activeId, setActiveId] = useState<string | null>(null);
	const [favoriteSelection, setFavorites] = useState(false);
	const active =
		library?.spaces.find((space) => space.arcId === activeId) ??
		library?.spaces[0];
	const favorites =
		favoriteSelection || (!active && !!library?.favorites.length);
	const activeCounts = active ? spaceCounts(active) : { tabs: 0, folders: 0 };
	const nodes = favorites
		? (library?.favorites ?? [])
		: active
			? [...active.pinned, ...active.today]
			: [];
	const counts = favorites ? nodeCounts(nodes) : activeCounts;
	const selectedNames =
		library?.spaces
			.filter((space) => selected.has(space.arcId))
			.map((space) => space.title) ?? [];
	const selectedTabs =
		(library?.spaces
			.filter((space) => selected.has(space.arcId))
			.reduce((sum, space) => sum + spaceCounts(space).tabs, 0) ?? 0) +
		nodeCounts(library?.favorites ?? []).tabs;
	const fullExport = !props.importMode && props.format !== "bookmarks";
	const exportTabs =
		props.actionCount ??
		(fullExport ? (library?.report.counts.tabs ?? 0) : selectedTabs);
	function toggle(id: string) {
		const next = new Set(selected);
		if (!next.delete(id)) next.add(id);
		props.onSelection(next);
	}
	const spaceChoices = (
		<div className="ws-space-options">
			{library?.spaces.map((space) => (
				<label key={space.arcId}>
					<input
						type="checkbox"
						checked={selected.has(space.arcId)}
						disabled={busy}
						onChange={() => toggle(space.arcId)}
					/>
					<span>{space.title}</span>
					<small>{spaceCounts(space).tabs}</small>
				</label>
			))}
		</div>
	);
	const formatPicker = (
		<select
			aria-label="Export format"
			value={props.format}
			disabled={busy}
			onChange={(event) => props.onFormat(event.target.value as ExportFormat)}
		>
			{(props.formatOptions ?? formats).map((format) => (
				<option key={format.value} value={format.value}>
					{format.label}
				</option>
			))}
		</select>
	);
	return (
		<div
			className={`handoff-workspace ${expanded ? "is-expanded" : "is-compact"}`}
		>
			<header className="ws-header">
				<div className="ws-brand">
					<img src={mark} width="48" height="48" alt="" />
					<strong>Handoff</strong>
				</div>
				{library && (
					<div className="ws-header-actions">
						{props.onTools && (
							<button type="button" disabled={busy} onClick={props.onTools}>
								{props.toolsLabel ?? "Migration tools"}
							</button>
						)}
						<button
							type="button"
							className="ws-view-toggle"
							aria-expanded={expanded}
							aria-controls="workspace-library"
							disabled={busy}
							onClick={props.onToggle}
						>
							{expanded ? "Compact view" : "Expand preview"}
						</button>
					</div>
				)}
			</header>
			{library && expanded && (
				<div className="ws-filebar">
					<Icon kind="file" />
					<span title={props.sourceDetails || props.source}>
						{props.source}
					</span>
					<button type="button" disabled={busy} onClick={props.onPick}>
						Change file
					</button>
				</div>
			)}
			<section className="ws-compact" hidden={expanded && !!library}>
				<h1>
					{props.importMode ? "Move your sidebar." : "Export your sidebar."}
				</h1>
				<div hidden={!!library}>{props.filePicker}</div>
				<div className="ws-source" hidden={!library && !!props.filePicker}>
					<Icon kind="file" />
					<strong>{library ? props.source : "Choose your Arc file"}</strong>
					<button type="button" disabled={busy} onClick={props.onPick}>
						{library ? "Change" : "Choose file"}
					</button>
				</div>
				{library ? (
					<>
						<div className="ws-setting">
							<span>Spaces</span>
							<details className="ws-space-picker">
								<summary>
									{selectedNames.length
										? selectedNames.length > 2
											? `${selectedNames.length} Spaces`
											: selectedNames.join(" + ")
										: "Choose Spaces"}
								</summary>
								{spaceChoices}
							</details>
						</div>
						<label className="ws-setting">
							<span>Format</span>
							{formatPicker}
						</label>
						<button
							className="ws-preview-button"
							type="button"
							disabled={busy}
							onClick={props.onToggle}
						>
							Preview sidebar
						</button>
						{fullExport && (
							<p className="ws-format-note">
								This format exports the full library.
							</p>
						)}
					</>
				) : (
					<>
						<div className="ws-found">{props.candidates}</div>
						<p className="ws-intro">
							{props.emptyIntro ||
								"Bring your Spaces, folders and tabs to your next browser. Everything stays on this computer."}
						</p>
						<details className="ws-file-help">
							<summary>Where is my Arc file?</summary>
							{props.help}
						</details>
					</>
				)}
			</section>
			<div
				className="ws-library"
				id="workspace-library"
				hidden={!expanded || !library}
			>
				<aside className="ws-spaces">
					<h2>Spaces</h2>
					{library?.spaces.map((space) => (
						<div
							key={space.arcId}
							className={`ws-space ${!favorites && space === active ? "active" : ""}`}
						>
							<input
								type="checkbox"
								aria-label={`Include ${space.title}`}
								checked={selected.has(space.arcId)}
								disabled={busy}
								onChange={() => toggle(space.arcId)}
							/>
							<button
								type="button"
								aria-pressed={!favorites && space === active}
								onClick={() => {
									setActiveId(space.arcId);
									setFavorites(false);
								}}
							>
								{space.title}
							</button>
							<small>{spaceCounts(space).tabs}</small>
						</div>
					))}
					{!!library?.favorites.length && (
						<button
							className={`ws-favorites ${favorites ? "active" : ""}`}
							type="button"
							onClick={() => setFavorites(true)}
						>
							Favorites <small>{nodeCounts(library.favorites).tabs}</small>
						</button>
					)}
				</aside>
				<section className="ws-space-content" aria-label="Space contents">
					<h1>{favorites ? "Favorites" : (active?.title ?? "Your sidebar")}</h1>
					<p>
						{counts.tabs} tabs · {counts.folders} folders
					</p>
					{nodes.length === 0 ? (
						<p className="ws-empty">This Space has no tabs.</p>
					) : counts.tabs + counts.folders > 500 && library ? (
						<PreviewTree
							library={{
								...library,
								favorites: favorites ? library.favorites : [],
								spaces: favorites ? [] : active ? [active] : [],
							}}
							selectedSpaceIds={selected}
							onChange={(ids) => {
								const next = new Set(selected);
								if (active) {
									if (ids.has(active.arcId)) next.add(active.arcId);
									else next.delete(active.arcId);
								}
								props.onSelection(next);
							}}
						/>
					) : (
						<div className="ws-tree">
							{nodes.map((node, index) => (
								<Branch key={node.arcId} node={node} open={index === 0} />
							))}
						</div>
					)}
				</section>
			</div>
			{library && (
				<footer className="ws-exportbar">
					{props.primary ? (
						<>
							<div className="ws-totals">
								<strong>
									{selected.size} {selected.size === 1 ? "Space" : "Spaces"}
								</strong>
								<span>{selectedTabs} tabs selected</span>
							</div>
							<button
								type="button"
								className="ws-export"
								disabled={busy || selected.size === 0}
								onClick={props.primary.onClick}
							>
								{busy ? "Working…" : props.primary.label}
							</button>
						</>
					) : (
						<>
							{expanded && (
								<>
									<div className="ws-totals">
										<strong>
											{fullExport
												? "Full library"
												: `${selected.size} ${selected.size === 1 ? "Space" : "Spaces"}`}
										</strong>
										<span>
											{exportTabs} tabs {fullExport ? "in total" : "selected"}
										</span>
									</div>
									{formatPicker}
								</>
							)}
							<button
								type="button"
								className="ws-export"
								aria-label={props.actionAccessibleName}
								disabled={busy || (!exportTabs && props.format === "bookmarks")}
								onClick={props.onExport}
							>
								<Icon kind="download" />
								{busy
									? "Working…"
									: `${props.importMode ? "Move" : "Export"} ${exportTabs} ${props.importMode && props.format === "bookmarks" ? "bookmarks" : "tabs"}`}
							</button>
						</>
					)}
				</footer>
			)}
			<p className="ws-local">
				<Icon kind="lock" />
				Your file stays on this device.
			</p>
		</div>
	);
}
