import type { Library, Node } from "@handoff/core";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useId, useMemo, useRef, useState } from "react";
import type { PreviewTreeProps } from "./types";

interface Row {
	title: string;
	kind: "space" | "section" | "folder" | "tab";
	depth: number;
	key: string;
	spaceId?: string;
	info?: string;
}

function makeRows(lib: Library, closed: ReadonlySet<string>) {
	const rows: Row[] = [];
	function section(
		title: string,
		nodes: Node[],
		prefix: string,
		depth: number,
	) {
		if (!nodes.length) return;
		rows.push({ title, kind: "section", depth, key: prefix });
		if (closed.has(prefix)) return;
		const stack = nodes.map((node) => ({ node, depth: depth + 1 })).reverse();
		const seen = new Set<Node>();
		while (stack.length) {
			const entry = stack.pop()!;
			if (seen.has(entry.node)) continue;
			seen.add(entry.node);
			const { node, depth: level } = entry;
			const key = JSON.stringify([prefix, node.arcId]);
			rows.push({
				title: node.title,
				depth: level,
				kind: node.kind,
				key,
				info: node.kind === "tab" ? node.url : undefined,
			});
			if (node.kind === "folder" && !closed.has(key)) {
				for (let i = node.children.length - 1; i >= 0; i--)
					stack.push({ node: node.children[i], depth: level + 1 });
			}
		}
	}
	section("Favorites", lib.favorites, "favorites", 1);
	for (const space of lib.spaces) {
		const key = JSON.stringify(["space", space.arcId]);
		rows.push({
			title: space.title,
			key,
			kind: "space",
			depth: 1,
			spaceId: space.arcId,
			info: space.profile ?? undefined,
		});
		if (!closed.has(key)) {
			section("Pinned", space.pinned, JSON.stringify([key, "pinned"]), 2);
			section("Today", space.today, JSON.stringify([key, "today"]), 2);
		}
	}
	return rows;
}

const reasons = {
	"generated-title": "Missing titles filled in",
	"order-mismatch": "Unlisted items appended",
	"orphan-recovered": "Orphaned items recovered",
	"cycle-broken": "Circular links repaired",
	"split-view-flattened": "Split views flattened",
	"depth-limited": "Deep folders reorganized",
	"unknown-field": "Unrecognized fields",
	"unsupported-kind": "Unsupported items skipped",
	"no-url": "Items without URLs skipped",
};

function Warnings({ library }: { library: Library }) {
	const counts = new Map<string, number>();
	for (const warning of library.report.warnings)
		counts.set(warning.kind, (counts.get(warning.kind) ?? 0) + 1);
	for (const skip of library.report.skipped)
		counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1);
	if (counts.size === 0) return null;
	return (
		<details className="tm-help">
			<summary>
				Import notes (
				{library.report.warnings.length + library.report.skipped.length})
			</summary>
			<ul>
				{[...counts].map(([reason, count]) => (
					<li key={reason}>
						{reasons[reason as keyof typeof reasons] ?? "Other notes"} · {count}
					</li>
				))}
			</ul>
		</details>
	);
}

