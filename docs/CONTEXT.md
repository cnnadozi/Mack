# Mack AI — Complete Context for All Four Agents

This document contains the full current product, contracts, role assignments, and collaboration rules. No earlier conversation is needed. Roles: 1 ElevenLabs/voice, 2 intent/guidance, 3 UI generation, 4 Chrome extension/integration. Application architecture is extension-only.

Tell your agent its role number before implementation. If unspecified, ask. Read all sections, then implement your owned portion. PRD.md and the role-*.md files in this folder are standalone copies of sections of this document; keep them in sync with it after coordinated changes.


## Mack AI — Main PRD

### Pitch and build rule

“Mack turns confusing websites into simple interfaces and guides you through them by voice.”

Build only what delivers the pitch or directly makes it work reliably. Build a Chrome extension that works on an existing real website. Do not build a fake website or a separate application backend.

Three promises:
1. AI redesigns the current screen into useful, clearly labeled actions.
2. Users speak or type a request and receive a spoken, highlighted next step.
3. Mack adapts after navigation and can surface real actions missing from the current simplified view.

### Exact four roles

| Role | Responsibility | Owned paths |
| --- | --- | --- |
| 1 | ElevenLabs, microphone input, transcription, playback | extension/src/voice/ |
| 2 | Request interpretation, AI responses, requests to add/highlight actions | extension/src/guidance/ |
| 3 | AI-driven initial redesign, structured screen generation, UI rendering | extension/src/ui/ |
| 4 | Chrome shell, permissions, website extraction, action execution, shared state, integration | extension/src/platform/, extension entry/build/manifest, root config, shared/ |

Role 4 coordinates integration. Roles 2 and 3 use one model-access boundary owned by Role 4, but own their separate prompts and output validation. Role 4 handles transport and credentials, not the reasoning itself. Role 1 owns ElevenLabs-specific requests; Role 4 supplies the permitted extension context/credential access.

### Architecture

All application logic runs in extension contexts. No server/, REST application endpoints, or localhost application backend. Cloud provider calls may still be used: “client-side application” does not mean the AI model runs locally or that voice is offline. The team must choose and record the actual language-model provider/runtime.

AI produces structured screen descriptions, grounded action IDs, labels, and groups. Code renders accessible components. Do not execute model-generated JavaScript or arbitrary HTML. Redesign can vary per site and screen; there is no fixed two/three-button template and no compulsory customer-service button.

### First decisions

Record role-to-person assignments, one existing real website URL, an actual primary task, another supported task, model provider/runtime, ElevenLabs voice and authentication approach, and extension audio context. Choose a publicly accessible journey without a required payment or login for the first demo. Nothing in this PRD invents the site's buttons or promises universal compatibility.

### Provider authentication: resolve early

ElevenLabs integration is required for spoken output. Role 1 chooses a working transcription path; ElevenLabs transcription is preferred if feasible, but using a separate supported speech-input implementation is allowed. ElevenLabs must speak the same accepted instruction shown on screen, not independently invent navigation instructions.

An extension cannot hide a distributed service API key. Never commit or bundle team/provider secrets, including through build-time environment variables. For a private hackathon run, the operator may supply their own restricted, temporary credentials at runtime in an extension-owned setup surface; keep them out of page/content-script data, logs, fixtures, and exported packages. This is operator-managed access, not a secure way to distribute a shared secret. Verify provider and browser compatibility on the actual machine immediately.

ElevenLabs documents client-side realtime transcription using a single-use token; token issuance needs authenticated provisioning and does not happen automatically because an app is an extension. If that path is chosen, identify an existing authorized provisioning mechanism. Do not silently add a backend or fake working authentication. If no authorized workable path is available, report the exact blocker while continuing independent tasks. Do not claim a production-safe credential flow has been implemented merely because a private demo works.

References checked for this design: https://elevenlabs.io/docs/api-reference/authentication and https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming . Check current SDK/API details during implementation rather than assuming methods.

### Required experience

