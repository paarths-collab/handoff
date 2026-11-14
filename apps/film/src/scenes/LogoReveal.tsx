import { AbsoluteFill, OffthreadVideo } from "remotion";
import glass from "../../media/handoff-liquid-glass.mp4";
import type { Cue } from "../audio";

export const LOGO_FRAMES = 90;
export const LOGO_CUES: Cue[] = [[0, "glass"]];

/**
 * The liquid-glass logo reveal over the sky. Brightening lifts the clip's grey (#e7e7e9) to
 * white, and multiplying makes white disappear, so only the logo and its glass colours show.
 */
export function LogoReveal() {
	return (
		<AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
			<OffthreadVideo
				src={glass}
				muted
				style={{
					width: 1024,
					height: 768,
					filter: "brightness(1.11)",
					mixBlendMode: "multiply",
				}}
			/>
		</AbsoluteFill>
	);
}
