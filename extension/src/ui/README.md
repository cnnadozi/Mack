# Role 3 — UI generation and rendering

Owned path: `extension/src/ui/`. Implements `GenerateScreen` and `MackApp` against Contract v1 (the type list from the earlier LENS_CONTEXT.md; docs/CONTEXT.md now defers the types to Role 4's `shared/contracts.ts`).

## Exports (`index.ts`)

| Export | Purpose |
| --- | --- |
| `createGenerateScreen(model: ModelClient): GenerateScreen` | Sends the snapshot to Role 4's `ModelClient` with `task: "design"`, then grounds the result. |
| `groundDesign(raw, snapshot, stamp)` | Validates model JSON. Keeps only real, enabled `navigate`/`button` ids, dedupes ids and same-href/same-label copies, cleans labels, assigns section ids in code, echoes the request stamp. |
| `DesignError` | Thrown with `LensError` fields (`design_invalid`, `design_ungrounded`, `design_model_failed`; all retryable). Aborts rethrow the signal reason. |
| `MackApp` | React component taking `LensAppProps`. |
| `mountMackApp(parent?)` | Creates `<mack-root data-mack>` with an open shadow root, injects styles, returns `{ host, render(props), unmount() }`. |
| `DESIGN_SYSTEM_PROMPT`, `buildDesignPayload` | The design prompt and the trimmed payload sent to the model. |

`fixtures.ts` holds development-only fixtures (snapshot, canned model output, UI states for loading, 2 actions, 12 grouped actions, an addition with highlight, clarification, error, empty, original mode). Never wire it into the real flow.

## Behavior

- Design status: `ready` → `mode: "simplified"`; `use_original` / `not_found` → `mode: "original"` with no sections. Pages with only form fields skip the model and return `use_original`.
- No button cap and no mandatory buttons. Disabled, `field` and `submit` actions never appear in a simplified view.
- `onRendered(screenVersion)` fires once per committed version, after the DOM commits.
- Simplified mode: a full-viewport overlay with title, Back / Original page / Exit, one instruction (`aria-live`), status, error with Try again, clarification choices (sent through `onRequest`), all sections, and a sticky request bar.
- Highlight: the `highlightedActionId` button gets a double border, a "Next step" badge (`aria-describedby`), and is scrolled into view. It does not rely on colour alone.
- Transcript: `state.transcript` fills the input so the user can correct it and resend. Send is disabled when the input is empty.
- Mic: Speak/Stop (`aria-pressed`) call `onMicStart`/`onMicStop`; disabled while `processing`. In the `error` voice state the UI says typing still works.
- Original mode: only a compact guide panel. A "Move" button cycles it between the four corners so it can be moved off the source target.
- Accessibility: task buttons ≥64px tall with 24px labels, other controls ≥44px, essential text ≥20px, visible focus ring, native buttons and labelled input, at most two columns, `prefers-reduced-motion` and `forced-colors` support.

## Needs from Role 4

1. `shared/contracts.ts` with the Contract v1 types, **including `LensUIState` and `LensAppProps`**. Imports here use relative paths (`../../../shared/contracts` from this folder). Tell me if you add a path alias.
2. Dependencies: `react@18`, `react-dom@18`, `@types/react`, `@types/react-dom`; tsconfig `"jsx": "react-jsx"`. For the tests: `vitest`, `jsdom`, `@testing-library/react`, `@vitejs/plugin-react` (test environment `jsdom`).
3. A `ModelClient` whose `generateJSON` resolves to parsed JSON (an object, not a string).
4. Call `mountMackApp()` from the content script. Exclude `mack-root[data-mack]` from extraction and from the mutation observer, make covered page content inert while in simplified mode, and restore it on exit or in original mode.
5. Loading view: commit a screen with `sections: []` and set `busy: true`; the UI shows "Working…".
6. Guidance additions arrive as a committed section (e.g. heading "For your request"). The UI renders whatever Role 4 commits and does not rename anything.

Possible contract proposal (not implemented): an optional panel-placement hint in `LensUIState`, so Role 4 can open the original-mode panel away from the highlighted source element. Today the user moves it.

## Verification done

- 24 unit/component tests (`__tests__/`), plus a type-check against a verbatim copy of Contract v1. Both were run outside the repo because there is no root toolchain yet.
- Visual and keyboard check in a browser harness mounting through `mountMackApp` on a page with hostile CSS: styles stay isolated, Enter/Space activate buttons, and action ids reach `onAction` unchanged.

## Not verified yet

- Live model design: no provider or `ModelClient` exists yet.
- Running inside the real extension on the chosen real website: blocked on Role 4's skeleton and the site choice.
