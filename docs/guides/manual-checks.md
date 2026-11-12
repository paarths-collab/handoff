# Manual release checks

Start with the synthetic typical fixture in a disposable browser profile. Use a private copy of the real sidebar only after the owner chooses to run the compatibility check. Record counts, versions and pass/fail results. Keep real titles, URLs and screenshots out of public reports.

| Target | Steps and expected outcome |
|---|---|
| Chrome, Brave, Edge | Open the importer and select a file. Before Move, the preview has the expected Spaces and no destination tabs exist. Move, compare window count, pinned order, folder group names/colors and Today selection. Add an unrelated tab to an imported window. Undo closes only owned tabs. |
| Vivaldi, Opera | Repeat the Chromium checks. If grouping is unavailable, verify the stated fallback and use the bookmarks guide. |
| Firefox 140+ | Load the Firefox package temporarily from about:debugging in a fresh profile. Import tiny. Check that the pinned tab is outside groups, a folder group has the intended title/color, and activating a discarded tab loads its URL. Undo. Test optional bookmark mode. |
| Safari | Download bookmarks HTML, import via the File menu and expand nested folders. Check the recorded tab count and ordering. |
| Web | Load the converter, disable networking, choose a file, download four formats and reopen them. Re-import the pack. Check the preview and skipped counts. |
| macOS | Launch the desktop app. With owner permission, check native discovery, any OS privacy prompt, and preview counts against the same file in the extension. Save each output. Open the archive and drag the saved pack into the browser importer. |
| Windows | Build on Windows, repeat the macOS workflow and validate the package-directory discovery path. For an unsigned installer, SmartScreen may display an unknown publisher warning. |
| Store install | Drag a packed test CRX onto chrome://extensions in Developer mode, if supported. Record the actual permission dialog. Check that optional URL access is requested only on duplicate detection. |

Finish by recording the demo with a synthetic profile, choosing the final product name/domain, adding assigned store IDs and URLs, and supplying signing and publishing accounts.
