# Role 3 — AI interface generation and rendering

Read MAIN_PRD.md and SHARED_CONTRACT.md before implementing. The combined LENS_CONTEXT.md includes all of these documents.

You own extension/src/ui/, including a design subfolder for generateScreen and its prompt. You own both the AI-generated screen design and the renderer that displays it. This is not a manually hardcoded set of buttons for each website.

## Deliverables

- generateScreen following DesignRequest/DesignProposal using Role 4's ModelClient.
- LensApp following the shared props and state.
- Structured design validation and reusable accessible components.
- Fixtures for different action counts, grouped tasks, loading, original mode, and guidance additions.

## Initial design

Inspect the supplied page snapshot through the model. Select relevant real actions, clearer labels, grouping, and title based on the page and stated goal. Return ScreenDesign; do not write arbitrary HTML/JavaScript or source selectors.

There is no fixed button count and no mandatory support/billing button. Use enough relevant actions for this screen without dumping every link. Deduplicate genuine duplicates and preserve meaning. Use available sections/labels to vary design across websites while keeping typography and controls predictable.

## Rendering and requested changes

Role 4 commits the initial design and later Role 2's additions. Render that authoritative state without independently rerunning generation on every render. Preserve accepted additions until a meaningful new page/context update; never let a delayed design erase a just-added task.

Render all returned sections/actions, stable IDs, large labels, and one instruction. Highlight highlightedActionId in simplified mode. Surface microphone controls, transcript correction, typing, clarification options, replay, back, retry, original view, and exit through callbacks. Do not call providers from UI event handlers directly.

A committed screen invokes onRendered once per version after targets exist. In original mode, render only the compact guidance controls; Role 4 owns highlighting the original source element. Coordinate panel placement so it does not obscure its target.

## Accessibility

Large high-contrast controls, approximately 24px task labels and 64px button height, readable one/two-column layout, normal scrolling, semantic headings, keyboard focus, labeled inputs, and no reliance on color or hover alone. Coordinate source-page focus isolation with Role 4. Support typing when audio is unavailable.

## Boundaries

Role 2 owns interpretation of conversational requests and additions. Role 4 owns source DOM, execution, state, and lifecycle. Role 1 owns audio. You do not add a server, scrape the site independently, pin customer support, truncate actions to three, or build a fake demo site.

## Acceptance

Live AI design reflects real source actions; different counts/groups display correctly; additions appear and are highlightable before speech; action callbacks preserve IDs; keyboard works; errors remain usable; original page remains usable in original mode. Finish inside the actual extension, not only a standalone React preview.

## Agent kickoff prompt

> Read LENS_CONTEXT.md in full. I own Role 3. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.
