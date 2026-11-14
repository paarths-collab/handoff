import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { type Space, SPACES, tabCount } from "../data";
import {
	AppBrand,
	AppWindow,
	Button,
	Check,
	Cursor,
	FolderIcon,
	Headline,
	pressAt,
	progress,
	rise,
	SceneFade,
	TabIcon,
} from "../ui";
import type { Cue } from "../audio";

export const PREVIEW_FRAMES = 270;
const RESEARCH_CLICK = 122;
const PERSONAL_CLICK = 166;
const SEND_CLICK = 226;
export const PREVIEW_CUES: Cue[] = [
	[4, "whoosh"],
	[RESEARCH_CLICK, "click"],
	[PERSONAL_CLICK, "click"],
	[SEND_CLICK, "click"],
];
const W = { left: 300, top: 300, width: 1320, height: 720 };
const ROW = { top: 56, step: 58, height: 52 };

/** Step 2: browse Spaces, folders and tabs, and pick which Spaces move. */
export function PreviewSetup() {
	const frame = useCurrentFrame();
	const active = frame < RESEARCH_CLICK ? SPACES[0] : SPACES[1];
	const shownFrom = frame < RESEARCH_CLICK ? 14 : RESEARCH_CLICK + 2;
	const personal = progress(frame, PERSONAL_CLICK, 18);
	const selected = new Set([
		"studio",
		"research",
		...(frame >= PERSONAL_CLICK ? ["personal"] : []),
	]);
	const tabs = Math.round(20 + 6 * personal);
	const scroll =
		frame < RESEARCH_CLICK
			? interpolate(progress(frame, 52, 50), [0, 1], [0, -250])
			: 0;
	return (
		<SceneFade>
			<Headline
				eyebrow="Step 2"
				lead="Preview your"
				accent="setup."
				start={4}
				style={{ position: "absolute", top: 72, width: "100%" }}
			/>
			<AbsoluteFill style={{ ...W, ...rise(frame, 6, 50) }}>
				<AppWindow width={W.width} height={W.height}>
					<div
						style={{
							height: 84,
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "0 32px",
						}}
					>
						<AppBrand size={24} />
						<span
							style={{
								padding: "10px 18px",
								borderRadius: 12,
								background: "#111",
								boxShadow: "0 0 0 1px #ffffff1f",
								color: "#ccc",
								fontSize: 17,
							}}
						>
							Compact view
						</span>
					</div>
					<div
						style={{
							height: 50,
							display: "flex",
							alignItems: "center",
							gap: 10,
							padding: "0 32px",
							borderBlock: "1px solid #ffffff14",
							color: "#b4b4b4",
							fontSize: 17,
						}}
					>
						<TabIcon size={18} />
						<span style={{ flex: 1 }}>StorableSidebar.json</span>
						<span style={{ color: "#fff" }}>Change file</span>
					</div>
					<div style={{ flex: 1, display: "flex", minHeight: 0 }}>
						<aside
							style={{
								position: "relative",
								width: 300,
								background: "#080808",
								borderRight: "1px solid #ffffff14",
							}}
						>
							<div
								style={{
									position: "absolute",
									top: 20,
									left: 22,
									color: "#aaa",
									fontSize: 17,
								}}
							>
								Spaces
							</div>
							{SPACES.map((space, i) => (
								<SpaceRow
									key={space.id}
									space={space}
									top={ROW.top + i * ROW.step}
									active={space.id === active.id}
									checked={selected.has(space.id)}
									pulse={
										space.id === "personal" ? pressAt(frame, PERSONAL_CLICK) : 0
									}
								/>
							))}
						</aside>
						<div
							style={{
								position: "relative",
								flex: 1,
								overflow: "hidden",
								padding: "26px 40px",
							}}
						>
							<div
								key={active.id}
								style={{ opacity: progress(frame, shownFrom - 2, 10) }}
							>
								<div
									style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.4 }}
								>
									{active.name}
								</div>
								<div style={{ marginTop: 4, color: "#aaa", fontSize: 19 }}>
									{tabCount(active)} tabs · {active.folders.length} folders
								</div>
							</div>
							<div
								style={{
									marginTop: 18,
									height: 260,
									overflow: "hidden",
									WebkitMaskImage:
										"linear-gradient(to bottom, #000 78%, transparent)",
									maskImage:
										"linear-gradient(to bottom, #000 78%, transparent)",
								}}
							>
								<Tree space={active} from={shownFrom} scroll={scroll} />
							</div>
						</div>
					</div>
					<div
						style={{
							height: 96,
							display: "flex",
							alignItems: "center",
							gap: 24,
							padding: "0 32px",
							borderTop: "1px solid #ffffff14",
						}}
					>
						<div>
							<div style={{ fontSize: 21, fontWeight: 600 }}>
								{selected.size} Spaces
							</div>
							<div style={{ color: "#aaa", fontSize: 17 }}>
								{tabs} tabs selected
							</div>
						</div>
						<span
							style={{
								padding: "9px 16px",
								borderRadius: 10,
								boxShadow: "0 0 0 1px #ffffff2a",
								color: "#ccc",
								fontSize: 16,
							}}
						>
							Chrome profiles
						</span>
						<div style={{ flex: 1 }} />
						<Button
							press={pressAt(frame, SEND_CLICK)}
							style={{ padding: "15px 26px", fontSize: 20 }}
						>
							Send to browser
						</Button>
					</div>
				</AppWindow>
			</AbsoluteFill>
			<Cursor
				stops={[
					{ frame: 96, x: 1150, y: 1040 },
					{ frame: 116, x: 410, y: 620 },
					{ frame: 158, x: 336, y: 676 },
					{ frame: 214, x: 1462, y: 968 },
				]}
				clicks={[RESEARCH_CLICK, PERSONAL_CLICK, SEND_CLICK]}
			/>
		</SceneFade>
	);
}

