// Everything Mack draws on the website: the highlight ring around the element Mack
// is pointing at, and the panel with the conversation, the box for typing a
// question, the push-to-talk button and the settings. It lives in a shadow root so
// the site's CSS cannot restyle it and Mack's CSS cannot leak into the site.

import { debug } from "../debug";
import {
  DEFAULT_OVERLAY,
  IDLE_SESSION,
  STORAGE,
  type MackSession,
  type OverlayPrefs,
  type RuntimeMessage,
  type TranscriptLine,
  type VoiceOption,
} from "../messages";
import { elementFor } from "./extract";

const HIGHLIGHT_SECONDS = 30;
const TOAST_SECONDS = 10;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 150;
// The panel is never allowed closer than this to the edge of the window.
const EDGE = 8;

/** Where the user put the panel, in window pixels. */
interface PanelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
const VISIBLE_LINES = 30;

const STATE_TEXT: Record<MackSession["state"], string> = {
  idle: "",
  ready: "Ready",
  listening: "Listening",
  hearing: "Hearing you",
  thinking: "Thinking",
  working: "Working",
  speaking: "Speaking",
};

const ICONS = {
  send: ["M12 19V5", "M5 12l7-7 7 7"],
  mic: [
    "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z",
    "M19 10v2a7 7 0 0 1-14 0v-2",
    "M12 19v3",
  ],
  minimise: ["M6 9l6 6 6-6"],
  off: ["M18 6L6 18", "M6 6l12 12"],
  settings: [
    "M4 7h9",
    "M17 7h3",
    "M15 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
    "M4 17h3",
    "M11 17h9",
    "M9 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  ],
};

const STYLES = `
:host { all: initial; }
.layer {
  --bg: #ffffff; --fg: #18181b; --muted: #6b6b76; --line: #e6e6eb; --soft: #f4f4f6;
  --accent: #18181b; --accent-strong: #3f3f46; --on-accent: #ffffff;
  --danger: #b91c1c; --danger-soft: #fef2f2; --ok: #16a34a; --busy: #d97706; --off: #c4c4cc;
  position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 15px; line-height: 1.4; color: var(--fg); -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .layer {
    --bg: #1c1c20; --fg: #f4f4f5; --muted: #a5a5b0; --line: #303037; --soft: #29292f;
    --accent: #f4f4f5; --accent-strong: #d4d4d8; --on-accent: #18181b;
    --danger: #fca5a5; --danger-soft: #3a1d1d; --off: #4a4a55;
  }
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }

/* Dark with a white edge, so the ring stands out on light and dark pages alike. */
.ring {
  position: fixed; display: none;
  border: 3px solid #18181b; border-radius: 10px;
  box-shadow: 0 0 0 3px #ffffff, 0 0 0 6px rgba(24, 24, 27, 0.3);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  50% { box-shadow: 0 0 0 3px #ffffff, 0 0 0 12px rgba(24, 24, 27, 0.1); }
}

.panel, .launcher, .toast {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); pointer-events: auto;
  background: var(--bg); border: 1px solid var(--line);
  box-shadow: 0 12px 32px rgba(15, 15, 30, 0.16), 0 1px 4px rgba(15, 15, 30, 0.08);
}
.panel {
  display: none; flex-direction: column; overflow: hidden;
  width: min(360px, calc(100vw - 32px)); max-height: min(44vh, 380px);
  border-radius: 16px; animation: rise 0.18s ease-out;
}
@keyframes rise { from { opacity: 0; transform: translate(-50%, 8px); } }

/* Once the user has moved or resized it, the panel keeps the exact box they chose. */
.panel[data-placed] { bottom: auto; max-height: none; transform: none; animation: none; }
.panel[data-placed] .lines, .panel[data-placed] .settings { flex: 1 1 auto; min-height: 0; }
.panel[data-placed] .controls { margin-top: auto; }
.grip { position: absolute; width: 12px; height: 12px; touch-action: none; }
.grip[data-corner="nw"] { top: 0; left: 0; cursor: nwse-resize; }
.grip[data-corner="ne"] { top: 0; right: 0; cursor: nesw-resize; }
.grip[data-corner="sw"] { bottom: 0; left: 0; cursor: nesw-resize; }
.grip[data-corner="se"] {
  bottom: 0; right: 0; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 55%, var(--muted) 55%, var(--muted) 65%, transparent 65%, transparent 75%, var(--muted) 75%, var(--muted) 85%, transparent 85%);
  border-bottom-right-radius: 16px; opacity: 0.6;
}

.logo { width: 22px; height: 22px; flex: none; }
.head {
  display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-bottom: 1px solid var(--line);
  cursor: grab; user-select: none; touch-action: none;
}
.head:active { cursor: grabbing; }
.name { font-size: 15px; font-weight: 650; }
.state { display: flex; align-items: center; gap: 6px; margin-right: auto; font-size: 13px; color: var(--muted); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); flex: none; }
[data-state="listening"] .dot, [data-state="hearing"] .dot { background: var(--ok); }
[data-state="hearing"] .dot { box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.25); }
[data-state="thinking"] .dot, [data-state="working"] .dot { background: var(--busy); }
[data-state="speaking"] .dot { background: var(--fg); }
.tool { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: var(--muted); }
.tool:hover { background: var(--soft); color: var(--fg); }
.tool[aria-expanded="true"] { background: var(--accent); color: var(--on-accent); }

.settings { display: none; flex-direction: column; padding: 2px 12px 6px; overflow-y: auto; }
.field { display: flex; flex-direction: column; gap: 5px; padding: 8px 0 10px; font-size: 14px; font-weight: 600; }
.select {
  height: 36px; padding: 0 8px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--bg); color: var(--fg); font: inherit; font-weight: 400;
}
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 40px; font-size: 14px; border-top: 1px solid var(--line); }
.row.sub { min-height: 34px; padding-left: 14px; border-top: 0; color: var(--muted); }
.switch { position: relative; flex: none; width: 38px; height: 22px; border-radius: 999px; background: var(--off); transition: background 0.15s; }
.switch::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
  background: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); transition: transform 0.15s;
}
.switch[aria-checked="true"] { background: var(--accent); }
.switch[aria-checked="true"]::after { transform: translateX(16px); background: var(--on-accent); }
.switch:disabled { opacity: 0.45; cursor: default; }

.toast {
  display: none; max-width: min(360px, calc(100vw - 32px)); margin: 0; padding: 10px 14px;
  border-radius: 12px; font-size: 14px; color: var(--danger);
}

.lines { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 10px 12px; list-style: none; overflow-y: auto; }
.lines:empty { display: none; }
.line { max-width: 88%; padding: 6px 11px; border-radius: 14px; font-size: 15px; overflow-wrap: anywhere; }
.line[data-speaker="mack"] { align-self: flex-start; background: var(--soft); border-bottom-left-radius: 5px; }
.line[data-speaker="user"] { align-self: flex-end; background: var(--accent); color: var(--on-accent); border-bottom-right-radius: 5px; }
.line[data-step] {
  max-width: 100%; padding: 0 2px 0 10px; border-radius: 0; background: none;
  border-left: 2px solid var(--line); font-size: 13px; color: var(--muted);
}
.busy { display: flex; gap: 4px; align-items: center; padding: 10px 11px; }
.busy i { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: bounce 1.2s infinite ease-in-out; }
.busy i:nth-child(2) { animation-delay: 0.15s; }
.busy i:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 0%, 60%, 100% { opacity: 0.35; transform: none; } 30% { opacity: 1; transform: translateY(-3px); } }

.error { margin: 0 12px 8px; padding: 7px 11px; border-radius: 10px; font-size: 13px; color: var(--danger); background: var(--danger-soft); }
.error:empty { display: none; }

.controls { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-top: 1px solid var(--line); }
.ask {
  display: flex; align-items: center; gap: 6px; margin: 0; padding: 3px 3px 3px 12px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--soft);
}
.ask:focus-within { border-color: var(--accent); background: var(--bg); }
.text {
  flex: 1; min-width: 0; height: 32px; padding: 0; border: 0; outline: 0; background: none;
  font: inherit; font-size: 15px; color: var(--fg);
}
.text::placeholder { color: var(--muted); }
.send { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: var(--on-accent); flex: none; }
.send:hover { background: var(--accent-strong); }
.talk {
  display: none; align-items: center; justify-content: center; gap: 8px; height: 40px; border-radius: 12px;
  border: 1px solid var(--line); background: var(--bg); font-size: 15px; font-weight: 600;
  touch-action: none; user-select: none;
}
.talk:hover { background: var(--soft); }
.talk[data-held="true"] { border-color: var(--ok); background: var(--ok); color: #ffffff; animation: held 1.2s ease-in-out infinite; }
@keyframes held { 50% { box-shadow: 0 0 0 5px rgba(22, 163, 74, 0.22); } }

.launcher {
  display: none; align-items: center; gap: 8px; padding: 6px 14px 6px 10px; border-radius: 999px;
  font-size: 14px; font-weight: 600;
}
.launcher .state { margin: 0; }
.launcher:hover { border-color: var(--accent); }

button:focus-visible, .select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .ring, .panel, .busy i, .talk[data-held="true"] { animation: none; }
}
`;

let ring: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let launcher: HTMLElement | null = null;
let launcherState: HTMLElement | null = null;
let stateText: HTMLElement | null = null;
let lines: HTMLElement | null = null;
let errorText: HTMLElement | null = null;
let talk: HTMLButtonElement | null = null;
let talkLabel: HTMLElement | null = null;
let settings: HTMLElement | null = null;
let settingsButton: HTMLButtonElement | null = null;
let voiceSelect: HTMLSelectElement | null = null;
let toast: HTMLElement | null = null;

interface Toggle {
  button: HTMLButtonElement;
  isOn: () => boolean;
  isEnabled: () => boolean;
}
const toggles: Toggle[] = [];

let session: MackSession = IDLE_SESSION;
let transcript: TranscriptLine[] = [];
let prefs: OverlayPrefs = DEFAULT_OVERLAY;
let pushToTalk = false;
let collapsed = false;
let holding = false;
let settingsOpen = false;
let voice = "";
let voices: VoiceOption[] = [];
// The voices currently listed in the dropdown, so it is only rebuilt when they change.
let listedVoices = "";
let toastTimer = 0;
// Null while the panel sits in its default place at the bottom centre.
let box: PanelBox | null = null;

let target: Element | null = null;
let highlightTimer = 0;

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: Node,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  parent.appendChild(element);
  return element;
}

