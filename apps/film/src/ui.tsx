import { loadFont } from "@remotion/fonts";
import type { CSSProperties, ReactNode } from "react";
import {
	AbsoluteFill,
	Easing,
	Img,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

loadFont({
	family: "Figtree",
	url: staticFile("figtree.woff2"),
	weight: "300 900",
});
loadFont({
	family: "Instrument Serif",
	url: staticFile("instrument-serif-italic.ttf"),
	style: "italic",
});

export const SANS = "Figtree, sans-serif";
export const SERIF = '"Instrument Serif", Georgia, serif';
export const BLUE = "#1489fc";
export const SKY =
	"linear-gradient(180deg, #2b2cab 0%, #0757e3 19%, #1489fc 39%, #75d1fc 72%, #ceebf0 100%)";

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** 0 → 1 between `start` and `start + duration` frames, eased. */
export function progress(frame: number, start: number, duration = 20) {
	return interpolate(frame, [start, start + duration], [0, 1], {
		easing: EASE,
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
}

export function pop(frame: number, fps: number, start: number) {
	return spring({
		frame: frame - start,
		fps,
		config: { damping: 14, stiffness: 160, mass: 0.7 },
	});
}

/** Fades and lifts an element in from `start`. */
export function rise(frame: number, start: number, distance = 28) {
	const p = progress(frame, start, 22);
	return {
		opacity: p,
		transform: `translateY(${(1 - p) * distance}px)`,
	} satisfies CSSProperties;
}

/** The blue sky from the website hero, drifting slowly. */
export function Sky() {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill
			style={{
				background: SKY,
				backgroundSize: "100% 112%",
				backgroundPosition: `0 ${interpolate(frame, [0, 3000], [0, 100], { extrapolateRight: "clamp" })}%`,
				boxShadow: "inset 0 0 120px #ffffff14",
			}}
		/>
	);
}

/** The grassy hill under the website hero, with its black sky masked away. */
export function Hill({ lift }: { lift: number }) {
	return (
		<Img
			src={staticFile("grassy-hill.png")}
			style={{
				position: "absolute",
				left: -160,
				width: 2240,
				bottom: -330 - (1 - lift) * 360,
				WebkitMaskImage:
					"linear-gradient(to bottom, transparent 50%, #000 66%)",
				maskImage: "linear-gradient(to bottom, transparent 50%, #000 66%)",
			}}
		/>
	);
}

const BAND_A =
	"M10.65 27.85V10.5Q10.65 5.25 15.9 5.25H27.7Q32.6 5.25 32.6 10.55H16.15V27.85Z";
const BAND_B =
	"M10.65 10.55Q5.35 10.55 5.35 15.85V27.9Q5.35 33 10.45 33H27.3V27.85H10.65Z";

/** The Handoff mark. `draw` traces the strokes from 0 to 1. */
export function Mark({
	size,
	draw = 1,
	color = "#fff",
}: {
	size: number;
	draw?: number;
	color?: string;
}) {
	const dash = {
		pathLength: 1,
		strokeDasharray: 1,
		strokeDashoffset: 1 - draw,
	};
	const bands = (
		<>
			<path d={BAND_A} {...dash} />
			<path d={BAND_B} {...dash} />
		</>
	);
	return (
		<svg width={size} height={size} viewBox="-1 -1 46 46" aria-hidden="true">
			<g
				transform="rotate(45 22 22)"
				fill="none"
				stroke={color}
				strokeWidth={2.65}
				strokeLinejoin="round"
			>
				{bands}
				<g transform="rotate(180 22 22)">{bands}</g>
			</g>
		</svg>
	);
}

/** A big two-part title: plain sans lead, serif italic accent, like the hero. */
export function Headline({
	eyebrow,
	lead,
	accent,
	start = 0,
	size = 84,
	stack = false,
	style,
}: {
	eyebrow?: string;
	lead: string;
	accent: string;
	start?: number;
	size?: number;
	stack?: boolean;
	style?: CSSProperties;
}) {
	const frame = useCurrentFrame();
	return (
		<div style={{ textAlign: "center", color: "#fff", ...style }}>
			{eyebrow && (
				<div
					style={{
						...rise(frame, start, 16),
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						gap: 12,
						marginBottom: 18,
						fontSize: 24,
						fontWeight: 550,
						letterSpacing: -0.5,
						color: "#f2faff",
					}}
				>
					<Mark size={30} />
					{eyebrow}
				</div>
			)}
			<div
				style={{
					fontSize: size,
					fontWeight: 600,
					lineHeight: 1,
					letterSpacing: "-0.06em",
				}}
			>
				<span style={{ display: "inline-block", ...rise(frame, start + 4) }}>
					{lead}
				</span>{" "}
				<span
					style={{
						display: stack ? "block" : "inline-block",
						lineHeight: 1.03,
						fontFamily: SERIF,
						fontStyle: "italic",
						fontWeight: 400,
						fontSize: "1.1em",
						letterSpacing: "-0.035em",
						...rise(frame, start + 10),
					}}
				>
					{accent}
				</span>
			</div>
		</div>
	);
}

/** Fades a scene in and out over its sequence. */
export function SceneFade({
	children,
	fadeIn = true,
	fadeOut = true,
}: {
	children: ReactNode;
	fadeIn?: boolean;
	fadeOut?: boolean;
}) {
	const frame = useCurrentFrame();
	const { durationInFrames } = useVideoConfig();
	const opacity =
		(fadeIn ? progress(frame, 0, 12) : 1) *
		(fadeOut ? 1 - progress(frame, durationInFrames - 14, 14) : 1);
	return (
		<AbsoluteFill style={{ opacity, fontFamily: SANS }}>
			{children}
		</AbsoluteFill>
	);
}

/** The black Handoff window from the website demo. */
export function AppWindow({
	width,
	height,
	title = "Handoff",
	children,
	style,
}: {
	width: number;
	height: number;
	title?: string;
	children: ReactNode;
	style?: CSSProperties;
}) {
	return (
		<div
			style={{
				position: "relative",
				width,
				height,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				borderRadius: 22,
				background: "#000",
				color: "#f5f5f5",
				boxShadow:
					"0 0 0 1px #ffffff26, 0 50px 120px #001a5c59, 0 12px 30px #00000040",
				...style,
			}}
		>
			<div
				style={{
					position: "relative",
					height: 46,
					flex: "none",
					display: "flex",
					alignItems: "center",
					padding: "0 20px",
					background: "#111",
					borderBottom: "1px solid #ffffff14",
				}}
			>
				<WindowDots />
				<span
					style={{
						position: "absolute",
						left: "50%",
						transform: "translateX(-50%)",
						color: "#c7cbd5",
						fontSize: 17,
						fontWeight: 550,
					}}
				>
					{title}
				</span>
			</div>
			{children}
		</div>
	);
}

export function WindowDots() {
	return (
		<span style={{ display: "flex", gap: 9 }}>
			{["#ed756c", "#e9be67", "#7bc98b"].map((color) => (
				<i
					key={color}
					style={{
						width: 13,
						height: 13,
						borderRadius: "50%",
						background: color,
					}}
				/>
			))}
		</span>
	);
}

export function AppBrand({ size = 30 }: { size?: number }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: size * 0.45 }}>
			<Img
				src={staticFile("handoff-mark.png")}
				style={{
					width: size * 1.55,
					height: size * 1.55,
					borderRadius: size * 0.4,
				}}
			/>
			<strong style={{ fontSize: size, letterSpacing: -0.6 }}>Handoff</strong>
		</div>
	);
}

