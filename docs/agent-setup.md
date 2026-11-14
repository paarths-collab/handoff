# Set up Handoff with a coding agent

Use Claude Code, Codex or Cursor to run Handoff locally on macOS or Windows.

1. Clone the repository:

   ```sh
   git clone https://github.com/paarths-collab/handoff.git
   cd handoff
   ```

   Alternatively, choose **Code → Download ZIP** on GitHub and extract the folder.
2. Open the cloned or extracted `handoff` folder in your coding agent. Start a task in that folder so it can read the repository instructions.
3. Copy the entire [setup prompt](setup-prompt.txt) and paste it into the agent. The same prompt works with all three tools.
4. Follow the agent's explanation of any missing platform prerequisites. It should run `pnpm install --frozen-lockfile` and launch the native app with `pnpm --filter @handoff/desktop exec tauri dev`.
5. In Handoff, choose a detected Arc file or select your sidebar or pack. Switch between compact and expanded views, review the actual contents, and confirm what to move or export.

For the optional extension, the agent builds `apps/extension/.output/chrome-mv3` and explains how to load or reload it in the profiles you choose. The extension previews a file you select or a pack received from Handoff.

The prompt keeps setup separate from migration: the agent prepares the app, while you select the file and confirm browser changes. It does not authorize uploading sidebar data, creating commits or publishing the repository.

The website's **Set up with a coding agent** section provides a **Copy setup prompt** button. For local source prerequisites and checks, see the [README](../README.md).