// Built node by node: sites with a strict Trusted Types policy reject innerHTML.
function icon(paths: string[], parent: Node): void {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  parent.appendChild(svg);
}

function logo(parent: Node): void {
  const image = make("img", "logo", parent);
  // Listed under web_accessible_resources, or the website could not load it.
  image.src = chrome.runtime.getURL("icons/icon48.png");
  image.alt = "";
}

function iconButton(
  className: string,
  label: string,
  paths: string[],
  parent: Node,
): HTMLButtonElement {
  const button = make("button", className, parent);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  icon(paths, button);
  return button;
}

function send(message: RuntimeMessage): void {
  try {
    void chrome.runtime.sendMessage(message).catch((error: unknown) => {
      debug("content", `could not send "${message.type}"`, error);
    });
  } catch (error) {
    // Thrown when the extension was reloaded but this page was not refreshed.
    debug("content", `could not send "${message.type}": refresh this page`, error);
  }
}

function store(key: string, value: unknown): void {
  // The change comes back through chrome.storage.onChanged, which redraws the panel.
  void chrome.storage.local.set({ [key]: value });
}

function addToggle(
  parent: HTMLElement,
  label: string,
  isOn: () => boolean,
  turn: (on: boolean) => void,
  // Given for a setting that only applies while another one is on; shown indented.
  isEnabled?: () => boolean,
): void {
  const row = make("div", isEnabled ? "row sub" : "row", parent);
  const name = make("span", "", row, label);
  name.id = `mack-setting-${toggles.length}`;
  const button = make("button", "switch", row);
  button.type = "button";
  button.setAttribute("role", "switch");
  button.setAttribute("aria-labelledby", name.id);
  button.addEventListener("click", () => turn(!isOn()));
  toggles.push({ button, isOn, isEnabled: isEnabled ?? (() => true) });
}

