import type { ReactNode } from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PERSONAL, WORK } from "../data";
import {
	BLUE,
	Check,
	Cursor,
	Headline,
	pop,
	pressAt,
	progress,
	rise,
	SceneFade,
} from "../ui";
import { Avatar } from "./PickProfiles";
import type { Cue } from "../audio";

export const KEEP_FRAMES = 210;
const SAVE_CLICK = 78;
export const KEEP_CUES: Cue[] = [
	[8, "whoosh"],
	[SAVE_CLICK, "click"],
	[SAVE_CLICK + 4, "success"],
	[110, "pop"],
	[118, "pop"],
	[126, "pop"],
];
const CARD = { top: 330, height: 560 };

/** Folders stay as bookmarks per profile; full exports cover everything else. */
export function KeepFolders() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const saved = frame >= SAVE_CLICK + 4;
	return (
		<SceneFade>
			<Headline
				eyebrow="Save an export"
				lead="Keep every"
				accent="folder."
				start={4}
				style={{ position: "absolute", top: 72, width: "100%" }}
			/>
			<Card left={170} width={760} start={8}>
				<Title>Keep each profile's folders</Title>
				<Body>
					Save its bookmarks file, then import it in that Chrome profile.
				</Body>
				<div style={{ display: "grid", gap: 16, marginTop: 34 }}>
					{[WORK, PERSONAL].map((profile, i) => (
						<div
							key={profile.name}
							style={{
								...rise(frame, 24 + i * 6, 14),
								display: "flex",
								alignItems: "center",
								gap: 16,
								height: 76,
								padding: "0 22px",
								borderRadius: 16,
								background: "#161617",
								boxShadow: `0 0 0 1px ${i === 0 && saved ? BLUE : "#ffffff24"}`,
								transform: `scale(${1 - (i === 0 ? pressAt(frame, SAVE_CLICK) * 0.03 : 0)})`,
							}}
						>
							<Avatar profile={profile} size={38} />
							<span style={{ flex: 1, fontSize: 22, fontWeight: 600 }}>
								Save bookmarks for {profile.name}
							</span>
							{i === 0 && saved && (
								<span
									style={{
										display: "grid",
										placeItems: "center",
										width: 36,
										height: 36,
										borderRadius: "50%",
										background: BLUE,
										transform: `scale(${pop(frame, fps, SAVE_CLICK + 4)})`,
									}}
								>
									<Check size={20} />
								</span>
							)}
						</div>
					))}
				</div>
				<div
					style={{
						...rise(frame, SAVE_CLICK + 8, 14),
						marginTop: 30,
						color: "#9cc8ff",
						fontSize: 19,
					}}
				>
					Bookmarks for Work saved.
				</div>
				<div
					style={{
						marginTop: 18,
						padding: "14px 18px",
						borderRadius: 12,
						background: "#111",
						color: "#bbb",
						fontFamily: "ui-monospace, Menlo, monospace",
						fontSize: 16,
						...rise(frame, SAVE_CLICK + 14, 14),
					}}
				>
					⋮ → Bookmarks and lists → Import bookmarks and settings
				</div>
			</Card>
			<Card left={990} width={760} start={14}>
				<Title>Or take it all with you</Title>
				<Body>Every Space, folder and tab, in files you keep.</Body>
				<div style={{ display: "grid", gap: 16, marginTop: 34 }}>
					<Export
						start={110}
						icon={
							<Img
								src={staticFile("safari.png")}
								style={{ width: 40, height: 40 }}
							/>
						}
						title="Safari bookmarks"
						detail="Selected Spaces and Favorites · HTML"
					/>
					<Export
						start={118}
						icon={<Glyph>⌕</Glyph>}
						title="Arc Archive"
						detail="Full searchable library · HTML and JSON"
					/>
					<Export
						start={126}
						icon={<Glyph>▦</Glyph>}
						title="Spreadsheet"
						detail="All tabs and folder paths · CSV"
					/>
				</div>
			</Card>
			<Cursor
				stops={[
					{ frame: 50, x: 700, y: 1040 },
					{ frame: 72, x: 640, y: CARD.top + 152 + 38 },
					{ frame: 120, x: 760, y: 1000 },
				]}
				clicks={[SAVE_CLICK]}
			/>
		</SceneFade>
	);
}

function Card({
	left,
	width,
	start,
	children,
}: {
	left: number;
	width: number;
	start: number;
	children: ReactNode;
}) {
	const frame = useCurrentFrame();
	return (
		<div
			style={{
				...rise(frame, start, 50),
				position: "absolute",
				left,
				top: CARD.top,
				width,
				height: CARD.height,
				padding: "40px 44px",
				borderRadius: 26,
				background: "#000",
				color: "#fff",
				boxShadow: "0 0 0 1px #ffffff26, 0 50px 120px #001a5c59",
			}}
		>
			{children}
		</div>
	);
}

function Title({ children }: { children: ReactNode }) {
	return (
		<div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.9 }}>
			{children}
		</div>
	);
}

function Body({ children }: { children: ReactNode }) {
	return (
		<div
			style={{ marginTop: 10, color: "#aaa", fontSize: 20, lineHeight: 1.45 }}
		>
			{children}
		</div>
	);
}

function Glyph({ children }: { children: ReactNode }) {
	return (
		<span
			style={{
				display: "grid",
				placeItems: "center",
				width: 40,
				height: 40,
				borderRadius: 10,
				background: "#0c1a3a",
				color: "#9cc8ff",
				fontSize: 24,
			}}
		>
			{children}
		</span>
	);
}

function Export({
	start,
	icon,
	title,
	detail,
}: {
	start: number;
	icon: ReactNode;
	title: string;
	detail: string;
}) {
	const frame = useCurrentFrame();
	const lit =
		progress(frame, start + 6, 10) * (1 - progress(frame, start + 30, 14));
	return (
		<div
			style={{
				...rise(frame, start, 18),
				display: "flex",
				alignItems: "center",
				gap: 18,
				height: 86,
				padding: "0 22px",
				borderRadius: 16,
				background: "#161617",
				boxShadow: `0 0 0 1px rgba(20,137,252,${0.25 + lit * 0.6})`,
			}}
		>
			{icon}
			<div>
				<div style={{ fontSize: 22, fontWeight: 600 }}>{title}</div>
				<div style={{ color: "#999", fontSize: 17 }}>{detail}</div>
			</div>
		</div>
	);
}
