#!/bin/bash
# Installs the latest Handoff release on macOS from Terminal:
#   curl -fsSL https://raw.githubusercontent.com/paarths-collab/handoff/main/scripts/install-mac.sh | bash
# Downloads made with curl are not quarantined, so macOS opens the app without the
# "Apple could not verify" prompt. The disk image is checked against the release's
# SHA256SUMS.txt before anything is installed.
#
# For testing a build that is not released yet:
#   HANDOFF_DMG_URL=<url or file://path> HANDOFF_SHA256=<hex> bash install-mac.sh
set -euo pipefail

repo="paarths-collab/handoff"
fail() { echo "Handoff install failed: $*" >&2; exit 1; }
[ "$(uname -s)" = Darwin ] || fail "this installer is for macOS."

work=$(mktemp -d)
mount="$work/volume"
cleanup() {
	hdiutil detach "$mount" -quiet 2>/dev/null || true
	rm -rf "$work"
}
trap cleanup EXIT

url="${HANDOFF_DMG_URL:-}"
expected="${HANDOFF_SHA256:-}"
if [ -z "$url" ]; then
	echo "Finding the latest Handoff release…"
	release=$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest") ||
		fail "could not reach GitHub releases."
	url=$(printf '%s' "$release" | grep -o '"browser_download_url": *"[^"]*-macos-universal\.dmg"' |
		head -1 | sed 's/.*"\(https[^"]*\)"$/\1/')
	sums=$(printf '%s' "$release" | grep -o '"browser_download_url": *"[^"]*/SHA256SUMS\.txt"' |
		head -1 | sed 's/.*"\(https[^"]*\)"$/\1/')
	[ -n "$url" ] && [ -n "$sums" ] || fail "the latest release has no macOS download."
	expected=$(curl -fsSL "$sums" | grep -- '-macos-universal\.dmg$' | cut -d' ' -f1)
fi
[[ "$expected" =~ ^[0-9a-f]{64}$ ]] || fail "no valid SHA-256 checksum for the download."

echo "Downloading ${url##*/}…"
curl -fL --progress-bar "$url" -o "$work/handoff.dmg" || fail "the download did not finish."
actual=$(shasum -a 256 "$work/handoff.dmg" | cut -d' ' -f1)
[ "$actual" = "$expected" ] || fail "the download does not match its checksum. Nothing was installed."

hdiutil attach "$work/handoff.dmg" -nobrowse -readonly -quiet -mountpoint "$mount" ||
	fail "could not open the disk image."
[ -d "$mount/Handoff.app" ] || fail "the disk image does not contain Handoff.app."

target=/Applications
[ -w "$target" ] || { target="$HOME/Applications"; mkdir -p "$target"; }
if pgrep -x handoff >/dev/null; then
	echo "Closing the running Handoff…"
	osascript -e 'quit app "Handoff"' 2>/dev/null || true
	sleep 1
fi
rm -rf "$target/Handoff.app"
ditto "$mount/Handoff.app" "$target/Handoff.app"
# Clear any quarantine flag left from an earlier browser download of the same app.
xattr -dr com.apple.quarantine "$target/Handoff.app" 2>/dev/null || true

extras="$HOME/Handoff Extras"
mkdir -p "$extras"
rm -rf "$extras/Handoff Extension"
ditto "$mount/Handoff Extension" "$extras/Handoff Extension"
cp -f "$mount/Handoff for Firefox.zip" "$mount/Read me first.txt" "$extras/"

echo "Installed Handoff in $target. The optional browser extensions are in $extras."
open "$target/Handoff.app"