function mountSettings(parent: HTMLElement): void {
  settings = make("div", "settings", parent);

  const field = make("label", "field", settings, "Mack's voice");
  voiceSelect = make("select", "select", field);
  voiceSelect.addEventListener("change", () => store(STORAGE.voice, voiceSelect?.value ?? ""));

  addToggle(
    settings,
    "Push to talk",
    () => pushToTalk,
    (on) => store(STORAGE.pushToTalk, on),
  );
  addToggle(
    settings,
    "Show conversation",
    () => prefs.enabled,
    (on) => store(STORAGE.overlay, { ...prefs, enabled: on }),
  );
  addToggle(
    settings,
    "My words",
    () => prefs.showUser,
    (on) => store(STORAGE.overlay, { ...prefs, showUser: on }),
    () => prefs.enabled,
  );
  addToggle(
    settings,
    "Mack's replies",
    () => prefs.showMack,
    (on) => store(STORAGE.overlay, { ...prefs, showMack: on }),
    () => prefs.enabled,
  );
}

function renderSettings(): void {
  if (!settings || !settingsButton || !voiceSelect) return;
  settings.style.display = settingsOpen ? "flex" : "none";
  settingsButton.setAttribute("aria-expanded", String(settingsOpen));
  for (const toggle of toggles) {
    toggle.button.setAttribute("aria-checked", String(toggle.isOn()));
    toggle.button.disabled = !toggle.isEnabled();
  }

  const listing = voices.map((option) => option.id).join(",");
  if (listing !== listedVoices || voiceSelect.options.length === 0) {
    listedVoices = listing;
    voiceSelect.replaceChildren(
      new Option("Default voice", ""),
      ...voices.map(
        (option) =>
          new Option(
            option.description ? `${option.name} (${option.description})` : option.name,
            option.id,
          ),
      ),
    );
  }
  voiceSelect.value = voices.some((option) => option.id === voice) ? voice : "";
}

