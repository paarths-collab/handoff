import type { CSSProperties, ReactNode } from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import type { Cue } from "../audio";
import { SPACES } from "../data";
import {
	FolderIcon,
	Headline,
	progress,
	rise,
	SceneFade,
	TabIcon,
	WindowDots,
} from "../ui";

export const MEMORIES_FRAMES = 300;
export const STALLED_FRAMES = 240;

// Years of sidebar: every folder and tab from the sample Spaces, plus a fourth Space.
const SIDE_PROJECT = {
	name: "Side project",
	folders: [
		{
			name: "Someday",
			tabs: ["Landing page", "Name ideas", "Pricing notes", "Launch list"],
		},
	],
};
// Sidebar colours as Spaces are added.
const THEMES = [
	["#7d8cff", "#4f5fe0"],
	["#b08cff", "#7a52d9"],
	["#5fcf9f", "#2f9a74"],
	["#f2a33c", "#d5702a"],
];
const ROWS = [...SPACES, SIDE_PROJECT].flatMap((space, s) =>
	space.folders.flatMap((folder) => [
		{ kind: "folder" as const, name: folder.name, space: s },
		...folder.tabs.map((tab) => ({
			kind: "tab" as const,
			name: tab,
			space: s,
		})),
	]),
);
const PINNED = [
	"#ffffff",
	"#ea4335",
	"#34a853",
	"#fbbc05",
	"#1a73e8",
	"#5fd4a0",
	"#ff7a59",
	"#8ab4f8",
];
const ROW_HEIGHT = 30;
const LIST_HEIGHT = 380;
const SCREEN = { width: 1056, height: 660 };

const LABELS = [
	{ at: 0, text: "Week one", count: "1 Space · 4 tabs" },
	{ at: 0.3, text: "Month six", count: "2 Spaces · 86 tabs" },
	{ at: 0.55, text: "Year two", count: "3 Spaces · 612 tabs" },
	{ at: 0.78, text: "Year three", count: "4 Spaces · 1,284 tabs" },
];

export const memoriesCues = (frames: number): Cue[] =>
	LABELS.slice(1).map(({ at }) => [Math.round(at * frames), "pop"]);
export const stalledCues = (frames: number): Cue[] => [
	[0, "dim"],
	[Math.round(0.42 * frames), "scatter"],
];

/** Years of Arc: the browser fills up, one Space and tab at a time. */
export function Memories() {
	const frame = useCurrentFrame();
	const { durationInFrames: d } = useVideoConfig();
	// Slow at first, then piling up, like years of tabs.
	const fill =
		interpolate(frame, [12, d * 0.85], [0, 1], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		}) ** 1.7;
	const label = LABELS.findLast((l) => frame >= l.at * d) ?? LABELS[0];
	return (
		<SceneFade fadeIn={false}>
			<Caption
				key={label.text}
				text={label.text}
				count={label.count}
				start={label.at * d}
			/>
			<Laptop lift={progress(frame, 0, 30)}>
				<ArcWindow fill={fill} />
			</Laptop>
		</SceneFade>
	);
}

/** Arc stalls: the colour drains, the tabs scatter, and starting over looms. */
export function Stalled() {
	const frame = useCurrentFrame();
	const { durationInFrames: d } = useVideoConfig();
	const drain = progress(frame, 0, d * 0.22);
	return (
		<SceneFade fadeIn={false}>
			<AbsoluteFill style={{ background: "#08133f", opacity: drain * 0.32 }} />
			<div style={{ opacity: 1 - drain }}>
				<Caption text="Year three" count="4 Spaces · 1,284 tabs" start={-30} />
			</div>
			<Caption text="Start over?" start={d * 0.44} />
			<Laptop>
				<div
					style={{
						filter: `grayscale(${drain}) brightness(${1 - drain * 0.3})`,
					}}
				>
					<ArcWindow fill={1} scatterFrom={d * 0.42} />
				</div>
			</Laptop>
		</SceneFade>
	);
}

