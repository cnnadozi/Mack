# Mack

Mack is a Chrome extension that turns confusing websites into simple interfaces and guides you through them by voice.

## What it does

- **Simplifies the page.** AI redesigns the current screen into large, clearly labeled actions.
- **Guides by voice.** Speak or type what you want, and Mack answers with a spoken, highlighted next step.
- **Keeps up with you.** Mack refreshes after you navigate and can surface real actions missing from the simplified view.

Mack works on top of an existing real website. There is no separate backend: all application logic runs inside the extension.

## Run it locally

1. Put your keys in `.env.local` at the repo root (git ignores it):

   ```
   ELEVENLABS_API_KEY=...
   GEMINI_API_KEY=...
   ```

2. Install and build:

   ```bash
   npm install
   npm run build
   ```

   This writes the extension to `dist/`. Use `npm run dev` to rebuild automatically while editing.

3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the `dist` folder. After each rebuild, click **Reload** on Mack's card.

The build copies the keys into `dist/`, so never commit, zip or share that folder. This is a local developer setup, not a way to ship keys.

## Using it

1. Open a normal website and click the Mack icon in the toolbar. There is no popup: the icon turns Mack on, and clicking it again turns Mack off. The icon shows **ON** while Mack is running. A short rising chime plays when Mack turns on and a falling one when it turns off. The first time, a tab opens once so Chrome can ask for the microphone.
2. **Mack's bar** appears at the bottom centre of the page. In the middle is a round indicator with a moving sound wave that shows what Mack is doing (green while listening and hearing you, amber while thinking or working, dark while speaking). To its left are the logo (drag it to move the bar; double-click to put it back) and the **Simple view** button. To its right are four small buttons: switch between light and dark mode (for the bar and the simple view; it follows your system until you choose), show or hide the conversation, open the settings, and turn Mack off. The conversation (your words, Mack's replies, and the steps of a task in smaller text) is in a card above the bar.
3. **Talk.** Mack listens all the time, so you can just speak, for example "Where is the contact page?". There is nothing to press unless push to talk is on. Mack answers by voice and puts a ring around the element it means. A new question cuts off the answer Mack is still speaking.
4. **Simple view.** Press **Simple view** and Mack covers the page with a redesign of it, made for that page: the site's own name, icon, colour and preview picture at the top with a short summary, the page's search box only when searching is the main thing people do there (a store like Costco, a library catalog), not on sites used through a few tasks (a hospital, insurer, bank or city site), key facts the page states (opening hours, a phone number, a price), and then everything the page lets you do as cards grouped under headings, each with an icon or the site's own picture and a line about what it does. The cards are the page's real links and buttons: pressing one does the real thing on the website, searching uses the site's real search, and the page you land on gets a simple view too. Mack never creates a simple view on its own. While one is up the button reads **Recreate** and makes it again; **Original page** at the top right removes it. It only works on https websites. If you ask where something is while the simple view is up, Mack marks the card to press with **Next step**.
5. **Ask Mack to do a task**, for example "Search for a good car" or "Open the contact page". Mack does it for you step by step: it rings an element, acts on it, looks at the page that results, and carries on until the task is done, then tells you what it did. Mack can click, type into fields and rich text editors, pick dropdown options, tick boxes, hover to open menus, press keys (Enter, Escape, Tab, Backspace, Space, arrows), scroll, go back and forward, and open a web address you name. While a task is running, a pulsing amber frame surrounds the page and a note above the bar says which step Mack is on and what it is doing, with a **Stop** button. A task also stops after 15 steps, or as soon as you ask something new or turn Mack off.
6. **What Mack leaves to you.** It will not press anything that looks like paying, buying, placing an order, donating, subscribing, deleting or transferring, will not type into password or card fields, and will not submit a form that contains one. It goes as far as that step, highlights it, and asks you to do it yourself. It only types words you gave it.
7. **Settings** (the sliders button on the bar):
   - **Mack's voice** picks which ElevenLabs voice speaks. The list comes from your own ElevenLabs account and is loaded when Mack starts. Changing it plays a short sample.
   - **Language** sets the language of Mack's answers and of the simple view's buttons. Mack's greeting is in that language too. The bar's own labels stay in English.
   - **Push to talk** stops Mack from listening all the time: the round indicator becomes the talk button, and Mack only listens while you hold it (mouse, touch, or Space/Enter).
   - **Text input** shows a box for typing just above the bar, and the round indicator stops being a talk button. Typing works even when the microphone is blocked or missing.

How it works: the microphone is heard in a hidden extension page. Gemini turns each sentence into text (`gemini-3.5-flash`, the fastest model that was as accurate), then answers (`gemini-3.8-flash`) using a screenshot of the tab, the page's real links, buttons and fields, and the readable text of the whole page (including parts you have not scrolled to). Text you typed into fields or editors is never sent. ElevenLabs speaks the answer. For a task, that second step repeats once per click or typing action, each time with a fresh reading of the page.