// With no popup, a problem that stopped Mack has nowhere else to be shown.
function showToast(): void {
  if (!toast) return;
  window.clearTimeout(toastTimer);
  const text = session.active ? "" : (session.error ?? "");
  toast.textContent = text;
  toast.style.display = text ? "block" : "none";
  if (text) {
    toastTimer = window.setTimeout(() => {
      if (toast) toast.style.display = "none";
    }, TOAST_SECONDS * 1000);
  }
}

function clampBox(wanted: PanelBox): PanelBox {
  const width = Math.min(Math.max(wanted.width, MIN_WIDTH), window.innerWidth - 2 * EDGE);
  const height = Math.min(Math.max(wanted.height, MIN_HEIGHT), window.innerHeight - 2 * EDGE);
  return {
    width,
    height,
    left: Math.min(Math.max(wanted.left, EDGE), window.innerWidth - width - EDGE),
    top: Math.min(Math.max(wanted.top, EDGE), window.innerHeight - height - EDGE),
  };
}

function applyBox(): void {
  if (!panel) return;
  if (!box) {
    delete panel.dataset.placed;
    for (const side of ["left", "top", "bottom", "width", "height"])
      panel.style.removeProperty(side);
    return;
  }
  // Clamped here as well as while dragging: the window may be smaller on this page.
  const placed = clampBox(box);
  panel.dataset.placed = "";
  panel.style.left = `${placed.left}px`;
  panel.style.width = `${placed.width}px`;
  // With the conversation hidden and the settings closed there is nothing to fill
  // the chosen height, so the panel shrinks to its bar and typing box. It hangs
  // from the bottom edge of its box, so the typing box does not jump.
  const filled = settingsOpen || prefs.enabled;
  panel.style.height = filled ? `${placed.height}px` : "";
  panel.style.top = filled ? `${placed.top}px` : "";
  panel.style.bottom = filled ? "" : `${window.innerHeight - placed.top - placed.height}px`;
}

