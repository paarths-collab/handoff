import type { Library, Node, Warning, ParseError } from "./model";
import type { Result } from "./result";
import { isRecord, isPackEnvelope } from "./pack-format";
import { emptyLibrary, summarize } from "./tree";

const nullable = (v: unknown): v is string | null =>
	v === null || typeof v === "string";
function warning(v: unknown): Warning | null {
	if (!isRecord(v)) return null;
	if (v.kind === "order-mismatch" && typeof v.parentArcId === "string")
		return { kind: v.kind, parentArcId: v.parentArcId };
	if (v.kind === "unknown-field" && typeof v.path === "string")
		return { kind: v.kind, path: v.path };
	if (typeof v.arcId !== "string") return null;
	if (
		v.kind === "generated-title" &&
		(v.target === "folder" || v.target === "tab" || v.target === "space")
	)
		return { kind: v.kind, arcId: v.arcId, target: v.target };
	if (
		v.kind === "orphan-recovered" ||
		v.kind === "split-view-flattened" ||
		v.kind === "cycle-broken" ||
		v.kind === "depth-limited"
	)
		return { kind: v.kind, arcId: v.arcId };
	return null;
}

export function readPack(value: unknown): Result<Library, ParseError> {
	const invalid = {
		ok: false,
		error: {
			kind: "invalid-pack",
			message: "The pack contains invalid or incomplete library data.",
		},
	} as const;
	if (
		isRecord(value) &&
		value.format === "tab-mover-pack" &&
		value.schemaVersion !== 1
	)
		return {
			ok: false,
			error: {
				kind: "unsupported-pack-version",
				message: "This pack version is not supported.",
			},
		};
	if (!isPackEnvelope(value) || !isRecord(value.library)) return invalid;
	const raw = value.library;
	if (
		raw.schemaVersion !== 1 ||
		!isRecord(raw.source) ||
		!Array.isArray(raw.favorites) ||
		!Array.isArray(raw.spaces) ||
		!isRecord(raw.report)
	)
		return invalid;
	const source = raw.source,
		report = raw.report;
	if (
		(source.platform !== "unknown" &&
			source.platform !== "macos" &&
			source.platform !== "windows") ||
		typeof source.parsedAt !== "string" ||
		typeof source.sourceHash !== "string" ||
		!Array.isArray(report.skipped) ||
		!Array.isArray(report.warnings) ||
		!isRecord(report.counts)
	)
		return invalid;
	const lib = emptyLibrary();
	lib.source.platform = source.platform;
	lib.source.parsedAt = source.parsedAt;
	const ids = new Set<string>();
	function unique(v: unknown): v is string {
		if (typeof v !== "string" || !v || ids.has(v)) return false;
		ids.add(v);
		return true;
	}
	for (const entry of report.skipped) {
		if (
			!isRecord(entry) ||
			!unique(entry.arcId) ||
			(entry.reason !== "no-url" && entry.reason !== "unsupported-kind") ||
			typeof entry.detail !== "string"
		)
			return invalid;
		lib.report.skipped.push({
			arcId: entry.arcId,
			reason: entry.reason,
			detail: entry.detail,
		});
	}
	for (const w of report.warnings) {
		const normalized = warning(w);
		if (!normalized) return invalid;
		lib.report.warnings.push(normalized);
	}
	const jobs: { raw: unknown[]; out: Node[]; depth: number }[] = [
		{ raw: raw.favorites, out: lib.favorites, depth: 0 },
	];
	for (const s of raw.spaces) {
		if (
			!isRecord(s) ||
			!unique(s.arcId) ||
			typeof s.title !== "string" ||
			typeof s.titleGenerated !== "boolean" ||
			!nullable(s.profile) ||
			!nullable(s.color) ||
			!nullable(s.icon) ||
			!Array.isArray(s.pinned) ||
			!Array.isArray(s.today)
		)
			return invalid;
		const pinned: Node[] = [],
			today: Node[] = [];
		lib.spaces.push({
			arcId: s.arcId,
			title: s.title,
			titleGenerated: s.titleGenerated,
			profile: s.profile,
			color: s.color,
			icon: s.icon,
			pinned,
			today,
		});
		jobs.push(
			{ raw: s.pinned, out: pinned, depth: 0 },
			{ raw: s.today, out: today, depth: 0 },
		);
	}
	while (jobs.length) {
		const job = jobs.pop()!;
		for (const n of job.raw) {
			if (
				job.depth >= 64 ||
				!isRecord(n) ||
				!unique(n.arcId) ||
				typeof n.title !== "string"
			)
				return invalid;
			if (
				n.kind === "tab" &&
				typeof n.url === "string" &&
				nullable(n.savedTitle) &&
				nullable(n.customTitle)
			) {
				job.out.push({
					kind: "tab",
					arcId: n.arcId,
					title: n.title,
					url: n.url,
					savedTitle: n.savedTitle,
					customTitle: n.customTitle,
				});
			} else if (n.kind === "folder" && Array.isArray(n.children)) {
				const children: Node[] = [];
				job.out.push({
					kind: "folder",
					arcId: n.arcId,
					title: n.title,
					children,
				});
				jobs.push({ raw: n.children, out: children, depth: job.depth + 1 });
			} else return invalid;
		}
	}
	return { ok: true, value: summarize(lib) };
}
