# Role 4 checkpoint — October 3, 2026

Implementation paused at the user's request. All work below is saved in Git.
Resume from `role-4/guidance-integration`; do not start over or edit other roles'
feature files. Small PRs have not been opened or merged into main yet.

## Completed branches, in order

1. `role-4/contracts-v1`: Contract v1 restored from `00e2ba2:LENS_CONTEXT.md`,
   preserving LensError/LensUIState/LensAppProps, with Zod data validation and
   grounding/version helpers. Role 2 migration request is documented in
   `docs/role-4-handoff.md`.
2. `role-4/toolchain`: TypeScript, React 18, Vitest/jsdom/testing-library,
   esbuild, dependencies/lockfile, IIFE content script and ESM worker builds.
3. `role-4/contexts-model`: action activation, GOV.UK host permission,
   trusted session credentials entered in an extension-owned options page.
   Demo site/tasks/provider are documented in `docs/demo.md`.
4. `role-4/model-transport`: Anthropic service-worker transport, sender and
   payload validation, request-ID cancellation, 25-second timeout, sanitized
   failures. Credentials/provider SDK are excluded from the content bundle.
5. `role-4/platform`: extractor/local action registry, versioned state
   controller, stale result rejection, addition merging, action checks,
   navigation observation, body inert restoration, optional voice boundary.
6. `role-4/ui-integration`: Alex's code merged unchanged from `origin/alex`
   at `7e770aa`; mounts and calls Role 3's modules, queues loading state,
   handles exit/reinjection. Guidance is still an explicit unavailable error.
7. `role-4/guidance-integration`: Chika's branch merged unchanged from
   `origin/chika` at `312c711`. Merge conflicts in root README and manifest
   were resolved in favor of the new Role 4 setup. No guidance adapter yet.

## Verified before the last merge

`npm.cmd run check` passed on the UI integration branch:
TypeScript, 39 Vitest tests (including Role 3's 24 tests), and extension build.
The unpacked output is `dist/`. No live Anthropic key was supplied and no
loaded-Chrome live-site/voice rehearsal has been performed. Automated integration
tests use clearly marked canned model output, not a final-demo substitute.

On this Windows machine, use `npm.cmd` because PowerShell blocks `npm.ps1`.
esbuild/Vitest may need sandbox escalation due to Windows directory restrictions.
Git commands in the sandbox need the per-command option:
`git -c safe.directory=C:/Users/Administrator/Desktop/Codecode/Mack ...`.
`gh` is not installed.

## Next work

- Finish Role 2 integration without editing `extension/src/guidance/`.
  Their provisional contract has numeric top-level versions, kind `link`,
  different page/screen/result shapes, and model.complete returning text.
  V1 uses string stamps, kind `navigate`, and model.generateJSON returning JSON.
  Ask Role 2 to migrate imports/shapes; a temporary platform adapter may
  translate their existing resolver while preserving their prompts/grounding.
- Run their node:test tests through a TypeScript runner (tsx) separately from
  Vitest; they are currently excluded in vitest.config.ts. Add the runner to
  the root toolchain/lockfile if retaining the existing tests.
- Re-run typecheck/tests/build after the guidance merge and adapter.
- Add meaningful integrated tests for guidance/stale responses and navigation.
- Review remaining lifecycle edge cases (tab-session update ordering, source
  link changes including query-only changes, original-target readiness,
  cancellation on navigation and repeated activation).
- Update README/handoff to describe final wired behavior; current README still
  describes the earlier contexts stage.
- Open small stacked PRs in the order above. Do not claim they are landed
  until reviewed/merged. PR descriptions should explicitly request Role 2's
  contract migration and Role 3's boundary review.
- Voice remains blocked on Role 1's factory, transcription/authentication,
  and tested extension audio context. Do not implement their voice logic.
- Live browser/provider verification still requires an operator key and Chrome.

## Resume prompt

Read docs/CONTEXT.md and docs/role-4-checkpoint.md. Continue Role 4 from
role-4/guidance-integration. Preserve all saved work and leave other roles'
feature files unchanged. Finish integration and checks, then prepare the small
PRs requested in the original task. Report verified behavior and blockers.