// Lets the pointer drag `handle` to change the panel's box. `change` gets the box
// as it was when the drag started and how far the pointer has moved since.
function dragToChange(
  handle: HTMLElement,
  change: (start: PanelBox, dx: number, dy: number) => PanelBox,
): void {
  handle.addEventListener("pointerdown", (down) => {
    if (!panel || down.button !== 0 || (down.target as Element).closest("button")) return;
    down.preventDefault();
    const rect = panel.getBoundingClientRect();
    // The stored box, not what is on screen: the panel may be showing shrunk.
    const start = box
      ? clampBox(box)
      : { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    handle.setPointerCapture(down.pointerId);

    const move = (event: PointerEvent): void => {
      box = clampBox(change(start, event.clientX - down.clientX, event.clientY - down.clientY));
      applyBox();
    };
    const end = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      // Stored so the panel stays where it was put on the next page too.
      if (box) store(STORAGE.panelBox, box);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
}

function mountMoveAndResize(panel: HTMLElement, head: HTMLElement): void {
  dragToChange(head, (start, dx, dy) => ({ ...start, left: start.left + dx, top: start.top + dy }));
  head.addEventListener("dblclick", (event) => {
    if ((event.target as Element).closest("button")) return;
    box = null;
    store(STORAGE.panelBox, null);
    applyBox();
  });

  for (const corner of ["nw", "ne", "sw", "se"]) {
    const grip = make("div", "grip", panel);
    grip.dataset.corner = corner;
    dragToChange(grip, (start, dx, dy) => {
      const next = { ...start };
      if (corner.includes("e")) next.width = start.width + dx;
      if (corner.includes("s")) next.height = start.height + dy;
      // The left and top edges move the panel as well as resizing it, and must
      // stop at the minimum size or the panel would slide away instead.
      if (corner.includes("w")) {
        const moved = Math.min(dx, start.width - MIN_WIDTH);
        next.left = start.left + moved;
        next.width = start.width - moved;
      }
      if (corner.includes("n")) {
        const moved = Math.min(dy, start.height - MIN_HEIGHT);
        next.top = start.top + moved;
        next.height = start.height - moved;
      }
      return next;
    });
  }
  window.addEventListener("resize", applyBox);
}

function readBox(value: unknown): PanelBox | null {
  const candidate = value as Partial<PanelBox> | null | undefined;
  const sides = [candidate?.left, candidate?.top, candidate?.width, candidate?.height];
  return sides.every((side) => typeof side === "number" && Number.isFinite(side))
    ? (candidate as PanelBox)
    : null;
}

function setCollapsed(next: boolean): void {
  collapsed = next;
  // Stored so the panel stays put while a task moves from page to page.
  void chrome.storage.local.set({ [STORAGE.collapsed]: next });
  render();
}

function setHolding(held: boolean): void {
  if (!talk || !talkLabel || held === holding) return;
  holding = held;
  talk.dataset.held = String(held);
  talkLabel.textContent = held ? "Listening. Let go to send" : "Hold to talk";
  send({ type: "mack:talk", held });
}

function mountControls(parent: HTMLElement): void {
  const controls = make("div", "controls", parent);

  talk = make("button", "talk", controls);
  talk.type = "button";
  icon(ICONS.mic, talk);
  talkLabel = make("span", "", talk, "Hold to talk");
  talk.addEventListener("pointerdown", (event) => {
    // Capture keeps the release coming here even if the pointer slides off the button.
    talk?.setPointerCapture(event.pointerId);
    setHolding(true);
  });
  for (const type of ["pointerup", "pointercancel", "blur"]) {
    talk.addEventListener(type, () => setHolding(false));
  }
  const isPressKey = (event: KeyboardEvent): boolean => event.key === " " || event.key === "Enter";
  talk.addEventListener("keydown", (event) => {
    if (!isPressKey(event)) return;
    event.preventDefault();
    if (!event.repeat) setHolding(true);
  });
  talk.addEventListener("keyup", (event) => {
    if (isPressKey(event)) setHolding(false);
  });

  const form = make("form", "ask", controls);
  const text = make("input", "text", form);
  text.type = "text";
  text.placeholder = "Ask Mack, or tell it what to do";
  text.setAttribute("aria-label", "Type a question or a task for Mack");
  text.autocomplete = "off";
  const submit = iconButton("send", "Send", ICONS.send, form);
  submit.type = "submit";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = text.value.trim();
    if (!question) return;
    text.value = "";
    send({ type: "mack:typed", text: question });
  });
}

// Built on first use so pages where Mack is never used get no extra DOM.
function mount(): void {
  if (ring) return;
  const host = document.createElement("div");
  host.setAttribute("data-mack-root", "");
  const shadow = host.attachShadow({ mode: "open" });
  make("style", "", shadow).textContent = STYLES;
  const layer = make("div", "layer", shadow);

  ring = make("div", "ring", layer);
  ring.setAttribute("aria-hidden", "true");

  panel = make("section", "panel", layer);
  panel.setAttribute("aria-label", "Mack");
  const head = make("div", "head", panel);
  logo(head);
  make("span", "name", head, "Mack");
  const state = make("span", "state", head);
  make("span", "dot", state);
  stateText = make("span", "", state);
  stateText.setAttribute("role", "status");
  settingsButton = iconButton("tool", "Settings", ICONS.settings, head);
  settingsButton.addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    render();
  });
  iconButton("tool", "Minimise Mack", ICONS.minimise, head).addEventListener("click", () =>
    setCollapsed(true),
  );
  iconButton("tool", "Turn Mack off", ICONS.off, head).addEventListener("click", () =>
    send({ type: "mack:stop" }),
  );
  mountSettings(panel);
  lines = make("ol", "lines", panel);
  errorText = make("p", "error", panel);
  mountControls(panel);
  // Keys typed in the panel must not also trigger the website's own keyboard shortcuts.
  for (const type of ["keydown", "keyup", "keypress"]) {
    panel.addEventListener(type, (event) => event.stopPropagation());
  }

  mountMoveAndResize(panel, head);

  toast = make("p", "toast", layer);
  toast.setAttribute("role", "alert");

  launcher = make("button", "launcher", layer);
  (launcher as HTMLButtonElement).type = "button";
  launcher.setAttribute("aria-label", "Open Mack");
  logo(launcher);
  launcherState = make("span", "state", launcher);
  make("span", "dot", launcherState);
  make("span", "", launcherState);
  launcher.addEventListener("click", () => setCollapsed(false));

  document.documentElement.appendChild(host);
}

