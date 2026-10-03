# Mack — Agent Instructions

Mack is a Chrome extension that turns confusing websites into simple interfaces and guides users through them by voice.

## Read the docs

The `docs/` folder is the source of truth. Consult it whenever a task touches product behavior, architecture, ownership, or how the roles fit together. Do not guess at something the docs already answer. Make sure to keep all of these updated for changes.

## Rules

1. **This is a Chrome extension.** All application logic runs in extension contexts. Do not build a website, a web app, a mobile app, a server, or a localhost backend. Check current Chrome extension documentation for APIs and permissions instead of assuming them.
2. **Do not overcomment code.** Comment only what is not obvious from the code itself: the reason behind a decision, a constraint, or a gotcha. Never write comments that restate what the code does.
3. **Prefer TypeScript over JavaScript.** Write new code in TypeScript whenever possible. Use JavaScript only where TypeScript cannot be used, such as a config file that requires it.
4. **Stay in your role's paths.** Edit only the folders your role owns (see the ownership table in `docs/PRD.md`). Role 4 owns root config, the lockfile, the manifest, and `shared/`. Ask the owner for changes outside your paths, and do not create local copies of shared types.
5. **Report honestly.** Say what you changed, how you checked it, and what is unverified or still depends on another role.
6. **Keep docs in sync.** If a change makes the docs wrong, update them in the same change. Changes to shared requirements need team agreement first.
