# Handoff

Move an Arc sidebar into browser windows, pinned tabs and groups, or export nested bookmarks, a searchable offline archive, a JSON pack and CSV. The desktop app and extension read your file locally. The extension opens destinations only after you choose Move.

This repository contains the desktop app, browser extension, shared code and product-film sources. The website, browser guides and offline web converter are maintained in the separate private [handoff-website](https://github.com/paarths-collab/handoff-website) repository. Website builds and tests run there.

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
2. Install the standard Tauri v2 platform prerequisites and run `pnpm --filter @handoff/desktop exec tauri dev` to open the native app.
3. Choose [tiny.json](fixtures/tiny.json) in the native file picker. Expect one Space and three tabs. Expand the preview, export Bookmarks HTML, and open the file in a browser. The [guides](docs/guides/README.md) cover importing it.
4. For tab groups, run `pnpm --filter @handoff/extension build`. In a disposable Chromium profile, open the Extensions page, enable Developer mode, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Open the extension's importer, choose the same fixture, review the plan, and click **Move**. Synthetic .test destinations do not resolve on the public internet. Review the result, then try Undo.

## Checks

`pnpm check` runs TypeScript, lint, formatting, unit/property tests, production builds, manifest and fixture privacy checks, and the production dependency audit. `pnpm e2e` checks the built desktop frontend with a mocked native bridge and the actual Chromium extension in disposable profiles; no website server is needed. Run `pnpm build` first, and install the browser with `pnpm exec playwright install chromium` if needed. Run `pnpm mutation` for the core mutation suite. Run Rust tests from `apps/desktop/src-tauri` with `cargo test --locked` and `cargo clippy --locked --all-targets -- -D warnings`.

[Build plan](docs/PLAN.md) · [Build decisions](docs/decisions.md) · [Threat model](docs/security/threat-model.md) · [Report a security issue](SECURITY.md)

## Build the Windows desktop download

On Windows x64, install the Node version in `.nvmrc`, pnpm from `package.json`, Rust stable MSVC, and Visual Studio C++ Build Tools with the Windows SDK. Run `pnpm install --frozen-lockfile`, then `pnpm package:windows`. This builds the native Tauri app as a per-user NSIS installer and creates `release/handoff-<version>-windows-x64.zip` with the installer, optional Chromium extension, Firefox add-on and setup instructions.

The `App and extension CI` GitHub Actions workflow tests the native app on macOS and Windows. To build both downloads as workflow artifacts, run it manually with **build-downloads** enabled. Windows installer execution and an Arc-to-browser smoke test must pass on a Windows PC before release; a successful macOS build does not verify Windows behavior.

## GitHub Actions

[App and extension CI](.github/workflows/ci.yaml) runs on pushes, pull requests and manual runs:

- Linux: TypeScript, lint, formatting, unit/property tests, app and Chrome/Firefox extension builds, manifest checks, fixture privacy checks and the production dependency audit. Playwright tests the desktop frontend with a mocked native bridge and the actual Chromium extension in disposable profiles. Its HTML report is retained for seven days.
- macOS and Windows: native Rust tests, Clippy and executable builds after the shared checks pass. These jobs compile and test native code; they do not automate native installer dialogs or establish real Arc compatibility.
- A manual run with **build-downloads** enabled also builds the macOS universal DMG (Apple Silicon and Intel) and Windows x64 ZIP, including optional extensions and setup instructions. Download artifacts are retained for fourteen days.

[Draft desktop release](.github/workflows/release.yaml) is manual and never publishes a release automatically. Once the workflow is on the default branch:

1. Update the application version consistently in the root, desktop and extension package manifests, `apps/desktop/src-tauri/tauri.conf.json`, and the native Cargo manifest/lockfile. Commit the reviewed changes and create and push the matching version tag, such as `v1.0.0`, using the authorized publishing identity.
2. Using the **paarths-collab** publishing account, open **Actions → Draft desktop release → Run workflow**. Select that tag and enter it in **tag**. It must already exist, match the app version and point to the exact selected commit. The workflow never creates or moves tags.
3. The workflow reruns CI, builds both downloads, generates **SHA256SUMS.txt**, and creates a new **draft** GitHub Release. It fails rather than overwriting an existing release. Review signing, install the builds and perform a real migration on both operating systems before publishing the draft manually.

No personal access token or custom Actions secret is needed. GitHub automatically supplies temporary credentials to the release job; only that job requests permission to write releases. The draft is created by GitHub Actions after the publishing account starts the workflow. People downloading, cloning or using Handoff do not need a token from Handoff. While the repositories are private, access still requires an authorized GitHub account.

Current packaging uses ad hoc macOS signing and does not configure Apple notarization or Windows certificate signing. Signing credentials and platform release testing remain separate from CI. The [product-film workflow](.github/workflows/film.yaml) continues to render film artifacts independently. Website CI is maintained in the separate website repository.

[Archived design prototypes](archive/prototypes/README.md) · [Shared UI font license](packages/ui/src/assets/Figtree-OFL.txt) · [Extension notices](apps/extension/public/licenses/) · [Film notices and artwork](apps/film/public/)
