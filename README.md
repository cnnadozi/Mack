# Mack

A bare-bones Manifest V3 Chrome extension with a toolbar popup.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `extension` folder.
4. Open Mack from the browser's Extensions menu to see the popup.

No dependencies or build step are required. After editing files, click **Reload**
on Mack's extension card and reopen the popup.

## Files

- `extension/manifest.json`: extension metadata and popup entry point.
- `extension/popup.html`: static starter popup.
- `extension/popup.css`: popup styles.
- `docs/`: product requirements and role responsibilities.

This starter does not yet implement page extraction, AI, voice, or navigation.

Chrome setup reference: [Hello World extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
