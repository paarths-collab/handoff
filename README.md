# Handoff

Move an Arc sidebar into browser windows, pinned tabs and groups, or export nested bookmarks, a searchable offline archive, a JSON pack and CSV. The converter reads the file locally. The extension opens destinations only after you choose Move.

## Install

On macOS, download the disk image from [GitHub Releases](https://github.com/paarths-collab/handoff/releases) and drag Handoff to Applications. On Windows x64, extract the Windows ZIP, run `Handoff-Setup.exe`, then open Handoff from Start. The Windows installer sets up WebView2 if missing (internet required for runtime setup). To get tab groups, open your browser's Extensions page, turn on Developer mode, choose **Load unpacked** and pick the **Handoff Extension** folder (copy it somewhere permanent first, since the browser loads it from that folder). Repeat in each browser profile that should get groups; the app opens tabs in any profile without it.

## Set up with Claude Code, Codex or Cursor

Use a coding agent to check your platform prerequisites and launch the native app:

```sh
git clone https://github.com/paarths-collab/handoff.git
cd handoff
```

You can also use GitHub's **Code → Download ZIP** and extract the folder. Open the repository in Claude Code, Codex or Cursor, then paste the [coding-agent setup prompt](docs/setup-prompt.txt). One prompt works with all three agents on macOS and Windows.

The agent installs project dependencies and launches the desktop app. You choose a detected Arc sidebar or your own file and confirm the migration. The optional extension uses the actual file you select or a pack received from Handoff. Your sidebar stays local; the setup prompt does not authorize commits, publishing or automatic browser changes.

The website has a **Copy setup prompt** button and a [step-by-step setup guide](docs/agent-setup.md).

## Try a synthetic sidebar

1. Use Node from `.nvmrc` and the pnpm version in `package.json`. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm --filter @handoff/web build`, then `pnpm --filter @handoff/web exec vite preview --host 127.0.0.1`. Open the printed local address and choose **Open converter**.
3. Choose [tiny.json](fixtures/tiny.json). Expect one Space and three tabs. Expand the preview, download Bookmarks HTML, and open the file in a browser. The [guides](docs/guides/README.md) cover importing it.
4. For native tabs, run `pnpm --filter @handoff/extension build`. In a disposable Chromium profile, open the Extensions page, enable Developer mode, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Open Handoff, choose the same fixture, review the plan, and click **Move**. Synthetic .test destinations do not resolve on the public internet. Review the result, then try Undo.
5. To use the desktop app from source, install the standard Tauri v2 platform prerequisites and run `pnpm --filter @handoff/desktop exec tauri dev`. Choose the synthetic fixture in the native file picker.

## Checks

`pnpm check` runs TypeScript, lint, unit/property tests, production builds, manifest and fixture privacy checks, and the production dependency audit. `pnpm e2e` uses Playwright Chromium with disposable profiles. Install its browser with `pnpm exec playwright install chromium` if needed. Run `pnpm mutation` for the core mutation suite. Run Rust tests from `apps/desktop/src-tauri` with `cargo test --locked` and `cargo clippy --locked --all-targets -- -D warnings`.

[Build plan](docs/PLAN.md) · [Build decisions](docs/decisions.md) · [Threat model](docs/security/threat-model.md) · [Report a security issue](SECURITY.md)

## Build the Windows desktop download

On Windows x64, install the Node version in `.nvmrc`, pnpm from `package.json`, Rust stable MSVC, and Visual Studio C++ Build Tools with the Windows SDK. Run `pnpm install --frozen-lockfile`, then `pnpm package:windows`. This builds the native Tauri app as a per-user NSIS installer and creates `release/handoff-<version>-windows-x64.zip` with the installer, optional Chromium extension, Firefox add-on and setup instructions.

The `Windows desktop installer` GitHub Actions workflow runs native Rust tests and builds the download on Windows. It uploads a workflow artifact without publishing a release. Windows installer execution and an Arc-to-browser smoke test must pass on a Windows PC before release; a successful macOS build does not verify Windows behavior.