function SpaceRow({
	space,
	top,
	active,
	checked,
	pulse,
}: {
	space: Space;
	top: number;
	active: boolean;
	checked: boolean;
	pulse: number;
}) {
	return (
		<div
			style={{
				position: "absolute",
				top,
				left: 14,
				right: 14,
				height: ROW.height,
				display: "flex",
				alignItems: "center",
				gap: 14,
				padding: "0 12px",
				borderRadius: 10,
				background: active ? "#222" : "transparent",
				fontSize: 21,
			}}
		>
			<span
				style={{
					display: "grid",
					placeItems: "center",
					width: 22,
					height: 22,
					borderRadius: 6,
					background: checked ? "#eee" : "transparent",
					boxShadow: checked ? "none" : "inset 0 0 0 2px #777",
					transform: `scale(${1 + pulse * 0.25})`,
				}}
			>
				{checked && <Check size={16} color="#000" />}
			</span>
			<span style={{ flex: 1, color: "#eee" }}>{space.name}</span>
			<span style={{ color: "#aaa", fontSize: 17 }}>{tabCount(space)}</span>
		</div>
	);
}

function Tree({
	space,
	from,
	scroll,
}: {
	space: Space;
	from: number;
	scroll: number;
}) {
	const frame = useCurrentFrame();
	const rows: { kind: "folder" | "tab"; name: string; count?: number }[] = [];
	for (const folder of space.folders) {
		rows.push({ kind: "folder", name: folder.name, count: folder.tabs.length });
		for (const tab of folder.tabs) rows.push({ kind: "tab", name: tab });
	}
	return (
		<div style={{ transform: `translateY(${scroll}px)` }}>
			{rows.map((row, i) => (
				<div
					key={row.name}
					style={{
						...rise(frame, from + i * 3, 12),
						height: 40,
						display: "flex",
						alignItems: "center",
						gap: 12,
						paddingLeft: row.kind === "tab" ? 44 : 0,
						color: row.kind === "folder" ? "#fff" : "#e0e0e0",
						fontSize: row.kind === "folder" ? 20 : 18,
						fontWeight: row.kind === "folder" ? 600 : 400,
					}}
				>
					{row.kind === "folder" ? (
						<>
							<span style={{ color: "#aaa", fontSize: 14 }}>⌄</span>
							<FolderIcon size={20} />
						</>
					) : (
						<TabIcon size={18} color="#aaa" />
					)}
					<span style={{ flex: 1 }}>{row.name}</span>
					{row.count && (
						<span style={{ color: "#aaa", fontSize: 15 }}>
							{row.count} tabs
						</span>
					)}
				</div>
			))}
		</div>
	);
}
