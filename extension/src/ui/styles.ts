// Injected into the Mack shadow root so the host page's CSS cannot restyle the UI and vice versa.
// --accent* come from the source site's brand color via theme.ts and are always AA-readable.
export const MACK_STYLES = `
:host { all: initial; }
.mack {
  --accent: #2457c5;
  --accent-soft: #f2f5fc;
  --accent-tint: #dfe7f8;
  --accent-line: #a7bce8;
  --ink: #111827;
  --ink-muted: #4b5563;
  --paper: #ffffff;
  --line: #d6dbe3;
  --focus: #b45309;
  --danger: #b42318;
  --highlight: #b45309;
  --highlight-fill: #fff7e6;
  --radius: 16px;
  --shadow: 0 1px 2px rgba(17, 24, 39, 0.06), 0 2px 8px rgba(17, 24, 39, 0.06);
  --shadow-lift: 0 4px 10px rgba(17, 24, 39, 0.08), 0 12px 28px rgba(17, 24, 39, 0.10);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 20px;
  line-height: 1.4;
  color: var(--ink);
  box-sizing: border-box;
}
.mack *, .mack *::before, .mack *::after { box-sizing: inherit; }

.mack-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  background: var(--accent-soft);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.mack-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px 20px 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
.mack-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--paper);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border-top: 6px solid var(--accent);
}
.mack-heading { flex: 1 1 240px; min-width: 0; }
.mack-brand {
  margin: 0 0 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.mack-brand-mack {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent);
}
.mack-logo {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
}
.mack-logo img { display: block; height: 100%; max-width: 200px; width: auto; object-fit: contain; }
.mack-logo-text { font-size: 17px; font-weight: 800; color: var(--ink); }
.mack-logo[data-kind="icon"] { gap: 8px; }
.mack-logo[data-kind="icon"] img { height: 28px; width: 28px; border-radius: 6px; }
.mack-title { margin: 0; font-size: 30px; line-height: 1.15; font-weight: 800; overflow-wrap: anywhere; }
.mack-toolbar { display: flex; flex-wrap: wrap; gap: 8px; }

/* Generic controls */
.mack-btn {
  font: inherit;
  font-size: 19px;
  font-weight: 600;
  min-height: 48px;
  min-width: 48px;
  padding: 8px 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.mack-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
.mack-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mack-btn--primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.mack-btn--primary:hover { background: var(--accent); filter: brightness(0.92); }
.mack-btn[aria-pressed="true"] { background: var(--danger); border-color: var(--danger); color: #fff; }

.mack-icon-btn {
  flex: none;
  width: 48px;
  height: 48px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
}
.mack-icon-btn:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }

.mack :focus-visible { outline: 4px solid var(--focus); outline-offset: 3px; }

/* Guidance */
.mack-instruction {
  margin: 0;
  padding: 16px 20px;
  background: var(--paper);
  border-left: 8px solid var(--accent);
  border-radius: 12px;
  box-shadow: var(--shadow);
  font-size: 24px;
  font-weight: 650;
}
.mack-instruction:empty { display: none; }
.mack-status { margin: 0; font-size: 20px; color: var(--ink-muted); display: flex; align-items: center; gap: 10px; }
.mack-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 3px solid var(--accent-tint); border-top-color: var(--accent);
  animation: mack-spin 0.9s linear infinite;
}
@keyframes mack-spin { to { transform: rotate(360deg); } }

.mack-error {
  background: #fef3f2;
  border: 2px solid var(--danger);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
}
.mack-error p { margin: 0; font-weight: 600; }

.mack-choices { display: flex; flex-direction: column; gap: 8px; }
.mack-choices h2 { margin: 0; font-size: 20px; }
.mack-choices ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }

/* Site search */
.mack-search {
  display: flex; flex-direction: column; gap: 10px;
  padding: 18px 20px;
  background: var(--paper);
  border: 2px solid var(--accent-line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.mack-search label { font-size: 22px; font-weight: 750; }
.mack-search-row { display: flex; flex-wrap: wrap; gap: 10px; }
.mack-search-field { position: relative; flex: 1 1 260px; display: flex; }
.mack-search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--accent); pointer-events: none; }
.mack-search .mack-input { min-height: 64px; padding-left: 54px; font-size: 24px; width: 100%; }
.mack-search-go { min-height: 64px; padding: 8px 28px; font-size: 22px; font-weight: 750; }

/* Task hierarchy: primary > card > row */
.mack-tasks { display: flex; flex-direction: column; gap: 28px; }
.mack-section { display: flex; flex-direction: column; gap: 12px; }
.mack-section h2 { margin: 0; font-size: 22px; font-weight: 750; }
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
  font: inherit;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  color: var(--ink);
  cursor: pointer;
  animation: mack-in 0.35s ease both;
  animation-delay: calc(var(--order, 0) * 45ms);
  /* Keeps a scrolled-to highlight clear of the sticky header area and request bar. */
  scroll-margin: 24px 0 240px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}
.mack-task-label { flex: 1; overflow-wrap: anywhere; }
.mack-task-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; }
.mack-task-trail { flex: none; }

.mack-task[data-variant="primary"] {
  min-height: 88px;
  padding: 18px 22px;
  font-size: 26px;
  font-weight: 750;
  background: var(--accent);
  color: #fff;
  border: 3px solid var(--accent);
  border-radius: 20px;
  box-shadow: var(--shadow-lift);
}
.mack-task[data-variant="primary"] .mack-task-icon {
  width: 52px; height: 52px; border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
}
.mack-task[data-variant="primary"]:hover { transform: translateY(-1px); filter: brightness(0.95); }

.mack-task[data-variant="card"] {
  min-height: 72px;
  padding: 14px 18px;
  font-size: 24px;
  font-weight: 650;
  background: var(--paper);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.mack-task[data-variant="card"] .mack-task-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--accent-tint); color: var(--accent);
}
.mack-task[data-variant="card"]:hover { border-color: var(--accent); box-shadow: var(--shadow-lift); transform: translateY(-1px); }

.mack-task[data-variant="row"] {
  min-height: 64px;
  padding: 10px 18px;
  font-size: 22px;
  font-weight: 600;
  background: transparent;
  border: 0;
  border-radius: 0;
}
.mack-task[data-variant="row"] .mack-task-icon { color: var(--accent); }
.mack-task[data-variant="row"] .mack-task-trail { color: var(--ink-muted); }
.mack-task[data-variant="row"]:hover { background: var(--accent-soft); }

/* "Next step" never relies on color alone: ring, fill and a text badge. */
.mack-task[data-highlighted="true"] {
  border: 3px solid var(--highlight);
  box-shadow: 0 0 0 4px var(--highlight-fill), 0 0 0 7px var(--highlight);
  animation: mack-in 0.35s ease both, mack-glow 1.8s ease-in-out 0.4s infinite;
}
.mack-task[data-variant="card"][data-highlighted="true"],
.mack-task[data-variant="row"][data-highlighted="true"] { background: var(--highlight-fill); }
.mack-badge {
  flex: none;
  font-size: 17px;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--highlight);
  color: #fff;
}
.mack-task[data-variant="primary"] .mack-badge { background: #fff; color: var(--highlight); }

@keyframes mack-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mack-glow {
  0%, 100% { box-shadow: 0 0 0 4px var(--highlight-fill), 0 0 0 7px var(--highlight); }
  50% { box-shadow: 0 0 0 6px var(--highlight-fill), 0 0 0 10px var(--highlight), 0 0 24px rgba(180, 83, 9, 0.35); }
}

.mack-more { display: flex; flex-direction: column; gap: 16px; }
.mack-more-list { display: flex; flex-direction: column; gap: 20px; }
.mack-more-toggle { align-self: flex-start; min-height: 56px; font-size: 20px; font-weight: 700; color: var(--accent); }
.mack-chevron { display: inline-flex; transition: transform 0.15s ease; }
.mack-chevron[data-open] { transform: rotate(90deg); }

.mack-empty { margin: 0; font-size: 22px; }

/* Request bar */
.mack-request {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  background: var(--paper);
  border-top: 1px solid var(--line);
  box-shadow: 0 -6px 18px rgba(17, 24, 39, 0.06);
  margin-left: -20px;
  margin-right: -20px;
  padding: 14px 20px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.mack-request label { font-weight: 750; }
.mack-request-row { display: flex; flex-wrap: wrap; gap: 8px; }
.mack-input {
  font: inherit;
  font-size: 22px;
  flex: 1 1 240px;
  min-height: 56px;
  padding: 8px 16px;
  border: 2px solid var(--line);
  border-radius: 12px;
  color: var(--ink);
  background: var(--paper);
}
.mack-input:focus { border-color: var(--accent); }

/* Original-mode guide panel */
.mack-panel {
  position: fixed;
  z-index: 2147483646;
  width: min(440px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--paper);
  border: 2px solid var(--line);
  border-top: 6px solid var(--accent);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(17, 24, 39, 0.28);
  padding: 14px 16px 16px;
  display: flex; flex-direction: column; gap: 12px;
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
.mack-panel .mack-brand-mack { font-size: 12px; }
.mack-panel .mack-logo { height: 34px; padding: 4px 8px; }
.mack-panel .mack-logo img { max-width: 140px; }
.mack-panel .mack-instruction { font-size: 21px; box-shadow: none; background: var(--accent-soft); }
.mack-panel .mack-request { position: static; border-top: none; box-shadow: none; margin: 0; padding: 0; }
.mack-panel[data-collapsed] { padding: 10px 12px; }
.mack-panel-footer { display: flex; justify-content: flex-end; border-top: 1px solid var(--line); padding-top: 10px; }

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
