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

1. Open a normal website and click the Mack icon in the toolbar. There is no popup: the icon turns Mack on, and clicking it again turns Mack off. The icon shows **ON** while Mack is running.
2. A short rising chime plays when Mack turns on and a falling one when it turns off. The Mack panel appears at the bottom centre of the page; its sliders button opens the settings. The first time, a tab opens once so Chrome can ask for the microphone.
3. Ask out loud, for example "Where is the contact page?". Mack answers by voice and puts a ring around the element it means. Keep talking for a back-and-forth conversation; click the Mack icon again, or the X on the Mack panel, to end it.
4. **Type instead.** While Mack is on, a Mack panel sits at the bottom centre of the page with a box for typing a question. Typing works even when the microphone is blocked or missing. A new question cuts off the answer Mack is still speaking.
5. **Push to talk** (in the settings) stops Mack from listening all the time. The panel then shows a **Hold to talk** button: hold it (mouse, touch, or Space/Enter) while you speak and let go to send.
6. **Ask Mack to do a task**, for example "Search for a good car" or "Open the contact page". Mack does it for you step by step: it rings an element, acts on it, looks at the page that results, and carries on until the task is done, then tells you what it did. Each step appears as text in the panel. Asking *where* something is ("Where is the search box?") still only highlights it. Mack can click, type into fields and rich text editors, pick dropdown options, tick boxes, hover to open menus, press keys (Enter, Escape, Tab, Backspace, Space, arrows), scroll, go back and forward, and open a web address you name. A task stops after 15 steps, or as soon as you ask something new or turn Mack off.
7. **What Mack leaves to you.** It will not press anything that looks like paying, buying, placing an order, donating, subscribing, deleting or transferring, will not type into password or card fields, and will not submit a form that contains one. It goes as far as that step, highlights it, and asks you to do it yourself. It only types words you gave it.
8. **The Mack panel** on the page is a chat window: your words, Mack's replies, and the steps of a task in smaller text. The arrow minimises it to a small button; the X turns Mack off. Drag the panel by its top bar to move it, and drag any corner to resize it; it stays where you put it on the next page. Double-click the top bar to send it back to the bottom centre. **Show conversation** hides or shows the text in it. **My words** and **Mack's replies** choose which side is shown.
9. **Mack's voice** picks which ElevenLabs voice speaks. The list comes from your own ElevenLabs account and is loaded the first time Mack starts, so start Mack once before choosing. Changing it while Mack is on plays a short sample in the new voice.

How it works: the microphone is heard in a hidden extension page. Gemini (`gemini-3.5-flash-lite`) turns each sentence into text, then Gemini (`gemini-3.5-flash`) answers using a screenshot of the tab, the page's real links, buttons and fields, and the readable text of the whole page (including parts you have not scrolled to). Text you typed into fields or editors is never sent. ElevenLabs speaks the answer. For a task, that second step repeats once per click or typing action, each time with a fresh reading of the page.

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


## Role 4's platform code (merged, not yet wired in)

The `role4_chrome_extension` branch is merged into this one. Its code is in the repo and its tests run with `npm test`, but the built extension does not load it yet: the manifest, `package.json` and Vite build are still the voice-conversation extension described above.

- `shared/contracts.ts`: the shared contract types and validation
- `extension/src/platform/` (`controller.ts`, `extractor.ts`, `provider.ts`, and others), `extension/src/service-worker.ts`, `extension/src/content.ts`, `extension/src/options.ts`: Role 4's platform, written for its own manifest
- `extension/src/ui/MackApp.tsx` and `extension/src/ui/design/`: the AI-redesigned simple screen
- `build.mjs`: Role 4's esbuild build. Do not run it as is: it writes to `dist/` and expects Role 4's manifest, which this branch does not use.

## Documentation

- [`docs/PRD.md`](docs/PRD.md): what Mack is and what is in scope
- [`docs/CONTEXT.md`](docs/CONTEXT.md): the full combined context, including the shared contract
- `docs/role-*.md`: one file per role
- [`AGENTS.md`](AGENTS.md): rules for AI coding agents working in this repo

## Status

Early stage. Voice and typed conversation about the current page, push to talk, element highlighting, tasks carried out on the page (clicking and typing) work as described above. The AI-redesigned simple screen (Role 3) and Role 2's guidance module in `extension/src/guidance/` are not wired into the extension yet.
