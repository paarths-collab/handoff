import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { type Space, SPACES, TOTAL_TABS } from "../data";
import { Check, Headline, pop, SceneFade, WindowDots } from "../ui";
import { Avatar } from "./PickProfiles";
import type { Cue } from "../audio";

export const OPEN_FRAMES = 240;
const SPOTS = [
	{ left: 130, top: 300, start: 16 },
	{ left: 540, top: 410, start: 46 },
	{ left: 950, top: 520, start: 76 },
];
export const OPEN_CUES: Cue[] = [
	...SPOTS.flatMap((s): Cue[] => [
		[s.start, "window"],
		[s.start + 10, "tabs"],
	]),
	[150, "success"],
];

/** Each Space lands in its own Chrome window, in the profile chosen for it. */
export function OpenWindows() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const toast = pop(frame, fps, 150);
	return (
		<SceneFade>
			<Headline
				eyebrow="Chrome profiles"
				lead="Opened in the"
				accent="right profile."
				start={4}
				style={{ position: "absolute", top: 72, width: "100%" }}
			/>
			{SPACES.map((space, i) => (
				<BrowserWindow key={space.id} space={space} {...SPOTS[i]} />
			))}
			<div
				style={{
					position: "absolute",
					left: "50%",
					bottom: 44,
					display: "flex",
					alignItems: "center",
					gap: 14,
					padding: "16px 26px",
					borderRadius: 18,
					background: "#000",
					color: "#fff",
					fontSize: 22,
					fontWeight: 550,
					boxShadow: "0 16px 40px #0000004d",
					opacity: toast,
					transform: `translateX(-50%) translateY(${(1 - toast) * 30}px)`,
				}}
			>
				<Check size={22} color="#5fd4a0" />
				Opened {TOTAL_TABS} tabs in 2 Chrome profiles.
			</div>
		</SceneFade>
	);
}

function BrowserWindow({
	space,
	left,
	top,
	start,
}: {
	space: Space;
	left: number;
	top: number;
	start: number;
}) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const appear = pop(frame, fps, start);
	const tabs = space.folders.flatMap((f) => f.tabs);
	const tabWidth = Math.min(170, 690 / tabs.length);
	const shown = tabs.filter((_, i) => frame >= start + 10 + i * 2).length;
	const current = tabs[Math.max(0, shown - 1)];
	return (
		<div
			style={{
				position: "absolute",
				left,
				top,
				width: 840,
				height: 480,
				overflow: "hidden",
				borderRadius: 16,
				background: "#202124",
				boxShadow: "0 0 0 1px #ffffff26, 0 40px 100px #001a5c66",
				opacity: Math.min(1, appear * 1.4),
				transform: `scale(${0.9 + appear * 0.1})`,
				transformOrigin: "30% 0",
			}}
		>
			<div
				style={{
					height: 52,
					display: "flex",
					alignItems: "flex-end",
					gap: 0,
					padding: "0 14px",
					background: "#0f0f10",
				}}
			>
				<div style={{ alignSelf: "center", marginRight: 14 }}>
					<WindowDots />
				</div>
				{tabs.slice(0, shown).map((tab, i) => (
					<div
						key={tab}
						style={{
							width: tabWidth,
							height: 40,
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "0 10px",
							overflow: "hidden",
							borderRadius: "10px 10px 0 0",
							background: i === shown - 1 ? "#202124" : "transparent",
							borderRight: i === shown - 1 ? "none" : "1px solid #ffffff14",
							color: "#e8eaed",
							fontSize: 14,
							whiteSpace: "nowrap",
						}}
					>
						<i
							style={{
								flex: "none",
								width: 14,
								height: 14,
								borderRadius: 4,
								background: space.profile.color,
								opacity: 0.85,
							}}
						/>
						{tabWidth > 60 && tab}
					</div>
				))}
			</div>
			<div
				style={{
					height: 54,
					display: "flex",
					alignItems: "center",
					gap: 14,
					padding: "0 16px",
				}}
			>
				<span style={{ color: "#9aa0a6", fontSize: 20, letterSpacing: 6 }}>
					‹ › ↻
				</span>
				<div
					style={{
						flex: 1,
						height: 36,
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "0 16px",
						borderRadius: 18,
						background: "#2b2c2f",
						color: "#e8eaed",
						fontSize: 16,
					}}
				>
					<Img
						src={staticFile("chrome.png")}
						style={{ width: 18, height: 18 }}
					/>
					{current}
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "4px 14px 4px 4px",
						borderRadius: 18,
						background: "#35363a",
						color: "#e8eaed",
						fontSize: 15,
						fontWeight: 600,
					}}
				>
					<Avatar profile={space.profile} size={28} />
					{space.profile.name}
				</div>
			</div>
			<div style={{ padding: "28px 34px", display: "grid", gap: 16 }}>
				<div
					style={{
						color: "#fff",
						fontSize: 30,
						fontWeight: 600,
						letterSpacing: -0.8,
					}}
				>
					{space.name}
				</div>
				{[78, 92, 64, 84].map((w, i) => (
					<i
						key={w}
						style={{
							display: "block",
							width: `${w}%`,
							height: i === 0 ? 18 : 12,
							borderRadius: 6,
							background: "#ffffff14",
						}}
					/>
				))}
			</div>
		</div>
	);
}
