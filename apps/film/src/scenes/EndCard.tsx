import {
	AbsoluteFill,
	Img,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { BROWSERS } from "../data";
import { Hill, Mark, pop, progress, rise, SceneFade, SERIF } from "../ui";
import type { Cue } from "../audio";

export const END_FRAMES = 180;
export const END_CUES: Cue[] = [
	[0, "swell"],
	[34, "pop"],
];

/** Logo, promise and call to action over the website's sky and hill. */
export function EndCard() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	return (
		<SceneFade fadeOut={false}>
			<Hill lift={progress(frame, 0, 50)} />
			<AbsoluteFill
				style={{ alignItems: "center", paddingTop: 170, color: "#fff" }}
			>
				<div
					style={{
						...rise(frame, 6),
						display: "flex",
						alignItems: "center",
						gap: 26,
					}}
				>
					<Mark size={110} draw={progress(frame, 4, 30)} />
					<span
						style={{ fontSize: 118, fontWeight: 650, letterSpacing: "-0.05em" }}
					>
						Handoff
					</span>
				</div>
				<div
					style={{
						...rise(frame, 22),
						marginTop: 22,
						fontSize: 62,
						fontWeight: 600,
						letterSpacing: "-0.05em",
					}}
				>
					Move on{" "}
					<span
						style={{
							fontFamily: SERIF,
							fontStyle: "italic",
							fontWeight: 400,
							fontSize: "1.1em",
							letterSpacing: "-0.03em",
						}}
					>
						from Arc.
					</span>
				</div>
				<div style={{ display: "flex", gap: 18, marginTop: 40 }}>
					{BROWSERS.map((image, i) => (
						<Img
							key={image}
							src={staticFile(image)}
							style={{
								width: 54,
								height: 54,
								transform: `scale(${pop(frame, fps, 34 + i * 3)})`,
							}}
						/>
					))}
				</div>
				<div
					style={{
						...rise(frame, 54),
						display: "flex",
						alignItems: "center",
						gap: 14,
						marginTop: 46,
						padding: "20px 34px",
						borderRadius: 22,
						background: "#000",
						fontSize: 26,
						fontWeight: 550,
					}}
				>
					Start migration
					<svg
						width={26}
						height={26}
						viewBox="0 0 24 24"
						fill="#fff"
						aria-hidden="true"
					>
						<path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.2.8-.5v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.3.1 2 1.3 2 1.3 1.1 2 2.9 1.4 3.5 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.6-1.4-5.6-6.2 0-1.4.5-2.5 1.3-3.4-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.5 1.3a12 12 0 0 1 6.4 0c2.4-1.6 3.4-1.3 3.4-1.3.7 1.7.3 3 .1 3.3.9.9 1.3 2 1.3 3.4 0 4.8-2.9 5.9-5.6 6.2.5.4.8 1.1.8 2.2V22c0 .3.2.6.8.5A11.1 11.1 0 0 0 12 .9Z" />
					</svg>
				</div>
				<div
					style={{
						...rise(frame, 66),
						display: "flex",
						gap: 34,
						marginTop: 26,
						color: "#174e82",
						fontSize: 21,
						fontWeight: 550,
					}}
				>
					<span>Processed on your device</span>
					<span>Preview before you move</span>
					<span>No account needed</span>
				</div>
			</AbsoluteFill>
		</SceneFade>
	);
}
