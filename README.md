# Mack

A Manifest V3 Chrome extension. Product requirements live in `docs/CONTEXT.md`.

## Build and check

Use Node 22.12 or newer. From this folder:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm test` runs Vitest and then Role 2's `node:test` suite through `tsx`
(`npm run test:guidance`). `npm run check` runs typecheck, tests, and build.
On PowerShell systems that block `npm.ps1`, use `npm.cmd` instead of `npm`.
The build bundles the content script as a single IIFE and the service worker as
ESM. It outputs the unpacked extension in `dist/`.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `dist` folder.
4. Open Mack's **Details → Extension options** and save your Gemini key
   (stored only in `chrome.storage.session`; never put a key in the repo).
5. Open `https://www.uhc.com/` or `https://www.libertymutual.com/`, then click
   Mack in the Extensions menu or toolbar.

After editing files, run `npm run build`, click **Reload** on Mack's extension
card, and refresh the website tab.

## Files

- `extension/manifest.json`: permissions and service-worker entry point.
- `extension/options.html`: extension-owned session credential setup.
- `extension/src/`: TypeScript entry points and role modules.
- `shared/contracts.ts`: Contract v1 and runtime validation.
- `docs/`: product requirements and role responsibilities.

Clicking the action on a supported site injects the content script, which extracts the
page, mounts Role 3's UI, generates the screen through the service-worker model
client, and routes typed requests to Role 2's resolver (via a temporary adapter
in `extension/src/platform/guidance-adapter.ts` until Role 2 migrates to
Contract v1). Voice requires Role 1's controller and a tested audio context.

`extension/popup.*` and `extension/assets/cursor-*` arrived with Role 2's branch
and are not wired: the manifest uses action click activation, which a
`default_popup` would disable. They are not copied into `dist/`.

Chrome setup reference: [Hello World extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
