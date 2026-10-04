// Mack's layout rules, injected after the Tailwind/shadcn stylesheet in the shadow root (unlayered, so they win).
// Controls are shadcn components; --brand* come from the site's brand color via theme.ts for the current mode.
export const MACK_STYLES = `
:host { all: initial; }
.mack {
  --brand: #2457c5;
  --on-brand: #ffffff;
  --brand-soft: #f2f5fc;
  --brand-tint: #dfe7f8;
  --brand-line: #a7bce8;
  --ink: #111827;
  --ink-muted: #4b5563;
  --paper: #ffffff;
  --muted-bg: #f3f4f6;
  --line: #d6dbe3;
  --focus: #b45309;
  --danger: #b42318;
  --danger-bg: #fef3f2;
  --highlight: #ffd60a;
  --highlight-edge: #111111;
  --highlight-ink: #111111;
  --highlight-fill: #fff3a3;
  --radius: 16px;
  --shadow: 0 1px 2px rgba(17, 24, 39, 0.06), 0 2px 8px rgba(17, 24, 39, 0.06);
  --shadow-lift: 0 4px 10px rgba(17, 24, 39, 0.08), 0 12px 28px rgba(17, 24, 39, 0.10);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 20px;
  line-height: 1.4;
  color: var(--ink);
  color-scheme: light;
  box-sizing: border-box;
}
.mack[data-theme="dark"] {
  --ink: #f3f4f6;
  --ink-muted: #b8bec9;
  --paper: #1a1d24;
  --muted-bg: #242832;
  --line: #3a404d;
  --focus: #fbbf24;
  --danger: #f87171;
  --danger-bg: #3b1416;
  --highlight: #ffd60a;
  --highlight-edge: #ffffff;
  --highlight-ink: #111111;
  --highlight-fill: #4a3d00;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-lift: 0 4px 10px rgba(0, 0, 0, 0.45), 0 12px 28px rgba(0, 0, 0, 0.5);
  color-scheme: dark;
}
.mack *, .mack *::before, .mack *::after { box-sizing: inherit; }

/* shadcn's tokens for everything inside Mack's view, fed from the light/dark neutrals above
   and the site's brand palette (--brand*, set by theme.ts). They override the bar's defaults. */
.mack {
  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper);
  --card-foreground: var(--ink);
  --primary: var(--brand);
  --primary-foreground: var(--on-brand);
  --secondary: var(--brand-tint);
  --secondary-foreground: var(--brand);
  --muted: var(--muted-bg);
  --muted-foreground: var(--ink-muted);
  --accent: var(--brand-soft);
  --accent-foreground: var(--brand);
  --destructive: var(--danger);
  --border: var(--line);
  --input: var(--line);
  --ring: var(--focus);
}

.mack-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  background: var(--brand-soft);
  overflow-y: auto;
  overscroll-behavior: contain;
}
/* Inside the extension, Mack's floating bar sits at the bottom; the last buttons must scroll clear of it. */
.mack-shell[data-embedded] { padding-bottom: 160px; }
.mack-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px 20px 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header (a shadcn Card) */
.mack-header {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--radius);
  border-top: 6px solid var(--brand);
}
.mack-heading { flex: 1 1 240px; min-width: 0; }
.mack-brand { margin: 0 0 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.mack-logo { display: inline-flex; align-items: center; height: 44px; padding: 6px 12px; border-radius: 10px; border: 1px solid var(--line); }
.mack-logo img { display: block; height: 100%; max-width: 200px; width: auto; object-fit: contain; }
.mack-logo-text { font-size: 17px; font-weight: 800; color: #111827; }
.mack-logo[data-kind="icon"] { gap: 8px; }
.mack-logo[data-kind="name"] { height: auto; min-height: 44px; background: var(--paper); }
.mack-logo[data-kind="name"] .mack-logo-text { color: var(--ink); }
.mack-logo[data-kind="icon"] img { height: 28px; width: 28px; border-radius: 6px; }
.mack-title { margin: 0; font-size: 30px; line-height: 1.15; font-weight: 800; overflow-wrap: anywhere; color: var(--ink); }
.mack-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

.mack :focus-visible { outline: 4px solid var(--focus); outline-offset: 3px; }

/* Guidance */
.mack-instruction {
  margin: 0;
  padding: 16px 20px;
  background: var(--paper);
  color: var(--ink);
  border-left: 8px solid var(--brand);
  border-radius: 12px;
  box-shadow: var(--shadow);
  font-size: 24px;
  font-weight: 650;
}
.mack-instruction:empty { display: none; }
.mack-status { margin: 0; font-size: 20px; color: var(--ink-muted); display: flex; align-items: center; gap: 10px; }
.mack-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 3px solid var(--brand-tint); border-top-color: var(--brand);
  animation: mack-spin 0.9s linear infinite;
}
@keyframes mack-spin { to { transform: rotate(360deg); } }

.mack-error {
  background: var(--danger-bg);
  color: var(--ink);
  border: 2px solid var(--danger);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
}
.mack-error p { margin: 0; font-weight: 600; }

.mack-choices { display: flex; flex-direction: column; gap: 8px; }
.mack-choices h2 { margin: 0; font-size: 20px; color: var(--ink); }
.mack-choices ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }

/* Site search (a shadcn Card) */
.mack-search { padding: 18px 20px; gap: 0; border: 2px solid var(--brand-line); border-radius: var(--radius); }
.mack-search-form { display: flex; flex-direction: column; gap: 10px; }
.mack-search label { font-size: 22px; font-weight: 750; color: var(--ink); }
.mack-search-row { display: flex; flex-wrap: wrap; gap: 10px; }
.mack-search-field { position: relative; flex: 1 1 260px; display: flex; }
.mack-search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--brand); pointer-events: none; z-index: 1; }

/* Task hierarchy on shadcn Buttons: primary > card > row */
.mack-tasks { display: flex; flex-direction: column; gap: 28px; }
.mack-section { display: flex; flex-direction: column; gap: 12px; }
.mack-section h2 { margin: 0; font-size: 22px; font-weight: 750; color: var(--ink); }
.mack-grid {
  list-style: none; margin: 0; padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 12px;
}
.mack-list {
  list-style: none; margin: 0; padding: 0;
  background: var(--paper);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.mack-list li + li { border-top: 1px solid var(--line); }

.mack-task {
  animation: mack-in 0.35s ease both;
  animation-delay: calc(var(--order, 0) * 45ms);
  /* Keeps a scrolled-to highlight clear of the sticky request bar. */
  scroll-margin: 24px 0 240px;
}
.mack-task-label { flex: 1; overflow-wrap: anywhere; }
.mack-task-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; }
.mack-task[data-variant="primary"] .mack-task-icon { width: 52px; height: 52px; border-radius: 14px; background: color-mix(in srgb, var(--on-brand) 18%, transparent); }
.mack-task[data-variant="card"] .mack-task-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--brand-tint); color: var(--brand); }
.mack-task[data-variant="row"] .mack-task-icon { color: var(--brand); }
.mack-task[data-variant="row"] .mack-task-trail { color: var(--ink-muted); }

/* "Next step" never relies on color alone: a thick bright ring with a contrasting edge, a glow and a text badge. */
.mack-task[data-highlighted="true"] {
  border: 4px solid var(--highlight);
  box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 8px var(--highlight), 0 0 30px 10px color-mix(in srgb, var(--highlight) 80%, transparent);
  animation: mack-in 0.35s ease both, mack-glow 1.2s ease-in-out 0.4s infinite;
  position: relative;
  z-index: 1;
}
.mack-search[data-highlighted="true"] {
  border: 4px solid var(--highlight);
  box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 8px var(--highlight), 0 0 30px 10px color-mix(in srgb, var(--highlight) 80%, transparent);
  animation: mack-glow 1.2s ease-in-out infinite;
}
.mack-search-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mack-task[data-variant="card"][data-highlighted="true"],
.mack-task[data-variant="row"][data-highlighted="true"] { background: var(--highlight-fill); color: var(--ink); }
.mack-badge { background: var(--highlight); color: var(--highlight-ink); border: 2px solid var(--highlight-edge); }
.mack-task[data-variant="primary"] .mack-badge { background: var(--highlight); color: var(--highlight-ink); }

@keyframes mack-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mack-glow {
  0%, 100% { box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 8px var(--highlight), 0 0 30px 10px color-mix(in srgb, var(--highlight) 80%, transparent); }
  50% { box-shadow: 0 0 0 3px var(--highlight-edge), 0 0 0 12px var(--highlight), 0 0 48px 20px var(--highlight); }
}

.mack-more { display: flex; flex-direction: column; gap: 16px; }
.mack-more-list { display: flex; flex-direction: column; gap: 20px; }
.mack-chevron { display: inline-flex; transition: transform 0.15s ease; }
.mack-chevron[data-open] { transform: rotate(90deg); }

.mack-empty { margin: 0; font-size: 22px; color: var(--ink); }

.mack-loading { display: flex; flex-direction: column; gap: 12px; }
.mack-skeleton {
  display: block;
  height: 72px;
  border-radius: var(--radius);
  background: linear-gradient(90deg, var(--brand-tint) 0%, var(--paper) 50%, var(--brand-tint) 100%);
  background-size: 200% 100%;
  animation: mack-shimmer 1.2s ease-in-out infinite;
}
.mack-skeleton--primary { height: 88px; border-radius: 20px; }
@keyframes mack-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* Request bar */
.mack-request {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  background: var(--paper);
  border-top: 1px solid var(--line);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.08);
  margin-left: -20px;
  margin-right: -20px;
  padding: 14px 20px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.mack-request label { font-weight: 750; color: var(--ink); }
.mack-request-row { display: flex; flex-wrap: wrap; gap: 8px; }

/* Original-mode guide panel (a shadcn Card) */
.mack-panel {
  position: fixed;
  z-index: 2147483646;
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  border: 2px solid var(--line);
  border-top: 6px solid var(--brand);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  padding: 14px 16px 16px;
  gap: 12px;
}
.mack-panel[data-dock="bottom-right"] { right: 16px; bottom: 16px; }
.mack-panel[data-dock="bottom-left"] { left: 16px; bottom: 16px; }
.mack-panel[data-dock="top-right"] { right: 16px; top: 16px; }
.mack-panel[data-dock="top-left"] { left: 16px; top: 16px; }
.mack-panel-header { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 10px; }
.mack-panel-tools { display: flex; gap: 6px; }
.mack-panel-body { display: flex; flex-direction: column; gap: 12px; }
.mack-panel .mack-title { font-size: 21px; }
.mack-panel .mack-brand { margin-bottom: 4px; gap: 8px; }
.mack-panel .mack-logo { height: 34px; padding: 4px 8px; }
.mack-panel .mack-logo img { max-width: 140px; }
.mack-panel .mack-instruction { font-size: 21px; box-shadow: none; background: var(--brand-soft); }
.mack-panel .mack-request { position: static; border-top: none; box-shadow: none; margin: 0; padding: 0; background: transparent; }
.mack-panel[data-collapsed] { padding: 10px 12px; }
.mack-panel-footer { display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--line); padding-top: 10px; }

.mack-visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .mack *, .mack *::before, .mack *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
@media (forced-colors: active) {
  .mack-task[data-highlighted="true"] { outline: 4px solid Highlight; }
  .mack-badge { border: 2px solid CanvasText; }
  .mack-task[data-variant="primary"] { border: 3px solid ButtonText; }
}
`;
