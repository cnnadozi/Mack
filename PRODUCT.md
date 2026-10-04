# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who find a website confusing and want to get one thing done on it: check a claim, refill a prescription, pay a bill, find a doctor, buy something. Most of them are older adults, because older people are the ones most often lost on busy sites, but Mack is not only for them: anyone overwhelmed by a site, a first-time visitor or someone reading in a second language, is the same user. They often have lower confidence online and may have weaker eyesight or less precise pointing.

## Product Purpose

Mack is a Chrome extension that turns a confusing website into a simple interface and guides the user through it by voice. It reads the real page, redesigns the current screen into a few large, clearly labelled actions (the simple view), and answers spoken or typed requests with a spoken, highlighted next step. It can carry out tasks on the page for the user. Success is the user finishing their task on the real site without help from another person.

## Positioning

Mack works on top of the real website the user already uses, not a copy of it: every button in the simple view is one of the site's own links or buttons, checked against the live page before it is shown and before it is pressed. The design is made for each page as it is, and voice guidance points at the exact control to use.

## Operating Context

- Runs on any https website the user turns Mack on for (examples tested: costco.com, uhc.com, libertymutual.com, trinityhealthmichigan.org).
- Mack's bar floats at the bottom of every page: a round talk button (press to talk, or hold Space), the Simple view button, theme, transcript and settings.
- The simple view covers the site in a full-screen overlay inside a shadow root; "Original page" removes it, and a small Mack guide panel appears over the original page when that page is better used as it is (forms, checkout, articles).
- Voice in and out: Gemini transcribes and answers, ElevenLabs speaks.

## Capabilities and Constraints

- A Chrome extension only: no website, server or backend. All UI is React (shadcn/ui on Tailwind v4) rendered in a shadow root on someone else's page, with sizes in pixels so the site's root font size cannot shrink it.
- The model only chooses content (which real actions, their short labels, section headings, title, whether to show the site's search box). It never writes HTML, CSS or layout; the look is entirely Mack's own components.
- Light and dark mode; 11 interface languages including Arabic (right to left).
- Highlights for "the next step" must be unmistakable and never rely on colour alone.
- Pages that are mainly a form, checkout or article stay on the original page.
- Open decision: how much the site's identity (its colour and logo) leads inside the simple view versus Mack's own identity. The user rejected an all-Mack, monochrome version and is undecided; show options before committing.

## Brand Commitments

- Name: Mack. Logo: a rounded white "M" on a near-black square (`docs/assets/mack-logo.png`), used for the extension icons and Mack's bar.
- The site's own logo appears in the simple view so users know which site they are on; when a site has no logo, its name is written out. Never a "Simplified by Mack" or "✨ Mack" label.
- Voice: friendly helper, not a quiz; short plain sentences; at most one question at a time.

## Evidence on Hand

- Product docs: `docs/PRD.md`, `docs/role-3-ui.md`, `README.md`.
- No user research, testimonials or metrics exist; do not invent any.

## Product Principles

1. The real site, made simple: never invent actions, and never take away what the user came to do.
2. One clear next step at a time: few choices, the most likely one first.
3. Say it, show it, do it: what Mack says, highlights and does always match.
4. Calm and readable over clever: large type, generous targets, plain words.

## Accessibility & Inclusion

WCAG 2.2 AA. Large text (labels about 24px, nothing essential under 20px), task buttons at least 64px tall, visible focus, full keyboard use, labelled inputs, `prefers-reduced-motion` and `forced-colors` support, and right-to-left layouts.
