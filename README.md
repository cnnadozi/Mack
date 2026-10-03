# Mack

Mack is a Chrome extension that turns confusing websites into simple interfaces and guides you through them by voice.

## What it does

- **Simplifies the page.** AI redesigns the current screen into large, clearly labeled actions.
- **Guides by voice.** Speak or type what you want, and Mack answers with a spoken, highlighted next step.
- **Keeps up with you.** Mack refreshes after you navigate and can surface real actions missing from the simplified view.

Mack works on top of an existing real website. There is no separate backend: all application logic runs inside the extension.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `extension` folder.
4. Open Mack from the browser's Extensions menu to see the popup.
5. On a normal website, press **Turn on Mack cursor** to swap the mouse cursor on that page.
6. Choose **Speak a test sentence**, paste an ElevenLabs API key, and choose **Speak the sentence**. The key stays in memory for this browser session. The page speaks: "Mack is speaking this sentence."
7. Open `src/voice/mic-check.html` from the loaded extension to record from the microphone.

No install step is required to load the extension. After editing the TypeScript in `extension/src/voice/`, compile it with `npx --yes typescript@5.9.2 tsc -p extension/src/voice`, then click **Reload** on Mack's extension card.

Chrome setup reference: [Hello World extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

## How the project is organized

The work is split into four roles:

| Role | Area |
| --- | --- |
| 1 | Voice: ElevenLabs, microphone input, transcription, playback |
| 2 | Guidance: understanding requests and deciding the next step |
| 3 | UI: AI-generated screen design and rendering |
| 4 | Platform: Chrome extension shell, page extraction, integration |

## Files

- `extension/manifest.json`: extension metadata and popup entry point.
- `extension/popup.html`: starter popup with the cursor toggle.
- `extension/popup.js`: turns the custom Mack cursor on and off for the current tab.
- `extension/assets/`: Mack cursor images. The purple arrow is the normal cursor; the orange arrow is for links and buttons.
- `extension/popup.css`: popup styles.
- `extension/src/guidance/`: Role 2's guidance module (not yet wired into the extension).
- `extension/src/voice/`: Role 1's microphone capture check and ElevenLabs speech check.
- `docs/`: product requirements and role responsibilities.

## Documentation

- [`docs/PRD.md`](docs/PRD.md): what Mack is and what is in scope
- [`docs/CONTEXT.md`](docs/CONTEXT.md): the full combined context, including the shared contract
- `docs/role-*.md`: one file per role
- [`AGENTS.md`](AGENTS.md): rules for AI coding agents working in this repo

## Status

Early stage. The extension is a starter popup with a custom cursor toggle. It does not yet implement page extraction, AI guidance, or navigation. Microphone capture and one fixed spoken sentence are in `extension/src/voice/`.
