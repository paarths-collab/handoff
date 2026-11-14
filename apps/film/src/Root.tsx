import { Composition } from "remotion";
import { FILM_FRAMES, FPS, Film } from "./Film";

export function Root() {
	return (
		<Composition
			id="HandoffFilm"
			component={Film}
			durationInFrames={FILM_FRAMES}
			fps={FPS}
			width={1920}
			height={1080}
		/>
	);
}
