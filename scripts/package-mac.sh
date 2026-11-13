#!/bin/sh
# Builds the self-download disk image: the Mac app, the unpacked Chromium extension,
# the Firefox add-on and a short read-me. Run after `pnpm check`, `pnpm --filter
# @handoff/extension zip` and `pnpm --filter @handoff/desktop bundle:mac`.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
version=$(node -p "require('$root/apps/desktop/src-tauri/tauri.conf.json').version")
app="$root/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/macos/Handoff.app"
chromium="$root/apps/extension/.output/chrome-mv3"
firefox="$root/apps/extension/.output/handoffextension-$version-firefox.zip"
for path in "$app" "$chromium/manifest.json" "$firefox"; do
	[ -e "$path" ] || { echo "Missing $path" >&2; exit 1; }
done
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
ditto "$app" "$stage/Handoff.app"
ditto "$chromium" "$stage/Handoff Extension"
cp "$firefox" "$stage/Handoff for Firefox.zip"
ln -s /Applications "$stage/Applications"
cat > "$stage/Read me first.txt" <<'TXT'
Handoff

1. Drag Handoff into Applications and open it.
2. Optional, for tab groups: copy the "Handoff Extension" folder somewhere
   permanent (for example your Documents folder). In Chrome, Brave, Edge or
   Vivaldi open the Extensions page, turn on Developer mode, choose
   "Load unpacked" and pick that folder. Do this in each profile that should
   get groups. The app can open tabs in any profile without it.
3. Firefox: open about:debugging, choose This Firefox, then
   "Load Temporary Add-on" and pick "Handoff for Firefox.zip".
   Firefox removes it when it restarts.

Handoff never reads your passwords, cookies or history.
TXT
mkdir -p "$root/release"
out="$root/release/handoff-$version-macos-universal.dmg"
hdiutil create -volname Handoff -srcfolder "$stage" -format UDZO -ov "$out" >/dev/null
echo "$out"
