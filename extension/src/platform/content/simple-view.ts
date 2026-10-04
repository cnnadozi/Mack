// Role 4's simple view on this page. It is only created when the user presses
// the simple-view button in Mack's bar (or arrives by pressing one of the simple
// view's own buttons), never just because a page loaded. The platform itself is
// downloaded only when it is needed.

import { debug } from "../debug";
import {
  IDLE_SESSION,
  readLanguage,
  STORAGE,
  type GuideReply,
  type MackSession,
} from "../messages";
import { supportedUrl } from "../settings";
import { shouldContinue } from "./continue";
import { setRingAllowed } from "./overlay";
import type { SimpleView } from "./platform-host";

export interface SimpleViewState {
  /** False on pages where the simple view cannot run (anything but https). */
  available: boolean;
  /** The simple view has been asked for and is still being made. */
  creating: boolean;
  /** The simple view is running on this page. */
  showing: boolean;
}

// Dynamic pages keep loading for a long time; the simple view should not wait for that.
const MAX_LOAD_WAIT_MS = 4000;

// Role 4's model transport only answers pages served over https.
const available = supportedUrl(location.href);

let active = false;
// The user asked for the simple view on this page.
let wanted = false;
let simpleView: SimpleView | null = null;
let covering = false;
// Starting is asynchronous; a newer decision makes an older start give up.
let generation = 0;

let state: SimpleViewState = { available, creating: false, showing: false };
const listeners = new Set<() => void>();

function publish(): void {
  state = { available, creating: wanted && simpleView === null, showing: simpleView !== null };
  for (const listener of listeners) listener();
}

/** For Mack's bar, which shows whether a simple view is up. */
export function subscribeSimpleView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function simpleViewState(): SimpleViewState {
  return state;
}

// Role 4's platform reads document.body as soon as it starts.
function pageLoaded(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
    const giveUp = (): void => void window.setTimeout(resolve, MAX_LOAD_WAIT_MS);
    if (document.readyState === "interactive") giveUp();
    else document.addEventListener("DOMContentLoaded", giveUp, { once: true });
  });
}

function setCovering(next: boolean): void {
  covering = next;
  // The highlight ring points at the real page, which the simple view covers.
  setRingAllowed(!next);
}

function stop(): void {
  generation += 1;
  simpleView?.stop();
  simpleView = null;
  setCovering(false);
}

async function start(): Promise<void> {
  stop();
  const mine = generation;
  try {
    await pageLoaded();
    const [host, stored] = await Promise.all([
      import("./platform-host"),
      chrome.storage.local.get(STORAGE.language),
    ]);
    if (mine !== generation) return;
    const started = await host.startSimpleView({
      language: readLanguage(stored[STORAGE.language]),
      onShowOriginal: removeSimpleView,
      onModeChange: setCovering,
    });
    if (mine !== generation) {
      started.stop();
      return;
    }
    simpleView = started;
    debug("content", "simple view: created");
  } catch (error) {
    debug("content", "simple view: could not start", error);
    if (mine === generation) wanted = false;
  }
  publish();
}

/** Makes the simple view for this page, replacing the one that is up, if any. */
export function createSimpleView(): void {
  if (!active || !available) return;
  wanted = true;
  void start();
  publish();
}

export function removeSimpleView(): void {
  wanted = false;
  stop();
  publish();
}

/** True while the simple view is covering the page. */
export function simpleViewShowing(): boolean {
  return covering;
}

export function guideInSimpleView(text: string): Promise<GuideReply> {
  return simpleView ? simpleView.guide(text) : Promise.resolve({ ok: false });
}

export async function initSimpleView(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE.session);
  active = ((stored[STORAGE.session] as MackSession | undefined) ?? IDLE_SESSION).active;
  // Arriving through one of the simple view's own buttons continues in the simple view.
  if (active && available && shouldContinue()) createSimpleView();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE.session]) return;
    active = ((changes[STORAGE.session].newValue as MackSession | undefined) ?? IDLE_SESSION)
      .active;
    if (!active) removeSimpleView();
  });

  // A page kept in the back/forward cache must not keep its simple view running.
  window.addEventListener("pagehide", removeSimpleView);
}
