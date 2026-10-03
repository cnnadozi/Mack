# Role 4 demo setup

## Selected journey

Start at https://www.gov.uk/. Primary task: find benefits information, using
the site's real Benefits link. Second task: find passport information through
the site's real Passports, travel and living abroad section and Passports link.
These are public information journeys; stop before any application, payment,
or login. The platform has no task-specific URL or selector shortcuts.

The site and links were inspected on October 3, 2026. This is Role 4's selected
integration target, pending the team's live rehearsal. It is not a promise of
compatibility with every GOV.UK service or other website.

## Model and credentials

Provider: Anthropic Messages API. Selected model: `claude-sonnet-5-5`.
Both design and guidance use one service-worker `ModelClient`; prompts and
grounding belong to Roles 3 and 2. No application server exists.

An operator pastes their own restricted temporary Anthropic key in Mack's
extension options. The key is stored only in `chrome.storage.session`, with
`TRUSTED_CONTEXTS` access. Content scripts receive results, never credentials.
Reloading/disabling/updating the extension or restarting Chrome clears the key.
This is private demo access, not a production shared-secret distribution scheme.

## Try it

1. Run `npm ci`, `npm run build` from the repository root.
2. Load `dist/` using Chrome's Developer mode / Load unpacked flow.
3. In Mack's Details, open Extension options and save a temporary key.
4. Open GOV.UK, then click Mack in the toolbar. After platform integration,
   wait for the generated screen, type “Find benefits information”, and click
   the highlighted real action. Check that navigation produces a fresh screen.
5. Try the passport information task. Original page restores the source page;
   Exit restores the previous inert/focus state and cancels work.
6. For code changes: rebuild, reload the extension, refresh the website tab,
   and re-enter the session key.

## Remaining live evidence

Live provider authentication, real-site keyboard navigation, and full browser
navigation must be checked in loaded Chrome with the operator's key. Voice is
blocked on Role 1's controller/authentication/context decision. An unavailable
microphone must leave typed guidance usable.

## References

- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://github.com/anthropics/anthropic-sdk-typescript
- https://platform.claude.com/docs/en/models/overview
- https://www.gov.uk/browse/benefits
- https://www.gov.uk/browse/abroad/passports
