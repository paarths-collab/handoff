# Handoff product film

A story-led, roughly 96-second, 1920×1080 film of moving from Arc with Handoff, written as [Remotion](https://www.remotion.dev) code in the look of the website. Its fonts, logo, browser icons, hill image and license notices are kept locally in `apps/film/public`. The website lives separately in [handoff-website](https://github.com/paarths-collab/handoff-website).

| Scene     | Shows                                                                          |
| --------- | ------------------------------------------------------------------------------ |
| Memories  | Years of Arc: a sidebar fills up from "Week one" to "Year three"               |
| Stalled   | Arc stops moving forward; the colour drains, the tabs scatter, "Start over?"   |
| Logo      | The liquid-glass logo reveal (`media/handoff-liquid-glass.mp4`)                |
| Intro     | The sky opens out of the mark, "Move on from Arc."                             |
| Step 1    | Handoff finds `StorableSidebar.json` and counts Spaces, folders and tabs       |
| Step 2    | Preview Spaces, folders and tabs; pick which Spaces move                       |
| Step 3    | Choose Chrome, then a signed-in Chrome profile (Google account) for each Space |
| Opened    | Each Space opens in its own window in the chosen profile                       |
| Exports   | Save bookmarks per profile; Safari bookmarks, Arc Archive and CSV              |
| Passwords | Arc's export and Chrome's import move passwords; Handoff never reads them      |
| End       | Logo, call to action and the website's hill                                    |

## Voice and sound effects

Both come from ElevenLabs; there is no music. The narration is in `src/voiceover.json`, one line per scene, with `eleven_v3` delivery tags such as `[softly]`, read by the "Matilda" voice. Each scene runs at least as long as its line. The sound effects are described in `src/sfx.json`; each scene lists its own as cues timed to its clicks and transitions, and `src/audio.tsx` places everything.

`scripts/elevenlabs.mjs` generates the audio using `ELEVENLABS_API_KEY` from `apps/film/.env`:

- `pnpm --filter @handoff/film elevenlabs voice <voiceId> [line...]` rewrites every line in `media/voice` (or just the named ones) and updates `timing.json`
- `pnpm --filter @handoff/film elevenlabs sfx [name...]` rewrites `media/sfx`

The MP3s are committed, so renders never need the key.

## Render

Pushing a change under `apps/film` runs the **Product film** GitHub Actions workflow, which renders `handoff-film.mp4` and attaches it to the run as the `handoff-film` artifact. Run it by hand from the Actions tab with **Run workflow**.

## Edit

`pnpm --filter @handoff/film studio` opens Remotion Studio to scrub the timeline. Scenes live in `src/scenes`, shared pieces in `src/ui.tsx` and the sample sidebar in `src/data.ts`.

Remotion is free for individuals and companies of up to three people. Larger companies need a [company license](https://www.remotion.dev/license).
