---
name: Mack
description: A recipe-card box that files a confusing website's real actions behind tabs in the site's own colour, with the next step pulled up.
colors:
  site-brand-default: "#2457c5"
  on-site-brand: "#ffffff"
  head-rule-red: "#c8372d"
  highlight-yellow: "#ffd60a"
  highlight-edge: "#111111"
  highlight-ink: "#111111"
  highlight-fill: "#fff3a3"
  focus-amber: "#b45309"
  danger-red: "#b42318"
  danger-wash: "#fef3f2"
  card-stock: "#ffffff"
  tin: "#f1f2f4"
  tab-grey: "#e4e6ea"
  hairline: "#c5c9d0"
  field-edge: "#8a9099"
  ink-muted: "#565c66"
  ink-soft: "#2e3238"
  ink: "#16181c"
  dark-card-stock: "#202328"
  dark-tin: "#131518"
  dark-tab-grey: "#2a2e34"
  dark-hairline: "#3c414a"
  dark-field-edge: "#6c727c"
  dark-ink-muted: "#a7adb6"
  dark-ink-soft: "#d9dce1"
  dark-ink: "#f3f4f6"
  dark-head-rule: "#ef6b5f"
  dark-focus-amber: "#fbbf24"
  dark-danger-red: "#f87171"
  dark-danger-wash: "#3b1416"
  dark-highlight-edge: "#ffffff"
  dark-highlight-fill: "#4a3d00"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  instruction:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "25px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
  tab:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 750
    lineHeight: 1.25
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  card: "5px"
  tab: "7px"
  control: "9px"
  logo-chip: "10px"
  panel: "18px"
  pill: "9999px"
spacing:
  tight: "8px"
  card-gap: "10px"
  section-gap: "14px"
  inset: "16px"
  gutter: "20px"
  shell-gap: "24px"
  box-gap: "32px"
components:
  lid:
    backgroundColor: "{colors.site-brand-default}"
    textColor: "{colors.on-site-brand}"
    padding: "16px 20px"
  divider-tab:
    backgroundColor: "{colors.site-brand-default}"
    textColor: "{colors.on-site-brand}"
    typography: "{typography.tab}"
    rounded: "{rounded.tab}"
    padding: "9px 22px 7px"
  more-tab:
    backgroundColor: "{colors.tab-grey}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    height: "56px"
  more-tab-hover:
    backgroundColor: "{colors.hairline}"
  task-card-primary:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.card}"
    padding: "24px 24px 20px"
    height: "104px"
  task-card:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.card}"
    padding: "16px 20px 14px"
    height: "76px"
  task-row:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "14px 20px 12px"
    height: "68px"
  task-card-highlighted:
    backgroundColor: "{colors.highlight-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  badge-next-step:
    backgroundColor: "{colors.highlight-yellow}"
    textColor: "{colors.highlight-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  button-primary:
    backgroundColor: "{colors.site-brand-default}"
    textColor: "{colors.on-site-brand}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "56px"
  button-outline:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.tin}"
  input-field:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "56px"
  search-card:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "18px 20px 20px"
  guide-panel:
    backgroundColor: "{colors.tin}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    width: "460px"
  error-banner:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 16px"
---

# Design System: Mack

Scope: the simple view (full-screen overlay) and the guide panel over original pages, both rendered by `extension/src/ui/` inside a shadow root. Mack's floating bar (`extension/src/platform/content/panel.tsx`) is outside this system and keeps its own shadcn-neutral look.

## Overview

**Creative North Star: "The Recipe Card Box"**

Every website Mack simplifies becomes a kitchen index-card box. The lid is a full-width strip in the site's own colour carrying the site's logo on a white chip, the page title and the controls. Inside, flat white card stock sits on a cool grey tin, and the one card to do now is already pulled up out of the box, marked by a single straight red rule across its top. Everything else is filed behind staggered divider tabs that also wear the site's colour; "More options" is the back of the box, a plain grey tab, collapsed.

The world is flat, quiet and large. Greys never improvise: each one is a step of a fixed eight-step ramp, and the site's colour is allowed in exactly two places (the lid and the tabs, plus filled submit buttons). Cards share one scale and baseline and stack as full-width rows in one centred column, so the eye travels down a single reading spine. When Mack points at something, the yellow highlight ring takes over and the rest of the box steps back.

