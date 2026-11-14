import {
	AbsoluteFill,
	Img,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import {
	DETECTED,
	type Profile,
	PROFILES,
	type Space,
	SPACES,
	tabCount,
	TOTAL_TABS,
} from "../data";
import {
	AppWindow,
	BLUE,
	Button,
	Cursor,
	Headline,
	pop,
	pressAt,
	progress,
	rise,
	SceneFade,
} from "../ui";
import type { Cue } from "../audio";

export const PICK_FRAMES = 330;
const W = { left: 360, top: 280, width: 1200, height: 720 };
const CHROME_CLICK = 44;
const ROWS_TOP = 330;
const ROW_STEP = 88;
const OPTION = 56;
const OPEN_CLICK = 268;

// Each row: when its menu opens, which option is picked and when, and which way the menu opens.
const PICKS = [
	{ open: 98, pick: 124, option: 1, up: false },
	{ open: 152, pick: 174, option: 1, up: true },
	{ open: 200, pick: 224, option: 2, up: true },
];
const OPTIONS: (Profile | null)[] = [null, ...PROFILES];
export const PICK_CUES: Cue[] = [
	[4, "whoosh"],
	[CHROME_CLICK, "click"],
	...PICKS.flatMap((p): Cue[] => [
		[p.open, "click"],
		[p.open + 2, "pop"],
		[p.pick, "click"],
	]),
	[OPEN_CLICK, "click"],
	[OPEN_CLICK + 4, "success"],
];

const rowTop = (i: number) => ROWS_TOP + i * ROW_STEP;
const menuTop = (i: number) =>
	PICKS[i].up ? rowTop(i) - 6 - (OPTIONS.length * OPTION + 16) : rowTop(i) + 72;
const abs = (x: number, y: number) => ({ x: W.left + x, y: W.top + y });

/** Step 3: choose Chrome, then a signed-in Chrome profile for each Space. */
export function PickProfiles() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const chrome = progress(frame, CHROME_CLICK, 10);
	const assigned = PICKS.filter((p) => frame >= p.pick).length;
	const used = new Set(SPACES.slice(0, assigned).map((s) => s.profile.name))
		.size;
	const tabs = SPACES.slice(0, assigned).reduce((n, s) => n + tabCount(s), 0);

	const stops = [
		{ frame: 22, x: 820, y: 1040 },
		{ frame: 38, ...abs(118, 136) },
	];
	const clicks = [CHROME_CLICK];
	PICKS.forEach((p, i) => {
		stops.push({ frame: p.open - 10, ...abs(1000, rowTop(i) + 38) });
		stops.push({
			frame: p.pick - 6,
			...abs(960, menuTop(i) + 8 + p.option * OPTION + 28),
		});
		clicks.push(p.open, p.pick);
	});
	stops.push({ frame: OPEN_CLICK - 12, ...abs(612, 652) });
	clicks.push(OPEN_CLICK);

	return (
		<SceneFade>
			<Headline
				eyebrow="Step 3"
				lead="A Chrome profile"
				accent="for each Space."
				start={4}
				style={{ position: "absolute", top: 72, width: "100%" }}
			/>
			<AbsoluteFill style={{ ...W, ...rise(frame, 6, 50) }}>
				<AppWindow
					width={W.width}
					height={W.height}
					style={{ overflow: "visible" }}
				>
					<div
						style={{
							position: "absolute",
							top: 74,
							left: 40,
							color: "#aaa",
							fontSize: 17,
						}}
					>
						Destination browser
					</div>
					<div
						style={{
							position: "absolute",
							top: 104,
							left: 40,
							display: "flex",
							gap: 14,
						}}
					>
						{DETECTED.map((b, i) => {
							const on = i === 0 ? chrome : 0;
							return (
								<div
									key={b.name}
									style={{
										...rise(frame, 10 + i * 3, 12),
										display: "flex",
										alignItems: "center",
										gap: 12,
										width: 156,
										height: 64,
										padding: "0 16px",
										borderRadius: 14,
										background: on ? `rgba(20,137,252,${0.18 * on})` : "#111",
										boxShadow: `0 0 0 ${1 + on}px ${on ? BLUE : "#ffffff1f"}`,
										fontSize: 19,
										transform: `scale(${1 - pressAt(frame, CHROME_CLICK) * 0.04 * (i === 0 ? 1 : 0)})`,
									}}
								>
									<Img
										src={staticFile(b.image)}
										style={{ width: 34, height: 34 }}
									/>
									{b.name}
								</div>
							);
						})}
					</div>
					<div
						style={{
							position: "absolute",
							top: 196,
							left: 40,
							right: 40,
							height: 1,
							background: "#ffffff14",
						}}
					/>
					<div
						style={{
							position: "absolute",
							top: 220,
							left: 40,
							right: 40,
							...rise(frame, CHROME_CLICK + 6, 16),
						}}
					>
						<div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.8 }}>
							Open in Chrome profiles
						</div>
						<div
							style={{
								marginTop: 8,
								color: "#aaa",
								fontSize: 19,
								lineHeight: 1.4,
							}}
						>
							Each Space opens in its own window, signed in as that profile.
						</div>
					</div>
					{SPACES.map((space, i) => (
						<SpaceRow key={space.id} space={space} index={i} />
					))}
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							top: 622,
							display: "flex",
							justifyContent: "center",
							...rise(frame, 84, 12),
						}}
					>
						<Button
							press={pressAt(frame, OPEN_CLICK)}
							style={{ minWidth: 380 }}
						>
							{assigned === 0
								? "Nothing to open"
								: `Open ${tabs} tabs in ${used} ${used === 1 ? "profile" : "profiles"}`}
						</Button>
					</div>
					{PICKS.map((p, i) => (
						<Menu key={p.open} index={i} />
					))}
				</AppWindow>
			</AbsoluteFill>
			<div
				style={{
					position: "absolute",
					top: W.top + W.height + 18,
					width: "100%",
					textAlign: "center",
					opacity: pop(frame, fps, OPEN_CLICK + 4),
					color: "#174e82",
					fontSize: 22,
					fontWeight: 550,
				}}
			>
				{TOTAL_TABS} tabs · {SPACES.length} windows · already signed in
			</div>
			<Cursor stops={stops} clicks={clicks} />
		</SceneFade>
	);
}