function lineItem(line: TranscriptLine): HTMLElement {
  const item = document.createElement("li");
  item.className = "line";
  item.dataset.speaker = line.speaker;
  if (line.step) item.dataset.step = "";
  // textContent, never innerHTML: the words come from a model and a website.
  item.textContent = line.text;
  return item;
}

function busyItem(): HTMLElement {
  const item = document.createElement("li");
  item.className = "line busy";
  item.dataset.speaker = "mack";
  item.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) make("i", "", item);
  return item;
}

function render(): void {
  // The panel holds the typing box and talk button, so it shows whenever Mack is
  // on; the "show conversation" setting only hides the transcript inside it.
  const show = session.active;
  if (!show && !panel && !session.error) return;
  mount();
  showToast();
  if (!panel || !launcher || !launcherState || !stateText || !lines || !errorText || !talk) return;

  panel.style.display = show && !collapsed ? "flex" : "none";
  applyBox();
  launcher.style.display = show && collapsed ? "flex" : "none";
  if (!show) {
    setHolding(false);
    return;
  }
  talk.style.display = pushToTalk ? "flex" : "none";
  renderSettings();
  // The settings take the place of the conversation while they are open.
  lines.style.display = settingsOpen ? "none" : "";

  panel.dataset.state = session.state;
  launcher.dataset.state = session.state;
  stateText.textContent = STATE_TEXT[session.state];
  launcherState.lastElementChild!.textContent = STATE_TEXT[session.state];
  errorText.textContent = session.error ?? "";

  const items = (prefs.enabled ? transcript : [])
    .filter((line) => (line.speaker === "user" ? prefs.showUser : prefs.showMack))
    .slice(-VISIBLE_LINES)
    .map(lineItem);
  if (session.state === "thinking" || session.state === "working") items.push(busyItem());
  lines.replaceChildren(...items);
  lines.scrollTop = lines.scrollHeight;
}

