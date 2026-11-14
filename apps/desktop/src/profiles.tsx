import {
	isOpenableUrl,
	toBookmarksHtml,
	type Library,
	type Node,
} from "@handoff/core";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";

export type Browser =
	| "chrome"
	| "brave"
	| "edge"
	| "vivaldi"
	| "opera"
	| "firefox";
type Profile = { directory: string; name: string };
type ProfileList = { profiles: Profile[]; named: boolean };
// Profile labels the user typed when names can't be read. Stored only on this device.
const labelKey = (browser: string) => "handoff.profileLabels." + browser;
function loadLabels(browser: string): Record<string, string> {
	try {
		const value = JSON.parse(localStorage.getItem(labelKey(browser)) ?? "{}");
		return value && typeof value === "object" ? value : {};
	} catch {
		return {};
	}
}
function saveLabels(browser: string, labels: Record<string, string>) {
	try {
		localStorage.setItem(labelKey(browser), JSON.stringify(labels));
	} catch {}
}
const SKIP = "";
const FAVORITES = "\u0000favorites";
// Must match MAX_URLS in profiles.rs.
const PER_LAUNCH = 500;
const HEAVY = 100;

export function openableUrls(nodes: Node[]): string[] {
	const out: string[] = [];
	const stack = [...nodes].reverse();
	while (stack.length) {
		const node = stack.pop()!;
		if (node.kind === "folder")
			for (let i = node.children.length - 1; i >= 0; i--)
				stack.push(node.children[i]);
		else if (isOpenableUrl(node.url.trim())) out.push(node.url.trim());
	}
	return out;
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ProfileMover({
	library,
	selected,
	browser,
	browserName,
	busy,
	perform,
	setStatus,
}: {
	library: Library;
	selected: Set<string>;
	browser: Browser;
	browserName: string;
	busy: boolean;
	perform(work: () => Promise<void>): Promise<void>;
	setStatus(text: string): void;
}) {
	const [raw, setRaw] = useState<ProfileList | null>(null);
	const [labels, setLabels] = useState<Record<string, string>>({});
	const [assign, setAssign] = useState(new Map<string, string>());
	const [today, setToday] = useState(true);
	const [opened, setOpened] = useState<string[]>([]);
	const spaces = library.spaces.filter((s) => selected.has(s.arcId));

	useEffect(() => {
		let active = true;
		setRaw(null);
		setOpened([]);
		setLabels(loadLabels(browser));
		invoke<ProfileList>("list_profiles", { browser })
			.then((list) => active && setRaw(list))
			.catch(() => active && setRaw({ profiles: [], named: false }));
		return () => {
			active = false;
		};
	}, [browser]);
	const named = raw?.named ?? false;
	const profiles = useMemo(
		() =>
			raw?.profiles.map((p) => ({
				...p,
				name: named ? p.name : labels[p.directory]?.trim() || p.directory,
			})) ?? null,
		[raw, named, labels],
	);

	// Default: match an Arc profile label to a browser profile of the same name.
	// Folder names like "Profile 4" never match: Arc's and Chrome's folders are unrelated.
	useEffect(() => {
		if (!profiles?.length) return;
		const fallback =
			profiles.find((p) => p.directory === "Default")?.directory ??
			profiles[0].directory;
		const byName = new Map(
			profiles
				.filter((p) => p.name !== p.directory)
				.map((p) => [p.name.trim().toLowerCase(), p.directory]),
		);
		const next = new Map<string, string>();
		for (const space of library.spaces)
			next.set(
				space.arcId,
				byName.get(space.profile?.trim().toLowerCase() ?? "") ?? fallback,
			);
		next.set(FAVORITES, library.favorites.length ? fallback : SKIP);
		setAssign(next);
		// Re-run only when the profile list itself changes, not while the user types labels.
	}, [raw, library]);

	const arcProfiles = useMemo(() => {
		const groups = new Map<string, string[]>();
		for (const space of spaces) {
			const label = space.profile ?? "Unlabelled Arc profile";
			groups.set(label, [...(groups.get(label) ?? []), space.arcId]);
		}
		return groups;
	}, [spaces]);

	const jobs = useMemo(() => {
		const list: { directory: string; title: string; urls: string[] }[] = [];
		const favorites = assign.get(FAVORITES) ?? SKIP;
		if (favorites !== SKIP) {
			const urls = openableUrls(library.favorites);
			if (urls.length)
				list.push({ directory: favorites, title: "Favorites", urls });
		}
		for (const space of spaces) {
			const directory = assign.get(space.arcId) ?? SKIP;
			if (directory === SKIP) continue;
			const urls = [
				...openableUrls(space.pinned),
				...(today ? openableUrls(space.today) : []),
			];
			if (urls.length) list.push({ directory, title: space.title, urls });
		}
		return list;
	}, [assign, library, spaces, today]);
	const total = jobs.reduce((n, j) => n + j.urls.length, 0);
	const usedProfiles = new Set(jobs.map((j) => j.directory));
	const heavy = jobs.filter((j) => j.urls.length > HEAVY);
	const nameOf = (dir: string) =>
		profiles?.find((p) => p.directory === dir)?.name ?? dir;

	if (browser === "firefox" || browser === "opera")
		return (
			<section className="profiles">
				<h2>Open in browser profiles</h2>
				<p>
					Choosing a profile works with Chrome, Brave, Edge and Vivaldi. For{" "}
					{browserName}, use the Handoff extension or a bookmarks file.
				</p>
			</section>
		);

	const select = (
		value: string,
		onChange: (v: string) => void,
		label: string,
	) => (
		<select
			aria-label={label}
			value={value}
			disabled={busy}
			onChange={(e) => {
				onChange(e.target.value);
				setOpened([]);
			}}
		>
			<option value={SKIP}>Don't open</option>
			{profiles?.map((p) => (
				<option key={p.directory} value={p.directory}>
					{p.name}
				</option>
			))}
		</select>
	);
	const set = (keys: string[], value: string) =>
		setAssign((prev) => {
			const next = new Map(prev);
			for (const key of keys) next.set(key, value);
			return next;
		});

	async function openAll() {
		for (const job of jobs)
			for (let i = 0; i < job.urls.length; i += PER_LAUNCH) {
				await invoke("open_in_profile", {
					browser,
					profile: job.directory,
					urls: job.urls.slice(i, i + PER_LAUNCH),
				});
				// Give the browser time to hand each window to the right profile.
				await pause(400);
			}
		setOpened([...usedProfiles]);
		setStatus(
			`Opened ${total} tabs in ${usedProfiles.size} ${browserName} ${
				usedProfiles.size === 1 ? "profile" : "profiles"
			}.`,
		);
	}
	async function saveBookmarks(directory: string) {
		const spaceIds = spaces
			.filter((s) => assign.get(s.arcId) === directory)
			.map((s) => s.arcId);
		if (
			await invoke<boolean>("save_export", {
				format: "bookmarks",
				contents: toBookmarksHtml(library, { spaceIds }),
			})
		)
			setStatus(`Bookmarks for ${nameOf(directory)} saved.`);
	}

	return (
		<section className="profiles">
			<h2>Open in {browserName} profiles</h2>
			<p>
				Choose which {browserName} profile gets each Space. Each Space opens in
				its own window, signed in as that profile. No extension needed.
			</p>
			{profiles === null ? (
				<p>Looking for {browserName} profiles…</p>
			) : profiles.length === 0 ? (
				<p>
					No {browserName} profiles were found. Open {browserName} once, then
					choose the browser again.
				</p>
			) : (
				<>
					{!named && (
						<div className="unnamed">
							<p className="note warn">
								Handoff could not read {browserName}'s profile names, so your
								profiles are listed by folder. Click <strong>Show</strong> to
								open an empty window in a profile and see which account it is,
								then type a name. Names are saved on this device.
							</p>
							<div className="profile-rows">
								{raw?.profiles.map((p) => (
									<div className="label-row" key={p.directory}>
										<span>{p.directory}</span>
										<input
											aria-label={"Name for " + p.directory}
											placeholder="Name, e.g. Work"
											maxLength={60}
											value={labels[p.directory] ?? ""}
											onChange={(e) => {
												const next = {
													...labels,
													[p.directory]: e.target.value,
												};
												setLabels(next);
												saveLabels(browser, next);
											}}
										/>
										<button
											type="button"
											disabled={busy}
											onClick={() =>
												perform(() =>
													invoke("open_in_profile", {
														browser,
														profile: p.directory,
														urls: [],
													}),
												)
											}
										>
											Show
										</button>
									</div>
								))}
							</div>
							{/Mac/.test(navigator.platform) && (
								<button
									type="button"
									disabled={busy}
									onClick={() => perform(() => invoke("open_privacy_settings"))}
								>
									Or allow Full Disk Access to see names automatically
								</button>
							)}
						</div>
					)}
					{arcProfiles.size > 1 && (
						<div className="profile-rows bulk">
							{[...arcProfiles].map(([label, ids]) => (
								<label key={label}>
									<span>
										All Spaces from <strong>{label}</strong>
									</span>
									{select(
										ids.every((id) => assign.get(id) === assign.get(ids[0]))
											? (assign.get(ids[0]) ?? SKIP)
											: SKIP,
										(v) => set(ids, v),
										"All Spaces from " + label,
									)}
								</label>
							))}
						</div>
					)}
					<div className="profile-rows">
						{library.favorites.length > 0 && (
							<label>
								<span>Favorites</span>
								{select(
									assign.get(FAVORITES) ?? SKIP,
									(v) => set([FAVORITES], v),
									"Favorites",
								)}
							</label>
						)}
						{spaces.map((space) => (
							<label key={space.arcId}>
								<span>
									{space.title}
									{space.profile && <small> · {space.profile}</small>}
								</span>
								{select(
									assign.get(space.arcId) ?? SKIP,
									(v) => set([space.arcId], v),
									space.title,
								)}
							</label>
						))}
					</div>
					<label className="inline">
						<input
							type="checkbox"
							checked={today}
							disabled={busy}
							onChange={(e) => setToday(e.target.checked)}
						/>{" "}
						Include Today tabs
					</label>
					<p className="note">
						These open as plain tabs. Tab groups need the Handoff extension in
						that profile. Save a bookmarks file below to keep nested folders
						permanently.
					</p>
					{heavy.length > 0 && (
						<p className="note warn">
							{heavy.map((j) => j.title).join(", ")}{" "}
							{heavy.length === 1 ? "has" : "have"} more than {HEAVY} tabs.{" "}
							{browserName} loads every tab opened this way, which can slow your
							Mac. Chrome's Memory Saver unloads them later.
						</p>
					)}
					<button
						className="primary"
						disabled={busy || total === 0}
						onClick={() => perform(openAll)}
					>
						{total === 0
							? "Nothing to open"
							: `Open ${total} tabs in ${usedProfiles.size} ${
									usedProfiles.size === 1 ? "profile" : "profiles"
								}`}
					</button>
					{opened.length > 0 && (
						<div className="handoff">
							<p>
								Keep each profile's folders permanently: save its bookmarks
								file, then in that profile choose ⋮ → Bookmarks and lists →
								Import bookmarks and settings → Bookmarks HTML file.
							</p>
							{opened.map((dir) => (
								<button
									key={dir}
									disabled={busy}
									onClick={() => perform(() => saveBookmarks(dir))}
								>
									Save bookmarks for {nameOf(dir)}
								</button>
							))}
						</div>
					)}
				</>
			)}
		</section>
	);
}