- Large clear actions chosen from the actual page according to page context and any stated goal; flexible count and plain grouping.
- One persistent place to speak or type. Show transcription so it can be corrected.
- One instruction at a time. Match speech to the exact visible label.
- Back, original-view access, replay, retry, and exit where appropriate. No complex onboarding, mode-picker, or settings dashboard.
- Task controls at least 64px high, labels around 24px; essential text at least 20px; other controls at least 44px. Visible keyboard focus, native controls, high contrast, readable scrolling, and reduced-motion support.
- Covered original controls cannot remain keyboard-focusable. Original-view exit restores their prior state.
- Complex forms stay on the original page with a compact guidance panel. Do not rebuild forms or auto-submit. Final sensitive actions require direct user action on the original website.

### Grounding and state

Role 4 extracts headings, concise text, visible links/buttons/field labels and generates snapshot-scoped action IDs. Exclude Mack DOM and sensitive input values. Original elements stay in a local registry, not provider payloads. Model output may reference only current IDs.

Role 3 designs the initial screen. Role 2 proposes contextual additions and highlights after user requests. Only Role 4 commits state changes; Role 3 renders accepted state. No race between two agents rewriting the same UI.

On navigation or relevant page change, invalidate old requests, mappings, highlights, and speech. Ignore Mack's own DOM mutations. Carry the user goal to the new page, refresh its design, then request guidance against that accepted design. Discard delayed results using snapshot version, screen version, and request ID.

Role 2 never clicks. Role 3 never finds source elements. Role 1 never makes independent navigation decisions. A rendered button sends an action ID to Role 4, which validates and executes the source action following a user click.

### Demo and completion

Existing real page → activate Mack → AI-generated simplified view → spoken request → accepted button addition/highlight → spoken next instruction → user clicks → real navigation → refreshed UI → additional available task. Pick tasks based on what the chosen website actually supports. Do not hide a useful action merely to stage an omitted-button demo.

Require live AI, real microphone input, ElevenLabs speech, actual source actions, keyboard access, original-view restoration, stale-response rejection, and honest missing-target behavior. Verify microphone denial still permits typed requests. Component fixtures are allowed during development but cannot substitute for the real final flow.

### Out of scope

No fake portal, application backend, second website project, general autonomous browsing, payments integration, universal compatibility promise, rebuilt forms, translation, persistent user profiles, caregiver tools, continuous conversational audio, or a separate scripted demo engine. Screenshot context is only justified by an observed blocker on the chosen journey. Freeze features after the pitch works; fix defects and rehearse.


## Shared integration contract and collaboration rules

### Authority and file ownership

The current PRD and this contract govern all four roles. All agents read the full context document. Each is assigned exactly one role by their human. If a role is unspecified, ask before editing. Do not spawn other coding agents unless explicitly requested.

Use one repo with separate branches, e.g. role-1/voice, role-2/guidance, role-3/ui, role-4/platform. Role 4 creates the shared skeleton and owns root dependencies, lockfile, manifest, entry points, and shared types. Send dependency requests to Role 4. Feature owners may edit only their paths unless an affected owner explicitly coordinates a shared edit.

Before parallel implementation, Role 4 lands the shared types in shared/contracts.ts with input/output runtime validation. Roles 1–3 review their boundaries. Propose changes in writing with old shape, new shape, consumers affected, and reason; Role 4 lands the change once. Do not define local alternate copies of shared types.

### Module APIs — no application HTTP endpoints

Each feature receives its dependencies through initialization or imports the single agreed bridge, not a second provider client. Boundaries can use extension messages where required; Role 4 implements transport. Do not assume AbortSignal, functions, Blob, or DOM nodes can cross an extension messaging boundary. Serialize cancellation as job IDs where needed and reconstruct local controllers in the owning context.

Role 3 exports MackApp. Role 4 uses onRendered as an acknowledgement, not a reason to rerender repeatedly. Original-source highlight readiness is checked separately by Role 4 before speech. Clarification controls send their text via onRequest.

### Exact lifecycle and conflict prevention

