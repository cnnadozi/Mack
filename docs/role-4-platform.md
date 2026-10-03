# Role 4 — Chrome extension, website engine, and integration

Read PRD.md and the shared integration contract in CONTEXT.md before implementing. The combined CONTEXT.md includes the PRD, the contract, and every role.

You own extension/src/platform/, extension entry/manifest/build files, root workspace configuration, and shared/. You coordinate the other three parts and own authoritative state. There is no application backend to scaffold.

## Deliverables

- Minimal installable extension with explicit activation on the selected existing real website.
- Source extractor and snapshot-scoped action registry.
- Single ModelClient transport/runtime usable by Roles 2/3, with credential access isolated from the webpage.
- Appropriate extension execution/message contexts for model/audio work, agreed with Role 1.
- State controller that implements the shared lifecycle, original-view highlights, and navigation refresh.
- Build/install instructions, shared contracts/runtime schemas, and docs/demo.md for the real journey.

## Start here

1. Inspect existing repo and agree one skeleton; land contracts before parallel integration. Own root dependencies/lockfile changes to prevent conflicting installs.
2. Record actual website URL and tasks after inspecting them with the team. Prove extension activation and extraction of one real navigable link.
3. Prove model/provider access and ElevenLabs credential/permission feasibility with Role 1. Existing real APIs do not mean local inference; document the selected approach accurately.
4. Wire Role 3's fixture into one working source-action click, then live design. Wire typed guidance before voice, then integrate all three without forking their logic.

## Browser responsibilities

Extract actual headings, context, links/buttons/labels; exclude Mack DOM and private values. Keep DOM elements local behind action IDs. Recheck connection, snapshot, visibility/disabled state before user-triggered execution. No hardcoded task URL/selector logic. Sensitive form submissions are never triggered from a model response or generated shortcut.

Handle the actual site's full-page or client-side navigation, debounced relevant changes, and extension reinjection. Keep task goal scoped to the active tab and clear it appropriately. Handle worker/context lifecycle rather than assuming permanent in-memory background state. Ignore own overlay mutations.

Implement the shared proposal/commit sequence exactly. Queue latest input while initial design is pending, reject old response IDs/versions, merge additions without silent renaming, and speak only after visible target readiness. A replay uses the current accepted instruction, never an obsolete response.

In original mode, restore the original website, scroll/mark the actual control, and coordinate non-obscuring panel placement. On exit, restore original focus/accessibility state and stop all jobs/audio.

## Integration boundaries

Role 1 implements audio/provider-specific voice behavior. Role 2 writes guidance prompt/proposals. Role 3 writes design prompt/renderer. Mount their modules and own wiring; don't rewrite them in platform code. Use explicit messages for cross-context work and validate senders/payloads; do not expose credentials to content scripts/page scripts. Check current official Chrome APIs and permissions when choosing contexts.

## Acceptance

Extension loads; one generated button navigates the real site; AI-generated UI updates after navigation; typed/voice requests add/highlight real targets; stale requests/audio cannot interfere; covered original controls are not keyboard-focusable; original-view exit works; missing/disabled targets recover clearly. Automate meaningful ID/version checks and coordinate a full live demo with all owners.

## Agent kickoff prompt

> Read docs/CONTEXT.md in full. I own Role 4. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.
