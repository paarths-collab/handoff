# Run on Windows with Rust MSVC and Visual Studio C++ build tools installed.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Build the Windows installer on Windows.' }
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
$stage = $null
try {
    pnpm --filter '@handoff/extension' zip
    if ($LASTEXITCODE -ne 0) { throw 'Extension build failed.' }
    pnpm --filter '@handoff/desktop' bundle:windows
    if ($LASTEXITCODE -ne 0) { throw 'Windows app build failed.' }
    $version = (Get-Content 'apps/desktop/src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json).version
    $bundle = 'apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis'
    $installers = @(Get-ChildItem $bundle -Filter '*.exe')
    if ($installers.Count -ne 1) { throw 'Expected one NSIS installer.' }
    $stage = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
    New-Item $stage -ItemType Directory | Out-Null
    Copy-Item $installers[0].FullName (Join-Path $stage 'Handoff-Setup.exe')
    Copy-Item 'apps/extension/.output/chrome-mv3' (Join-Path $stage 'Handoff Extension') -Recurse
    Copy-Item "apps/extension/.output/handoffextension-$version-firefox.zip" (Join-Path $stage 'Handoff for Firefox.zip')
    @'
Handoff for Windows (x64)

1. Extract this ZIP, run Handoff-Setup.exe, then open Handoff from Start.
   The installer sets up Microsoft WebView2 if it is missing (internet required).
2. Let Handoff find Arc, or choose StorableSidebar.json manually.
3. Preview your Spaces, choose a destination browser and assign profiles.
   Open each Space in its own window or save bookmarks and other exports.
4. Optional tab groups: copy "Handoff Extension" somewhere permanent.
   In each Chromium profile, open Extensions, enable Developer mode,
   choose "Load unpacked" and select that folder.
5. Firefox: about:debugging > This Firefox > Load Temporary Add-on.
   Select "Handoff for Firefox.zip". Firefox removes it on restart.

Handoff never reads passwords, cookies or history. Your sidebar stays local.
Opening tabs contacts those websites through your browser.
'@ | Set-Content (Join-Path $stage 'Read me first.txt') -Encoding utf8
    New-Item 'release' -ItemType Directory -Force | Out-Null
    $out = Join-Path $root "release/handoff-$version-windows-x64.zip"
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -Force
    # .NET hashing works even when Windows PowerShell inherits PowerShell 7's module path
    # and cannot load Get-FileHash, as on GitHub's Windows runners.
    $sha = [Security.Cryptography.SHA256]::Create()
    $file = [IO.File]::OpenRead($out)
    try { $hash = [BitConverter]::ToString($sha.ComputeHash($file)).Replace('-', '') }
    finally { $file.Dispose(); $sha.Dispose() }
    Write-Output "SHA256: $hash"
    Write-Output $out
} finally {
    if ($stage -and (Test-Path $stage)) { Remove-Item $stage -Recurse -Force }
    Pop-Location
}
