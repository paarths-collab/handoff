# Tab Mover: Implementation Plan (v1, one-day agent build)

> Historical implementation plan. The current product is Handoff. Use the repository README and `docs/agent-setup.md` for setup, the separate [handoff-website](https://github.com/paarths-collab/handoff-website) repository for the final website, and `packages/ui/src/workspace.tsx` for the shared app/extension workspace. Retired design explorations are in `archive/prototypes/`; website paths below describe the former monorepo layout. Old countdown and visual-design requirements below are not current shipping requirements.


*For **Astra**, the lead agent. "Owner" means the product owner, who holds the accounts, runs the final manual checks and presses launch.*

---

## 0. How to use this plan

- The whole product is built in **one session by a tree of agents** (§2). Astra is the root. Work moves in **waves**: a wave starts when the work it depends on has merged, not at a set time.
- Each task (§9) has an **ID**, an **agent**, **deliverables** and **acceptance** criteria. A task is done only when its acceptance criteria pass.
- Facts marked **VERIFY** are unconfirmed. Check them before building on them. Agents report answers in their handoff, and only Astra writes them to `docs/decisions.md`.
- Where this plan is silent, pick the simplest option that keeps the rules in §3, and say so in the handoff report.
- Nothing ships on unit tests alone. §10 defines three independent reviews (does it work, software engineering, cybersecurity), the evidence each must show, and what blocks release.

---

## 1. Goal

Arc browser is shutting down (Dec 22, 2026; the landing page countdown needs this date). Tab Mover moves a user's Arc sidebar (Spaces, pinned tabs, folders, Favorites, Today tabs) into the browser they choose, entirely on their own computer:
- **Chromium browsers** (Chrome, Brave, Edge; Vivaldi and Opera best effort) and **Firefox**: native pinned tabs and tab groups.
- **Safari** and anything else: a bookmarks file.

**Done in the build session:** all code, tests, fixtures, docs, guides, the three reviews (§10), store packages, desktop builds and launch copy.
**Outside the session (the Owner, or waiting on someone else):** store review, Apple signing and notarization (needs the Owner's account), the Windows build if no Windows machine is available, the manual test matrix, the demo recording and publishing.

---

## 2. Agent tree and execution

### 2.1 The tree

```
Astra (lead) ── owns root config, contracts, lockfile, docs/decisions.md and main; merges; packages the release
│
├── Wave 0 ─ foundation (no code copies: these agents report text back and Astra commits it)
│   ├── (Astra itself)   A0 scaffold, A1 contracts, dependency install
│   ├── spike-format     S3  (blocks core)
│   ├── spike-chromium   S1  (feeds extension)
│   ├── spike-handoff    S2  (feeds desktop, extension)
│   ├── spike-firefox    S4  (feeds extension)
│   ├── threat-modeler   R0  threat model + security requirements, before feature code
│   └── design-reviewer  R1  reviews the contracts before they freeze
│
├── Wave 1 ─ build (one code copy per agent)
│   ├── core        A2–A5    fixtures, parser, planner, exporters
│   ├── extension   A6–A11   shell, importer, executor, Undo, e2e tests, Firefox
│   ├── ui-web      B1, B2   shared UI + web converter
│   ├── site        B3–B5    landing page, guides, privacy policy
│   ├── desktop     C1–C3    Tauri app
│   └── launch      D1, D2   launch copy and asset scripts
│
├── Wave 2 ─ review (one code copy per agent)
│   ├── verify            "does it actually work?" (§10.2)
│   ├── engineering       software engineering review (§10.3)
│   ├── security          cybersecurity review (§10.4)
│   └── finding-verifier  reproduces every finding before it's fixed
│   (confirmed findings → the builder that owns the code → fix + regression test → reviewer re-checks)
│
└── Wave 3 ─ package (Astra)  A12, C4, C5, D3
```

**Size:** 17 agents. At most 6 code copies exist at once (during Wave 1); Astra deletes each copy after merging it.

**Why this size:**
- Only agents that edit code at the same time need their own copy. Spikes and the Wave 0 reviewers only report back, so they need none.
- Copies are cheap on disk: git shares its history between them, and pnpm links packages instead of duplicating them. The real cost of more agents is merging and coordination, so each builder owns a whole area instead of splitting it among several agents.
- A review agent may split its roles (§10) among helpers inside its own copy if the platform allows. Helpers that run builds or tests take turns.

**Critical path:** design review → contracts → spike-format → core → extension (executor) → merge → Wave 2 reviews → fixes → package. Start these first.

**If parallelism is capped,** start builders in this order: core, ui-web, extension, desktop, site, launch.

### 2.2 Roster

| Agent | Wave | Tasks | Code copy | Owns (may edit only these) |
|---|---|---|---|---|
| `astra` | 0–3 | A0, A1, merges, A12, C4, C5, D3 | Main checkout | Root files (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `biome.json`, `.nvmrc`, `.gitignore`, `stryker.config.mjs`), contract files (`packages/core/src/{result,model,plan-types}.ts`, `packages/ui/src/types.ts`), `packages/core/test/builders.ts`, `docs/PLAN.md`, `docs/decisions.md`, the Wave 0 outputs it commits (`docs/arc-format.md`, `docs/security/threat-model.md`, `SECURITY.md`), `release/` (gitignored), `CHANGELOG.md` |
| `spike-format` | 0 | S3 | None: reads the private file and returns the text of `docs/arc-format.md` | — |
| `spike-chromium`, `spike-handoff`, `spike-firefox` | 0 | S1, S2, S4 | None: throwaway code in a scratch folder outside the repo | — |
| `threat-modeler` | 0 | R0 | None: returns the threat model and `SECURITY.md` text | — |
| `design-reviewer` | 0 | R1 | None: reads the contract files | — |
| `core` | 1 | A2–A5 | `../tm-core` | `packages/core/` except the contract files and `builders.ts`; `fixtures/`; `scripts/{anonymize,gen-fixture,check-anon}.ts` |
| `extension` | 1 | A6–A11 | `../tm-extension` | `apps/extension/`; `scripts/check-manifest.ts` |
| `ui-web` | 1 | B1, B2 | `../tm-ui-web` | `packages/ui/` except `src/types.ts`; `apps/web` config (`package.json` and the Vite config, set up with entries for every page); `apps/web/{convert.html,dev.html}`; `apps/web/src/convert/`; `apps/web/e2e/` |
| `site` | 1 | B3–B5 | `../tm-site` | `apps/web/index.html`, `apps/web/src/site/`, `apps/web/guides/`, `docs/guides/`, `docs/privacy.md` |
| `desktop` | 1 | C1–C3 | `../tm-desktop` | `apps/desktop/` |
| `launch` | 1 | D1, D2 | `../tm-launch` | `launch/` |
| `verify` | 2 | §10.2 | `../tm-verify` | Tests only: `packages/core/test/faults/`, `apps/*/e2e/faults/`; report: `docs/reviews/verify.md` |
| `engineering` | 2 | §10.3 | `../tm-engineering` | Report only: `docs/reviews/engineering.md` |
| `security` | 2 | §10.4 | `../tm-security` | Tests only: `packages/core/test/attacks/`, `apps/*/e2e/attacks/`, `apps/desktop/src-tauri/tests/attacks/`; report: `docs/reviews/security.md` |
| `finding-verifier` | 2 | Reproduces findings | `../tm-verifier` | Report only |

### 2.3 Waves

| Wave | Starts when | Runs | Ends when |
|---|---|---|---|
| **0** | Owner input §12 item 1 is ready | Astra: A0, A1, full dependency install, commit `docs/PLAN.md`. In parallel: the four spikes, threat-modeler (R0) and design-reviewer (R1) | Contracts frozen after R1; threat model and `arc-format.md` committed and folded into the briefs; scaffold on `main`. S1, S2 and S4 may keep running into Wave 1; their consumers use the spike defaults until results arrive |
| **1** | Wave 0 ends | All six builders at once (or in the §2.1 order) | Every builder's branch passes its checks and has merged to `main` |
| **2** | All builders merged | verify, engineering and security in parallel, plus finding-verifier; fix loop | No release blockers open (§10.5), and all three reviewers sign off with evidence |
| **3** | Wave 2 signs off | Astra packages the release | Release outputs exist and Astra's final report is delivered (§2.8) |

**Rolling integration:** as soon as a builder passes its checks, Astra merges it to `main`, and the other builders merge `main` into their branches. Core usually lands first, so the other builders can switch from test builders to the real engine.

### 2.4 Branches and copies

- Branches: `main` ← `agent/<name>`.
- Each agent with a code copy works in a git worktree: `git worktree add ../tm-<name> -b agent/<name> main`. Astra runs `git worktree remove` after merging it.
- In a Wave 2 fix round, the owning builder is resumed (or restarted from its handoff report) in a fresh copy made from the current `main`.
- `private/` is gitignored, so it exists **only in the main checkout**. Only `spike-format` and `core` receive its absolute path, read-only.
- Only Astra edits root files and the lockfile. Wave 0 installs the **full dependency set** (§9, A0), so builders never add dependencies. If one is truly needed, the builder asks in its handoff and Astra adds it.
- Only Astra edits contract files (§6.2, §6.3). Builders request changes in their handoff. Astra applies them and tells every affected agent.

### 2.5 Briefing template (parent → child)

```
You are <agent> in the Tab Mover build. Parent: <parent>.
Copy: <absolute path, or none>   Branch: agent/<agent> (from main)
Read first: docs/PLAN.md §3 (rules), §4 (repo rules), §6.2–6.3 (contracts),
§7 if you touch parsing, and your tasks: <IDs> in §9.
You own only: <paths from §2.2>. Do not edit anything else.
Do not add dependencies, permissions, network calls or remote resources.
Do not change contract files; request changes in your handoff.
Inputs: <spike results or defaults; fixture paths; private file path if allowed>.
Done when: every acceptance criterion of your tasks passes with <scoped check command>.
Commit with the configured agent identity (§4). Do not push.
If the same failure persists after 3 fix attempts, stop and report.
Never weaken, skip or delete a test to make it pass.
Finish with the handoff report from PLAN.md §2.6.
```

Review agents get the same brief plus: *"You review and test; you don't change production code. You may add tests only under <paths from §2.2>. Report each finding with file, line, severity (§10.5) and reproduction steps."*

### 2.6 Handoff report (child → parent, 25 lines or fewer)

```
agent: <name> | tasks: <IDs> | branch: agent/<name> @ <commit>
status: done | partial | blocked
checks: <command> → pass/fail (<counts>)
acceptance: <criterion> → pass/fail   (one line each)
answers: <VERIFY and spike answers, or none>
contract requests: <none | exact change + reason>
needs from others: <none | agent: what>
known gaps: <none | ...>
```

### 2.7 Merge protocol

1. **Builder done:** Astra checks scope (`git diff --name-only main...agent/<name>` touches only that agent's owned paths), reviews the diff, merges with `--no-ff`, then runs `pnpm install --frozen-lockfile && pnpm check` (plus `pnpm e2e` for `extension` and `ui-web`). If anything fails, Astra reverts the merge and sends the failure back to the builder.
2. **Review findings:** the reviewer reports each finding with file, line, severity and reproduction steps → `finding-verifier` reproduces it independently (unconfirmed findings are labeled as such and not fixed blindly) → the owning builder → fix plus a regression test → the reviewer re-checks the affected area.

### 2.8 Astra's final report to the Owner

Kept short:
- What shipped, with paths to the release outputs.
- Review results (working, engineering, security), including any Medium findings the Owner must accept.
- Spike and VERIFY answers.
- Anything P1 that didn't make it.
- The Owner's to-do list from §12.

### 2.9 Running the tree in Claude Code (one way)

- The lead session spawns each agent as a subagent and passes the §2.5 brief. Agents with a code copy get worktree isolation; Wave 0 agents don't need one.
- Alternatively, open one terminal per agent, create the worktree (§2.4) and start `claude` in it with the brief.
- Gates can use the built-in `/code-review` and `/security-review` commands.

---

## 3. Rules that must always hold

1. **Local only.** No server, account or telemetry. The extension has no host permissions and makes no network requests. The converter page enforces `connect-src 'none'`.
2. **Never lose a tab silently.** Every tab in the input appears exactly once in each output, or in a skipped list with a reason. A shared test helper checks this "tab conservation" for every exporter and every import plan.
3. **Never crash on input.** Parsing returns a typed `Result`. Unknown shapes become warnings, not exceptions.
4. **Never touch credentials.** Don't read Arc's `Login Data`, `Cookies`, `History` or the Keychain. Passwords are covered by a guide only.
5. **Minimal permissions.** Extension required: `tabGroups`, `storage`. Optional, requested at the moment of use: `tabs` (only for "skip tabs I already have open") and `bookmarks` (only for bookmark mode). A check fails the build if any built manifest differs.
6. **Escape all user text** in every HTML and CSV output.
7. **No Arc branding.** "Tab Mover" is a working name. Descriptions may say "works with Arc". Never use Arc's logo.
8. **Private data stays private.** The Owner's real Arc file lives only in the gitignored `private/` folder. Fixtures are anonymized by script. Never put real titles or URLs in commits, logs, snapshots, handoff reports or issues.
9. **Treat every input as hostile.** Arc files, packs and URL fragments are untrusted. No `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML` with data (Biome security rules enforce this). Use `Map` for ID lookups, never plain objects, so keys like `__proto__` can't pollute prototypes. Traverse iteratively with a visited set and a depth cap of 64 levels; deeper items move to a "Deeply nested items" folder with a warning.
10. **Nothing opens without a click.** Data from any source (file, pack, URL fragment) is previewed first, and tabs open only after the user presses Move. Only `openableSchemes` URLs ever become tabs; `javascript:`, `data:`, `file:` and browser-internal URLs never do.
11. **Desktop commands are narrow.** No shell. Commands take enums and validated arguments only. File reads are limited to canonicalized allowlisted paths. The browser launcher accepts only detected browser executables and URLs of the form `chrome-extension://<known ID>/importer.html#…` or the known store pages.

---

## 4. Repository rules

- **Commit identity:** author and committer are always `paarths-collab <205314222+paarths-collab@users.noreply.github.com>`:
  ```bash
  GIT_AUTHOR_NAME=paarths-collab GIT_AUTHOR_EMAIL=205314222+paarths-collab@users.noreply.github.com \
  GIT_COMMITTER_NAME=paarths-collab GIT_COMMITTER_EMAIL=205314222+paarths-collab@users.noreply.github.com \
  git commit -m "feat(core): parse Arc spaces"
  git show -s --format='%an <%ae> | %cn <%ce>'   # verify before any merge
  ```
  No signing keys and no personal co-author trailers.
- **Do not push, add remotes, open PRs or deploy** until the Owner names a publishing account (§12, item 6). Until then, the local `pnpm check` is the CI gate.
- Use Conventional Commit messages.
- Never commit `private/`, real Arc files, `spikes/`, `release/`, `dist/`, `.output/`, `node_modules/`, signing certificates or store credentials.

---

## 5. Scope and priority

Everything below is in scope. Priority sets the start order and the review order. If a P1 item fails Wave 2 review, it is left out of the release and listed in Astra's final report; it doesn't block P0.

| ID | Component | Priority |
|---|---|---|
| `core` | Parser, model, import planner, exporters (bookmarks HTML, archive HTML, pack JSON, CSV, diagnostic) | P0 |
| `ext-chromium` | Extension for Chrome, Brave, Edge (Vivaldi and Opera best effort) | P0 |
| `web` | Web converter (no install) | P0 |
| `site` | Landing page, per-browser guides, password guide, FAQ, privacy policy | P0 |
| `launch` | Store listings, Product Hunt, X, Reddit, Hacker News copy, screenshot and video scripts | P0 |
| `ext-firefox` | Firefox build | P1 |
| `desktop-mac` | Tauri app for macOS (signed and notarized once the Owner's account exists) | P1 |
| `desktop-win` | Tauri app for Windows | P1 |
| `safari-ext` | Safari Web Extension | P2 (after launch) |
| `any-browser` | After Arc shuts down: move tabs between any browsers | P2 (after launch) |

**Out of scope:** history, cookies, passwords (guide only), Easels, Boosts, Notes, mapping Arc profiles to browser profiles (shown as labels only), sync, accounts, payments (unless the Owner decides otherwise, §12).

---

## 6. Architecture

```
 StorableSidebar.json (raw)  or  tab-mover-pack.json
              │
              ▼
   ┌─────────────────────────────────────────────┐
   │ packages/core (pure TypeScript)             │
   │ parseArcSidebar → Library                   │
   │ planImport(Library, options) → ImportPlan   │
   │ exporters: bookmarks / archive / pack / CSV │
   └───────┬──────────────┬──────────────┬───────┘
           ▼              ▼              ▼
   apps/extension    apps/web       apps/desktop
   executePlan()     downloads      Tauri: finds file,
   via browser       exports        saves exports,
   adapter                          hands pack to the extension
           ▲                                │
           └──────── pack (JSON) ───────────┘
```

**Layering rule:** `packages/core` has no DOM, no `chrome.*`/`browser.*` and no Node `fs`. Platform code lives only in `apps/*`. `packages/ui` holds the shared React screens.

### 6.1 Repository layout

```
tab-mover/
├── package.json  pnpm-workspace.yaml  tsconfig.base.json  biome.json  .nvmrc
├── packages/
│   ├── core/     src/{result,model,plan-types,parse,plan,conserve}.ts  src/export/  test/
│   └── ui/       src/types.ts + FileDrop, PathHelper, PreviewTree, OptionsPanel,
│                 ProgressView, ResultReport, CopyDiagnosticButton
├── apps/
│   ├── extension/  WXT: entrypoints/{importer, popup, background}, src/{executor,adapters}, e2e/
│   ├── web/        Vite multi-page: index.html (landing), convert.html, guides/, e2e/
│   └── desktop/    Tauri v2: src-tauri/ (Rust), src/ (React using core + ui)
├── fixtures/     *.json (anonymized/synthetic) + expected/*.json
├── scripts/      anonymize.ts, gen-fixture.ts, check-manifest.ts, check-anon.ts
├── private/      (gitignored, main checkout only) the Owner's real Arc file
├── docs/         PLAN.md, decisions.md, arc-format.md, privacy.md, guides/,
│                 security/threat-model.md, reviews/{verify,engineering,security}.md
├── SECURITY.md   how to report a vulnerability
├── stryker.config.mjs  mutation testing for packages/core
└── launch/       copy, screenshot list, video script
```

**Toolchain:** current Node LTS (pinned in `.nvmrc`), pnpm workspaces, TypeScript `strict`, Biome (lint + format), Vitest, fast-check (property tests), StrykerJS (mutation testing), happy-dom (DOM parsing in tests), Playwright, WXT, React, Tailwind, Vite, a virtual-list library for the preview tree, and Tauri v2 with its official dialog, file-system and opener plugins (**VERIFY** current plugin names). Use the latest stable versions and pin them in the lockfile.

### 6.2 Core contracts (Astra writes these in Wave 0; frozen after that)

```ts
// packages/core/src/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// packages/core/src/model.ts
export interface Library {
  schemaVersion: 1;
  source: { platform: 'macos' | 'windows' | 'unknown'; parsedAt: string; sourceHash: string };
  favorites: Node[];               // Arc Favorites (shared across Spaces)
  spaces: Space[];                 // in Arc's sidebar order
  report: ParseReport;
}
export interface Space {
  arcId: string;
  title: string;
  titleGenerated: boolean;         // true when Arc stored no title ("Space 2")
  profile: string | null;          // label only; null = unknown
  color: string | null;            // primary hex color if stored; null = unknown
  icon: string | null;             // emoji if stored
  pinned: Node[];
  today: Node[];                   // Arc's unpinned section
}
export type Node = TabNode | FolderNode;
export interface TabNode {
  kind: 'tab'; arcId: string;
  url: string;                     // exactly as stored
  title: string;                   // display: custom ?? savedTitle ?? host ?? url
  customTitle: string | null;
  savedTitle: string | null;
}
export interface FolderNode { kind: 'folder'; arcId: string; title: string; children: Node[] }

export interface ParseReport {
  counts: { spaces: number; tabs: number; folders: number; favorites: number; today: number; skipped: number };
  skipped: { arcId: string; reason: 'unsupported-kind' | 'no-url'; detail: string }[]; // detail = kind key, e.g. "easel"
  warnings: Warning[];
}
export type Warning =
  | { kind: 'generated-title'; target: 'space' | 'folder' | 'tab'; arcId: string }
  | { kind: 'order-mismatch'; parentArcId: string }
  | { kind: 'orphan-recovered'; arcId: string }      // parent missing → "Recovered items" folder
  | { kind: 'cycle-broken'; arcId: string }
  | { kind: 'split-view-flattened'; arcId: string }
  | { kind: 'unknown-field'; path: string };         // key names only, never values

export type ParseError =
  | { kind: 'not-json'; message: string }
  | { kind: 'not-arc-file'; message: string; hint: string }
  | { kind: 'no-sidebar-data'; message: string; hint: string }
  | { kind: 'too-large'; message: string; limitBytes: number };

export declare function parseArcSidebar(text: string): Result<Library, ParseError>;
export declare function parsePack(text: string): Result<Library, ParseError>;   // tab-mover-pack.json

// packages/core/src/plan-types.ts
export type GroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';
export interface ImportOptions {
  spaceIds: string[];                              // selected Spaces
  spaceMode: 'window' | 'group';                   // bookmark mode is an extension option using toBookmarksHtml
  folderMode: 'groups' | 'flatten';
  today: 'include' | 'skip';
  favorites: 'pinned-first-window' | 'skip';
  collapseGroups: boolean;                         // default true
  openableSchemes: string[];                       // default ['http:', 'https:']
  skipUrls?: ReadonlySet<string>;                  // URLs already open (only when the user opts in)
}
export interface ImportPlan {
  windows: PlannedWindow[];
  skipped: { arcId: string; url: string; reason: 'scheme' | 'empty-url' | 'by-choice' | 'duplicate' }[];
  notes: string[];                                 // e.g. "4 pinned tabs inside folders became group tabs"
  totals: { windows: number; tabs: number; pinned: number; groups: number };
}
export interface PlannedWindow { key: string; spaceArcId: string; tabs: PlannedTab[]; groups: PlannedGroup[] }
export interface PlannedTab { arcId: string; url: string; title: string; pinned: boolean; groupKey: string | null }
export interface PlannedGroup { key: string; title: string; color: GroupColor; collapsed: boolean }
export declare function planImport(lib: Library, opts: ImportOptions): ImportPlan;

// packages/core/src/export/*.ts
export declare function toBookmarksHtml(lib: Library, opts?: { spaceIds?: string[] }): string;
export declare function toArchiveHtml(lib: Library): string;
export declare function toPackJson(lib: Library): string;  // { format: 'tab-mover-pack', schemaVersion: 1, createdAt, library }
export declare function toCsv(lib: Library): string;
export declare function toDiagnostic(lib: Library, appVersion: string): string; // structure only: no titles, URLs or IDs

// packages/core/src/conserve.ts: used by every exporter and plan test
export declare function assertConserved(input: Library, outputTabArcIds: string[], skippedArcIds: string[]): void;
```

Astra also writes `packages/core/test/builders.ts`, a small set of helpers that build `Library` objects directly. Planner, exporter, UI and app agents test with these before the parser lands.

### 6.3 UI contracts (Astra writes these in Wave 0)

```ts
// packages/ui/src/types.ts
export interface FileDropProps { onLoaded(r: Result<Library, ParseError>, fileName: string): void }  // accepts raw Arc file or pack
export interface PathHelperProps { platform: 'macos' | 'windows' | 'unknown' }
export interface PreviewTreeProps { library: Library; selectedSpaceIds: Set<string>; onChange(ids: Set<string>): void }
export interface OptionsPanelProps { value: ImportOptions; onChange(v: ImportOptions): void; capabilities: { groups: boolean; bookmarks: boolean } }
export interface ProgressViewProps { done: number; total: number; onCancel(): void }
export interface ResultReportProps {
  plan: ImportPlan;
  result: { done: number; failed: { arcId: string; url: string; error: string }[]; cancelled: boolean };
  onUndo?(): void; onDownloadSkipped(): void;
}
export interface CopyDiagnosticButtonProps { library: Library; appVersion: string }
```

---

## 7. Arc file format: known facts and open questions

**Location**
- macOS: `~/Library/Application Support/Arc/StorableSidebar.json`
- Windows: `%LOCALAPPDATA%\Packages\TheBrowserCompany.Arc_<suffix>\LocalCache\Local\Arc\StorableSidebar.json`

**Structure, as read from the open-source arc-export tool. Confirm everything against the real file in spike S3.**
```
{ "sidebar": { "containers": [ { …, "global": {…} }, { "spaces": [...], "items": [...], … } ] } }
```
- The **data container** is the element after the one with a `global` key. If there is none (for example, `global` is last), fall back to the first container that has both `spaces` and `items`. If neither exists, return `no-sidebar-data`.
- `spaces` and `items` can mix bare ID strings with objects (flattened ID/value pairs). Skip the strings and use each object's `id`.
- **Space:** `id`, optional `title`, and `newContainerIDs`, a list in which a marker object (`{"pinned": …}` or `{"unpinned": …}`) is followed by that section's container ID. **VERIFY** where the icon and theme color live (expected under `customInfo`) and how the profile is referenced.
- **Item:** `id`, `parentID`, optional `childrenIds`, optional `title` (the custom name), and `data`:
  - `data.tab` (`savedURL`, `savedTitle`) → tab.
  - `data.list` → folder (**VERIFY**). Fallback: no `data.tab`, and has a title or children → folder.
  - `data.splitView` → split view. Flatten its children into the parent and warn (**VERIFY**).
  - `easel`, notes and anything else → skipped with reason `unsupported-kind` and the key name as detail.
- **Order:** use the parent's `childrenIds`. Append any unlisted children in file order and add an `order-mismatch` warning.
- **Favorites:** expected in a `topAppsContainerIDs` field (**VERIFY**).
- **Corrupt data:** a missing parent puts the item in a "Recovered items" folder. Break cycles with a visited set. Never recurse without that guard.

**Bugs in existing tools to avoid:** no HTML escaping; a crash when `global` is the last container; unpinned sections skipped; children ordered by file order instead of `childrenIds` (**VERIFY** against Arc's display); untitled non-tab items (such as split views) dropped along with their children.

---

## 8. Spikes (Wave 0)

Each spike agent answers its questions in its handoff report. If a question can't be answered after a short, focused attempt, the default applies and the spike reports why.

| ID | Agent | Question | Default if unresolved | Consumers |
|---|---|---|---|---|
| **S1** | spike-chromium | Chromium tab behavior, tested in a throwaway unpacked extension driven by Playwright (Chromium first; then Brave, Edge, Vivaldi and Opera if installed, via `executablePath`): **(a)** Chrome can't create tabs unloaded (`tabs.create` has no `discarded` option), so test `tabs.discard` immediately after create versus after `onUpdated` reports the URL. Which keeps the correct URL and title while unloaded? Does the returned tab ID differ from the original? **(b)** Can a pinned tab join a group, or does `tabs.group` error or unpin it? **(c)** Time and memory for 300 tabs in batches of 10, 25 and 50. **(d)** Do `tabGroups.update` title and color work in each browser? **(e)** Does `windows.create({ focused: false })` work from an extension page? | Discard after `onUpdated` has `url`; always use the ID `discard` returns; never group pinned tabs; batch size 20; if `chrome.tabGroups` is missing, one window per folder | extension |
| **S2** | spike-handoff | Desktop-to-extension handoff (Chrome and Edge). Can a local process open `chrome-extension://<ID>/importer.html#pack=<base64url(gzip(json))>` by launching the browser executable with that URL? What is the maximum working size? Does the fragment arrive intact? | File handoff only (see C3). Firefox always uses file handoff, because its extension URLs contain a random per-install UUID. Native messaging is out of v1: it adds a permission prompt and writes into browser config folders | desktop, extension |
| **S3** | spike-format | Survey the Owner's real file (read-only, absolute path in the main checkout). Map keys (no values), count item kinds, answer every **VERIFY** in §7. Return the text of `docs/arc-format.md`; Astra commits it | Rules exactly as written in §7 | core (blocking) |
| **S4** | spike-firefox | Firefox: `tabs.create({ discarded: true, title })`, `tabs.group` + `tabGroups.update` (added in Firefox 138–139), pinned tabs in groups; choose `strict_min_version`. If the agent can't drive Firefox with the extension loaded (for example, through `web-ext`), it writes a 2-minute manual check for the Owner | Pinned tabs and windows only; folders become bookmark folders via the optional `bookmarks` permission | extension |

The install-warning check (formerly S5) needs a browser dialog, so it's an Owner check (§12, item 9).

---

## 9. Tasks by track

### Track A: core + extension

**A0 · Scaffold monorepo** · `astra` · Wave 0
pnpm workspaces, strict TypeScript, Biome, Vitest, `.gitignore` covering §4. Install the full dependency set from §6.1. Turn on Biome's security rules (`noDangerouslySetInnerHtml`, `noGlobalEval`) as errors. Don't let pnpm run dependency install scripts, except for an allowlist of packages that need them, such as esbuild (**VERIFY** the list). Add `stryker.config.mjs` for mutation testing of `packages/core`. Root scripts: `pnpm check` runs typecheck, lint, test, build, check-manifest, check-anon (when `private/` exists) and `pnpm audit --prod` (fails on high or critical); `pnpm e2e` runs Playwright. Copy this plan to `docs/PLAN.md`.
*Acceptance:* `pnpm check` passes on empty packages.

**A1 · Contracts** · `astra` · Wave 0
Write §6.2 and §6.3 as real code, with type guards for the pack format, plus `packages/core/test/builders.ts`.
*Acceptance:* types compile, and every builder can import them.

**A2 · Anonymizer and fixtures** · `core` · Wave 1 (needs S3)
- `scripts/anonymize.ts <private file> > fixtures/real-anon-1.json`: keep the structure; replace IDs with stable hashes, titles with `Title 0042` and URLs with `https://site-0042.test/p` (keep non-http schemes as scheme only, e.g. `arc://x`).
- `scripts/gen-fixture.ts`: synthetic generator for the fixture list in §10.
- `scripts/check-anon.ts`: fails if any title or hostname from the private file appears anywhere in `fixtures/`.
*Acceptance:* all fixtures from §10 exist, and check-anon passes.

**A3 · Parser** · `core` · Wave 1
`parseArcSidebar` and `parsePack` exactly as in §6.2 and §7, plus `assertConserved`. Reject inputs over 100 MB with `too-large`. Follow rule 9 (`Map` lookups, iterative traversal, depth cap).
*Acceptance:* every fixture matches its `fixtures/expected/*.json` snapshot; conservation holds; a property test (fast-check) over generated sidebars shows tabs in = tabs out; 10,000 random JSON inputs never throw; a 5,000-tab file parses in under 200 ms; keys like `__proto__` and `constructor` leave `Object.prototype` untouched; a 100,000-level nested file returns a typed result without a stack overflow.

**A4 · Import planner** · `core` · Wave 1 (tests with builders)
`planImport` rules:
- `spaceMode: 'window'`: one window per selected Space, in Arc order. Favorites (if chosen) become pinned tabs at the start of the first window.
- Pinned tabs at the Space root → native pinned tabs, in order.
- `folderMode: 'groups'`: each folder → a group. Nested folders are named `Parent / Child`, and tabs go to their deepest folder's group. Pinned tabs never go in groups (S1b), so tabs inside folders become unpinned group tabs, and `notes` says how many.
- `today: 'include'` → unpinned tabs after the pinned tabs and groups; `skip` → listed with reason `by-choice`.
- `spaceMode: 'group'` (one window): each Space becomes a group, and folders become `Space / Folder`.
- URLs whose scheme isn't in `openableSchemes`, and empty URLs, are skipped with a reason. They still appear in the bookmarks, archive and CSV exports.
- Group color: nearest of the 9 `GroupColor`s to the Space color by hue; otherwise cycle by index.
- `skipUrls`: exact string match after trimming → skipped with reason `duplicate`.
*Acceptance:* a unit test per rule; conservation: planned + skipped = all tabs in the selected Spaces.

**A5 · Exporters** · `core` · Wave 1 (tests with builders)
- **Bookmarks HTML:** Netscape format (`<!DOCTYPE NETSCAPE-Bookmark-file-1>`, UTF-8 meta, `<DL><p>` nesting). One folder per Space with `Pinned` and `Today` subfolders, plus a `Favorites` folder. Nesting is preserved. Escape `& < > " '` in both text and attributes. Keep every URL as stored.
- **Archive HTML:** one self-contained file with no external requests, inline CSS and JS, a search box and collapsible folders. Only `http`, `https` and `mailto` become links, with `rel="noopener noreferrer"`; other URLs render as plain text. Embed the data as `<script type="application/json">` with `<` written as `<`. Include a CSP meta tag with `default-src 'none'`, allowing only the inline style and script.
- **Pack JSON:** `{ format: 'tab-mover-pack', schemaVersion: 1, createdAt, library }`.
- **CSV:** columns `space,profile,section,folder_path,title,url`. RFC 4180 quoting. Prefix `'` to any cell starting with `=`, `+`, `-`, `@`, tab or carriage return (prevents spreadsheet formula injection).
- **Diagnostic:** key names, item-kind counts, warnings and app version only.
*Acceptance:* round trip (bookmarks HTML → parsed back with happy-dom → same tree); snapshot tests; conservation; a fixture full of attack strings (`<script>`, `"><img onerror=…>`, `</script>`) produces no executable elements when parsed; no title, URL or ID appears in the diagnostic.

**A6 · Extension shell** · `extension` · Wave 1
WXT + React.
- `importer`: a full tab page, not a popup, because popups close when the file picker opens.
- `popup`: one button, "Open Tab Mover".
- `background`: opens the importer on install and on toolbar click.
- Permissions per §3, rule 5. For dev builds only, set a manifest `key` so the extension ID stays stable (S2 and the desktop app need it).
- `scripts/check-manifest.ts` asserts the exact `permissions`, `optional_permissions`, and the absence of `host_permissions`, `content_scripts`, `web_accessible_resources` and `externally_connectable` in every built target.
*Acceptance:* builds and loads unpacked in Chromium; check-manifest passes.

**A7 · Importer flow** · `extension` · Wave 1 (uses `packages/ui`; stubs until `ui-web` lands)
Screens: drop file (with PathHelper) → preview tree with Space checkboxes, counts and warnings → options → run (progress, Cancel) → result (moved and skipped with reasons, "Download skipped list", Undo, Copy diagnostic). Accepts a raw Arc file or a pack, including a pack arriving in the URL fragment (S2). Strip the fragment with `history.replaceState` right after reading it. A fragment pack is treated like a dropped file: preview first, and nothing opens until the user presses Move (rule 10).
*Acceptance:* the flow works on the tiny, typical and special-characters fixtures in Chromium (verified by A10).

**A8 · Executor** · `extension` · Wave 1 (S1 results or defaults)
`executePlan(plan, adapter, { batchSize, signal, onProgress }) → ImportResult`. It runs **in the importer page, not the service worker**, so Manifest V3 worker shutdowns can't interrupt it.
```ts
interface BrowserTabsAdapter {
  readonly supportsGroups: boolean;
  createWindow(): Promise<{ windowId: number; placeholderTabId: number }>; // placeholder closed at the end
  createTab(t: { windowId: number; url: string; title: string; pinned: boolean }): Promise<number>; // Firefox: discarded at create
  unload(tabId: number): Promise<number>;   // Chromium: tabs.discard per S1; returns the current tab ID
  group(windowId: number, tabIds: number[], g: { title: string; color: GroupColor; collapsed: boolean }): Promise<number>;
  closeTabs(tabIds: number[]): Promise<void>;
}
interface ImportResult {
  importId: string; sourceHash: string; startedAt: string; finishedAt?: string;
  created: { windowIds: number[]; tabIds: number[]; groupIds: number[] };
  done: number; failed: { arcId: string; url: string; error: string }[]; cancelled: boolean;
}
```
Save `ImportResult` to `storage.local` after every batch. If one tab fails, record it and continue. Cancel stops after the current batch.
*Acceptance:* unit tests with `FakeAdapter` covering order, pinned tabs, groups, failures and cancel.

**A9 · Undo and re-run** · `extension` · Wave 1
Undo closes the tabs and windows the last import created, after a confirmation that shows the count. If a created window now holds tabs we didn't create, close only our tabs. Tab IDs don't survive a browser restart, so Undo works only within the same browser session, and the UI says so. On re-run, warn if the same `sourceHash` was imported before. The "skip tabs I already have open" option requests the optional `tabs` permission at the moment it's clicked.
*Acceptance:* unit tests, plus the Undo e2e test (A10).

**A10 · End-to-end tests** · `extension` · written in Wave 1, run in Wave 2
- **Extension:** Playwright `launchPersistentContext` on Chromium with `--disable-extensions-except` and `--load-extension`. For the tiny, typical, huge and special-characters fixtures: upload the file, run the import, then evaluate `chrome.windows.getAll({ populate: true })` and `chrome.tabGroups.query({})` in an extension page and compare against `planImport` output (window count, pinned count, group titles and order, tab URLs). Include an Undo test.
*Acceptance:* `pnpm e2e` passes on merged `main` in under 5 minutes.

**A11 · Firefox build** · `extension` · Wave 1 (S4 results or defaults) · P1
`wxt build -b firefox`. A `FirefoxAdapter` creates tabs with `discarded: true` and `title`, and uses groups if S4 confirms support, with a bookmark-folder fallback otherwise. Set `browser_specific_settings.gecko.id` and `strict_min_version`. `wxt zip -b firefox` must also produce the sources zip; write `SOURCE_BUILD.md`, because AMO reviewers rebuild bundled code from source.
*Acceptance:* the Firefox build passes check-manifest; FirefoxAdapter passes the same FakeAdapter-style contract tests; a manual check for the Owner is written if Firefox can't be automated.

**A12 · Store packages** · `astra` · Wave 3
`wxt zip` for Chrome (also used for Edge) and Firefox (plus sources). Put them in `release/` with the listing text from D1.

### Track B: UI + web + site

**B1 · Shared UI** · `ui-web` · Wave 1 (builders data)
The components in §6.3. PreviewTree is virtualized for 1,000+ rows. Keyboard accessible, with labels, in light and dark themes. Add a dev gallery page at `apps/web/dev.html` (not deployed).
*Acceptance:* renders every builder and fixture library; the whole flow works with the keyboard alone.

**B2 · Web converter** · `ui-web` · Wave 1
`convert.html`: drop → preview → download bookmarks HTML, archive HTML, pack JSON or CSV, plus Copy diagnostic. CSP meta: `default-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'`. A visible note says the page is technically blocked from sending data.
*Acceptance:* a Playwright test in `apps/web/e2e/` loads `convert.html`, picks a fixture, downloads each format, and asserts **zero network requests after page load** (`page.on('request')`).

**B3 · Landing page** · `site` · Wave 1
`index.html`: hero with a countdown to Arc's shutdown, how it works in 3 steps, a supported-browsers grid, a dated factual comparison table, a privacy section, download buttons (placeholders until store URLs exist), FAQ and a footer (privacy policy, source link). No third-party scripts or fonts (self-host fonts).
*Acceptance:* Lighthouse performance and accessibility ≥ 95.

**B4 · Guides** · `site` · Wave 1
- Per-browser import guides: Chrome, Brave, Edge, Vivaldi, Opera, Firefox, and Safari (File → Import From → Bookmarks HTML File). **VERIFY** how Opera users install from the Chrome Web Store.
- **Password guide** for each browser: in Arc, Settings → Passwords → Export to CSV; in the new browser, Settings → Passwords → Import; then delete the CSV. State plainly that Tab Mover never sees passwords.
- "Where's my Arc file?" for macOS and Windows.
- "What isn't moved": history (use the browser's own import), passwords (guide), cookies and logins, Easels, Boosts and Notes.
Screenshots are marked placeholders with a shot list for the Owner.

**B5 · Privacy policy** · `site` · Wave 1
Plain language: no data collected, all processing local, each permission and why. Both stores require it.

### Track C: desktop

**C1 · Scaffold Tauri v2** · `desktop` · Wave 1
The React front end reuses `core` and `ui`. Capabilities: read access only to the Arc paths in §7 and files picked in a dialog; saving only through the save dialog; opening only browser executables. CSP with `connect-src` limited to Tauri IPC.

**C2 · Rust commands** · `desktop` · Wave 1
- `find_arc_files()`: the macOS path, or a glob over `%LOCALAPPDATA%\Packages\TheBrowserCompany.Arc_*\LocalCache\Local\Arc\StorableSidebar.json`. Returns path, size and modified time.
- `read_arc_file(path)`: only for paths returned by `find_arc_files` or picked in a dialog. Canonicalize first (resolve `..` and symlinks), then compare against the allowlist.
- `detect_browsers()`: known install locations on macOS and Windows.
- `extension_installed(browser)`: look for the extension ID folder under each profile's `Extensions/`. If unknown, the UI offers both "Install extension" and "I already have it".
- `open_in_browser(browser, url)`: launches the detected executable directly, with no shell, and accepts only the URLs allowed by rule 11.
- Keep a table of extension IDs per store (Chrome Web Store and Edge Add-ons assign different IDs; use placeholders until the stores assign them).
- **VERIFY** whether macOS 15+ shows a privacy prompt when reading Arc's folder.
*Acceptance:* Rust unit tests for path discovery, the read allowlist (including `..` and symlink attempts) and launcher URL validation; `cargo clippy` clean.

**C3 · App flow** · `desktop` · Wave 1 (S2 results or defaults)
Auto-find → preview (same counts as the extension) → actions:
- **Send to browser:** if S2 worked, open the importer with the pack in the URL fragment (one click). Otherwise, and always for Firefox, save `tab-mover-pack.json` to Downloads, open the importer (or the store page if the extension isn't installed) and show "drop the file the app just saved".
- **Save bookmarks for Safari**, then open the Safari guide.
- **Save Arc Archive** to a chosen folder (`archive.html` + `pack.json`).
- **Save CSV.**
*Acceptance:* on this Mac, the dev build finds the file automatically and its preview counts match the extension's for the same file.

**C4 · macOS build** · `astra` · Wave 3 · P1
Universal binary (arm64 + x86_64) and DMG. If the Owner's Apple Developer credentials are present in the environment, sign and notarize through the Tauri bundler; otherwise produce an unsigned build and list signing in the Owner's to-do.

**C5 · Windows build** · `astra` · Wave 3 · P1
Build only if a Windows machine or VM is available; otherwise list it in the Owner's to-do. If unsigned, the guide documents the SmartScreen warning.

### Track D: launch kit

**D1 · Copy** · `launch` · Wave 1
Product Hunt (name, tagline of 60 characters or fewer, description of 260 or fewer, first comment in the Owner's voice, topics), X thread, Reddit posts (r/ArcBrowser, r/browsers, r/macapps; follow each subreddit's self-promotion rules), Show HN post, and store listings (short and long description, single-purpose statement, permission justifications from §11, data disclosure: "does not collect").

**D2 · Asset scripts** · `launch` · Wave 1
Shot list for five Product Hunt gallery images (1270×760) and Chrome Web Store screenshots (1280×800), a 30-second demo script and a before/after GIF script. The Owner records them.

**D3 · Final pass** · `astra` · Wave 3
Update all copy with the final name, real features as built, and placeholders for store URLs.

### Track R: design and security reviews in Wave 0

**R0 · Threat model and security requirements** · `threat-modeler` · Wave 0
Draft `docs/security/threat-model.md` following §10.4: assets, attackers, every entry point (file drop, pack, URL fragment, desktop IPC, release downloads) and the control for each, mapped to rules 1–11 and to the task that builds it. Draft `SECURITY.md`. Both come back as text in the handoff, and Astra commits them. Astra also adds any new requirement to the affected briefs before Wave 1 starts.
*Acceptance:* every entry point has a named control and a named test owner.

**R1 · Contract design review** · `design-reviewer` · Wave 0
Review the §6.2–6.3 code before the freeze. Can every task be built against it without changes? Can unknowns be represented (null versus missing)? Are all expected errors typed? Is anything ambiguous for agents working in parallel? Astra applies accepted changes, then freezes the contracts.
*Acceptance:* a written sign-off, or the list of changes Astra applied.

---

## 10. Verification and review

### 10.1 When reviews happen
- **Design, in Wave 0:** R1 reviews the contracts before they freeze, and R0 sets the security requirements before any feature code is written.
- **Every merge:** `pnpm check` (typecheck, lint including Biome's security rules, unit and property tests, all builds, check-manifest, check-anon, dependency audit), plus `pnpm e2e` for `extension` and `ui-web`, plus Astra's scope and diff review (§2.7).
- **Wave 2:** three independent review branches (§10.2–10.4) on merged `main`.
- **Evidence rule:** every review report lists the checks actually run, with commands and results, and states plainly what was not verified. "Looks fine" without evidence is not a pass.
- **Roles:** each review agent covers every role in its table itself, or hands roles to helpers inside its own copy if the platform allows.

### 10.2 Working verification ("does it actually work?") · `verify`
Unit tests alone don't prove anything here. Each row needs evidence from a real run.

| Role | Checks | Evidence |
|---|---|---|
| `e2e-runner` | `pnpm e2e` on merged `main`: extension import for the tiny, typical, huge and special-characters fixtures; Undo; web converter downloads with zero network requests | Playwright report; browser state dumps (window, tab and group JSON) compared with `planImport` output |
| `browser-matrix-bot` | The same import in every installed Chromium browser: Playwright's bundled Chromium stands in for Chrome (recent branded Chrome ignores `--load-extension`; **VERIFY**), plus Brave, Edge, Vivaldi and Opera via `executablePath` if installed; Firefox via `web-ext` if it can be automated | A state dump for each browser. Anything that can't be automated becomes a precise manual step in §10.8 |
| `fault-injector` | Cancel mid-import; close the importer page mid-import, reopen it and check the saved result; adapter failures on random tabs; Undo after a partial import; every malformed fixture (`not-arc`, `truncated`, `corrupt`, `hostile`) in every surface; a 50,000-tab file; a file over 100 MB (expect `too-large`) | A pass/fail table, and a regression test for each failure found |
| `desktop-smoke` | Dev build on this Mac: auto-find, preview counts equal the extension's for the same file, each export opens correctly, Send to browser per the S2 result. Reads the real file read-only and never writes into Arc's folder | Command log and counts (no titles or URLs) |

**Pass rule:** every P0 row passes, conservation holds everywhere, and the performance budgets (§10.7) are met.

### 10.3 Software engineering review · `engineering`

| Role | Reviews |
|---|---|
| `code-reviewer` | `/code-review` on each builder's full diff: correctness, edge cases, error handling, resource cleanup (listeners, ports, timers), and async races in the executor (cancel during a batch, Undo during an import) |
| `architecture-reviewer` | Layering rule, checked mechanically on imports (core imports nothing platform-specific); one owner per responsibility (only core parses Arc JSON; no app re-parses it); contracts used exactly as defined; expected failures returned as `Result`, not thrown; no duplicated logic across apps; no dead code, unused exports or leftover stubs; module boundaries match §6.1 |
| `test-auditor` | Tests check behavior, not implementation details; no skipped, `.only` or weakened tests (diff each test file against its first version); snapshot changes reviewed, not blindly accepted; every acceptance criterion in §9 maps to a test; mutation testing (StrykerJS) on `packages/core` scores at least 80% for `parse`, `plan` and `export` |

**Pass rule:** no open correctness findings; every Medium finding fixed or accepted by the Owner in writing.

### 10.4 Cybersecurity review · `security`

**Threat model** (written by `threat-modeler` in Wave 0, re-checked here):
- **Assets:** the user's tab URLs and titles (URLs can contain tokens or private document links), the user's browser session (unwanted tabs opening), and the user's file system (desktop app).
- **Attackers:** a malicious or corrupted Arc file or pack shared online ("import my setup"); a local process that launches the importer URL with a crafted fragment; a compromised dependency; a tampered release download.
- **Out of scope:** an attacker who already controls the user's account or browser.

| Role | Checks |
|---|---|
| `appsec-reviewer` | `/security-review` on the whole codebase. Walk through every threat-model entry and confirm its control exists and is tested. Built manifests: permissions exactly per rule 5; no host permissions, content scripts, `web_accessible_resources` or `externally_connectable`. CSP on the extension, converter, archive HTML and desktop app. No `eval` or HTML injection with data anywhere in our code. Logs and error messages contain no titles or URLs |
| `attack-tester` | Writes and runs hostile-input tests: XSS payloads in every field rendered by the extension, converter, desktop app and archive HTML; prototype-pollution keys (`__proto__`, `constructor`, `prototype`); 100,000-level nesting; huge strings; invalid UTF-16; `javascript:`, `data:`, `file:` and `chrome://` URLs (never opened as tabs, never clickable in the archive); CSV formula injection; a crafted URL-fragment pack (must stop at preview); desktop IPC abuse (paths outside the allowlist, `../` and symlink tricks, launcher arguments with injected flags or other schemes). Each confirmed issue gets a regression test |
| `supply-chain-auditor` | `pnpm audit --prod`; lockfile pinned and committed; install scripts limited to the allowlist; licenses compatible with open-sourcing (`pnpm licenses list`; flag GPL and AGPL); no secrets in the repo or its history (gitleaks if already installed, otherwise a scripted pattern scan; don't install system tools without the Owner's approval); built zips contain only expected files (no source maps exposing local paths, no `.env`, nothing from `private/`); `cargo audit` for the Rust side if available |

Outputs: `docs/reviews/security.md` (findings with severity, reproduction steps and fix status) and `SECURITY.md`.

### 10.5 Severity and release blockers

| Severity | Examples | Rule |
|---|---|---|
| Critical | Data leaves the device; code runs from a crafted file; the desktop app reads or launches outside its allowlist | Blocks release |
| High | Stored XSS in the archive or an extension page; a tab lost without a skip reason; tabs open without a click | Blocks release |
| Medium | Wrong order or group name; a misleading message; a missing regression test | Fix, or the Owner accepts it in writing |
| Low | Style, naming, minor UX | Listed in the final report |

Any failed P0 working check also blocks release. Only findings confirmed by `finding-verifier` count; unconfirmed ones are reported as unconfirmed.

### 10.6 Fixtures (each with an expected snapshot)

| Fixture | Covers |
|---|---|
| `tiny` | 1 Space, 3 tabs |
| `typical` | 4 Spaces, ~100 tabs, folders, Favorites, Today tabs |
| `huge` | ~600 tabs, 40 folders (generated) |
| `deep` | 8 levels of nested folders |
| `untitled` | Missing titles on a Space, a folder and a tab |
| `special-chars` | `& < > " '`, emoji, right-to-left text, very long titles, `</script>`, attack strings |
| `global-last` | `global` is the last container |
| `empty-spaces` | Spaces with no tabs |
| `split-easel-notes` | Unsupported and flattened kinds |
| `corrupt` | Orphans, a parent cycle, wrong `childrenIds` |
| `profiles` | Spaces in two Arc profiles |
| `schemes` | `arc://`, `chrome://`, `file://`, `javascript:`, empty URL |
| `duplicates` | The same URL in several places |
| `windows` | Windows variant (**VERIFY** differences; collect real diagnostics after launch) |
| `not-arc` / `truncated` | Wrong JSON shape; cut-off file |
| `hostile` | `__proto__`/`constructor` keys, 100,000-level nesting, huge strings, crafted schemes (generated at test time, not committed) |
| `real-anon-1` | The Owner's anonymized file |

### 10.7 Performance budgets

Parse + plan 5,000 tabs in under 300 ms. Importing 300 tabs must keep the browser responsive (measured in S1c).

### 10.8 Manual matrix (the Owner, about 1 hour, with the real file, after the build)

Also includes every step `browser-matrix-bot` couldn't automate.

| Target | Check |
|---|---|
| Chrome, Brave, Edge | Windows per Space, pinned order, group names and colors, Today option, Undo |
| Vivaldi, Opera | Same, or a clean fallback with an explanation |
| Firefox | Pinned tabs, groups or bookmark fallback, unloaded tabs |
| Safari | Bookmarks import keeps nested folders |
| Web converter | All four downloads; works with the network off after load |
| Mac app | Auto-find, Send to browser, Safari export, Archive |
| Windows app | Same |

---

## 11. Release checklist

- **Chrome Web Store** ($5 one-time account): listing, screenshots, privacy tab with a single-purpose statement and permission justifications (`tabGroups`: name and color groups to mirror Arc folders; `storage`: remember the last import for Undo; optional `tabs`: detect already-open tabs when the user asks to skip duplicates; optional `bookmarks`: bookmark mode), data disclosure "does not collect", privacy policy URL.
- **Edge Add-ons** (free Partner Center account): the same zip and listing.
- **Firefox AMO** (free): zip, sources zip, `SOURCE_BUILD.md`.
- **Brave and Vivaldi** install from the Chrome Web Store; the guides say so.
- **macOS:** signed, notarized DMG. **Windows:** installer, signed or documented as unsigned.
- **Web:** static hosting, once the Owner decides on a publishing account.
- Version `1.0.0` everywhere, plus `CHANGELOG.md`.

---

## 12. Owner inputs

| # | Needed | Blocks |
|---|---|---|
| 1 | Copy the Arc file into `private/` in the main checkout (or allow Astra to copy it) | Wave 0 (S3), fixtures |
| 2 | Final name + domain | Final copy, privacy policy URL (placeholders until then) |
| 3 | Chrome Web Store ($5), Edge Partner Center and Firefox AMO accounts | Store submission |
| 4 | Apple Developer Program (check Apple's current price), or ship the Mac app later | Signed, notarized Mac app |
| 5 | Windows: signed or unsigned; a Windows machine or VM | Windows app |
| 6 | A non-personal publishing account for GitHub and hosting | Push, CI, deploy, open-sourcing the core |
| 7 | Everything free plus a tip link (default), or a paid tier | Scope |
| 8 | Landing-page analytics: none (default) or a cookieless page-view counter. The converter never gets analytics | Site build |
| 9 | Install-warning check: drag the packed `.crx` onto `chrome://extensions` in Developer mode, and confirm there's no "Read your browsing history" warning | Store listing text |
| 10 | Run the manual matrix (§10) and record the demo | Launch |

---

## 13. Risks

| Risk | Response |
|---|---|
| The Arc format differs on some machines (Windows, older versions) | Tolerant parser; the copy-diagnostic button turns user reports into new fixtures |
| `tabs.discard` misbehaves | Smaller batches; advise Chrome's Memory Saver; note it in the result screen |
| Store review is slow | Release the web converter and desktop app first; the landing page marks store links as pending |
| Pinned tabs can't live in groups | The result report says so ("4 pinned tabs inside folders became group tabs") |
| Vivaldi or Opera ignore tab groups | Fall back to windows or bookmarks; the matrix row confirms |
| The S2 handoff fails | The file handoff is always built |
| Merge conflicts between agents | Strict path ownership (§2.2), Astra-only root files and lockfile, rolling integration |
| An agent games a test | Briefs forbid weakening tests; `test-auditor` diffs test files and runs mutation testing; `e2e-runner` reruns everything on merged `main` |
| Reviewers report false alarms | `finding-verifier` reproduces each finding before anyone fixes it |
| Apple account not ready | Ship the Mac app later; the web converter and extension cover macOS users |

---

## 14. Definition of done

- `pnpm check` and `pnpm e2e` pass on `main`.
- The working, engineering and security reviews (§10.2–10.4) sign off with evidence: no open Critical or High findings, and every Medium is fixed or accepted by the Owner.
- `docs/reviews/{verify,engineering,security}.md`, `docs/security/threat-model.md` and `SECURITY.md` are complete.
- The anonymized real fixture (`real-anon-1`) passes conservation through the planner and every exporter.
- Built manifests contain only the allowed permissions, and the converter makes zero network requests (both tested).
- `release/` contains the Chrome, Edge and Firefox zips (plus Firefox sources), the web build, the macOS build, and the Windows build if one was possible.
- Landing page, guides and password guide built.
- Launch kit written, with placeholders only for the store URLs and the final name.
- `docs/decisions.md` and `docs/arc-format.md` complete.
- Astra's final report (§2.8) delivered, including the Owner's to-do list from §12.

---

## References

- [Chrome `tabs` API](https://developer.chrome.com/docs/extensions/reference/api/tabs): `create` options (no unloaded option), `discard`, `group`
- [Chrome `permissions` API](https://developer.chrome.com/docs/extensions/reference/api/permissions): which permissions can be optional
- [MDN `tabs.create`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create): Firefox `discarded` and `title`
- [Mozilla: WebExtensions support for tab groups](https://blog.mozilla.org/addons/2025/04/30/webextensions-support-for-tab-groups/) and [MDN `tabGroups`](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups)
- [WXT: multiple browsers](https://wxt.dev/guide/key-concepts/multiple-browsers.html)
- [arc-export](https://github.com/ivnvxd/arc-export): source of the file-structure notes in §7