function SpaceRow({ space, index }: { space: Space; index: number }) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const pick = PICKS[index];
	const filled = frame >= pick.pick;
	return (
		<div
			style={{
				...rise(frame, 60 + index * 6, 14),
				position: "absolute",
				top: rowTop(index),
				left: 40,
				right: 40,
				height: 76,
				display: "flex",
				alignItems: "center",
				padding: "0 10px 0 22px",
				borderRadius: 16,
				background: "#0b0b0c",
				boxShadow: "0 0 0 1px #ffffff14",
			}}
		>
			<div style={{ flex: 1 }}>
				<div style={{ fontSize: 23, fontWeight: 600 }}>{space.name}</div>
				<div style={{ color: "#999", fontSize: 16 }}>
					{tabCount(space)} tabs · {space.folders.length} folders
				</div>
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 14,
					width: 440,
					height: 56,
					padding: "0 18px",
					borderRadius: 12,
					background: "#161617",
					boxShadow: `0 0 0 1px ${frame >= pick.open && !filled ? BLUE : "#ffffff24"}`,
					transform: `scale(${1 - pressAt(frame, pick.open) * 0.03})`,
				}}
			>
				{filled ? (
					<>
						<span style={{ transform: `scale(${pop(frame, fps, pick.pick)})` }}>
							<Avatar profile={space.profile} size={34} />
						</span>
						<div style={{ flex: 1 }}>
							<div style={{ fontSize: 19, fontWeight: 600 }}>
								{space.profile.name}
							</div>
							<div style={{ color: "#999", fontSize: 14 }}>
								{space.profile.account}
							</div>
						</div>
					</>
				) : (
					<span style={{ flex: 1, color: "#888", fontSize: 19 }}>
						Don't open
					</span>
				)}
				<span style={{ color: "#888", fontSize: 18 }}>⌄</span>
			</div>
		</div>
	);
}

function Menu({ index }: { index: number }) {
	const frame = useCurrentFrame();
	const pick = PICKS[index];
	const open =
		progress(frame, pick.open, 8) * (1 - progress(frame, pick.pick + 2, 6));
	if (open <= 0) return null;
	const hover = frame >= pick.pick - 8 ? pick.option : -1;
	return (
		<div
			style={{
				position: "absolute",
				zIndex: 2,
				top: menuTop(index),
				left: W.width - 40 - 10 - 440,
				width: 440,
				padding: 8,
				borderRadius: 14,
				background: "#1d1d1f",
				boxShadow: "0 0 0 1px #ffffff26, 0 24px 60px #000000a0",
				opacity: open,
				transform: `translateY(${(1 - open) * (pick.up ? 10 : -10)}px)`,
			}}
		>
			{OPTIONS.map((profile, i) => (
				<div
					key={profile?.name ?? "skip"}
					style={{
						height: OPTION,
						display: "flex",
						alignItems: "center",
						gap: 14,
						padding: "0 12px",
						borderRadius: 10,
						background: i === hover ? BLUE : "transparent",
					}}
				>
					{profile ? (
						<>
							<Avatar profile={profile} size={32} />
							<div style={{ flex: 1 }}>
								<div style={{ fontSize: 18, fontWeight: 600 }}>
									{profile.name}
								</div>
								<div
									style={{
										color: i === hover ? "#e6f1ff" : "#999",
										fontSize: 14,
									}}
								>
									{profile.account}
								</div>
							</div>
						</>
					) : (
						<span style={{ color: "#aaa", fontSize: 18 }}>Don't open</span>
					)}
				</div>
			))}
		</div>
	);
}

export function Avatar({ profile, size }: { profile: Profile; size: number }) {
	return (
		<span
			style={{
				display: "grid",
				placeItems: "center",
				width: size,
				height: size,
				borderRadius: "50%",
				background: profile.color,
				color: "#fff",
				fontSize: size * 0.48,
				fontWeight: 650,
				flex: "none",
			}}
		>
			{profile.name[0]}
		</span>
	);
}
