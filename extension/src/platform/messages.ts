// Shared shapes for chrome.storage and for messages between the popup, the
// background service worker, the offscreen voice document and content scripts.

// "listening" means the microphone is open and waiting for speech (hands-free).
// "ready" means Mack is waiting for typed text or for the talk button to be held.
// "working" means Mack is carrying out a step of a task on the page.
import type { VoiceOption } from "../voice/live/voices";

export type { VoiceOption };

export type SessionState =
  "idle" | "ready" | "listening" | "hearing" | "thinking" | "working" | "speaking";

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
  /** Role 4's simple view is covering the page, so the user cannot see the real one. */
  simple?: boolean;
}

/** The content script's answer to "mack:extract". */
export interface ExtractReply {
  page: PageSnapshot;
  simple: boolean;
}

/** Whether Role 2's guidance answered on the simple view (and will be spoken). */
export interface GuideReply {
  ok: boolean;
}

/** One thing Mack does on the page for the user. */
export const PRESS_KEYS = [
  "Enter",
  "Escape",
  "Tab",
  "Backspace",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
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
  pushToTalk: "mackPushToTalk",
  /** The conversation card above Mack's bar is hidden. */
  collapsed: "mackConversationHidden",
  /** "light" or "dark" for the bar and the simple view; unset follows the system. */
  theme: "mackTheme",
  /** The language Mack answers in and writes the simple view in; unset means English. */
  language: "mackLanguage",
  /** Show a box for typing in Mack's bar instead of the talk button. */
  textInput: "mackTextInput",
  /** Where the user dragged Mack's bar to; unset means bottom centre. */
  barPosition: "mackBarPosition",
  /** The chosen ElevenLabs voice id; unset means Mack's default voice. */
  voice: "mackVoice",
  /** The voices this ElevenLabs account offers, saved each time Mack starts. */
  voices: "mackVoices",
  session: "mackSession",
  transcript: "mackTranscript",
} as const;

/**
 * Languages offered in the settings. "name" is what the model is told; "label" is
 * the language's own name, which is what a speaker of it will recognise;
 * "greeting" is what Mack says when it turns on.
 */
export const LANGUAGES = [
  { name: "English", label: "English", greeting: "Hi, I'm Mack. Ask me anything about this page." },
  {
    name: "Spanish",
    label: "Español",
    greeting: "Hola, soy Mack. Pregúntame lo que quieras sobre esta página.",
  },
  {
    name: "French",
    label: "Français",
    greeting: "Bonjour, je suis Mack. Posez-moi n'importe quelle question sur cette page.",
  },
  {
    name: "German",
    label: "Deutsch",
    greeting: "Hallo, ich bin Mack. Fragen Sie mich alles zu dieser Seite.",
  },
  {
    name: "Italian",
    label: "Italiano",
    greeting: "Ciao, sono Mack. Chiedimi qualsiasi cosa su questa pagina.",
  },
  {
    name: "Portuguese",
    label: "Português",
    greeting: "Olá, eu sou o Mack. Pergunte-me qualquer coisa sobre esta página.",
  },
  {
    name: "Chinese (Simplified)",
    label: "中文",
    greeting: "你好，我是 Mack。关于这个页面，有什么都可以问我。",
  },
  {
    name: "Japanese",
    label: "日本語",
    greeting: "こんにちは、Mackです。このページについて何でも聞いてください。",
  },
  {
    name: "Korean",
    label: "한국어",
    greeting: "안녕하세요, Mack입니다. 이 페이지에 대해 무엇이든 물어보세요.",
  },
  {
    name: "Hindi",
    label: "हिन्दी",
    greeting: "नमस्ते, मैं Mack हूँ। इस पेज के बारे में मुझसे कुछ भी पूछें।",
  },
  { name: "Arabic", label: "العربية", greeting: "مرحبًا، أنا Mack. اسألني أي شيء عن هذه الصفحة." },
] as const;

/** Mack's first words, in the chosen language ("" is English). */
export function greetingIn(language: string): string {
  return (LANGUAGES.find((option) => option.name === language) ?? LANGUAGES[0]).greeting;
}

/** The stored language if it is one Mack offers, otherwise "" (English). */
export function readLanguage(value: unknown): string {
  return LANGUAGES.some((language) => language.name === value && value !== "English")
    ? (value as string)
    : "";
}

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
  /** Stop the task Mack is carrying out, and stay on. */
  | { type: "mack:halt" }
  /** Offscreen to a tab: let Role 2's guidance answer on the simple view. */
  | { type: "mack:guide"; tabId: number; text: string }
  /** Role 4's platform to the offscreen document: speak this instruction, or stop speaking it. */
  | { type: "mack:say"; text: string }
  | { type: "mack:hush" }
  | { type: "mack:talk"; held: boolean }
  | { type: "mack:mode"; pushToTalk: boolean }
  | { type: "mack:voice"; voiceId: string }
  | { type: "mack:language"; language: string }
  /** Mack is about to be turned off: go quiet and play the closing sound. */
  | { type: "mack:bye" }
  | { type: "mack:voices"; voices: VoiceOption[] };

export type TabMessage =
  | { type: "mack:extract" }
  | { type: "mack:highlight"; elementId: string | null }
  | { type: "mack:act"; step: ContentAction }
  | { type: "mack:guide"; text: string };