/** A white pill button. `press` (0–1) dips it like a click. */
export function Button({
	children,
	press = 0,
	style,
}: {
	children: ReactNode;
	press?: number;
	style?: CSSProperties;
}) {
	return (
		<div
			style={{
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 12,
				padding: "16px 28px",
				borderRadius: 14,
				background: "#fff",
				color: "#111",
				fontSize: 21,
				fontWeight: 600,
				transform: `scale(${1 - press * 0.05})`,
				boxShadow: "0 8px 24px #0000004d",
				...style,
			}}
		>
			{children}
		</div>
	);
}

type Stop = { frame: number; x: number; y: number };

/** A pointer that rests on each stop, travels to arrive at the next stop's frame, and dips on clicks. */
export function Cursor({
	stops,
	clicks = [],
}: {
	stops: Stop[];
	clicks?: number[];
}) {
	const frame = useCurrentFrame();
	let x = stops[0].x;
	let y = stops[0].y;
	for (let i = 1; i < stops.length; i++) {
		const start = Math.max(stops[i - 1].frame, stops[i].frame - 18);
		const p = progress(frame, start, stops[i].frame - start);
		if (frame >= start) {
			x = stops[i - 1].x + (stops[i].x - stops[i - 1].x) * p;
			y = stops[i - 1].y + (stops[i].y - stops[i - 1].y) * p;
		}
	}
	const dip = Math.max(
		0,
		...clicks.map((c) => 1 - Math.min(1, Math.abs(frame - c) / 5)),
	);
	const opacity = progress(frame, stops[0].frame - 8, 8);
	return (
		<svg
			width={40}
			height={40}
			viewBox="0 0 28 28"
			style={{
				position: "absolute",
				left: x,
				top: y,
				opacity,
				transform: `scale(${1 - dip * 0.18})`,
				transformOrigin: "4px 3px",
				filter: "drop-shadow(0 3px 6px #00000059)",
			}}
			aria-hidden="true"
		>
			<path
				d="M5 3.2v19.6l5.3-5.1 3.3 7.6 3.5-1.5-3.3-7.5h7.3z"
				fill="#111"
				stroke="#fff"
				strokeWidth={1.6}
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** How pressed a button looks around a click frame (0–1). */
export function pressAt(frame: number, click: number) {
	return Math.max(0, 1 - Math.abs(frame - click) / 5);
}

export function TabIcon({
	size = 20,
	color = "currentColor",
}: {
	size?: number;
	color?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth={1.6}
			aria-hidden="true"
		>
			<rect x="3" y="4" width="18" height="16" rx="1" />
			<path d="M3 9h18" />
		</svg>
	);
}

export function FolderIcon({
	size = 20,
	color = "currentColor",
}: {
	size?: number;
	color?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth={1.6}
			aria-hidden="true"
		>
			<path d="M3 6h7l2 3h9v11H3z" />
		</svg>
	);
}

export function Check({
	size = 18,
	color = "#fff",
}: {
	size?: number;
	color?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth={3}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="m5 12.5 4.5 4.5L19 7.5" />
		</svg>
	);
}
