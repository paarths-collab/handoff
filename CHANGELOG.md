# Changelog

## 1.0.2

- Show each browser's logo on the destination tiles.
- Use the Handoff mark for the Mac, Windows and extension icons.
- Add a one-line Terminal installer for macOS that verifies the release checksum and avoids the Gatekeeper prompt.
- Security: pin every CI Action to a commit SHA and keep the release job free of third-party Actions; leave script-capable links out of bookmark exports; cap imports at 1,000 Spaces, 100,000 tabs and folders and 64 KiB links, and moves at 5,000 tabs; create Mac archives through one handle to the chosen folder.
- Release under the MIT License.

## 1.0.1

- Open the full preview as soon as a sidebar is loaded.
- Make **Send to browser** the main step after the preview: choose a browser, a profile for each Space, open, then keep folders, use the extension for tab groups, recover archived tabs and move passwords.
- Offer Safari on Mac, through a bookmarks import.
- Fix the Windows download build's checksum step.

## 1.0.0

- Read an Arc sidebar or Handoff pack and preview Spaces, Favorites, pinned and Today tabs. Inspect skipped entries and structural warnings before moving.
- Export nested bookmarks HTML, a searchable offline archive, a versioned JSON pack and CSV. The converter processes the file on device.
- Import into Chromium windows and tab groups. Choose Spaces and folder handling, optionally detect duplicates, create bookmarks, cancel a move or undo the last import within the same browser session.
- Add a Firefox build with background-tab creation and capability-based group handling.
- Add a Tauri desktop frontend for local sidebar discovery, native file picking, exports and pack-file handoff.
- Include per-browser migration guides, privacy disclosures and an owner-operated manual verification checklist.
- Open Spaces directly in chosen Chrome, Brave, Edge or Vivaldi profiles from the desktop app, without installing the extension in each profile. Save a bookmarks file per profile to keep nested folders.
- Keep pinned tabs and Favorites as tab groups by default, and optionally keep a nested bookmarks copy alongside opened tabs.
- Add a guided password move from Arc to each browser profile.
- Ship as a self-download: the Mac app and the extension in one disk image. The extension keeps a fixed ID when loaded unpacked.
