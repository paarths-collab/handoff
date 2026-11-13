# Engineering review

Reviewed the initial integrated candidate at `381fb5b` and the fixes and strengthened tests through `2dc4eae`. All five initial findings have been corrected. The mutation score and final recheck are recorded below.

## Findings on the initial build

| ID | Severity | Evidence on the reviewed candidate | Status |
|---|---|---|---|
| E1 | Medium | `apps/extension/src/storage.ts:84`. Bookmark Undo removes each stored ID before advancing. Deleting the first imported bookmark by hand makes the browser reject the same ID on each retry, stranding surviving bookmarks. The folder-removal path has the same issue. | Closed. The native adapter now checks for confirmed absence after an API rejection, preserves errors on existing IDs for retry and retains foreign bookmarks. Two regression tests cover both paths. Independent working verification passed. |
| E2 | Medium | `packages/core/src/plan.ts:185`, `apps/extension/src/executor.ts:150`. The planner reports two windows for the empty-spaces fixture, and the executor skips every empty window. A selected Space whose URLs are all excluded has the same discrepancy. | Closed. Group-capable and fallback adapters create each selected empty window, keep its placeholder under Undo ownership and count zero migrated tabs. Independent verification observed two planned and two created windows. |
| E3 | Medium | `packages/core/src/plan.ts:171`. A folder containing a tab, a populated subfolder and a second direct tab produces group memberships parent/child/parent. A browser tab strip requires contiguous group members. The planned order cannot match execution. | Closed. The planner now groups each block at first occurrence while preserving sibling order. Native Chromium independently observed [a, c, b] for the interleaved source [a, b, c], matching the corrected plan. The regression also covers ungrouped neighbors. |
| E4 | High | `packages/core/src/parse.ts:350`. With the tiny synthetic fixture’s pinned container row carrying tab data, the input has four tab rows. The parser visits only that anchor's children and reports three tabs, zero skips and zero warnings. A local Node run confirmed the counts. | Closed. Each section anchor now passes through the same tab routine as ordinary rows. Rechecks counted four input and four output tabs. Regression cases cover pinned, Today and Favorites anchors and missing URLs. |
| E5 | Medium | `packages/core/test/engine.test.ts:272`. The bookmarks round-trip checks linear tab order, title/URL pairs and the presence of a Favorites heading. A broken folder hierarchy would pass those assertions. | Closed. Round-trip tests now reconstruct folder, Space, Pinned, Today and Favorites paths from bookmarks HTML and compare them to the source tree. The verifier reran all five export round-trip fixture cases. |

## Architecture and test audit

- Inspected the parser, pack reader, planner, exports, importer, adapters, executor, persisted ownership, bookmark creation, Undo, browser tests, web converter and desktop bridge.
- A script inspected all import specifiers under `packages/core/src`. Every import referenced a relative module. Searching app and shared UI sources for `JSON.parse` found no competing parser. Parsing returns typed results. Core emits static archive markup as strings.
- The importer serializes native operations with Web Locks. The completion listener removes itself and clears its timeout. The executor tracks replaced Chromium tab IDs before Undo. Browser tests preserve an unrelated tab added to an imported window.
- At the initial review all eight tracked TypeScript test files and sixteen expected fixtures had zero content changes since introduction. At recheck, 417 lines were added to the core engine tests and 16 to the executor tests. The existing native window assertion was extended to expect a tracked blank placeholder for a selected empty Space. Every nonempty window still uses the same ordered URL, pin and group oracle. A search for skip/only/todo markers found zero matches.
- The mutation launcher measures the performance contract against shipping code first. The instrumented run covers functional behavior because instrumentation changes wall-clock timing. New tests exercise parser size/encoding boundaries, pack envelope and field validation, palette and option selection, normalized export trees and byte-exact golden outputs. The original behavioral tests remain active.

The focused recheck `pnpm exec vitest run packages/core/test apps/extension/src` passed all 128 tests. The integrated runner passed all 13 end-to-end cases in 1.4 minutes. Those included a real Chromium empty-Space import, large-input recovery, Undo, cancellation and all four offline converter downloads.

## Mutation score and final recheck

