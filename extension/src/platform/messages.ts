// Shared shapes for chrome.storage and for messages between the popup, the
// background service worker, the offscreen voice document and content scripts.

// "listening" means the microphone is open and waiting for speech (hands-free).
// "ready" means Mack is waiting for typed text or for the talk button to be held.
// "working" means Mack is carrying out a step of a task on the page.
import type { VoiceOption } from "../voice/live/voices";

export type { VoiceOption };

export type SessionState =
  | "idle"
  | "ready"
  | "listening"
  | "hearing"
  | "thinking"
  | "working"
  | "speaking";

export interface MackSession {
  active: boolean;
  state: SessionState;
  error?: string;
}

export interface TranscriptLine {
  id: string;
  speaker: "user" | "mack";
  text: string;
  /** A step of a task Mack is carrying out, shown smaller than what Mack says. */
  step?: boolean;
}

export interface OverlayPrefs {
  enabled: boolean;
  showUser: boolean;
  showMack: boolean;
}

export interface PageElement {
  id: string;
  kind: "link" | "button" | "field";
  label: string;
  /** Where it sits on screen, e.g. "top right" or "below the visible area". */
  region: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  headings: string[];
  elements: PageElement[];
  /**
   * The whole page's readable text, top to bottom, one block per line. Headings
   * start with "#", and each control appears where it sits as "[id kind: label]".
   */
  content: string;
}

export interface PageContext {
  tabId: number | null;
  page: PageSnapshot | null;
  /** Base64 JPEG of the visible tab, without the data: prefix. */
  screenshot: string | null;
}

/** One thing Mack does on the page for the user. */
export const PRESS_KEYS = [
  "Enter", "Escape", "Tab", "Backspace", "Space",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
] as const;
export type PressKey = (typeof PRESS_KEYS)[number];

export const SCROLL_DIRECTIONS = ["up", "down", "top", "bottom"] as const;
export type ScrollDirection = (typeof SCROLL_DIRECTIONS)[number];

/** Steps the content script performs on the page itself. */
export type ContentAction =
  | { kind: "click"; elementId: string }
  | { kind: "type"; elementId: string; text: string; submit: boolean }
  | { kind: "hover"; elementId: string }
  /** A null elementId sends the key to whatever has focus. */
  | { kind: "press"; key: PressKey; elementId: string | null }
  | { kind: "scroll"; direction: ScrollDirection };

/** One thing Mack does for the user. The last four are done by the background worker. */
export type PageAction =
  | ContentAction
  | { kind: "back" }
  | { kind: "forward" }
  | { kind: "open"; url: string }
  | { kind: "wait" };

export type ActResult =
  | { ok: true }
  /** "failed": it could not be done on this page. "sensitive": left to the user. */
  | { ok: false; reason: "failed" | "sensitive" };

export const STORAGE = {
  overlay: "mackOverlay",
  pushToTalk: "mackPushToTalk",
  /** The on-page panel is minimised to a small button. */
  collapsed: "mackPanelCollapsed",
  /** Where the user dragged and resized the on-page panel to; unset means bottom centre. */
  panelBox: "mackPanelBox",
  /** The chosen ElevenLabs voice id; unset means Mack's default voice. */
  voice: "mackVoice",
  /** The voices this ElevenLabs account offers, saved each time Mack starts. */
  voices: "mackVoices",
  session: "mackSession",
  transcript: "mackTranscript",
} as const;

export const DEFAULT_OVERLAY: OverlayPrefs = { enabled: true, showUser: true, showMack: true };
export const IDLE_SESSION: MackSession = { active: false, state: "idle" };

export type RuntimeMessage =
  /** typingOnly skips the microphone, after the user declined it. */
  | { type: "mack:start"; typingOnly?: boolean }
  /** Chrome has not been asked for the microphone yet; only a visible tab can ask. */
  | { type: "mack:need-microphone" }
  | { type: "mack:stop" }
  | { type: "mack:sync" }
  | { type: "mack:status"; session: MackSession }
  | { type: "mack:line"; line: TranscriptLine }
  | { type: "mack:context" }
  | { type: "mack:highlight"; tabId: number; elementId: string | null }
  | { type: "mack:act"; tabId: number; step: PageAction }
  | { type: "mack:typed"; text: string }
  | { type: "mack:talk"; held: boolean }
  | { type: "mack:mode"; pushToTalk: boolean }
  | { type: "mack:voice"; voiceId: string }
  /** Mack is about to be turned off: go quiet and play the closing sound. */
  | { type: "mack:bye" }
  | { type: "mack:voices"; voices: VoiceOption[] };

export type TabMessage =
  | { type: "mack:extract" }
  | { type: "mack:highlight"; elementId: string | null }
  | { type: "mack:act"; step: ContentAction };
