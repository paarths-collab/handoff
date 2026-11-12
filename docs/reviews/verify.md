# Working verification

The independent review used invented titles, URLs and browser profiles on macOS. The owner deferred personal-sidebar compatibility. The initial merged test candidate was `381fb5b`.

## Observed results

| Check | Evidence |
|---|---|
| Chromium browser state | `pnpm e2e` passed 11/11 in 1.0 minute on the initial merged build. Tiny, typical, huge and special-characters imports matched the planner’s windows, pinned order, tab URLs, group titles, colors and collapsed state. Huge moved 600 tabs in 41.1 seconds. The HTML Playwright report embeds four synthetic browser-state attachments. |
| Undo, Cancel and interruption | The tiny test added an unrelated tab to an imported window before Undo. The added tab survived. Cancel after work started, and closing/reopening the importer before completion, both allowed Undo and restored the original window set. |
| Partial adapter failures | Ten independently seeded `executePlan` runs over the 100-tab typical plan simulated failed creates and cancellation. Five completed and five cancelled. In each run, moved, failed and unfinished IDs accounted for exactly 100 unique inputs and the fake browser’s remaining owned tabs equalled the reported successful moves. |
| Offline conversion | All four downloads completed with networking disabled after load and zero observed requests. Reopening a downloaded 100-tab archive in Chromium displayed 100 links. Searching for one synthetic title left one visible. Clearing search restored all 100. |
| Large input | A synthetic 5,000-tab file parsed in 18 ms and completed parse plus planning in 26 ms. A 6,114,582-byte, 50,000-tab file parsed in 159 ms and completed planning in 200 ms. The larger file produced 50,000 planned IDs, 50,000 bookmark links, 50,000 CSV rows and 50,000 tabs after pack round trip. No skips. |
| Size limit and recovery | Core returned typed `too-large` at 104,857,601 bytes. The built converter and extension rejected a sparse file of that size before previewing it. The retained Playwright case in `apps/web/e2e/faults/file-limits.spec.ts` then loaded 50,000 tabs and verified the virtualized preview. |
| Malformed input | Built converter, Chromium extension and desktop frontend each reported actionable errors for not-arc, truncated and 100,000-level nested arrays. Each recovered four tabs from the corrupt fixture and rendered a 50,000-tab preview. Desktop file IO was mocked for these checks. |
| Desktop frontend and native commands | The desktop Playwright smoke passed with mocked native file discovery, dialogs and browser launch. It checked the three-tab preview, Safari guide, bookmark/CSV contents, archive pair and pack handoff. A separate `cargo test --offline --locked` on the merged Rust app passed 4/4 with temporary directories for file grants, replaced links, extension folders and launch destinations. |
| Browser matrix | Playwright’s Chrome for Testing exercised the extension. Installed branded Chrome 157.0.8103.78 launched cleanly with the same unpacked flags but never started the extension worker. Brave, Edge, Vivaldi, Opera and Firefox were unavailable. Use the manual matrix for these and Safari. |

## Findings and rechecks

- **E1, Medium.** Removing the first owned bookmark manually made two successive Undo attempts fail while a second owned bookmark remained. At `6c4144a`, an independent test using the production Undo adapter with synthetic browser APIs confirmed a missing ID was ignored, a real write failure retained the single remaining owned ID, and retry removed it while preserving a foreign bookmark.
- **E2, Medium.** The initial executor skipped selected empty Spaces while the plan counted their windows. The corrected build adds a real-browser empty-Spaces check. An independent executor recheck at `ec78cd0` observed two planned and two created windows, zero moved user tabs and two placeholder IDs available for Undo.
- **E3, Medium.** An interleaved nested folder produced parent/child/parent group membership in the original plan, which a native tab strip cannot represent. Repeating the same input at `ec78cd0` produced parent/parent/child, with all three source IDs present exactly once.
- **E4, High.** Replacing a tiny-fixture section anchor’s data with a legitimate tab value produced four tab rows but only three parsed tabs and zero skips on `6c4144a`. The same input at `ec78cd0` produced four parsed tabs and zero skips.

- **E5, Medium.** After the exporter test correction, `pnpm exec vitest run packages/core/test/engine.test.ts -t "round-trips all exported rows"` passed five fixture cases including nested groups.

**Working review:** approved for local synthetic testing. The verified P0 Chromium and converter flows passed, the five reported findings were rechecked, and the synthetic timing budgets passed. Astra reruns the combined suite on the final merged revision.

## Manual verification

The [manual matrix](../guides/manual-checks.md) covers native browser installation, branded browser variants, Safari bookmark import, real Firefox behavior, real macOS permission prompts and Windows. The frontend smoke and native unit tests exercise separate layers. The real native dialog, live desktop handoff and real sidebar remain unverified.
