// Mack's layout rules, injected after the Tailwind/shadcn stylesheet in the shadow root (unlayered, so they win).
// Controls are shadcn components; --brand* come from the site's brand color via theme.ts for the current mode.
export const MACK_STYLES = `
:host { all: initial; }
/* The recipe-card box: flat card stock on a cool tin ground, every grey one step of a fixed ramp.
   The site's own colour (--brand*, from theme.ts) paints only the lid and the divider tabs. */
.mack {
  --brand: #2457c5;
  --on-brand: #ffffff;
  --brand-soft: #f2f5fc;
  --brand-tint: #dfe7f8;
  --brand-line: #a7bce8;
  --r0: #ffffff;
  --r1: #f1f2f4;
  --r2: #e4e6ea;
  --r3: #c5c9d0;
  --r4: #8a9099;
  --r5: #565c66;
  --r6: #2e3238;
  --r7: #16181c;
  --rule: #c8372d;
  --ink: var(--r7);
  --ink-muted: var(--r5);
  --paper: var(--r0);
  --muted-bg: var(--r1);
  --line: var(--r3);
  --focus: #b45309;
  --danger: #b42318;
  --danger-bg: #fef3f2;
  --highlight: #ffd60a;
  --highlight-edge: #111111;
  --highlight-ink: #111111;
  --highlight-fill: #fff3a3;
  /* Index-card corners, not app tiles. */
  --radius: 5px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 20px;
  line-height: 1.4;
  color: var(--ink);
  caret-color: var(--ink);
  color-scheme: light;
  box-sizing: border-box;
}
.mack[data-theme="dark"] {
  --r0: #202328;
  --r1: #131518;
  --r2: #2a2e34;
  --r3: #3c414a;
  --r4: #6c727c;
  --r5: #a7adb6;
  --r6: #d9dce1;
  --r7: #f3f4f6;
  --rule: #ef6b5f;
  --focus: #fbbf24;
  --danger: #f87171;
  --danger-bg: #3b1416;
  --highlight: #ffd60a;
  --highlight-edge: #ffffff;
  --highlight-ink: #111111;
  --highlight-fill: #4a3d00;
  color-scheme: dark;
}
.mack *, .mack *::before, .mack *::after { box-sizing: inherit; }
.mack ::selection { background: var(--brand-tint); color: var(--r7); }
.mack[data-theme="dark"] ::selection { background: var(--r3); color: var(--r7); }

/* shadcn's tokens, fed from the ramp and the site's colour. They override the bar's defaults. */
.mack {
  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper);
  --card-foreground: var(--ink);
  --primary: var(--brand);
  --primary-foreground: var(--on-brand);
  --secondary: var(--r2);
  --secondary-foreground: var(--ink);
  --muted: var(--r1);
  --muted-foreground: var(--ink-muted);
  --accent: var(--r1);
  --accent-foreground: var(--ink);
  --destructive: var(--danger);
  --border: var(--line);
  --input: var(--r4);
  --ring: var(--focus);
}

.mack-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  background: var(--r1);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--r4) var(--r1);
}
/* Inside the extension, Mack's floating bar sits at the bottom; the last buttons must scroll clear of it. */
.mack-shell[data-embedded] { padding-bottom: 160px; }
.mack-shell {
  max-width: 820px;
  margin: 0 auto;
  padding: 28px 20px 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* The lid: a full-width strip in the site's colour. */
.mack-lid { background: var(--brand); color: var(--on-brand); }
.mack-lid-inner {
  max-width: 820px; margin: 0 auto; padding: 16px 20px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
}
.mack-lid .mack-title { color: var(--on-brand); }
.mack .mack-lid-control {
  background: transparent;
  color: var(--on-brand);
  border-color: color-mix(in srgb, var(--on-brand) 60%, transparent);
}
.mack .mack-lid-control:hover { background: color-mix(in srgb, var(--on-brand) 14%, transparent); color: var(--on-brand); }
.mack-lid :focus-visible { outline-color: var(--on-brand); }
.mack-heading { flex: 1 1 240px; min-width: 0; }
.mack-brand { margin: 0 0 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.mack-logo { display: inline-flex; align-items: center; height: 44px; padding: 6px 12px; border-radius: 10px; }
.mack-logo img { display: block; height: 100%; max-width: 200px; width: auto; object-fit: contain; }
.mack-logo-text { font-size: 17px; font-weight: 800; color: #16181c; }
.mack-logo[data-kind="icon"] { gap: 8px; }
.mack-logo[data-kind="name"] { height: auto; min-height: 44px; background: #ffffff; }
.mack-logo[data-kind="icon"] img { height: 28px; width: 28px; border-radius: 6px; }
.mack-title { margin: 0; font-size: 32px; line-height: 1.12; font-weight: 800; letter-spacing: -0.01em; overflow-wrap: anywhere; text-wrap: balance; color: var(--ink); }
.mack-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

.mack :focus-visible { outline: 4px solid var(--focus); outline-offset: 3px; }

/* What Mack says now: plain words on the ground, not another box. */
.mack-instruction {
  margin: 0;
  padding: 0 4px;
  color: var(--ink);
  font-size: 25px;
  line-height: 1.3;
  font-weight: 700;
  text-wrap: pretty;
}
.mack-instruction:empty { display: none; }
.mack-status { margin: 0; font-size: 20px; color: var(--ink-muted); display: flex; align-items: center; gap: 10px; }
.mack-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 3px solid var(--r3); border-top-color: var(--ink);
  animation: mack-spin 0.9s linear infinite;
}
@keyframes mack-spin { to { transform: rotate(360deg); } }

.mack-error {
  background: var(--danger-bg);
  color: var(--ink);
  border: 2px solid var(--danger);
  border-radius: var(--radius);
  padding: 12px 16px;
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
}
.mack-error p { margin: 0; font-weight: 600; }

.mack-choices { display: flex; flex-direction: column; gap: 8px; }
.mack-choices h2 { margin: 0; font-size: 20px; color: var(--ink); }
.mack-choices ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }

/* Site search: one card with a plain, heavy field. */
.mack-search { padding: 18px 20px 20px; gap: 0; border: 1px solid var(--r3); border-radius: var(--radius); box-shadow: none; background: var(--r0); }
.mack-search-form { display: flex; flex-direction: column; gap: 12px; }
.mack-search label { font-size: 22px; font-weight: 750; color: var(--ink); }
.mack-search-row { display: flex; flex-wrap: wrap; gap: 10px; }
.mack-search-field { position: relative; flex: 1 1 260px; display: flex; }
.mack-search-icon { position: absolute; inset-inline-start: 18px; top: 50%; transform: translateY(-50%); color: var(--ink-muted); pointer-events: none; z-index: 1; }
.mack-search input { border-color: var(--r4); }

/* The box: one centred column of cards, filed behind divider tabs. */
.mack-tasks { display: flex; flex-direction: column; gap: 32px; }
.mack-section { display: flex; flex-direction: column; gap: 14px; }
.mack-divider { display: flex; border-bottom: 3px solid var(--brand); }
.mack-tab {
  margin: 0;
  margin-inline-start: calc(var(--tab, 0) * 9%);
  max-width: 78%;
  padding: 9px 22px 7px;
  border-radius: 7px 7px 0 0;
  background: var(--brand);
  color: var(--on-brand);
  font-size: 22px;
  line-height: 1.25;
  font-weight: 750;
  overflow-wrap: anywhere;
}
.mack-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }

/* Every card shares one scale and baseline: flat card stock with a hairline edge. */
.mack .mack-task {
  justify-content: flex-start;
  background: var(--r0);
  color: var(--ink);
  border: 1px solid var(--r3);
  border-radius: var(--radius);
  box-shadow: none;
  transition: border-color 0.15s ease, opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  /* Keeps a scrolled-to highlight clear of the sticky request bar. */
  scroll-margin: 24px 0 240px;
}
.mack .mack-task:hover { background: var(--r0); color: var(--ink); border-color: var(--r5); }
.mack-task-label { flex: 1; overflow-wrap: anywhere; line-height: 1.25; }
.mack-task-icon { flex: none; width: 26px; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-muted); }
.mack-task[data-variant="primary"] .mack-task-icon { width: 32px; }
.mack-task-trail { color: var(--ink-muted); flex: none; }
[dir="rtl"] .mack-task-trail { transform: scaleX(-1); }

/* The card pulled up out of the box: a heavy ink edge under one straight red head rule
   (ink instead when the site itself is red, set by theme.ts). */
.mack .mack-task[data-variant="primary"] {
  border: 2px solid var(--ink);
  border-top: 8px solid var(--head-rule, var(--rule));
  animation: mack-pull 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.mack .mack-task[data-variant="primary"] .mack-task-icon { color: var(--ink); }
.mack .mack-task[data-variant="primary"] .mack-task-trail { color: var(--ink); }
@keyframes mack-pull { from { transform: translateY(36px); } to { transform: none; } }

/* "Next step" never relies on colour alone: a thick bright ring with a contrasting edge, a glow and a text badge. */
.mack .mack-task[data-highlighted="true"] {
  border: 4px solid var(--highlight);
  box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 8px var(--highlight), 0 0 30px 10px color-mix(in srgb, var(--highlight) 80%, transparent);
  animation: mack-glow 1.2s ease-in-out 0.2s infinite;
  background: var(--highlight-fill);
  position: relative;
  z-index: 1;
}
/* While Mack points, everything else steps back (dimmed labels stay large-text readable, 3:1). */
.mack-shell:has([data-highlighted="true"]) :is(.mack-task, .mack-search, .mack-instruction):not([data-highlighted="true"]) { opacity: 0.55; }
/* Tabs step back by turning grey, not by fading, so their labels keep full contrast. */
.mack-shell:has([data-highlighted="true"]) .mack-divider { border-bottom-color: var(--r3); }
.mack-shell:has([data-highlighted="true"]) .mack-tab { background: var(--r2); color: var(--r5); }
.mack-search[data-highlighted="true"] {
  border: 4px solid var(--highlight);
  box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 8px var(--highlight), 0 0 30px 10px color-mix(in srgb, var(--highlight) 80%, transparent);
  animation: mack-glow 1.2s ease-in-out infinite;
}
.mack-search-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mack-badge { background: var(--highlight); color: var(--highlight-ink); border: 2px solid var(--highlight-edge); }

@keyframes mack-glow {
  0%, 100% { box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 8px var(--highlight), 0 0 30px 10px color-mix(in srgb, var(--highlight) 80%, transparent); }
  50% { box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 12px var(--highlight), 0 0 48px 20px var(--highlight); }
}

/* More options: the back of the box, a plain tab in the ramp's grey. */
.mack-more { display: flex; flex-direction: column; gap: 22px; }
.mack-divider[data-kind="more"] { border-bottom-color: var(--r4); }
.mack .mack-more-toggle {
  border-radius: 7px 7px 0 0;
  background: var(--r2);
  color: var(--ink);
}
.mack .mack-more-toggle:hover { background: var(--r3); color: var(--ink); }
.mack-more-list { display: flex; flex-direction: column; gap: 28px; }
.mack-chevron { display: inline-flex; transition: transform 0.15s ease; }
.mack-chevron[data-open] { transform: rotate(90deg); }
[dir="rtl"] .mack-chevron:not([data-open]) { transform: scaleX(-1); }

.mack-empty { margin: 0; font-size: 22px; color: var(--ink); }

.mack-loading { display: flex; flex-direction: column; gap: 10px; }
.mack-skeleton {
  display: block;
  height: 76px;
  border-radius: var(--radius);
  border: 1px solid var(--r2);
  background: linear-gradient(90deg, var(--r2) 0%, var(--r0) 50%, var(--r2) 100%);
  background-size: 200% 100%;
  animation: mack-shimmer 1.2s ease-in-out infinite;
}
.mack-skeleton--primary { height: 104px; margin-bottom: 16px; border-top: 8px solid var(--r3); }
@keyframes mack-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* Request bar */
.mack-request {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  background: var(--r0);
  border-top: 1px solid var(--r3);
  margin-left: -20px;
  margin-right: -20px;
  padding: 14px 20px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.mack-request label { font-weight: 750; color: var(--ink); }
.mack-request-row { display: flex; flex-wrap: wrap; gap: 8px; }

/* Guide panel over the original page: the same lid, then the note. */
.mack-panel {
  position: fixed;
  z-index: 2147483646;
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  border: 1px solid var(--r4);
  border-radius: 18px;
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.4), 0 4px 10px -2px rgba(0, 0, 0, 0.18);
  padding: 0 0 16px;
  gap: 14px;
  background: var(--r1);
}
.mack-panel[data-dock="bottom-right"] { right: 16px; bottom: 16px; }
.mack-panel[data-dock="bottom-left"] { left: 16px; bottom: 16px; }
.mack-panel[data-dock="top-right"] { right: 16px; top: 16px; }
.mack-panel[data-dock="top-left"] { left: 16px; top: 16px; }
.mack-panel-header { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 10px; padding: 12px 14px; }
.mack-panel-tools { display: flex; gap: 6px; }
.mack-panel-body { display: flex; flex-direction: column; gap: 12px; padding: 0 16px; }
.mack-panel .mack-title { font-size: 21px; }
.mack-panel .mack-brand { margin-bottom: 4px; gap: 8px; }
.mack-panel .mack-logo { height: 34px; padding: 4px 8px; }
.mack-panel .mack-logo img { max-width: 140px; }
.mack-panel .mack-instruction { font-size: 21px; }
.mack-panel .mack-request { position: static; border-top: none; margin: 0; padding: 0; background: transparent; }
.mack-panel[data-collapsed] { padding-bottom: 0; }
.mack-panel-footer { display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--r3); padding-top: 12px; }

.mack-visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}

@media (max-width: 560px) {
  .mack-title { font-size: 26px; }
  .mack-tab { margin-inline-start: calc(var(--tab, 0) * 5%); font-size: 20px; padding: 8px 16px 6px; }
  .mack .mack-task[data-variant="primary"] { font-size: 25px; }
}
@media (prefers-reduced-motion: reduce) {
  .mack *, .mack *::before, .mack *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
@media (forced-colors: active) {
  .mack-task[data-highlighted="true"] { outline: 4px solid Highlight; }
  .mack-badge { border: 2px solid CanvasText; }
  .mack-task[data-variant="primary"] { border: 3px solid ButtonText; }
  .mack-tab, .mack-lid { border: 2px solid CanvasText; }
}
`;