1. Role 4 extracts the real page, creates a new snapshot version, sets a loading view and a fresh screen version, then calls Role 3 generateScreen.
2. Role 3 returns a proposal. Role 4 checks the request ID and input versions, validates IDs, commits its screen with a new version, then Role 3 renders it.
3. Role 1 emits a completed transcription, or Role 3's typed form emits text. Both enter Role 4's same request path. Role 4 stores the latest goal, cancels obsolete work, and calls Role 2 against the committed screen. If design is pending, queue only the newest user request until it commits.
4. Role 2 returns a proposal. Role 4 validates it against the still-current request/page/view. In simplified mode, merge additions into the visible screen: deduplicate by action ID, preserve existing labels/order, and append new actions into a single plain “For your request” section. A proposal targeting an existing action must use its displayed label; a new target uses its accepted addition label. No silent renaming of an existing button.
5. A simplified target must exist after the merge and must map to a current source action. Otherwise reject or regenerate. A field/submit target uses original mode; restore the original page before guidance. Role 4 commits mode/additions/instruction/highlight together and assigns a new screen version.
6. Role 3 renders the accepted state and highlights the Mack button. In original mode, Role 4 highlights the source element. After render/target readiness, Role 4 creates a SpeechJob for the accepted output versions and calls Role 1.
7. User clicking a Mack button sends its ID to Role 4. Role 4 validates the live registry and executes an eligible action. Model output never directly clicks. Sensitive submission stays a direct original-page action.
8. Real navigation invalidates old jobs, clears mappings, stops audio, and repeats extraction/design. If a goal is active, resolve guidance after the new screen commits. A no-navigation action is checked by relevant page mutations; a lack of visible change is not proof of success.

Only Role 4 mutates authoritative state. Role 2 proposes changes, Role 3 proposes designs/renders, Role 1 reports audio events. No direct Role 1→Role 2 provider calls or Role 2→Role 3 state writes. Model calls for design and guidance share transport but separate prompts and schemas.

### Reliability rules

Ignore mutations created by Mack. Recheck live elements just before use. Block unknown/stale/disabled targets; never substitute a guessed URL. Maintain one active instruction and speech job. On new input/navigation/exit, reject delayed responses and delayed audio. Repeated clicks while an action is pending must not duplicate execution. Preserve source amounts/notices when showing original forms. Avoid private input values in model context.

### First integration checkpoints

| Gate | All-team evidence |
| --- | --- |
| Skeleton | Real URL chosen; extension loads; contracts and ownership agreed; provider authentication proven in extension context |
| First click | Real source link → Role 3 schema-valid screen → rendered button → actual navigation |
| Live design | Role 3 uses live model and extraction; different relevant action counts render correctly |
| Typed guidance | Role 2 handles a typed request, adds a real omitted action if needed, and highlights it |
| Voice | Role 1 transcript reaches the same path and ElevenLabs speaks the accepted visible instruction |
| Navigation | New page refreshes UI and guidance; old IDs/responses/audio cannot interfere |
| Freeze | Complete real-site pitch rehearsed; fix defects, add no extra features |

Use clearly marked development fixtures to unblock isolated components. They are not production/demo decisions. Integrate small PRs early, with a teammate review and a runnable handoff. Do not wait until the last hour. Pull current main into your branch regularly and resolve conflicts with file owners.

### Required handoff from every role

Provide changed paths, public module exports, how to run/try the feature, checks performed, remaining dependency and its owner, and any limitations. Each teammate joins the full demo rehearsal and fixes failures in their area. Role 4 coordinates integration but does not inherit all other roles' unfinished work.


## Role 1 — ElevenLabs and voice input

Read the product and shared-contract sections above before implementing.

You own extension/src/voice/. Your output is voice transport: microphone → transcript, and accepted instruction → ElevenLabs speech. You do not decide page actions or build a parallel conversation agent.

### Deliverables

