# Role 4 checkpoint — October 3, 2026

Resume from `role-4/guidance-integration`. Small PRs have not been opened or
merged into main yet (`gh` is not installed on this machine).

## Branches, in order

1. `role-4/contracts-v1`: Contract v1 restored from `00e2ba2:LENS_CONTEXT.md`
   (LensError/LensUIState/LensAppProps kept) with Zod validation and helpers.
2. `role-4/toolchain`: TypeScript, React 18, Vitest/jsdom/testing-library,
   esbuild IIFE content script and ESM worker builds.
3. `role-4/contexts-model`: action activation, GOV.UK host permission, trusted
   session credentials entered in an extension-owned options page.
4. `role-4/model-transport`: Anthropic service-worker transport, sender/payload
   validation, request-ID cancellation, 25-second timeout, sanitized failures.
5. `role-4/platform`: extractor/registry, versioned state controller, stale
   rejection, addition merging, action checks, navigation, body inert.
6. `role-4/ui-integration`: Alex's code merged unchanged; Role 3 mounted/wired.
7. `role-4/guidance-integration`: Chika's code merged unchanged, plus:
   - Role 2 wired through `platform/guidance-adapter.ts` (typed guidance live).
   - Role 2 `node:test` suite runs via `tsx` in `npm test`.
   - Mutation refresh gated by a content fingerprint; identical re-renders
     rebind IDs instead of calling the model.
   - Original mode no longer redesigns (and re-covers the page) on page edits.
   - Back in original mode restores the saved simplified screen.
8. Real-site platform: Gemini transport (replaces Anthropic), `onPreviousPage`,
   menu links, one-page-ahead peek, goal carry, button settle redesign.
9. Any-https activation: `host_permissions` is `https://*/*`. An active tab
   follows the user onto login domains (e.g. healthsafe-id.com). Peek and
   deep links stay same-site via `registrableDomain`. See `docs/demo.md`.

## Verified

`npm run check` is the gate. Model output in tests is canned. Extraction and
peek were run live on uhc.com and libertymutual.com through DevTools. No live
Gemini key or loaded-Chrome rehearsal of the sign-in hop has been run.

On this Windows machine use `npm.cmd`. `gh` is not installed.

## Still open

- Live check in Chrome with an operator key: design, typed guidance, navigation.
- Role 2: migrate to `shared/contracts.ts`; decide on popup/cursor files.
- Role 1: `VoiceController` factory, transcription/auth path, audio context.
- Open the small stacked PRs above for review.