/** A serif title over the sky, with an optional count beneath. */
function Caption({
	text,
	count,
	start,
}: {
	text: string;
	count?: string;
	start: number;
}) {
	const frame = useCurrentFrame();
	return (
		<div
			style={{
				position: "absolute",
				top: 70,
				width: "100%",
				textAlign: "center",
				color: "#fff",
			}}
		>
			<Headline lead="" accent={text} start={start} size={92} />
			{count && (
				<div
					style={{
						...rise(frame, start + 8, 16),
						marginTop: 12,
						color: "#e6f3ff",
						fontSize: 26,
					}}
				>
					{count}
				</div>
			)}
		</div>
	);
}

/** A silver laptop with a black bezel, its screen showing `children`. */
function Laptop({
	children,
	lift = 1,
}: {
	children: ReactNode;
	lift?: number;
}) {
	return (
		<div
			style={{
				position: "absolute",
				left: (1920 - (SCREEN.width + 36)) / 2,
				top: 290,
				opacity: lift,
				transform: `translateY(${(1 - lift) * 60}px)`,
			}}
		>
			<div
				style={{
					position: "relative",
					boxSizing: "border-box",
					width: SCREEN.width + 36,
					padding: "24px 18px 26px",
					borderRadius: "26px 26px 10px 10px",
					background: "#0c0d10",
					boxShadow: "0 0 0 2px #3a3d45, 0 50px 110px #001a5c66",
				}}
			>
				<i
					style={{
						position: "absolute",
						top: 9,
						left: "50%",
						width: 7,
						height: 7,
						marginLeft: -3.5,
						borderRadius: "50%",
						background: "#2a2d35",
					}}
				/>
				<div
					style={{
						position: "relative",
						width: SCREEN.width,
						height: SCREEN.height,
						overflow: "hidden",
						borderRadius: 8,
						background: "#000",
					}}
				>
					{children}
				</div>
			</div>
			<div
				style={{
					position: "relative",
					width: SCREEN.width + 36 + 180,
					height: 26,
					marginLeft: -90,
					borderRadius: "4px 4px 22px 22px",
					background: "linear-gradient(180deg, #e9ebf0, #b9bdc7 60%, #8f949f)",
					boxShadow: "0 18px 40px #001a5c55",
				}}
			>
				<i
					style={{
						position: "absolute",
						top: 0,
						left: "50%",
						width: 170,
						height: 9,
						marginLeft: -85,
						borderRadius: "0 0 10px 10px",
						background: "#9da2ad",
					}}
				/>
			</div>
		</div>
	);
}

/**
 * An Arc-style browser: a coloured sidebar with pinned tiles, folders, tabs and Space dots,
 * beside the open page. `fill` reveals it over the years; `scatterFrom` drops its pieces away.
 */
