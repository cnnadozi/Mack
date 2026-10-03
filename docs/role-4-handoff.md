# Role 4 integration handoff

Contract v1 is restored verbatim from `00e2ba2:LENS_CONTEXT.md` in
`shared/contracts.ts`. The `LensError`, `LensUIState`, and `LensAppProps` names
remain unchanged. Data schemas and parse helpers validate boundary payloads;
`validateDesign` checks grounded shortcut IDs and `sameStamp` checks all versions.

## Request to Role 2 (Chika)

Your `contract.pending.ts` differs from v1 in several places. Please migrate your
owned files and tests to import `shared/contracts.ts`, then delete the provisional
contract. No Role 2 files have been edited by Role 4.

| Provisional shape | Contract v1 |
| --- | --- |
| `kind: "link"` | `kind: "navigate"` |
| `page.url`, `page.text[]` | `snapshot.pageUrl`, `snapshot.context` |
| top-level numeric versions | `stamp` with string versions |
| `text`, `page` | `utterance` / `goal`, `snapshot` |
| section `title`, `actions` | section `id`, `heading`, `buttons` |
| `instruction` | `responseText` |
| `clarification`, `missing_target` | `needs_clarification`, `not_found` |
| `model.complete(...)` returning text | `model.generateJSON({ task, system, payload }, signal)` returning parsed JSON |

The resolver should implement `ResolveIntent` (with the model injected through a
factory, e.g. `createResolveIntent(model: ModelClient): ResolveIntent`). Prompts
and grounding remain Role 2's responsibility.

Until then, `extension/src/platform/guidance-adapter.ts` translates v1 requests
into your provisional shapes, calls your `resolveIntent` unchanged, and maps the
outcome back (`clarification` → `needs_clarification`, `missing_target` →
`not_found`, `instruction`/`question`/`message` → `responseText`). Your
`model.complete` is served by `generateJSON({ task: "guide", system, payload:
user })`; string payloads are sent to the model verbatim. It is not a second
contract or model transport, and it is deleted once you migrate.

Your `node:test` suite now runs in `npm test` through `tsx`
(`npm run test:guidance`); all 17 tests pass unchanged.

Also on your branch: `extension/popup.*` and `extension/assets/cursor-*` (Mack
cursor) are in Role 4's extension root but not wired. A `default_popup` would
stop `chrome.action.onClicked` from firing, which is how Mack activates, and the
cursor is not in the PRD scope. Please confirm whether to delete them or move
the idea into a team scope discussion.

## Request to Role 3 (Alex)

The shared type names and shapes are preserved. Please review your boundary
against `shared/contracts.ts`. No edits to `extension/src/ui/` are needed for v1.

## Request to Role 1

Provide the `VoiceController` factory, selected transcription/authentication
approach, and tested extension audio context. Microphone and speech integration
cannot be claimed complete until those are available and tested together.