- VoiceController and VoiceCallbacks exactly as the shared contract.
- Push-to-talk start/stop, correct microphone permissions in a supported extension document/context, transcript events, listening/processing/speaking/error states.
- ElevenLabs spoken output using the text from SpeechJob. Select a working transcription path with the team; verify its authentication before building advanced audio UX.
- Playback cancellation, replay support through Role 4's current instruction, and disposal of microphone/audio resources on exit.
- A concise provider/setup note with credential placeholders and the tested audio context. Never commit actual secrets.

### Current speech path

The loaded-extension speech check is `extension/src/voice/speech-check.html`, opened from the toolbar popup. It is an extension page, not a service worker and not a website. It speaks one fixed sentence through ElevenLabs and plays the audio in that page.

The API keys are read from `.env.local` (`ELEVENLABS_API_KEY`, `GEMINI_API_KEY`) at build time and inlined only into the offscreen voice document. `dist/` therefore contains them and is ignored by git, as is `.env.local`. No page asks for a key. This is a local developer setup: never commit, zip or share `dist/`.

The built extension holds a hands-free voice conversation about the current page from an offscreen document: Gemini transcribes each spoken sentence, Gemini answers from a screenshot and the page's extracted elements, and ElevenLabs speaks the answer. See `extension/src/voice/PROVIDER.md`.

### Sequence

1. With Role 4, verify a real microphone recording and a real ElevenLabs utterance inside the loaded extension. Resolve provider credentials immediately; a normal webpage test alone is insufficient.
2. Implement controller callbacks with local development input if needed, then real transcription.
3. Send completed transcript to Role 4; do not call the guidance model yourself. Avoid duplicate submissions of partial/final segments.
4. Receive SpeechJob only after the UI has committed. Stop old playback before another job. Suppress late audio from canceled jobs, even if its network request completes.
5. Integrate microphone controls supplied by Role 3; do not create competing floating controls.

### Boundaries and dependencies

Role 4 supplies extension execution context, message transport, credential access, and job lifecycle. Role 3 owns buttons/states visible to the user. Role 2 supplies the accepted text through Role 4. If ElevenLabs conversational tooling is used, disable independent task reasoning; it must not give instructions that bypass Roles 2/4.

Do not assume a service worker has a microphone, DOM, or persistent audio lifetime. Select and test the appropriate extension context with Role 4 using current Chrome documentation. Never bundle a shared key or add a server to work around auth without a new team decision.

### Acceptance

Actual speech becomes a single request; exact accepted guidance is spoken by ElevenLabs; assistant audio is not transcribed as user input; permission denial allows typing; navigation/new requests stop stale speech; stop/exit releases devices; transcript can be corrected through the UI. A pre-recorded clip is not completion.

### Microphone context

Push-to-talk capture runs in a top-level extension document. The development fixture is `extension/src/voice/mic-check.html`, opened as a `chrome-extension://` tab. Chrome can show the microphone permission prompt there. A service worker cannot record. An offscreen document can call `getUserMedia` only after that permission already exists, and creating one needs the `offscreen` manifest permission owned by Role 4.

This phase records microphone audio only. It does not transcribe speech or call ElevenLabs. No credentials are stored. The extension loads the compiled JavaScript from `extension/src/voice/dist/`. Recompile with `npx --yes -p typescript@5.9.2 tsc -p extension/src/voice` after editing the TypeScript.

### Agent kickoff prompt

> Read docs/CONTEXT.md in full. I own Role 1. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.


## Role 2 — User intent, AI guidance, and UI change proposals

Read the product and shared-contract sections above before implementing.

You own extension/src/guidance/. Interpret what the user wants using the current source page and the current redesigned screen. Return what to say, which real action to surface, and which visible target to highlight.

### Deliverables

- resolveIntent following GuidanceRequest/GuidanceProposal.
- A concise grounded prompt and runtime validation using shared types.
- Handling for ready, clarification, missing-target, and original-view cases.
- Development fixtures for an existing shortcut, an omitted action, unavailable action, and original form target.

### Responsibilities

