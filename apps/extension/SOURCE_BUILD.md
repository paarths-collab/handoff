# Rebuilding Handoff

Use Node 26 and pnpm 11.25.0. Extract the source archive into an empty directory. From its root run:

```sh
pnpm install --frozen-lockfile
pnpm --filter @handoff/extension exec wxt build -b firefox
```

The add-on is in `apps/extension/.output/firefox-mv3`. The Chromium target uses the same command with `-b chrome`. To test Firefox, open `about:debugging`, select This Firefox, choose Load Temporary Add-on and select the built manifest. Open the importer, drop a tiny synthetic sidebar with pinned, folder and Today tabs, and inspect its preview. Click Move. Verify the URLs, pinned order, group title and color, and load a background tab. Add one new tab to the imported window, click Undo and confirm the added tab remains.