function ArcWindow({
	fill,
	scatterFrom,
}: {
	fill: number;
	scatterFrom?: number;
}) {
	const frame = useCurrentFrame();
	const rows = Math.round(fill * ROWS.length);
	const pinned = Math.round(Math.min(1, fill * 1.6) * PINNED.length);
	const spaces = Math.min(4, 1 + Math.floor(fill * 4));
	const [from, to] = THEMES[spaces - 1];
	const scroll = Math.max(0, rows * ROW_HEIGHT - LIST_HEIGHT);
	const current = ROWS.slice(0, rows).findLast((r) => r.kind === "tab");
	// Each piece falls in turn once scattering starts.
	const fall = (order: number): CSSProperties => {
		if (scatterFrom === undefined) return {};
		const p = progress(frame, scatterFrom + order * 2.2, 26);
		const side = order % 2 ? 1 : -1;
		return {
			opacity: 1 - p,
			transform: `translate(${side * p * 50}px, ${p * p * 480}px) rotate(${side * p * 16}deg)`,
		};
	};
	return (
		<div
			style={{
				position: "relative",
				width: SCREEN.width,
				height: SCREEN.height,
				display: "flex",
				background: `linear-gradient(160deg, ${from}, ${to})`,
				color: "#fff",
				fontFamily: "Figtree, sans-serif",
			}}
		>
			<aside style={{ position: "relative", width: 252, padding: "14px 12px" }}>
				<WindowDots />
				<div
					style={{
						...fall(0),
						marginTop: 14,
						height: 34,
						display: "flex",
						alignItems: "center",
						padding: "0 12px",
						borderRadius: 9,
						background: "#ffffff2a",
						color: "#ffffffcc",
						fontSize: 13,
					}}
				>
					{current?.name ?? "Search or enter address"}
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						gap: 7,
						marginTop: 12,
					}}
				>
					{PINNED.map((color, i) => (
						<div
							key={color}
							style={{
								height: 42,
								display: "grid",
								placeItems: "center",
								borderRadius: 10,
								background: "#ffffff30",
								opacity: i < pinned ? 1 : 0,
								...(i < pinned ? fall(1 + i) : {}),
							}}
						>
							<i
								style={{
									width: 16,
									height: 16,
									borderRadius: 5,
									background: color,
								}}
							/>
						</div>
					))}
				</div>
				<div
					style={{
						position: "relative",
						height: LIST_HEIGHT,
						marginTop: 14,
						overflow: "hidden",
						WebkitMaskImage:
							"linear-gradient(to bottom, transparent, #000 8%, #000 90%, transparent)",
						maskImage:
							"linear-gradient(to bottom, transparent, #000 8%, #000 90%, transparent)",
					}}
				>
					<div style={{ transform: `translateY(${-scroll}px)` }}>
						{ROWS.slice(0, rows).map((row, i) => (
							<div
								key={`${row.space}-${row.name}`}
								style={{
									height: ROW_HEIGHT,
									display: "flex",
									alignItems: "center",
									gap: 9,
									paddingLeft: row.kind === "tab" ? 22 : 4,
									borderRadius: 7,
									background: row === current ? "#ffffff38" : "transparent",
									fontSize: 14,
									fontWeight: row.kind === "folder" ? 600 : 450,
									whiteSpace: "nowrap",
									...fall(10 + (rows - i)),
								}}
							>
								{row.kind === "folder" ? (
									<FolderIcon size={15} color="#fff" />
								) : (
									<TabIcon size={14} color="#ffffffcc" />
								)}
								{row.name}
							</div>
						))}
					</div>
				</div>
				<div
					style={{
						position: "absolute",
						bottom: 16,
						left: 0,
						right: 0,
						display: "flex",
						justifyContent: "center",
						gap: 12,
					}}
				>
					{THEMES.map(([color], i) => (
						<i
							key={color}
							style={{
								width: 11,
								height: 11,
								borderRadius: "50%",
								background: i < spaces ? "#fff" : "#ffffff40",
								boxShadow: i === spaces - 1 ? "0 0 0 3px #ffffff55" : "none",
								...(i < spaces ? fall(40 + i) : {}),
							}}
						/>
					))}
				</div>
			</aside>
			<Page title={current?.name} color={from} style={fall(6)} />
		</div>
	);
}

/** The open tab: a simple light page whose title follows the newest tab. */
function Page({
	title,
	color,
	style,
}: {
	title?: string;
	color: string;
	style: CSSProperties;
}) {
	return (
		<div
			style={{
				flex: 1,
				margin: "8px 8px 8px 0",
				padding: "40px 48px",
				borderRadius: 10,
				background: "#f7f8fb",
				color: "#15161a",
				boxShadow: "0 4px 18px #00000026",
				...style,
			}}
		>
			<div
				style={{
					height: 180,
					borderRadius: 14,
					background: `linear-gradient(135deg, ${color}, ${color}88)`,
				}}
			/>
			<div
				style={{
					marginTop: 30,
					fontSize: 40,
					fontWeight: 650,
					letterSpacing: -1.2,
				}}
			>
				{title ?? "New tab"}
			</div>
			{[92, 84, 88, 60].map((w) => (
				<i
					key={w}
					style={{
						display: "block",
						width: `${w}%`,
						height: 12,
						marginTop: 16,
						borderRadius: 6,
						background: "#e3e5ec",
					}}
				/>
			))}
		</div>
	);
}
