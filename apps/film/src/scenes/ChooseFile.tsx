import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { SPACES, TOTAL_TABS } from "../data";
import {
	AppBrand,
	AppWindow,
	BLUE,
	Button,
	Check,
	Cursor,
	Headline,
	pop,
	pressAt,
	progress,
	rise,
	SceneFade,
} from "../ui";
import type { Cue } from "../audio";

export const CHOOSE_FILE_FRAMES = 180;
const FOUND = 58;
const CLICK = 142;
export const CHOOSE_FILE_CUES: Cue[] = [
	[4, "whoosh"],
	[18, "scan"],
	[FOUND, "success"],
	[CLICK, "click"],
];
const WINDOW = { left: 420, top: 310, width: 1080, height: 690 };

const totals = [
	{ label: "Spaces", value: SPACES.length },
	{ label: "folders", value: SPACES.reduce((n, s) => n + s.folders.length, 0) },
	{ label: "tabs", value: TOTAL_TABS },
];

/** Step 1: Handoff finds the Arc sidebar file. */
export function ChooseFile() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const found = progress(frame, FOUND, 12);
	const card = pop(frame, fps, 14);
	const scan = interpolate(frame, [18, FOUND], [-30, 130], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	return (
		<SceneFade>
			<Headline
				eyebrow="Step 1"
				lead="Choose your"
				accent="Arc file."
				start={4}
				style={{ position: "absolute", top: 72, width: "100%" }}
			/>
			<AbsoluteFill style={{ ...WINDOW, ...rise(frame, 6, 50) }}>
				<AppWindow width={WINDOW.width} height={WINDOW.height}>
					<div
						style={{
							padding: "26px 40px",
							borderBottom: "1px solid #ffffff14",
						}}
					>
						<AppBrand size={26} />
					</div>
					<div
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							paddingTop: 36,
						}}
					>
						<div style={{ position: "relative", height: 44, width: "100%" }}>
							<StatusLine
								opacity={1 - found}
								text="Looking for your Arc sidebar…"
							/>
							<StatusLine opacity={found} text="Arc sidebar found" />
						</div>
						<div
							style={{
								position: "relative",
								overflow: "hidden",
								display: "flex",
								alignItems: "center",
								gap: 26,
								width: 660,
								marginTop: 28,
								padding: 22,
								borderRadius: 20,
								background: "#0b0b0c",
								boxShadow: `0 0 0 1px ${found ? "#1489fc80" : "#ffffff1f"}`,
								opacity: card,
								transform: `translateY(${(1 - card) * 40}px)`,
							}}
						>
							<FileTile />
							<div style={{ flex: 1 }}>
								<div
									style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.6 }}
								>
									StorableSidebar.json
								</div>
								<div style={{ marginTop: 8, color: "#9a9a9f", fontSize: 19 }}>
									Library › Application Support › Arc
								</div>
							</div>
							<div
								style={{
									display: "grid",
									placeItems: "center",
									width: 46,
									height: 46,
									borderRadius: "50%",
									background: BLUE,
									transform: `scale(${pop(frame, fps, FOUND)})`,
								}}
							>
								<Check size={24} />
							</div>
							<div
								style={{
									position: "absolute",
									inset: 0,
									opacity: 1 - found,
									background: `linear-gradient(100deg, transparent ${scan - 18}%, #1489fc33 ${scan}%, transparent ${scan + 18}%)`,
								}}
							/>
						</div>
						<div style={{ display: "flex", gap: 56, marginTop: 40 }}>
							{totals.map((t, i) => {
								const p = progress(frame, FOUND + 12 + i * 6, 26);
								return (
									<div
										key={t.label}
										style={{
											...rise(frame, FOUND + 10 + i * 6, 14),
											textAlign: "center",
										}}
									>
										<div
											style={{
												fontSize: 50,
												fontWeight: 600,
												letterSpacing: -1.5,
											}}
										>
											{Math.round(t.value * p)}
										</div>
										<div style={{ color: "#9a9a9f", fontSize: 19 }}>
											{t.label}
										</div>
									</div>
								);
							})}
						</div>
					</div>
					<div
						style={{
							position: "absolute",
							bottom: 40,
							width: "100%",
							display: "flex",
							justifyContent: "center",
							...rise(frame, 92, 16),
						}}
					>
						<Button press={pressAt(frame, CLICK)}>Preview sidebar</Button>
					</div>
				</AppWindow>
			</AbsoluteFill>
			<Cursor
				stops={[
					{ frame: 104, x: 1460, y: 1040 },
					{ frame: 134, x: 968, y: 932 },
				]}
				clicks={[CLICK]}
			/>
		</SceneFade>
	);
}

function StatusLine({ opacity, text }: { opacity: number; text: string }) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				textAlign: "center",
				opacity,
				fontSize: 38,
				fontWeight: 600,
				letterSpacing: -1,
			}}
		>
			{text}
		</div>
	);
}

/** The `{ }` file tile from the website's "Choose your Arc file" card. */
function FileTile() {
	return (
		<div
			style={{
				display: "grid",
				placeItems: "center",
				width: 96,
				height: 110,
				borderRadius: 14,
				background: "#0c1a3a",
				boxShadow: "0 0 0 1px #1489fc66",
				color: "#9cc8ff",
				fontSize: 30,
				fontWeight: 600,
			}}
		>
			<div>
				{"{ }"}
				<div style={{ display: "grid", gap: 6, marginTop: 10 }}>
					{[46, 34, 40].map((w) => (
						<i
							key={w}
							style={{
								width: w,
								height: 3,
								borderRadius: 2,
								background: "#9cc8ff88",
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