This world deliberately refuses the category default: a tinted page of same-size rounded icon-tile cards with soft shadows. There are no icon tiles, no soft shadows on cards, no gradients and no decorative accents.

**Key Characteristics:**
- Site colour on the lid and divider tabs only; Mack's own materials (card stock, tin, ink, red rule) everywhere else.
- One pulled-up next-step card with a heavy ink edge and an 8px red head rule.
- Flat card stock with hairline edges; depth comes from tone and borders, not shadows.
- A fixed grey ramp, re-stepped for dark mode rather than inverted ad hoc.
- Large type throughout (20px body, 24px card labels, 28px next step).
- The yellow "Next step" highlight never relies on colour alone: ring, contrasting edge, glow and a text badge.

## Colors

A neutral, cool-grey box tinted only by the visited site's colour, with one red rule and one yellow highlight as Mack's own signals.

### Primary
- **Site Brand** (runtime; default `site-brand-default`, a clear mid blue used when a site has no recognisable colour): fills the lid strip, the divider tabs, the tab underline (3px) and filled submit buttons. It is computed per site by `theme.ts`: in light mode it is darkened in 8% steps until it reaches 4.5:1 against white; in dark mode it is lightened until it reaches 4.5:1 against the dark card surface, and its label colour flips to near-black when that reads better. Lighter derivatives (`--brand-tint`) are used only for text selection.
- **On Site Brand** (`on-site-brand`): text and icons on the lid, tabs and filled buttons; lid controls use it as a transparent outline at 60% strength, with a 14% wash on hover.

### Secondary
- **Head Rule Red** (`head-rule-red`, lifted to `dark-head-rule` in dark mode): the single straight 8px rule across the top of the pulled-up card. It is Mack's mark, not the site's.

### Tertiary
- **Highlight Yellow** (`highlight-yellow`) with **Highlight Edge** (`highlight-edge`, white in dark mode) and **Highlight Fill** (`highlight-fill`, a deep olive `dark-highlight-fill` in dark mode): exclusively the "Next step" state, as a 4px ring, a 3px contrasting edge, an outer yellow spread, a pulsing glow and the pill badge.
- **Focus Amber** (`focus-amber`, `dark-focus-amber` in dark mode): the 4px keyboard focus outline (3px offset) everywhere except on the lid, where focus uses the on-brand colour.
- **Danger Red** on **Danger Wash** (`danger-red`, `danger-wash`): the error banner's 2px border and fill, and the listening state of the Speak button.