1. Receive typed and spoken text through Role 4's identical pipeline; do not implement transcription.
2. Use both source actions and currently displayed labels. Existing Mack buttons must be named exactly as displayed.
3. When the request needs an omitted action, return additions with actual source IDs and clear labels. Ask for one next action, not a long autonomous plan. Do not invent “Contact” merely because the user wants it.
4. Return targetActionId for highlighting. Role 3 draws Mack highlights and Role 4 draws original-page highlights; you own the decision, not the drawing or mutation.
5. Return use_original for source form fields/submit controls or a target that cannot be faithfully simplified. Guidance is emitted only after Role 4 switches and verifies the view.
6. Return honest missing/ambiguous results. A support request uses the same resolver as any task; no hardcoded customer-service logic.
7. Echo validated request versions through code, not model guesses. Use Role 4's ModelClient and abort signal; validate model JSON and IDs. Treat website text as data, not privileged instructions.

### Boundaries

Role 3 owns initial screen generation; do not redesign the entire screen on each utterance. Additions are merged deterministically by Role 4. Do not edit UI components, click elements, own extension state, record audio, create a provider backend, or build a second model transport.

### Acceptance

A typed and a spoken request produce equivalent grounded proposals; existing labels match; omitted source action can be added/highlighted; missing action is not fabricated; stale outputs cannot apply; fields remain original-page guidance; page text cannot request arbitrary execution. Test schemas and semantic target constraints, then join the live integrated flow.

### Agent kickoff prompt

> Read docs/CONTEXT.md in full. I own Role 2. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.


## Role 3 — AI interface generation and rendering

Read the product and shared-contract sections above before implementing.

You own extension/src/ui/, including a design subfolder for generateScreen and its prompt. You own both the AI-generated screen design and the renderer that displays it. This is not a manually hardcoded set of buttons for each website.

### Deliverables

- generateScreen following DesignRequest/DesignProposal using Role 4's ModelClient.
- MackApp following the shared props and state.
- Structured design validation and reusable accessible components.
- Fixtures for different action counts, grouped tasks, loading, original mode, and guidance additions.

### Initial design

Inspect the supplied page snapshot through the model. Select relevant real actions, clearer labels, grouping, and title based on the page and stated goal. Return ScreenDesign; do not write arbitrary HTML/JavaScript or source selectors.

There is no fixed button count and no mandatory support/billing button. Use enough relevant actions for this screen without dumping every link. Deduplicate genuine duplicates and preserve meaning. Use available sections/labels to vary design across websites while keeping typography and controls predictable.

### Rendering and requested changes

Role 4 commits the initial design and later Role 2's additions. Render that authoritative state without independently rerunning generation on every render. Preserve accepted additions until a meaningful new page/context update; never let a delayed design erase a just-added task.

Render all returned sections/actions, stable IDs, large labels, and one instruction. Highlight highlightedActionId in simplified mode. Surface microphone controls, transcript correction, typing, clarification options, replay, back, retry, original view, and exit through callbacks. Do not call providers from UI event handlers directly.

A committed screen invokes onRendered once per version after targets exist. In original mode, render only the compact guidance controls; Role 4 owns highlighting the original source element. Coordinate panel placement so it does not obscure its target.

### Accessibility

Large high-contrast controls, approximately 24px task labels and 64px button height, readable one/two-column layout, normal scrolling, semantic headings, keyboard focus, labeled inputs, and no reliance on color or hover alone. Coordinate source-page focus isolation with Role 4. Support typing when audio is unavailable.

### Boundaries

Role 2 owns interpretation of conversational requests and additions. Role 4 owns source DOM, execution, state, and lifecycle. Role 1 owns audio. You do not add a server, scrape the site independently, pin customer support, truncate actions to three, or build a fake demo site.

### Acceptance

Live AI design reflects real source actions; different counts/groups display correctly; additions appear and are highlightable before speech; action callbacks preserve IDs; keyboard works; errors remain usable; original page remains usable in original mode. Finish inside the actual extension, not only a standalone React preview.

### Agent kickoff prompt

> Read docs/CONTEXT.md in full. I own Role 3. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.


## Role 4 — Chrome extension, website engine, and integration

Read the product and shared-contract sections above before implementing.