function trackTarget(): void {
  if (!ring || !target) return;
  if (!target.isConnected) {
    highlight(null);
    return;
  }
  const rect = target.getBoundingClientRect();
  ring.style.left = `${rect.left - 8}px`;
  ring.style.top = `${rect.top - 8}px`;
  ring.style.width = `${rect.width + 16}px`;
  ring.style.height = `${rect.height + 16}px`;
  requestAnimationFrame(trackTarget);
}

export function highlight(elementId: string | null): void {
  window.clearTimeout(highlightTimer);
  target = elementId ? elementFor(elementId) : null;
  if (!target) {
    // An id is only valid for the snapshot that created it, and the element may have left the page.
    if (elementId) debug("content", `highlight: no element on the page for "${elementId}"`);
    if (ring) ring.style.display = "none";
    return;
  }
  debug("content", `highlight: pointing at "${elementId}"`, target);
  mount();
  if (!ring) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  ring.style.display = "block";
  trackTarget();
  highlightTimer = window.setTimeout(() => highlight(null), HIGHLIGHT_SECONDS * 1000);
}

export async function initOverlay(): Promise<void> {
  const stored = await chrome.storage.local.get([
    STORAGE.session,
    STORAGE.transcript,
    STORAGE.overlay,
    STORAGE.pushToTalk,
    STORAGE.collapsed,
    STORAGE.voice,
    STORAGE.voices,
    STORAGE.panelBox,
  ]);
  session = (stored[STORAGE.session] as MackSession | undefined) ?? IDLE_SESSION;
  transcript = (stored[STORAGE.transcript] as TranscriptLine[] | undefined) ?? [];
  prefs = { ...DEFAULT_OVERLAY, ...(stored[STORAGE.overlay] as Partial<OverlayPrefs> | undefined) };
  pushToTalk = stored[STORAGE.pushToTalk] === true;
  collapsed = stored[STORAGE.collapsed] === true;
  box = readBox(stored[STORAGE.panelBox]);
  voice = typeof stored[STORAGE.voice] === "string" ? (stored[STORAGE.voice] as string) : "";
  voices = (stored[STORAGE.voices] as VoiceOption[] | undefined) ?? [];
  // A problem from an earlier page must not pop up again on every page load.
  if (session.active || !session.error) render();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE.session]) {
      session = (changes[STORAGE.session].newValue as MackSession | undefined) ?? IDLE_SESSION;
      debug("content", "session changed:", session);
      if (!session.active) highlight(null);
    }
    if (changes[STORAGE.transcript]) {
      transcript = (changes[STORAGE.transcript].newValue as TranscriptLine[] | undefined) ?? [];
    }
    if (changes[STORAGE.pushToTalk]) {
      pushToTalk = changes[STORAGE.pushToTalk].newValue === true;
      if (!pushToTalk) setHolding(false);
    }
    if (changes[STORAGE.collapsed]) collapsed = changes[STORAGE.collapsed].newValue === true;
    if (changes[STORAGE.panelBox]) box = readBox(changes[STORAGE.panelBox].newValue);
    if (changes[STORAGE.voice]) {
      const next = changes[STORAGE.voice].newValue;
      voice = typeof next === "string" ? next : "";
    }
    if (changes[STORAGE.voices]) {
      voices = (changes[STORAGE.voices].newValue as VoiceOption[] | undefined) ?? [];
    }
    if (changes[STORAGE.overlay]) {
      prefs = {
        ...DEFAULT_OVERLAY,
        ...(changes[STORAGE.overlay].newValue as Partial<OverlayPrefs> | undefined),
      };
    }
    render();
  });
}