The simple view: when you press **Simple view**, the content script lists the page's real controls and the background worker asks Gemini (`gemini-3.8-flash` unless changed on the options page, with its thinking set to low for speed) how to organise them, with a summary, key facts, and a description and icon for each. The site's logo, colour, name and pictures are read straight from the page, not made by the model, and searching runs the site's own search box. Mack also looks one click ahead at a few same-site links (fetched without cookies) so a button can go straight to a useful page. Every button is checked against the real page before it is shown and again before it is pressed. While the simple view is up, Mack's voice is shown the simple view itself (a screenshot plus its buttons and search box) as well as the real page underneath. Asking where something is highlights the matching big button or the search box; asking Mack to open something presses that button, and the next page continues in the simple view; asking it to search fills in the simple view's search box. After an action, Mack waits for the next page and says what it did. Mack still decides when the original page makes more sense: if what you need is only on the real page (a form field, or a specific link the simple view only covers loosely), Role 2's guidance either adds it to the simple view or switches to the original page, and otherwise Mack switches to the original page itself and highlights it there. A task step that needs the real page also switches to it first, so you see what Mack does. Pages that are mainly a form, checkout or an article still open as the original page with a small Mack guide.

To make the screen appear quickly, the model is first asked only for the layout (which actions, in which groups); the summary, key facts and descriptions are asked for separately and fill in a moment later. A design is remembered for ten minutes per tab, so coming back to a page shows its simple view at once; **Recreate** always asks the model again.

Caching: asking the same question again on a page that has not changed is answered from memory, without another Gemini call, for up to five minutes. Tasks are never cached, because they change the page. Sentences Mack has already spoken in the current voice (the greeting, a repeated answer) reuse the audio instead of calling ElevenLabs again. Both caches are in memory only and are emptied when Mack is turned off.

Checks: `npm run typecheck` and `npm test`. The tests use two runners: Node's built-in one for the voice conversation code (`npm run test:node`) and Vitest for Role 4's platform, UI and shared contract tests.

## Debugging

Mack logs each step of a conversation with a `[Mack:<where>]` prefix. Each part of the extension has its own console:

| Prefix | Where to look |
| --- | --- |
| `[Mack:background]` | `chrome://extensions` → Mack → **service worker** |
| `[Mack:offscreen]`, `[Mack:gemini]` | `chrome://extensions` → Mack → **offscreen.html** (only listed while Mack is talking) |
| `[Mack:content]` | the website's own DevTools console |
| `[Mack:permission]` | DevTools on the microphone permission tab |

The logs never include API keys, audio, screenshots or text typed into fields. Set `ENABLED` to `false` in `extension/src/platform/debug.ts` to turn them all off.

## How the project is organized

The work is split into four roles:

| Role | Area |
| --- | --- |
| 1 | Voice: ElevenLabs, microphone input, transcription, playback |
| 2 | Guidance: understanding requests and deciding the next step |
| 3 | UI: AI-generated screen design and rendering |
| 4 | Platform: Chrome extension shell, page extraction, integration |


## How the pieces fit together

One extension, built by Vite, with four parts that talk through `chrome.runtime` messages:

| Part | Code | What it does |
| --- | --- | --- |
| Background service worker | `extension/src/platform/background.ts`, `simple-view-worker.ts` | Turns Mack on and off from the toolbar icon, reads the page for the conversation, and is the only place the simple view's Gemini calls are made (Role 4's `model-handler.ts` and `provider.ts`). |
| Offscreen document | `extension/src/platform/offscreen/main.ts` | The conversation: microphone, Gemini, ElevenLabs, tasks. It also speaks the simple view's instructions. |
| Content script | `extension/src/platform/content/` | Mack's bar (`panel.tsx`, shadcn/ui) and highlight ring (`overlay.ts`), clicking and typing (`act.ts`), and Role 4's platform (`simple-view.ts`, `platform-host.ts`, which run `controller.ts`, `extractor.ts` and `peek.ts`). |
| Simple view | `extension/src/ui/MackApp.tsx`, `ui/design/`, `extension/src/guidance/` | Role 3's AI-redesigned screen, built with shadcn/ui components, and Role 2's guidance. |

`shared/contracts.ts` holds the contract types that Roles 2, 3 and 4 share. The options page (`extension/options.html`, right-click the Mack icon → **Options**) is optional: it lets you try another Gemini key or model for the simple view for the current browser session.

## Documentation

- [`docs/PRD.md`](docs/PRD.md): what Mack is and what is in scope
- [`docs/CONTEXT.md`](docs/CONTEXT.md): the full combined context, including the shared contract
- `docs/role-*.md`: one file per role
- [`AGENTS.md`](AGENTS.md): rules for AI coding agents working in this repo

## Status

Early stage. Voice and typed conversation about the current page, push to talk, element highlighting, tasks carried out on the page (clicking and typing) work as described above. The AI-redesigned simple screen (Role 3) and Role 2's guidance module in `extension/src/guidance/` are not wired into the extension yet.
