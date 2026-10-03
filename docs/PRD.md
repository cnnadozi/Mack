# Mack — Main PRD

**Mack is a Chrome extension.** It is not a website, a web app, a mobile app, or a standalone desktop app. Everything in this PRD is built and shipped as a Chrome extension that runs on top of an existing real website.

## Pitch and build rule

“Mack turns confusing websites into simple interfaces and guides you through them by voice.”

Build only what delivers the pitch or directly makes it work reliably. Build a Chrome extension that works on an existing real website. Do not build a fake website or a separate application backend.

Three promises:
1. AI redesigns the current screen into useful, clearly labeled actions.
2. Users speak or type a request and receive a spoken, highlighted next step.
3. Mack adapts after navigation and can surface real actions missing from the current simplified view.

## Exact four roles

| Role | Responsibility | Owned paths |
| --- | --- | --- |
| 1 | ElevenLabs, microphone input, transcription, playback | extension/src/voice/ |
| 2 | Request interpretation, AI responses, requests to add/highlight actions | extension/src/guidance/ |
| 3 | AI-driven initial redesign, structured screen generation, UI rendering | extension/src/ui/ |
| 4 | Chrome shell, permissions, website extraction, action execution, shared state, integration | extension/src/platform/, extension entry/build/manifest, root config, shared/ |

Role 4 coordinates integration. Roles 2 and 3 use one model-access boundary owned by Role 4, but own their separate prompts and output validation. Role 4 handles transport and credentials, not the reasoning itself. Role 1 owns ElevenLabs-specific requests; Role 4 supplies the permitted extension context/credential access.

## Architecture

Mack is a Chrome extension, and all application logic runs in extension contexts. No server/, REST application endpoints, or localhost application backend. Cloud provider calls may still be used: “client-side application” does not mean the AI model runs locally or that voice is offline. The team must choose and record the actual language-model provider/runtime.

AI produces structured screen descriptions, grounded action IDs, labels, and groups. Code renders accessible components. Do not execute model-generated JavaScript or arbitrary HTML. Redesign can vary per site and screen; there is no fixed two/three-button template and no compulsory customer-service button.

## First decisions

Record role-to-person assignments, one existing real website URL, an actual primary task, another supported task, model provider/runtime, ElevenLabs voice and authentication approach, and extension audio context. Choose a publicly accessible journey without a required payment or login for the first demo. Nothing in this PRD invents the site's buttons or promises universal compatibility.

## Provider authentication: resolve early

ElevenLabs integration is required for spoken output. Role 1 chooses a working transcription path; ElevenLabs transcription is preferred if feasible, but using a separate supported speech-input implementation is allowed. ElevenLabs must speak the same accepted instruction shown on screen, not independently invent navigation instructions.

An extension cannot hide a distributed service API key. Never commit or bundle team/provider secrets, including through build-time environment variables. For a private hackathon run, the operator may supply their own restricted, temporary credentials at runtime in an extension-owned setup surface; keep them out of page/content-script data, logs, fixtures, and exported packages. This is operator-managed access, not a secure way to distribute a shared secret. Verify provider and browser compatibility on the actual machine immediately.

ElevenLabs documents client-side realtime transcription using a single-use token; token issuance needs authenticated provisioning and does not happen automatically because an app is an extension. If that path is chosen, identify an existing authorized provisioning mechanism. Do not silently add a backend or fake working authentication. If no authorized workable path is available, report the exact blocker while continuing independent tasks. Do not claim a production-safe credential flow has been implemented merely because a private demo works.

References checked for this design: https://elevenlabs.io/docs/api-reference/authentication and https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming . Check current SDK/API details during implementation rather than assuming methods.

## Required experience

- Large clear actions chosen from the actual page according to page context and any stated goal; flexible count and plain grouping.
- One persistent place to speak or type. Show transcription so it can be corrected.
- One instruction at a time. Match speech to the exact visible label.
- Back, original-view access, replay, retry, and exit where appropriate. No complex onboarding, mode-picker, or settings dashboard.
- Task controls at least 64px high, labels around 24px; essential text at least 20px; other controls at least 44px. Visible keyboard focus, native controls, high contrast, readable scrolling, and reduced-motion support.
- Covered original controls cannot remain keyboard-focusable. Original-view exit restores their prior state.
- Complex forms stay on the original page with a compact guidance panel. Do not rebuild forms or auto-submit. Final sensitive actions require direct user action on the original website.

## Grounding and state

Role 4 extracts headings, concise text, visible links/buttons/field labels and generates snapshot-scoped action IDs. Exclude Mack DOM and sensitive input values. Original elements stay in a local registry, not provider payloads. Model output may reference only current IDs.

Role 3 designs the initial screen. Role 2 proposes contextual additions and highlights after user requests. Only Role 4 commits state changes; Role 3 renders accepted state. No race between two agents rewriting the same UI.

On navigation or relevant page change, invalidate old requests, mappings, highlights, and speech. Ignore Mack's own DOM mutations. Carry the user goal to the new page, refresh its design, then request guidance against that accepted design. Discard delayed results using snapshot version, screen version, and request ID.

Role 2 never clicks. Role 3 never finds source elements. Role 1 never makes independent navigation decisions. A rendered button sends an action ID to Role 4, which validates and executes the source action following a user click.

## Demo and completion

Existing real page → activate Mack → AI-generated simplified view → spoken request → accepted button addition/highlight → spoken next instruction → user clicks → real navigation → refreshed UI → additional available task. Pick tasks based on what the chosen website actually supports. Do not hide a useful action merely to stage an omitted-button demo.

Require live AI, real microphone input, ElevenLabs speech, actual source actions, keyboard access, original-view restoration, stale-response rejection, and honest missing-target behavior. Verify microphone denial still permits typed requests. Component fixtures are allowed during development but cannot substitute for the real final flow.

## Out of scope

No fake portal, application backend, second website project, general autonomous browsing, payments integration, universal compatibility promise, rebuilt forms, translation, persistent user profiles, caregiver tools, continuous conversational audio, or a separate scripted demo engine. Screenshot context is only justified by an observed blocker on the chosen journey. Freeze features after the pitch works; fix defects and rehearse.
