import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline, Mark, progress, rise, SceneFade } from "../ui";
import type { Cue } from "../audio";

export const INTRO_FRAMES = 130;
export const INTRO_CUES: Cue[] = [[0, "whoosh"]];

/** The logo settles into the white mark, and the hero line lands. */
export function Intro() {
	const frame = useCurrentFrame();
	const leave = progress(frame, 30, 16);
	return (
		<SceneFade fadeIn={false}>
			<AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
				<div
					style={{
						position: "absolute",
						opacity: progress(frame, 4, 10) * (1 - leave),
						transform: `scale(${1 - leave * 0.5})`,
					}}
				>
					<Mark size={176} />
				</div>
				<div style={{ opacity: frame >= 34 ? 1 : 0 }}>
					<Headline
						eyebrow="Arc migration · macOS & Windows"
						lead="Move on"
						accent="from Arc."
						start={36}
						size={168}
						stack
					/>
					<p
						style={{
							...rise(frame, 64),
							margin: "44px auto 0",
							maxWidth: 1100,
							textAlign: "center",
							color: "#f2faff",
							fontSize: 34,
							lineHeight: 1.45,
							letterSpacing: -0.5,
						}}
					>
						Bring your Spaces, pinned tabs and folders to your next browser.
					</p>
				</div>
			</AbsoluteFill>
		</SceneFade>
	);
}