export function PreviewTree({
	library,
	selectedSpaceIds,
	onChange,
}: PreviewTreeProps) {
	const [closed, setClosed] = useState<Set<string>>(() => new Set());
	const [index, setIndex] = useState(0);
	const rows = useMemo(() => makeRows(library, closed), [library, closed]);
	const current = Math.min(index, Math.max(0, rows.length - 1));
	const id = useId();
	const viewport = useRef<HTMLDivElement>(null);
	const virtual = rows.length >= 1000;
	const list = useVirtualizer({
		count: rows.length,
		getScrollElement: () => viewport.current,
		estimateSize: () => 38,
		overscan: 10,
		enabled: virtual,
		rangeExtractor: (range) =>
			[...new Set([...defaultRangeExtractor(range), current])].sort(
				(a, b) => a - b,
			),
	});
	function select(spaceId: string) {
		const next = new Set(selectedSpaceIds);
		if (!next.delete(spaceId)) next.add(spaceId);
		onChange(next);
	}
	function toggle(key: string) {
		setClosed((prev) => {
			const next = new Set(prev);
			if (!next.delete(key)) next.add(key);
			return next;
		});
	}
	function focusRow(n: number) {
		const next = Math.max(0, Math.min(rows.length - 1, n));
		setIndex(next);
		if (virtual) list.scrollToIndex(next, { align: "auto" });
		else
			viewport.current
				?.querySelector(`[data-index="${next}"]`)
				?.scrollIntoView({ block: "nearest" });
	}
	function renderRow(n: number, offset?: number) {
		const row = rows[n];
		const branch = row.kind !== "tab";
		return (
			<div
				key={row.key}
				id={id + "-" + n}
				role="treeitem"
				aria-level={row.depth}
				aria-expanded={branch ? !closed.has(row.key) : undefined}
				aria-checked={
					row.spaceId !== undefined
						? selectedSpaceIds.has(row.spaceId)
						: undefined
				}
				data-index={n}
				data-kind={row.kind}
				data-active={current === n}
				className="tm-row"
				style={{
					paddingInlineStart: 12 + Math.min(row.depth - 1, 7) * 17,
					...(offset === undefined
						? {}
						: { position: "absolute", top: offset, left: 0, right: 0 }),
				}}
				onClick={() => {
					setIndex(n);
					viewport.current?.focus({ preventScroll: true });
					if (branch) toggle(row.key);
				}}
			>
				<span className="tm-glyph" aria-hidden="true">
					{branch ? (closed.has(row.key) ? "▸" : "▾") : "·"}
				</span>
				{row.spaceId !== undefined && (
					<label
						className="tm-space-check"
						onClick={(e) => e.stopPropagation()}
					>
						<input
							tabIndex={-1}
							type="checkbox"
							aria-label={`Include ${row.title}`}
							checked={selectedSpaceIds.has(row.spaceId)}
							onChange={() => select(row.spaceId!)}
						/>
					</label>
				)}
				<span className="tm-row-title" title={row.title}>
					{row.title}
				</span>
				{row.info && (
					<span className="tm-row-info" title={row.info}>
						{row.info}
					</span>
				)}
			</div>
		);
	}
	const counts = library.report.counts;
	return (
		<div className="tm-preview">
			<p className="tm-counts">
				<b>{counts.spaces}</b> Spaces <span>·</span> <b>{counts.tabs}</b> tabs{" "}
				<span>·</span> <b>{counts.folders}</b> folders
			</p>
			<div className="tm-tree-tools">
				<span>
					{selectedSpaceIds.size} of {library.spaces.length} Spaces selected
				</span>
				<button
					type="button"
					className="tm-link"
					onClick={() =>
						onChange(new Set(library.spaces.map((space) => space.arcId)))
					}
				>
					Select all
				</button>
				<button
					type="button"
					className="tm-link"
					onClick={() => onChange(new Set())}
				>
					Clear
				</button>
			</div>
			{rows.length > 0 ? (
				<div
					ref={viewport}
					className="tm-tree"
					role="tree"
					aria-label="Sidebar preview"
					aria-describedby={id + "-help"}
					aria-activedescendant={id + "-" + current}
					tabIndex={0}
					onKeyDown={(e) => {
						const row = rows[current];
						switch (e.key) {
							case "ArrowDown":
								focusRow(current + 1);
								break;
							case "ArrowUp":
								focusRow(current - 1);
								break;
							case "Home":
								focusRow(0);
								break;
							case "End":
								focusRow(rows.length - 1);
								break;
							case "PageDown":
								focusRow(current + 9);
								break;
							case "PageUp":
								focusRow(current - 9);
								break;
							case "ArrowLeft":
								if (row.kind !== "tab" && !closed.has(row.key)) toggle(row.key);
								else {
									let n = current - 1;
									while (n >= 0 && rows[n].depth >= row.depth) n--;
									if (n >= 0) focusRow(n);
								}
								break;
							case "ArrowRight":
								if (row.kind !== "tab" && closed.has(row.key)) toggle(row.key);
								else if (rows[current + 1]?.depth > row.depth)
									focusRow(current + 1);
								break;
							case "Enter":
								if (row.kind !== "tab") toggle(row.key);
								break;
							case " ":
								if (row.spaceId !== undefined) select(row.spaceId);
								break;
							default:
								return;
						}
						e.preventDefault();
					}}
				>
					{virtual ? (
						<div style={{ height: list.getTotalSize(), position: "relative" }}>
							{list
								.getVirtualItems()
								.map((item) => renderRow(item.index, item.start))}
						</div>
					) : (
						rows.map((_, i) => renderRow(i))
					)}
				</div>
			) : (
				<p>This library has no Spaces or Favorites.</p>
			)}
			<p className="tm-key-help" id={id + "-help"}>
				Use arrow keys to browse, Enter to expand, and Space to select a Space.
			</p>
			<Warnings library={library} />
		</div>
	);
}
