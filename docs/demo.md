# Role 4 demo setup

## Sites

Mack works on any https website the user activates it on. Clicking the toolbar
icon starts a tab session; that tab stays active across navigations to any
https domain (including separate sign-in domains such as
`identity.healthsafe-id.com`) until Exit or the tab is closed. Each completed
load is re-injected. There are no task-specific URL or selector shortcuts.

Chrome-blocked pages (`chrome://`, `file:`, `http:`, the Chrome Web Store) are
not injectable. The icon then shows a `!` badge and the title "Mack can't run
on this page. Open a website and click Mack again." If an active tab briefly
leaves https, the session is kept for 15 minutes and resumes when the tab
returns.

Demo journeys used while building: uhc.com (sign-in hops to
healthsafe-id.com) and libertymutual.com. Stop before any payment, submission,
or a real sign-in.

## Model and credentials

Provider: Gemini `generateContent` (v1beta), default model `gemini-3.8-flash`.
The request uses an `x-goog-api-key` header, a `systemInstruction`, the payload
as JSON text, and `generationConfig.responseMimeType: "application/json"`.
Design calls also send `responseJsonSchema`. Design and guidance share one
service-worker `ModelClient`; prompts and grounding belong to Roles 3 and 2.
No application server exists.

The operator pastes their own key (and optionally a model) into Mack's options
page. Saving runs a test call, then stores both only in `chrome.storage.session`
with `TRUSTED_CONTEXTS` access. Content scripts receive results, never
credentials. Restarting Chrome or reloading the extension clears the key.
The key is never read from `.env.local` or bundled: the repository is public,
and `build.mjs` fails if a key pattern appears in any bundle or if the content
bundle contains the provider host.

## Platform behavior

- Extraction: visible actions have no context prefix; toggles with
  `aria-expanded`/`aria-haspopup`/`aria-controls` start `opens menu; `; fields
  start `<input type> field; `; unlabeled password/email inputs are labelled
  "Password"/"Email". Input values are never sent. Mack's own root is skipped.
- Hidden same-site links become `navigate` actions with context
  `menu: <name>` (the `aria-controls` trigger, else the region's `aria-label`,
  else "site menu"). Same-site uses a registrable-domain check (last two labels,
  or three when the second-to-last is `co`/`com`/`gov`/`ac`/`org`/`net`/`edu`
  plus a two-letter country code; `gov.uk` is treated as a suffix, so
  `www.gov.uk` is its own site). Unsafe links (sign out, delete, cart,
  downloads...) are skipped. Only identical hrefs are deduplicated. Total
  actions are capped at 400.
- Peek: up to 8 same-site links (menu/nav and hub labels first) are fetched by
  the service worker in parallel with `credentials: "omit"` and a 3.5 s timeout,
  parsed with `DOMParser` in the content script, and add up to 30 links each with
  context `one click away via "<label>"`. Skipped on pages with a password field.
  Peek and deep-link navigation stay same-site only, so a UHC menu does not peek
  or assign `healthsafe-id.com`.
- Execution: visible actions are rechecked (connected, visible, enabled) and
  clicked; submit actions are never executed. Menu and peeked links navigate with
  `location.assign` to the exact extracted href after revalidation. A button that
  doesn't navigate is re-extracted and redesigned after 900 ms.
- Redesign triggers: full navigation (reinjection on `tabs.onUpdated`),
  client-side URL changes, and new form fields in simplified mode.
- Goal carry: a clicked label (minus " (sign in first)") or a typed request
  becomes the tab's goal in session storage for 15 minutes and goes into every
  `DesignRequest`, stored with the URL of the page where it was set. The goal
  survives hops to other domains (so "Check claims" still applies on the
  healthsafe-id login and the member portal). It is dropped when a page loads at
  that same URL and when the previous-page button is pressed. Exit and tab close
  clear it.
- Controls: `onBack` returns from the original page to the saved simplified
  screen (or shows the "no simple view" notice); `onPreviousPage` calls
  `history.back()`; `onExit` aborts work, restores `inert`, and unmounts.

## Try it

1. Run `npm ci` and `npm run build` from the repository root.
2. Load `dist/` with Chrome's Developer mode → Load unpacked.
3. Open Mack's options page and save a Gemini key.
4. Open any https site and click Mack in the toolbar. The tab stays on across
   domain hops until Exit.
5. After code changes: rebuild, reload the extension, refresh the tab, and
   re-enter the key.

## Live evidence (October 3, 2026)

The real extractor and peek code, bundled and run in the page through DevTools:

| | uhc.com | libertymutual.com |
| --- | --- | --- |
| Hidden menu links | 85 | 73 |
| Links added by peek | 24 | 27 |
| Input values in snapshot | none | none (marker value checked) |

That run fetched from the page, so cross-subdomain peeks (`member.uhc.com`,
`business.libertymutual.com`) failed on CORS. The service worker now has
`https://*/*` host access, but this has not been confirmed in a loaded
extension.

Not yet verified in loaded Chrome: activation, `inert`, the sign-in hop to
`identity.healthsafe-id.com`, deep-link navigation, goal carry, the
service-worker peek, and a live Gemini call. Voice is blocked on Role 1.

## References

- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