### Neutral
The ramp, light to dark: **Card Stock** (`card-stock`, cards, request bar, fields), **Tin** (`tin`, the overlay ground and guide panel body), **Tab Grey** (`tab-grey`, the "More options" tab and dimmed tabs), **Hairline** (`hairline`, card edges and rules), **Field Edge** (`field-edge`, input borders and the "More options" underline), **Ink Muted** (`ink-muted`, secondary text and card icons), **Ink Soft** (`ink-soft`, reserved ramp step), **Ink** (`ink`, all primary text and the pulled-up card's edge). Dark mode re-steps the same eight positions (`dark-*` keys): the ground goes darker than the cards, so cards still read as stock lying in a tin.

### Named Rules
**The Lid and Tabs Rule.** The site's colour appears only on the lid strip, the divider tabs with their underline, and filled submit buttons. Cards, the ground, icons and text never take it.

**The One Ramp Rule.** Every grey is a step of the fixed eight-step ramp. No in-between greys, no tinted greys, no opacity-made greys (the one exception is the deliberate 0.55 dim while Mack points).

**The Red Brand Rule.** When the site's own colour is reddish (hue under 30° or over 330° with real saturation), the head rule switches from red to ink so the pulled-up card stays distinct from the lid.

## Typography

**Display Font:** platform system sans (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`)
**Body Font:** the same stack

**Character:** One family, carried entirely by size and heavy weights (600 to 800) so labels read at a glance for users with weaker eyesight. The face is currently the platform default; a bundled, more legible face (Atkinson Hyperlegible Next is proposed) is an open item awaiting the user's permission, not a decision.

### Hierarchy
- **Display** (800, 32px, 1.12, -0.01em; 26px at 560px and below; 21px in the guide panel): the page title on the lid, balanced wrapping.
- **Headline** (700, 28px; 25px at 560px and below): the pulled-up next-step card label.
- **Instruction** (700, 25px, 1.3; 21px in the guide panel): what Mack says now, set as plain words on the ground, not in a box.
- **Title** (600, 24px, 1.25): ordinary task card labels. "More options" rows use 22px at the same weight.
- **Tab** (750, 22px, 1.25; 20px at 560px and below): divider-tab section names and the site search label.
- **Body** (400, 20px, 1.4): status lines, empty states, error text (600), request labels (750). 20px is the floor for essential text.

### Named Rules
**The Twenty Floor Rule.** Nothing a user must read to act is set below 20px; card labels sit at 22 to 28px.

## Layout

One centred column, 820px max, with a 20px gutter, on the full-viewport tin overlay (fixed, scrolls internally, `overscroll-behavior: contain`). The lid spans the full width with its content aligned to the same 820px column. Vertical rhythm: 24px between the shell's blocks (next-step card, instruction, search, the box, request bar), 32px between filed sections, 14px from a tab to its cards, 10px between cards, 8px between controls. Divider tabs stagger across the column (each section's tab is inset by 9% of the column per position, cycling over four positions; 5% at 560px and below) and cap at 78% width, so the tabs read as a filed set rather than a list of headings.

When the view is embedded in the extension, the shell keeps 160px of bottom padding so the last cards scroll clear of Mack's floating bar; standalone, a sticky request bar sits at the bottom on card stock with a hairline top edge. The guide panel is a 460px (or viewport minus 32px) card docked 16px from any of four corners and cycled by "Move panel". The single breakpoint is 560px. Right-to-left layouts mirror the trailing arrows and the chevron. All sizes are in pixels because the host page controls the root font size.

## Elevation & Depth

Flat by default. Cards are stock lying in a tin: depth is conveyed by the tin-to-card tonal step, hairline edges, and for the pulled-up card a heavier 2px ink edge and the 8px head rule. Shadows appear in only two places, both functional.

### Shadow Vocabulary
- **Highlight ring** (`box-shadow: 0 0 0 3px <highlight-edge>, 0 0 0 8px <highlight-yellow>, 0 0 30px 10px <highlight-yellow at 80%>`, pulsing to `0 0 0 12px` and `0 0 48px 20px` over 1.2s): the "Next step" state on a task card or the search card only.
- **Floating panel** (`box-shadow: 0 18px 40px -12px rgba(0,0,0,0.4), 0 4px 10px -2px rgba(0,0,0,0.18)`): the guide panel only, because it floats over a third-party page it must separate from.

### Named Rules
**The Stock-in-a-Tin Rule.** Cards inside the box never carry a shadow. If something needs to stand out, it gets a heavier edge, a rule, or the highlight state.

**The Step-Back Rule.** While Mack points, every other card, the search card and the instruction fade to 0.55 opacity, and divider tabs turn tab-grey with ink-muted labels instead of fading, so their text keeps full contrast.

## Shapes

Index-card corners, not app tiles. Cards, the search card, the error banner and skeletons use a barely-there 5px radius. Divider tabs and the "More options" tab round only their top corners (7px) and sit directly on a straight underline (3px in the site colour, or field-edge for "More options"). Controls and fields use 9px. The logo chip is a 10px-rounded white plate (44px tall, 34px in the panel); a bare site icon inside it is 28px with 6px corners. The guide panel is the softest object at 18px, signalling that it floats rather than sits in the box. Only the "Next step" badge is a full pill. Borders are the main form device: 1px hairlines on cards, 2px on controls and fields, 2px ink on the pulled-up card.

## Components

### Lid
- **Character:** the box's lid, in the site's colour, holding identity and controls.
- **Contents:** back button, the site logo (or its name, heavy ink text on white) on its white chip, the page title, and a toolbar of theme, "Original page" and "Exit Mack".
- **Controls on the lid:** transparent background, on-brand text, 2px on-brand border at 60%, 14% on-brand wash on hover, on-brand focus outline.

### Divider Tabs
- **Style:** site-colour tab, on-brand 22px/750 label, 7px top corners, `9px 22px 7px` padding, sitting on a 3px site-colour underline that spans the column.
- **Stagger:** inset by section position (9% steps, four positions), max 78% wide.
- **"More options" tab:** a 56px-tall tab-grey toggle with a rotating chevron (90° when open) and an ink label; hover steps to hairline; its underline is field-edge.

### Task Cards (signature)
- **Pulled-up next step:** full column width, 104px minimum, `24px 24px 20px` padding, 2px ink border with an 8px head-rule top border, 32px line icon and arrow in ink. Enters with a 36px upward pull over 0.8s (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Card:** 76px minimum, `16px 20px 14px`, 1px hairline border, 26px line icon and arrow in ink-muted; hover darkens the border to ink-muted, nothing else.
- **Row ("More options"):** 68px minimum, `14px 20px 12px`, 22px labels, same card stock and hairline.
- **Icons:** plain Lucide line icons, never on tiles. When no icon matches, the slot stays empty rather than repeating the arrow.
- **Highlighted:** highlight-fill background, 4px yellow border, highlight-ring shadow pulsing, raised above siblings; the trailing arrow is replaced by the "Next step" badge.

### "Next step" Badge
- **Style:** highlight-yellow pill, highlight-ink 800 label, 2px highlight-edge border, `4px 12px` padding. The same badge reads "Type here" on a highlighted search card.

### Buttons
- **Shape:** 9px corners.
- **Primary (submit):** filled site colour with on-brand label, 56px tall for Send and 64px for site Search, 20 to 22px bold.
- **Outline (controls):** 48px tall, 2px border, card-stock fill, semibold label with 22px icons; hover fills tin. Icon-only controls are 48px squares with a tooltip.
- **Speak while listening:** switches to the danger fill.
- **Focus:** 4px focus-amber outline, 3px offset.

### Inputs / Fields
- **Style:** card-stock fill, 2px border, 9px corners, 56px tall with 22px text (the site search field is 64px with 24px text and a 26px search icon inset 18px).
- **Site search card:** a flat card (hairline, 5px, no shadow) holding a 22px/750 label, the field and the Search button; its field border uses field-edge.
- **Focus:** the shared focus-amber outline.

### Guide Panel
- **Character:** the same lid, then a note, floating over the original page.
- **Style:** tin body, 1px field-edge border, 18px corners, floating-panel shadow, 460px wide. The header is a compact lid (48px / title / tools grid) with minimise, full-screen and exit; the footer holds the theme toggle and "Move panel" above a hairline.
- **Collapsed:** shows only the lid; new guidance or an error re-expands it.

### Feedback States
- **Instruction:** plain 25px/700 text on the ground, hidden when empty.
- **Status:** 20px ink-muted line with a 22px spinner (3px hairline ring, ink top).
- **Error banner:** danger-wash fill, 2px danger border, 5px corners, 600-weight message and an optional "Try again" control.
- **Loading:** skeleton cards in the final layout (a 104px primary with an 8px hairline head rule, then 76px cards) with a 1.2s tab-grey shimmer.

## Do's and Don'ts

### Do:
- **Do** put the site's colour only on the lid, the divider tabs and their underline, and filled submit buttons (The Lid and Tabs Rule).
- **Do** take every grey from the eight-step ramp, using the `dark-*` steps in dark mode.
- **Do** mark the pulled-up card with the 8px head rule and a 2px ink edge, and switch the rule to ink when the site's colour is reddish.
- **Do** keep cards flat card stock with 1px hairline edges and 5px corners.
- **Do** keep the "Next step" highlight as ring, contrasting edge, glow and text badge together, so it never relies on colour alone.
- **Do** dim everything else to 0.55 while Mack points, and grey the tabs instead of fading them.
- **Do** keep essential text at 20px or larger and task targets at 64px or taller.
- **Do** turn off all animation and transition under `prefers-reduced-motion`, and give tabs, the lid, the primary card and the badge real borders under `forced-colors`.

### Don't:
- **Don't** put icons on tinted tiles or in coloured circles; icons are plain line glyphs.
- **Don't** add soft drop shadows to cards inside the box; the floating guide panel is the only shadowed surface besides the highlight ring.
- **Don't** tint the page ground or the cards with the site's colour.
- **Don't** make all cards the same as the next step; only one card is pulled up.
- **Don't** add a "Simplified by Mack" or Mack-branded label; the site's logo or name identifies the page.
- **Don't** change the highlight yellow or weaken the ring for aesthetic reasons.
