# Tab Mover

Move an Arc sidebar into browser windows, pinned tabs and groups, or export nested bookmarks, a searchable offline archive, a JSON pack and CSV. The converter reads the file locally. The extension opens destinations only after you choose Move.

## Try a synthetic sidebar

1. Use Node from `.nvmrc` and the pnpm version in `package.json`. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm --filter @tab-mover/web build`, then `pnpm --filter @tab-mover/web exec vite preview --host 127.0.0.1`. Open the printed local address and choose **Open converter**.
3. Choose [tiny.json](fixtures/tiny.json). Expect one Space and three tabs. Expand the preview, download Bookmarks HTML, and open the file in a browser. The [guides](docs/guides/README.md) cover importing it.
4. For native tabs, run `pnpm --filter @tab-mover/extension build`. In a disposable Chromium profile, open the Extensions page, enable Developer mode, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Open Tab Mover, choose the same fixture, review the plan, and click **Move**. Synthetic .test destinations do not resolve on the public internet. Review the result, then try Undo.
5. To use the desktop app from source, install the standard Tauri v2 platform prerequisites and run `pnpm --filter @tab-mover/desktop exec tauri dev`. Choose the synthetic fixture in the native file picker.

## Checks

`pnpm check` runs TypeScript, lint, unit/property tests, production builds, manifest and fixture privacy checks, and the production dependency audit. `pnpm e2e` uses Playwright Chromium with disposable profiles. Install its browser with `pnpm exec playwright install chromium` if needed. Run `pnpm mutation` for the core mutation suite. Run Rust tests from `apps/desktop/src-tauri` with `cargo test --locked` and `cargo clippy --locked --all-targets -- -D warnings`.

[Build plan](docs/PLAN.md) · [Build decisions](docs/decisions.md) · [Threat model](docs/security/threat-model.md) · [Report a security issue](SECURITY.md)
