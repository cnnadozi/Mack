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
- Simplified mode: a full-viewport overlay with title, Previous page / Original page / Exit, one instruction (`aria-live`), status, error with Try again, clarification choices (sent through `onRequest`), all sections, and a sticky request bar.
- Main vs more: the model marks each section `main` or `more`; grounding encodes it in the section id (`main-N` / `more-N`, see `isMoreSection`). Main sections show first (with a goal: only the 1–3 buttons that continue it); `more-*` sections sit behind a "More options (N)" toggle that resets on each new snapshot and opens itself when the highlighted target is inside it. Sections with any other id (e.g. Role 4's "For your request") always show.
- Highlight: the `highlightedActionId` button gets a double border, a "Next step" badge (`aria-describedby`), and is scrolled into view. It does not rely on colour alone.
- Transcript: `state.transcript` fills the input so the user can correct it and resend. Send is disabled when the input is empty.
- Mic: Speak/Stop (`aria-pressed`) call `onMicStart`/`onMicStop`; disabled while `processing`. In the `error` voice state the UI says typing still works.
- Original mode: only a compact guide panel: back arrow (`onPreviousPage`), title, minimize/expand toggle (collapses the panel to its top bar; reopens itself on a new instruction, error or clarification), full-screen icon (`onBack`: Role 4 returns to the committed simplified screen, or explains there is none) and ✕ (`onExit`) on top, with tooltips and spoken labels; instruction and request bar; a "Move panel" button that cycles the panel between the four corners so it can be moved off the source target.
- Accessibility: task buttons ≥64px tall with 24px labels, other controls ≥44px, essential text ≥20px, visible focus ring, native buttons and labelled input, at most two columns, `prefers-reduced-motion` and `forced-colors` support.

## Needs from Role 4

1. `shared/contracts.ts` with the Contract v1 types, **including `LensUIState` and `LensAppProps`**. Imports here use relative paths (`../../../shared/contracts` from this folder). Tell me if you add a path alias.
2. Dependencies: `react@18`, `react-dom@18`, `@types/react`, `@types/react-dom`; tsconfig `"jsx": "react-jsx"`. For the tests: `vitest`, `jsdom`, `@testing-library/react`, `@vitejs/plugin-react` (test environment `jsdom`).
3. A `ModelClient` whose `generateJSON` resolves to parsed JSON (an object, not a string).
4. Call `mountMackApp()` from the content script. Exclude `mack-root[data-mack]` from extraction and from the mutation observer, make covered page content inert while in simplified mode, and restore it on exit or in original mode.
5. Loading view: commit a screen with `sections: []` and set `busy: true`; the UI shows "Working…".
6. Guidance additions arrive as a committed section (e.g. heading "For your request"). The UI renders whatever Role 4 commits and does not rename anything.

**Contract change — `onPreviousPage`** (landed by Role 4 in `shared/contracts.ts`): `onBack` = return to the full-screen simplified Mack view; `onPreviousPage` = go to the previous website page. Both views render the back arrow through `onPreviousPage`.

## Deep links: what Role 4's extractor should send

The design prompt ranks tasks by what visitors of that kind of site come to do, and can pick links the user would otherwise need several clicks to reach. It reads where an action lives from the start of `SourceAction.context` (no contract change needed):

| Context prefix | Meaning | How Role 4 executes it |
| --- | --- | --- |
| *(none)* | Visible on the page | Recheck the live element, then `click()` |
| `menu: <menu name>` | Real link inside a hidden dropdown/menu | Navigate to the element's own extracted `href` (hidden elements often ignore clicks) |
| `one click away via "<label>"` | Real link found on the page that `<label>` opens | Navigate to the extracted `href` |
| `opens menu; …` | Button that only opens a menu/panel | `click()`, then re-extract after the page changes |
| `<type> field; …` | Form field, e.g. `password field;` | Never executed; a password/PIN/card field keeps the page in original mode |

Peeking one page ahead (prototyped in Role 3's local test harness, verified on uhc.com: 85 menu links + 24 links one page ahead):
- Pick at most ~8 same-site links, preferring menu/nav links and support/account/billing-type labels, skipping anything that could act when opened (log out, unsubscribe, delete, cart, checkout, downloads).
- Fetch them from the service worker in parallel with `credentials: "omit"` and a ~3.5 s timeout, so pages are seen signed-out: no personal data, no account side effects. Parse with `DOMParser` in the content script and add only new same-site link labels/hrefs (max ~30 per page). Never send page text.
- Skip peeking on pages with a password field.
- Known limits: pages rendered by JavaScript show few links when fetched; content behind sign-in is not visible.

Labels ending in `(sign in first)` (e.g. "Check claims (sign in first)") point at a real sign-in link. Role 4 should carry the button label (without the suffix) as the goal across page loads, so after sign-in the portal's design puts that task first.

Possible contract proposal (not implemented): an optional panel-placement hint in `LensUIState`, so Role 4 can open the original-mode panel away from the highlighted source element. Today the user moves it.

## Verification done

- 24 unit/component tests (`__tests__/`), plus a type-check against a verbatim copy of Contract v1. Both were run outside the repo because there is no root toolchain yet.
- Visual and keyboard check in a browser harness mounting through `mountMackApp` on a page with hostile CSS: styles stay isolated, Enter/Space activate buttons, and action ids reach `onAction` unchanged.

## Not verified yet

- Live model design: no provider or `ModelClient` exists yet.
- Running inside the real extension on the chosen real website: blocked on Role 4's skeleton and the site choice.
