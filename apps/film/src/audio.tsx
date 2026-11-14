import { Audio, Sequence } from "remotion";
import click from "../media/sfx/click.mp3";
import dim from "../media/sfx/dim.mp3";
import glass from "../media/sfx/glass.mp3";
import pop from "../media/sfx/pop.mp3";
import scan from "../media/sfx/scan.mp3";
import scatter from "../media/sfx/scatter.mp3";
import success from "../media/sfx/success.mp3";
import swell from "../media/sfx/swell.mp3";
import tabs from "../media/sfx/tabs.mp3";
import whoosh from "../media/sfx/whoosh.mp3";
import windowOpen from "../media/sfx/window.mp3";
import chooseFile from "../media/voice/choose-file.mp3";
import end from "../media/voice/end.mp3";
import exportsLine from "../media/voice/exports.mp3";
import memories from "../media/voice/memories.mp3";
import opened from "../media/voice/opened.mp3";
import passwords from "../media/voice/passwords.mp3";
import preview from "../media/voice/preview.mp3";
import profiles from "../media/voice/profiles.mp3";
import stalled from "../media/voice/stalled.mp3";
import timing from "../media/voice/timing.json";
import turn from "../media/voice/turn.mp3";
import effects from "./sfx.json";

export type Sound = keyof typeof effects;
export type Voice = keyof typeof timing.seconds;
/** A sound effect at a frame within its scene. */
export type Cue = [frame: number, sound: Sound];

const SOUNDS: Record<Sound, string> = {
	glass,
	whoosh,
	click,
	pop,
	success,
	scan,
	window: windowOpen,
	tabs,
	swell,
	dim,
	scatter,
};
const VOICES: Record<Voice, string> = {
	memories,
	stalled,
	turn,
	"choose-file": chooseFile,
	preview,
	profiles,
	opened,
	exports: exportsLine,
	passwords,
	end,
};

const VOICE_DELAY = 10; // frames after a scene starts
const VOICE_TAIL = 24; // frames of breathing room after a line

/** A scene's length: its own animation, or longer if its narration needs it. */
export function fitToVoice(
	frames: number,
	voice: Voice | undefined,
	fps: number,
) {
	if (!voice) return frames;
	return Math.max(
		frames,
		VOICE_DELAY + Math.ceil(timing.seconds[voice] * fps) + VOICE_TAIL,
	);
}

/** Places every voice line and sound effect for scenes laid end to end. */
export function Soundtrack({
	scenes,
}: {
	scenes: {
		frames: number;
		voice?: Voice;
		cues: Cue[] | ((frames: number) => Cue[]);
	}[];
}) {
	const voices: { id: Voice; from: number }[] = [];
	const cues: { sound: Sound; from: number }[] = [];
	let start = 0;
	for (const scene of scenes) {
		if (scene.voice)
			voices.push({ id: scene.voice, from: start + VOICE_DELAY });
		const list =
			typeof scene.cues === "function" ? scene.cues(scene.frames) : scene.cues;
		for (const [frame, sound] of list)
			cues.push({ sound, from: start + frame });
		start += scene.frames;
	}
	return (
		<>
			{voices.map(({ id, from }) => (
				<Sequence key={id} from={from} layout="none">
					<Audio src={VOICES[id]} />
				</Sequence>
			))}
			{cues.map(({ sound, from }, i) => (
				<Sequence key={`${sound}-${from}-${i}`} from={from} layout="none">
					<Audio src={SOUNDS[sound]} volume={effects[sound].volume} />
				</Sequence>
			))}
		</>
	);
}
