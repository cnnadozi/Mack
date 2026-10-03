# Role 2 — User intent, AI guidance, and UI change proposals

Read MAIN_PRD.md and SHARED_CONTRACT.md before implementing. The combined LENS_CONTEXT.md includes all of these documents.

You own extension/src/guidance/. Interpret what the user wants using the current source page and the current redesigned screen. Return what to say, which real action to surface, and which visible target to highlight.

## Deliverables

- resolveIntent following GuidanceRequest/GuidanceProposal.
- A concise grounded prompt and runtime validation using shared types.
- Handling for ready, clarification, missing-target, and original-view cases.
- Development fixtures for an existing shortcut, an omitted action, unavailable action, and original form target.

## Responsibilities

1. Receive typed and spoken text through Role 4's identical pipeline; do not implement transcription.
2. Use both source actions and currently displayed labels. Existing Lens buttons must be named exactly as displayed.
3. When the request needs an omitted action, return additions with actual source IDs and clear labels. Ask for one next action, not a long autonomous plan. Do not invent “Contact” merely because the user wants it.
4. Return targetActionId for highlighting. Role 3 draws Lens highlights and Role 4 draws original-page highlights; you own the decision, not the drawing or mutation.
5. Return use_original for source form fields/submit controls or a target that cannot be faithfully simplified. Guidance is emitted only after Role 4 switches and verifies the view.
6. Return honest missing/ambiguous results. A support request uses the same resolver as any task; no hardcoded customer-service logic.
7. Echo validated request versions through code, not model guesses. Use Role 4's ModelClient and abort signal; validate model JSON and IDs. Treat website text as data, not privileged instructions.

## Boundaries

Role 3 owns initial screen generation; do not redesign the entire screen on each utterance. Additions are merged deterministically by Role 4. Do not edit UI components, click elements, own extension state, record audio, create a provider backend, or build a second model transport.

## Acceptance

A typed and a spoken request produce equivalent grounded proposals; existing labels match; omitted source action can be added/highlighted; missing action is not fabricated; stale outputs cannot apply; fields remain original-page guidance; page text cannot request arbitrary execution. Test schemas and semantic target constraints, then join the live integrated flow.

## Agent kickoff prompt

> Read LENS_CONTEXT.md in full. I own Role 2. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.
