// Generates the film's voiceover and sound effects with ElevenLabs. Run once; the MP3s and
// timing.json are committed, so renders never need the key.
//   node scripts/elevenlabs.mjs voices                 list the voices on your account
//   node scripts/elevenlabs.mjs sample <voiceId>...    read the first line in each voice
//   node scripts/elevenlabs.mjs voice <voiceId> [id...] write every line (or just these) to media/voice
//   node scripts/elevenlabs.mjs sfx [name...]          write sound effects to media/sfx
// The key comes from ELEVENLABS_API_KEY, or from apps/film/.env (never committed).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
try {
	process.loadEnvFile(new URL(".env", root));
} catch {}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
	console.error("Set ELEVENLABS_API_KEY in apps/film/.env first.");
	process.exit(1);
}
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const lines = read("src/voiceover.json");
const effects = read("src/sfx.json");
const API = "https://api.elevenlabs.io/v1";

async function call(path, body) {
	const response = await fetch(API + path, {
		method: body ? "POST" : "GET",
		headers: { "xi-api-key": key, "content-type": "application/json" },
		body: body && JSON.stringify(body),
	});
	if (!response.ok)
		throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`);
	return response;
}

/** Speaks `text` (with v3 audio tags like [softly]) and returns the MP3 and its length. */
async function speak(voice, text) {
	const response = await call(
		`/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
		{ text, model_id: "eleven_v3", voice_settings: { stability: 0.5 } },
	);
	const audio = Buffer.from(await response.arrayBuffer());
	// Constant 128 kbit/s, so the byte count gives the length.
	return { audio, seconds: (audio.length * 8) / 128000 };
}

function folder(path) {
	const dir = new URL(path, root);
	mkdirSync(dir, { recursive: true });
	return dir;
}

const [command, ...args] = process.argv.slice(2);
if (command === "voices") {
	const { voices } = await (await call("/voices")).json();
	for (const v of voices) {
		const labels = Object.values(v.labels ?? {}).join(", ");
		console.log(
			`${v.voice_id}  ${v.name}  (${v.category}${labels ? `; ${labels}` : ""})`,
		);
	}
} else if (command === "sample" && args.length) {
	const dir = folder("media/voice-samples/");
	for (const voice of args) {
		const { audio, seconds } = await speak(voice, Object.values(lines)[0]);
		writeFileSync(new URL(`${voice}.mp3`, dir), audio);
		console.log(`media/voice-samples/${voice}.mp3  ${seconds.toFixed(2)}s`);
	}
} else if (command === "voice" && args.length) {
	const [voice, ...only] = args;
	const dir = folder("media/voice/");
	// Redoing some lines keeps every other line's take and timing.
	let seconds = {};
	if (only.length)
		try {
			seconds = JSON.parse(
				readFileSync(new URL("timing.json", dir), "utf8"),
			).seconds;
		} catch {}
	for (const id of only.length ? only : Object.keys(lines)) {
		if (!lines[id])
			throw new Error(`No line named ${id} in src/voiceover.json`);
		const spoken = await speak(voice, lines[id]);
		writeFileSync(new URL(`${id}.mp3`, dir), spoken.audio);
		seconds[id] = Math.round(spoken.seconds * 100) / 100;
		console.log(`media/voice/${id}.mp3  ${spoken.seconds.toFixed(2)}s`);
	}
	writeFileSync(
		new URL("timing.json", dir),
		`${JSON.stringify({ voice, seconds }, null, "\t")}\n`,
	);
} else if (command === "sfx") {
	const dir = folder("media/sfx/");
	for (const name of args.length ? args : Object.keys(effects)) {
		const effect = effects[name];
		if (!effect)
			throw new Error(`No sound effect named ${name} in src/sfx.json`);
		const response = await call("/sound-generation", {
			text: effect.prompt,
			duration_seconds: effect.seconds,
			prompt_influence: 0.5,
		});
		writeFileSync(
			new URL(`${name}.mp3`, dir),
			Buffer.from(await response.arrayBuffer()),
		);
		console.log(`media/sfx/${name}.mp3`);
	}
} else {
	console.error(
		"Usage: elevenlabs.mjs voices | sample <voiceId>... | voice <voiceId> | sfx [name...]",
	);
	process.exit(1);
}
