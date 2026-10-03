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

On PowerShell systems that block `npm.ps1`, use `npm.cmd` instead of `npm`.
The build bundles the content script as a single IIFE and the service worker as
ESM. It outputs the unpacked extension in `dist/`.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `dist` folder.
4. Open Mack's **Details → Extension options** and paste your temporary Anthropic key.
5. Open `https://www.gov.uk/`, then click Mack in the Extensions menu or toolbar.

After editing files, run `npm run build`, click **Reload** on Mack's extension
card, and refresh the website tab.

## Files

- `extension/manifest.json`: permissions and service-worker entry point.
- `extension/options.html`: extension-owned session credential setup.
- `extension/src/`: TypeScript entry points and role modules.
- `shared/contracts.ts`: Contract v1 and runtime validation.
- `docs/`: product requirements and role responsibilities.

The action now injects the content entry point on GOV.UK. At the contexts stage,
that entry is still empty; subsequent platform wiring mounts Role 3's UI. Voice
requires Role 1's controller and a tested audio context.

Chrome setup reference: [Hello World extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