You own extension/src/platform/, extension entry/manifest/build files, root workspace configuration, and shared/. You coordinate the other three parts and own authoritative state. There is no application backend to scaffold.

### Deliverables

- Minimal installable extension with explicit activation on the selected existing real website.
- Source extractor and snapshot-scoped action registry.
- Single ModelClient transport/runtime usable by Roles 2/3, with credential access isolated from the webpage.
- Appropriate extension execution/message contexts for model/audio work, agreed with Role 1.
- State controller that implements the shared lifecycle, original-view highlights, and navigation refresh.
- Build/install instructions, shared contracts/runtime schemas, and docs/demo.md for the real journey.

### Start here

1. Inspect existing repo and agree one skeleton; land contracts before parallel integration. Own root dependencies/lockfile changes to prevent conflicting installs.
2. Record actual website URL and tasks after inspecting them with the team. Prove extension activation and extraction of one real navigable link.
3. Prove model/provider access and ElevenLabs credential/permission feasibility with Role 1. Existing real APIs do not mean local inference; document the selected approach accurately.
4. Wire Role 3's fixture into one working source-action click, then live design. Wire typed guidance before voice, then integrate all three without forking their logic.

### Browser responsibilities

Extract actual headings, context, links/buttons/labels; exclude Mack DOM and private values. Keep DOM elements local behind action IDs. Recheck connection, snapshot, visibility/disabled state before user-triggered execution. No hardcoded task URL/selector logic. Sensitive form submissions are never triggered from a model response or generated shortcut.

Handle the actual site's full-page or client-side navigation, debounced relevant changes, and extension reinjection. Keep task goal scoped to the active tab and clear it appropriately. Handle worker/context lifecycle rather than assuming permanent in-memory background state. Ignore own overlay mutations.

Implement the shared proposal/commit sequence exactly. Queue latest input while initial design is pending, reject old response IDs/versions, merge additions without silent renaming, and speak only after visible target readiness. A replay uses the current accepted instruction, never an obsolete response.

In original mode, restore the original website, scroll/mark the actual control, and coordinate non-obscuring panel placement. On exit, restore original focus/accessibility state and stop all jobs/audio.

### Integration boundaries

Role 1 implements audio/provider-specific voice behavior. Role 2 writes guidance prompt/proposals. Role 3 writes design prompt/renderer. Mount their modules and own wiring; don't rewrite them in platform code. Use explicit messages for cross-context work and validate senders/payloads; do not expose credentials to content scripts/page scripts. Check current official Chrome APIs and permissions when choosing contexts.

### Acceptance

Extension loads; one generated button navigates the real site; AI-generated UI updates after navigation; typed/voice requests add/highlight real targets; stale requests/audio cannot interfere; covered original controls are not keyboard-focusable; original-view exit works; missing/disabled targets recover clearly. Automate meaningful ID/version checks and coordinate a full live demo with all owners.

### Agent kickoff prompt

> Read docs/CONTEXT.md in full. I own Role 4. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.


## Mack repository agent instructions

Read docs/CONTEXT.md in full before changing code. Ask the human for their role number if none was assigned. Implement that role and respect the ownership table. Do not spawn agents unless explicitly asked.

This pack supersedes older Mack role splits and backend designs. The roles are: 1 voice/ElevenLabs, 2 intent/guidance, 3 interface generation/rendering, 4 extension/platform/integration. No application backend and no fake website.

Role 4 owns root configuration, lockfile, shared contracts, and authoritative state. Other roles request shared edits rather than making incompatible copies. Small coordinated integration changes are allowed after agreement with the affected owner.

Build only the pitch. Use fixtures only during component development; verify live AI/voice on a real website before claiming completion. Never commit credentials. If provider authentication is blocked, explain the concrete missing capability and continue independent work; do not silently change architecture.

When shared requirements change, update both the relevant standalone file (PRD.md or a role-*.md file) and the matching section of CONTEXT.md. Do not maintain two conflicting sources of truth. Changes require human/team agreement, not unilateral scope expansion.

