import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { BLUE, Headline, rise, SceneFade } from "../ui";
import type { Cue } from "../audio";

export const PASSWORDS_FRAMES = 210;

const STEPS: { text: ReactNode; start: number }[] = [
	{
		text: (
			<>
				In Arc, open <Address>arc://password-manager/settings</Address> and
				choose Export passwords.
			</>
		),
		start: 30,
	},
	{
		text: (
			<>
				In each Chrome profile, open{" "}
				<Address>chrome://password-manager/settings</Address> and choose Import
				passwords.
			</>
		),
		start: 62,
	},
	{ text: <>Check a few sign-ins, then delete the CSV.</>, start: 94 },
];
export const PASSWORDS_CUES: Cue[] = [
	[10, "whoosh"],
	...STEPS.map((s): Cue => [s.start, "pop"]),
];

/** Passwords move straight from Arc to the new browser; Handoff never reads them. */
export function Passwords() {
	const frame = useCurrentFrame();
	return (
		<SceneFade>
			<Headline
				eyebrow="Move passwords"
				lead="Bring your"
				accent="passwords."
				start={4}
				style={{ position: "absolute", top: 72, width: "100%" }}
			/>
			<div
				style={{
					...rise(frame, 10, 50),
					position: "absolute",
					left: 330,
					top: 330,
					width: 1260,
					padding: "40px 48px",
					borderRadius: 26,
					background: "#000",
					color: "#fff",
					boxShadow: "0 0 0 1px #ffffff26, 0 50px 120px #001a5c59",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<span
						style={{
							display: "grid",
							placeItems: "center",
							width: 52,
							height: 52,
							borderRadius: 14,
							background: "#0c1a3a",
						}}
					>
						<svg
							width={28}
							height={28}
							viewBox="0 0 24 24"
							fill="none"
							stroke="#9cc8ff"
							strokeWidth={1.8}
							aria-hidden="true"
						>
							<rect x="5" y="10.5" width="14" height="10" rx="2" />
							<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
						</svg>
					</span>
					<div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.8 }}>
						Handoff never reads your passwords.
					</div>
				</div>
				<div
					style={{ marginTop: 10, marginLeft: 68, color: "#aaa", fontSize: 20 }}
				>
					Arc and your new browser move them directly, using a file only you
					handle.
				</div>
				<div style={{ display: "grid", gap: 18, marginTop: 34 }}>
					{STEPS.map((step, i) => (
						<div
							key={step.start}
							style={{
								...rise(frame, step.start, 18),
								display: "flex",
								alignItems: "center",
								gap: 20,
							}}
						>
							<span
								style={{
									display: "grid",
									placeItems: "center",
									flex: "none",
									width: 44,
									height: 44,
									borderRadius: "50%",
									background: BLUE,
									fontSize: 21,
									fontWeight: 650,
								}}
							>
								{i + 1}
							</span>
							<span style={{ fontSize: 23, lineHeight: 1.4, color: "#eee" }}>
								{step.text}
							</span>
						</div>
					))}
				</div>
			</div>
			<div
				style={{
					...rise(frame, 126, 14),
					position: "absolute",
					top: 860,
					width: "100%",
					textAlign: "center",
					color: "#174e82",
					fontSize: 22,
					fontWeight: 550,
				}}
			>
				Website sign-ins don't transfer, so expect to sign in once per site.
			</div>
		</SceneFade>
	);
}

function Address({ children }: { children: ReactNode }) {
	return (
		<code
			style={{
				padding: "4px 10px",
				borderRadius: 8,
				background: "#1d1d1f",
				color: "#9cc8ff",
				fontFamily: "ui-monospace, Menlo, monospace",
				fontSize: 19,
			}}
		>
			{children}
		</code>
	);
}
