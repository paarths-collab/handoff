import { AbsoluteFill, Series } from "remotion";
import { type Cue, fitToVoice, Soundtrack, type Voice } from "./audio";
import {
	CHOOSE_FILE_CUES,
	CHOOSE_FILE_FRAMES,
	ChooseFile,
} from "./scenes/ChooseFile";
import { END_CUES, END_FRAMES, EndCard } from "./scenes/EndCard";
import { INTRO_CUES, INTRO_FRAMES, Intro } from "./scenes/Intro";
import { KEEP_CUES, KEEP_FRAMES, KeepFolders } from "./scenes/KeepFolders";
import { LOGO_CUES, LOGO_FRAMES, LogoReveal } from "./scenes/LogoReveal";
import { OPEN_CUES, OPEN_FRAMES, OpenWindows } from "./scenes/OpenWindows";
import {
	PASSWORDS_CUES,
	PASSWORDS_FRAMES,
	Passwords,
} from "./scenes/Passwords";
import { PICK_CUES, PICK_FRAMES, PickProfiles } from "./scenes/PickProfiles";
import {
	PREVIEW_CUES,
	PREVIEW_FRAMES,
	PreviewSetup,
} from "./scenes/PreviewSetup";
import {
	MEMORIES_FRAMES,
	Memories,
	memoriesCues,
	STALLED_FRAMES,
	Stalled,
	stalledCues,
} from "./scenes/Story";
import { Sky } from "./ui";

export const FPS = 30;

type Scene = {
	Scene: () => React.JSX.Element;
	frames: number;
	voice?: Voice;
	cues: Cue[] | ((frames: number) => Cue[]);
};

// `voice` names the scene's line in voiceover.json; `cues` are its sound effects.
// Each scene runs at least as long as its narration.
const SCENES: Scene[] = (
	[
		{
			Scene: Memories,
			frames: MEMORIES_FRAMES,
			voice: "memories",
			cues: memoriesCues,
		},
		{
			Scene: Stalled,
			frames: STALLED_FRAMES,
			voice: "stalled",
			cues: stalledCues,
		},
		{ Scene: LogoReveal, frames: LOGO_FRAMES, voice: "turn", cues: LOGO_CUES },
		{ Scene: Intro, frames: INTRO_FRAMES, cues: INTRO_CUES },
		{
			Scene: ChooseFile,
			frames: CHOOSE_FILE_FRAMES,
			voice: "choose-file",
			cues: CHOOSE_FILE_CUES,
		},
		{
			Scene: PreviewSetup,
			frames: PREVIEW_FRAMES,
			voice: "preview",
			cues: PREVIEW_CUES,
		},
		{
			Scene: PickProfiles,
			frames: PICK_FRAMES,
			voice: "profiles",
			cues: PICK_CUES,
		},
		{
			Scene: OpenWindows,
			frames: OPEN_FRAMES,
			voice: "opened",
			cues: OPEN_CUES,
		},
		{
			Scene: KeepFolders,
			frames: KEEP_FRAMES,
			voice: "exports",
			cues: KEEP_CUES,
		},
		{
			Scene: Passwords,
			frames: PASSWORDS_FRAMES,
			voice: "passwords",
			cues: PASSWORDS_CUES,
		},
		{ Scene: EndCard, frames: END_FRAMES, voice: "end", cues: END_CUES },
	] satisfies Scene[]
).map((scene) => ({
	...scene,
	frames: fitToVoice(scene.frames, scene.voice, FPS),
}));

export const FILM_FRAMES = SCENES.reduce((n, s) => n + s.frames, 0);
export function Film() {
	return (
		<AbsoluteFill>
			<Soundtrack scenes={SCENES} />
			<Sky />
			<Series>
				{SCENES.map(({ Scene, frames }) => (
					<Series.Sequence key={Scene.name} durationInFrames={frames}>
						<Scene />
					</Series.Sequence>
				))}
			</Series>
		</AbsoluteFill>
	);
}
