// One-command release: bump the version everywhere, commit, tag, push and start the draft build.
//   pnpm release patch|minor|major|X.Y.Z [--dry-run]
// --dry-run only rewrites the files, so you can inspect `git diff` and undo with `git checkout .`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [target, flag] = process.argv.slice(2);
const dryRun = flag === "--dry-run";
const run = (cmd: string, args: string[]) =>
	execFileSync(cmd, args, { encoding: "utf8" }).trim();
const fail = (message: string): never => {
	console.error(`Release stopped: ${message}`);
	process.exit(1);
};

const current: string = JSON.parse(
	readFileSync("package.json", "utf8"),
).version;
const [major, minor, patch] = current.split(".").map(Number);
const next =
	target === "patch"
		? `${major}.${minor}.${patch + 1}`
		: target === "minor"
			? `${major}.${minor + 1}.0`
			: target === "major"
				? `${major + 1}.0.0`
				: /^\d+\.\d+\.\d+$/.test(target ?? "")
					? target
					: fail("say patch, minor, major or a version like 1.2.3.");

if (!dryRun) {
	if (run("git", ["branch", "--show-current"]) !== "main")
		fail("switch to the main branch first.");
	if (run("git", ["status", "--porcelain", "--untracked-files=no"]))
		fail("commit or stash your changes first.");
	run("git", ["fetch", "--quiet", "origin"]);
	if (run("git", ["rev-list", "--count", "HEAD..origin/main"]) !== "0")
		fail("pull the latest main first.");
	if (run("git", ["tag", "--list", `v${next}`]))
		fail(`tag v${next} already exists.`);
}

// Each edit must match exactly once, so a moved or renamed field fails loudly.
function edit(path: string, pattern: RegExp, replacement: string, count = 1) {
	const text = readFileSync(path, "utf8");
	const matches =
		text.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`))
			?.length ?? 0;
	if (matches !== count)
		fail(`expected ${count} version in ${path}, found ${matches}.`);
	writeFileSync(
		path,
		text.replace(
			new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`),
			replacement,
		),
	);
}
const v = current.replaceAll(".", "\\.");
for (const path of [
	"package.json",
	"apps/desktop/package.json",
	"apps/extension/package.json",
])
	edit(path, new RegExp(`"version": "${v}"`), `"version": "${next}"`);
edit(
	"apps/desktop/src-tauri/tauri.conf.json",
	new RegExp(`"version": "${v}"`),
	`"version": "${next}"`,
);
edit(
	"apps/desktop/src-tauri/Cargo.toml",
	new RegExp(`^version = "${v}"$`, "m"),
	`version = "${next}"`,
);
edit(
	"apps/desktop/src-tauri/Cargo.lock",
	new RegExp(`(name = "handoff"\\nversion = )"${v}"`),
	`$1"${next}"`,
);
edit(
	"apps/extension/wxt.config.ts",
	new RegExp(`(\\n\\t\\tversion: )"${v}"`),
	`$1"${next}"`,
);
edit(
	"apps/desktop/src/main.tsx",
	new RegExp(`appVersion="${v}"`),
	`appVersion="${next}"`,
);
edit(
	"apps/extension/src/importer.tsx",
	new RegExp(`appVersion="${v}"`),
	`appVersion="${next}"`,
	2,
);
console.log(`Version ${current} → ${next} in all 9 files.`);
if (dryRun) process.exit(0);

run("git", ["commit", "--all", "--quiet", "--message", `Release ${next}`]);
run("git", ["tag", "--annotate", `v${next}`, "--message", `Handoff ${next}`]);
run("git", ["push", "--quiet", "origin", "main", `v${next}`]);
run("gh", [
	"workflow",
	"run",
	"Draft desktop release",
	"--ref",
	`v${next}`,
	"-f",
	`tag=v${next}`,
]);
console.log(
	`Pushed v${next} and started the draft release. When it finishes, publish it at https://github.com/paarths-collab/handoff/releases`,
);
