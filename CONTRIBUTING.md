# Contributing to Handoff

Thanks for helping. Bug reports, fixes and improvements are welcome.

## Report a bug

Open an [issue](https://github.com/paarths-collab/handoff/issues) with your Handoff version, platform and browser, what you did, and what happened. Add the app's **Copy diagnostic** output if you can — it holds only counts. Never attach your real sidebar file, exports or private links. For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Make a change

1. Fork the repository and create a branch.
2. Set up as described in [Run it from source](README.md#run-it-from-source).
3. Make your change and add or update tests.
4. Run `pnpm check`. For UI changes also run `pnpm build` and `pnpm e2e`; for native changes run `cargo test --locked` and `cargo clippy --locked --all-targets -- -D warnings` in `apps/desktop/src-tauri`.
5. Open a pull request that explains what changed and why, with a screenshot for visible changes.

## Ground rules

- Keep processing local. No telemetry, accounts or uploads.
- Use synthetic fixtures (`.test` links, invented titles) in tests and screenshots; `pnpm check` rejects private data in fixtures.
- Pin any new GitHub Action to a full commit SHA; `pnpm check-workflows` enforces it.
- By contributing, you agree your contribution is released under the [MIT License](LICENSE).
