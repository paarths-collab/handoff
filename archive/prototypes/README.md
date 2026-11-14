# Archived Handoff prototypes

These design explorations are preserved as references. They are outside `apps/` and are not application entry points, production build inputs or the supported setup workflow.

| Archive | Original location | Current replacement |
| --- | --- | --- |
| `version-a/` | `apps/web/versions/a.html` and its terminal/ASCII styles and scripts | The final landing page in [handoff-website](https://github.com/paarths-collab/handoff-website) |
| `desktop/` | `apps/web/versions/handoff-desktop/` | `packages/ui/src/workspace.tsx`, used by the real desktop app and extension |
| `storyboard/` | `apps/web/versions/handoff-storyboard/` | Design reference only; the active product film is in `apps/film/` |
| `liquid-glass-logo/` | `apps/web/public/handoff-logo.html` | Archived logo-animation experiment; the active logo assets live in `apps/film/public/` and `packages/ui/src/assets/` |

The prototypes may contain synthetic data and outdated instructions. Do not use them for migration or follow their links as current product guidance. The source and assets are retained for reference rather than maintained as supported applications. React/TypeScript previews require their former build environment or adapting to the current workspace.

The Figtree font used by these references and its Open Font License are in `assets/`. Original source notices in the archived logo experiment are retained. Current font licenses and browser-logo notices are retained in `apps/film/public/` and the separate website repository; the shared UI font license lives beside its font.

The supported website now lives in the separate private [handoff-website](https://github.com/paarths-collab/handoff-website) repository. Read the repository README and `docs/agent-setup.md` for installation and setup.
