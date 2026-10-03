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
4. Open Mack from the browser's Extensions menu to see the popup.

After editing files, run `npm run build`, click **Reload** on Mack's extension
card, and refresh the website tab.

## Files

- `extension/manifest.json`: extension metadata and popup entry point.
- `extension/popup.html`: static starter popup.
- `extension/popup.css`: popup styles.
- `docs/`: product requirements and role responsibilities.

The initial toolchain stage still shows the starter popup. Platform wiring is a
separate change; voice requires Role 1's controller and a tested audio context.

Chrome setup reference: [Hello World extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
