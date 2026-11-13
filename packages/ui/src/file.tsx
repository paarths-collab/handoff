import { parseInput } from "@handoff/core";
import { useId, useRef, useState } from "react";
import type { FileDropProps, PathHelperProps } from "./types";

const maxFileBytes = 100 * 1024 * 1024;

export function FileDrop({ onLoaded }: FileDropProps) {
	const id = useId();
	const current = useRef(0);
	const dragDepth = useRef(0);
	const [dragging, setDragging] = useState(false);
	const [busy, setBusy] = useState(false);

	async function load(file: File | undefined) {
		if (!file) return;
		const token = ++current.current;
		setBusy(true);
		try {
			const result =
				file.size > maxFileBytes
					? {
							ok: false as const,
							error: {
								kind: "too-large" as const,
								limitBytes: maxFileBytes,
								message: "This file exceeds the 100 MB limit.",
							},
						}
					: parseInput(await file.text());
			if (token === current.current) onLoaded(result, file.name);
		} catch {
			if (token === current.current)
				onLoaded(
					{
						ok: false,
						error: {
							kind: "not-json",
							message:
								"The file could not be read. Choose a local copy and try again.",
						},
					},
					file.name,
				);
		} finally {
			if (token === current.current) setBusy(false);
		}
	}

	return (
		<div
			className="tm-drop"
			data-dragging={dragging}
			onDragEnter={(event) => {
				event.preventDefault();
				dragDepth.current++;
				setDragging(true);
			}}
			onDragOver={(event) => {
				event.preventDefault();
				event.dataTransfer.dropEffect = "copy";
			}}
			onDragLeave={(event) => {
				event.preventDefault();
				if (--dragDepth.current <= 0) setDragging(false);
			}}
			onDrop={(event) => {
				event.preventDefault();
				dragDepth.current = 0;
				setDragging(false);
				void load(event.dataTransfer.files[0]);
			}}
		>
			<span className="tm-file-icon" aria-hidden="true">
				<span>JSON</span>
			</span>
			<strong>Drop your sidebar file here</strong>
			<p>StorableSidebar.json or a Handoff pack · Up to 100 MB</p>
			<label className="tm-pick" htmlFor={id}>
				Choose a file
				<input
					id={id}
					type="file"
					accept=".json,application/json"
					onChange={(event) => {
						const file = event.currentTarget.files?.[0];
						event.currentTarget.value = "";
						void load(file);
					}}
				/>
			</label>
			<span className="tm-sr" role="status">
				{busy ? "Reading file" : ""}
			</span>
		</div>
	);
}

export function PathHelper({ platform }: PathHelperProps) {
	return (
		<details className="tm-help">
			<summary>Where is my Arc file?</summary>
			{platform !== "windows" && (
				<p>
					<b>macOS</b> · In Finder press Shift + Command + G, paste this path,
					then press Return.
					<code>~/Library/Application Support/Arc/StorableSidebar.json</code>
				</p>
			)}
			{platform !== "macos" && (
				<p>
					<b>Windows</b> · Open <code>%LOCALAPPDATA%\Packages</code> in File
					Explorer. Open the folder beginning with{" "}
					<code>TheBrowserCompany.Arc_</code> and look inside{" "}
					<code>LocalCache\Local\Arc</code> for{" "}
					<code>StorableSidebar.json</code>.
				</p>
			)}
		</details>
	);
}