Rechecked on the working tree after `3d581ae` on 2026-11-13. A full StrykerJS run (`pnpm mutation`) first scored `plan.ts` at 78.93%, below the 80% bar in §10.3. The surviving mutants were group-colour hue selection, pinned totals, the pinned-folder note wording, Favorites/Today choices and URL trimming. `packages/core/test/planner-rules.test.ts` adds 11 behavioral tests for those rules. The rerun scored:

| Module | Score |
|---|---|
| `parse.ts` | 86.56% |
| `plan.ts` | 89.63% |
| `export/index.ts` | 85.25% |
| `read-pack.ts` | 95.22% |
| `tree.ts` | 95.89% |
| All mutated files | 89.46% |

The same recheck added six desktop IPC attack tests to the Rust modules (`attack_*` in `files.rs` and `browsers.rs`) covering ungranted and relative paths, discovery escaping its base, symlinked parent folders, granted directories, oversized and non-UTF-8 files, and launcher targets that must be fixed URLs, never flags. Unused `@tauri-apps/plugin-dialog`, `plugin-fs` and `plugin-opener` front-end packages were removed. Every dependency specifier is pinned to its locked version. Formatting is now enforced by `pnpm check`.

Final gate evidence: `pnpm install --frozen-lockfile && pnpm check` passed (typecheck, lint, format, 139/139 unit tests, all builds, both manifests, check-anon deferred with no private file, no known production vulnerabilities). `pnpm e2e` passed 13/13 in 46.7 seconds. `cargo test` passed 10/10 and `cargo clippy --all-targets -- -D warnings` was clean.

**Engineering review: signed off.** No open correctness findings. No Medium findings await acceptance. Not verified here: a real Arc sidebar, Firefox at runtime, Windows, and `cargo audit` (not installed).

## Addendum: profiles, pinned groups, bookmarks copy and password guide

Rechecked after the owner-requested features on 2026-11-13 (see `docs/decisions.md`). Native pinning tests now request `pinned: "native"` explicitly; the default-options assertion was updated for the new `pinned: "group"` default. New tests cover pinned and Favorites groups, the bookmarks copy's accounting, the profile launcher (`profiles.rs`, including attack cases for flags, schemes, profile names and URL limits) and the desktop profile flow in Playwright. A headless Chromium run with a throwaway profile confirmed `--profile-directory` and the `--` switch terminator; loading pages in that run was blocked by the local sandbox and remains a manual check.

Gates: `pnpm check` passed with 143/143 unit tests; `pnpm e2e` 14/14; `cargo test` 14/14; clippy clean. Mutation: `plan.ts` 89.94%, all mutated files 89.55%. Sign-off stands.

## Acceptance evidence map

| Tasks | Checks and limitations |
|---|---|
| A0–A2 | Root type checking, frozen install, lint and build verify the current scaffold and shared interfaces. Synthetic fixture snapshots, anonymizer tests and check-anon cover today's inputs. The initial empty-workspace run was not reconstructed. The real fixture check is deferred by the owner. |
| A3–A5 | Parser fixture snapshots, fast-check properties, depth/size and duplicate-ID checks, planner option assertions and the 5,000-tab timing case are in `packages/core/test/engine.test.ts`. Export tests parse bookmarks/archive HTML, compare CSV rows, check diagnostics and round-trip packs. See E2–E5. |
| A6–A11 | Manifest checker, adapter/executor/bookmarks/fragment unit tests, six Playwright extension flows and independent observer state dumps exercise builds, ordering, errors, cancellation, interrupted runs and Undo. Firefox runtime verification and optional native install prompts remain owner checks. |
| B1–B2 | Converter Playwright tests cover fixture rendering, all four offline downloads, network silence, keyboard control and virtualized large trees. Development gallery and production builds have separate entries. |
| B3–B5 | Landing and migration pages are static. Lighthouse measured performance and accessibility at 100 in the provided local build run. Per-browser guides, file location, passwords, scope and privacy are present. |
| C1–C3 | Rust tests exercise path grants, discovery, launcher destinations and extension directory lookup. Desktop Playwright smoke drives the built UI with mocked native commands. Real sidebar compatibility, permissions and live destination handoff are manual. |
| A12, C4–C5, D1–D3 | Listings, announcement drafts and recording scripts are tracked. Store archive inspection, source reproduction and native packaging are release-stage checks. Windows requires a Windows environment. |
| R0–R1 | Threat model and contract decisions are tracked under docs. The behavior and security reviews record their independent evidence. |
