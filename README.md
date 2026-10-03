# Mack

A bare-bones Manifest V3 Chrome extension with a toolbar popup.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `extension` folder.
4. Open Mack from the browser's Extensions menu to see the popup.
5. Choose **Speak a test sentence**, paste an ElevenLabs API key, and choose **Speak the sentence**. The key stays in memory for this browser session. The page speaks: "Mack is speaking this sentence."

No install step is required to load the extension. After editing the TypeScript in `extension/src/voice/`, compile it with `npx --yes typescript@5.9.2 tsc -p extension/src/voice`, then click **Reload** on Mack's extension card.

## Files

- `extension/manifest.json`: extension metadata and popup entry point.
- `extension/popup.html`: static starter popup.
- `extension/popup.css`: popup styles.
- `docs/`: product requirements and role responsibilities.

This starter does not yet implement page extraction, AI guidance, or navigation. Spoken output for one fixed sentence is in `extension/src/voice/`.

Chrome setup reference: [Hello World extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
