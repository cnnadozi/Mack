// Injected into the Mack shadow root so the host page's CSS cannot restyle the UI and vice versa.
export const MACK_STYLES = `
:host { all: initial; }
.mack {
  --ink: #111111;
  --ink-muted: #3d3d3d;
  --paper: #ffffff;
  --paper-alt: #f3f4f6;
  --line: #6b7280;
  --accent: #0b4fd6;
  --accent-ink: #ffffff;
  --focus: #b45309;
  --danger: #a30d0d;
  --highlight: #fff3c4;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
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
  background: var(--paper);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.mack-shell {
  max-width: 820px;
  margin: 0 auto;
  padding: 24px 16px 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mack-header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; justify-content: space-between; }
.mack-title { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 700; flex: 1 1 260px; }
.mack-toolbar { display: flex; flex-wrap: wrap; gap: 8px; }

.mack-btn {
  font: inherit;
  font-size: 20px;
  min-height: 44px;
  min-width: 44px;
  padding: 8px 16px;
  border: 2px solid var(--ink);
  border-radius: 10px;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
}
.mack-btn:hover { background: var(--paper-alt); }
.mack-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.mack-btn--primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.mack-btn--primary:hover { background: #083ca3; }
.mack-btn[aria-pressed="true"] { background: var(--danger); border-color: var(--danger); color: #fff; }

.mack-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.mack-icon { flex: none; display: block; }
.mack-icon-btn {
  flex: none;
  width: 48px;
  height: 48px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--ink);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
}
.mack-icon-btn:hover { background: var(--paper-alt); }

.mack :focus-visible { outline: 4px solid var(--focus); outline-offset: 3px; }

.mack-instruction {
  margin: 0;
  padding: 16px 20px;
  border-left: 8px solid var(--accent);
  background: var(--paper-alt);
  font-size: 24px;
  font-weight: 600;
  border-radius: 6px;
}
.mack-instruction:empty { display: none; }

.mack-status { margin: 0; font-size: 20px; color: var(--ink-muted); display: flex; align-items: center; gap: 10px; }
.mack-spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 3px solid var(--line); border-top-color: var(--accent);
  animation: mack-spin 0.9s linear infinite;
}
@keyframes mack-spin { to { transform: rotate(360deg); } }

.mack-error {
  border: 3px solid var(--danger);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
}
.mack-error p { margin: 0; font-weight: 600; }

.mack-choices { display: flex; flex-direction: column; gap: 8px; }
.mack-choices h2 { margin: 0; font-size: 20px; }
.mack-choices ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }

.mack-section + .mack-section { margin-top: 28px; }
.mack-section h2 { margin: 0 0 12px; font-size: 24px; }
.mack-grid {
  list-style: none; margin: 0; padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 12px;
}
.mack-task {
  font: inherit;
  width: 100%;
  min-height: 64px;
  padding: 14px 20px;
  font-size: 24px;
  font-weight: 600;
  text-align: left;
  border: 3px solid var(--ink);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  scroll-margin: 24px 0 220px;
}
.mack-task:hover { background: var(--paper-alt); }
.mack-task[data-highlighted="true"] {
  background: var(--highlight);
  border-width: 5px;
  border-style: double;
  box-shadow: 0 0 0 4px var(--accent);
}
.mack-badge {
  flex: none;
  font-size: 18px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
}

.mack-empty { margin: 0; font-size: 22px; }

.mack-request {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  background: var(--paper);
  border-top: 2px solid var(--line);
  padding: 12px 0 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.mack-request label { font-weight: 700; }
.mack-request-row { display: flex; flex-wrap: wrap; gap: 8px; }
.mack-input {
  font: inherit;
  font-size: 22px;
  flex: 1 1 240px;
  min-height: 56px;
  padding: 8px 14px;
  border: 2px solid var(--ink);
  border-radius: 10px;
  color: var(--ink);
  background: var(--paper);
}

.mack-panel {
  position: fixed;
  z-index: 2147483646;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--paper);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.3);
  padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.mack-panel[data-dock="bottom-right"] { right: 16px; bottom: 16px; }
.mack-panel[data-dock="bottom-left"] { left: 16px; bottom: 16px; }
.mack-panel[data-dock="top-right"] { right: 16px; top: 16px; }
.mack-panel[data-dock="top-left"] { left: 16px; top: 16px; }
.mack-panel-header {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: 10px;
}
.mack-panel .mack-title { font-size: 22px; flex-basis: auto; overflow-wrap: anywhere; }
.mack-panel-tools { display: flex; gap: 6px; }
.mack-panel-footer { display: flex; justify-content: flex-end; border-top: 2px solid var(--paper-alt); padding-top: 10px; }
.mack-panel .mack-instruction { font-size: 22px; }
.mack-panel .mack-request { position: static; border-top: none; padding: 0; }

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
}
`;
