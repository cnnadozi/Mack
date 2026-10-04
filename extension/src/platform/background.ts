// Service worker. It owns no conversation state itself (Chrome may stop it at any
// time): it starts and stops the offscreen voice document, answers its requests for
// page context, mirrors status and transcript into chrome.storage so the on-page
// panel can render them, and serves Role 4's simple view (see simple-view-worker.ts).

import { CHIME_MS } from "../voice/live/chime";
import { debug, since } from "./debug";
import {
  IDLE_SESSION,
  readLanguage,
  STORAGE,
  type ActResult,
  type ExtractReply,
  type GuideReply,
  type MackSession,
  type PageAction,
  type PageContext,
  type RuntimeMessage,
  type TabMessage,
  type TranscriptLine,
} from "./messages";
import { createSimpleViewWorker } from "./simple-view-worker";

const OFFSCREEN_PATH = "offscreen.html";
const MAX_LINES = 30;
const SCREENSHOT_MAX_WIDTH = 1280;
// After Mack clicks or types, the page needs a moment to react before it is read again.
const SETTLE_MS = 600;
const MAX_LOAD_WAIT_MS = 8000;
const WAIT_STEP_MS = 2000;

async function hasOffscreen(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function closeOffscreen(): Promise<void> {
  if (await hasOffscreen()) await chrome.offscreen.closeDocument().catch(() => undefined);
}

// Storage updates arrive in bursts; running them one at a time keeps a
// read-then-write (the transcript) from losing lines.
let writes: Promise<unknown> = Promise.resolve();
function write(task: () => Promise<unknown>): Promise<unknown> {
  writes = writes.then(task, task);
  return writes;
}

function setSession(session: MackSession): Promise<unknown> {
  return write(() => chrome.storage.local.set({ [STORAGE.session]: session }));
}

function addLine(line: TranscriptLine): Promise<unknown> {
  return write(async () => {
    const stored = await chrome.storage.local.get(STORAGE.transcript);
    const lines = (stored[STORAGE.transcript] as TranscriptLine[] | undefined) ?? [];
    await chrome.storage.local.set({ [STORAGE.transcript]: [...lines, line].slice(-MAX_LINES) });
  });
}

async function start(typingOnly = false): Promise<void> {
  debug("background", "start: opening the offscreen voice document");
  await closeOffscreen();
  // An offscreen document cannot read chrome.storage, so the settings it starts
  // with travel in its URL; later changes are sent as messages.
  const stored = await chrome.storage.local.get([
    STORAGE.pushToTalk,
    STORAGE.voice,
    STORAGE.language,
  ]);
  const pushToTalk = stored[STORAGE.pushToTalk] === true;
  const voice = stored[STORAGE.voice];
  const query = new URLSearchParams();
  if (pushToTalk) query.set("ptt", "1");
  if (typingOnly) query.set("nomic", "1");
  if (typeof voice === "string" && voice) query.set("voice", voice);
  const language = readLanguage(stored[STORAGE.language]);
  if (language) query.set("language", language);
  await write(() =>
    chrome.storage.local.set({
      [STORAGE.session]: {
        active: true,
        state: pushToTalk ? "ready" : "listening",
      } satisfies MackSession,
      [STORAGE.transcript]: [],
    }),
  );
  // Opening the document starts the conversation; closing it releases the microphone.
  await chrome.offscreen.createDocument({
    url: `${OFFSCREEN_PATH}?${query}`,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Listen to the user's spoken questions and play Mack's spoken answers.",
  });
  debug("background", "start: offscreen document created");
}

async function stop(session: MackSession = IDLE_SESSION): Promise<void> {
  debug("background", "stop: closing the offscreen document, session becomes", session);
  if (await hasOffscreen()) {
    // The closing sound is played by the document that is about to be closed.
    await chrome.runtime
      .sendMessage({ type: "mack:bye" } satisfies RuntimeMessage)
      .catch(() => undefined);
    await delay(CHIME_MS);
  }
  await closeOffscreen();
  await setSession(session);
  await simpleViewWorker.clearGoals().catch(() => undefined);
  const tab = await activeTab();
  if (tab?.id !== undefined) sendToTab(tab.id, { type: "mack:highlight", elementId: null });
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

function sendToTab<T>(tabId: number, message: TabMessage): Promise<T | null> {
  // frameId 0 is the top frame, the only one that extracts and draws.
  return chrome.tabs
    .sendMessage(tabId, message, { frameId: 0 })
    .then((response) => (response ?? null) as T | null)
    .catch((error: unknown) => {
      // Usual causes: a chrome:// page, or a tab opened before the extension was reloaded.
      debug("background", `sendToTab: tab ${tabId} did not answer "${message.type}"`, error);
      return null;
    });
}

async function screenshot(windowId: number): Promise<string | null> {
  const started = performance.now();
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 70 });
    // Retina screenshots are several megapixels; a smaller image is faster and reads just as well.
    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / bitmap.width);
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    debug(
      "background",
      `screenshot: ${canvas.width}x${canvas.height}, ${Math.round(bytes.length / 1024)} KB in ${since(started)}`,
    );
    return btoa(binary);
  } catch (error) {
    debug("background", "screenshot: failed", error);
    return null;
  }
}

// Chrome's own pages (chrome://, the Web Store) allow neither extraction nor a
// screenshot; the model is then told there is no page.
async function pageContext(): Promise<PageContext> {
  const tab = await activeTab();
  if (tab?.id === undefined) {
    debug("background", "pageContext: no active tab");
    return { tabId: null, page: null, screenshot: null };
  }
  const extracted = await sendToTab<ExtractReply>(tab.id, { type: "mack:extract" });
  const page = extracted?.page ?? null;
  const simple = extracted?.simple === true;
  const context: PageContext = {
    tabId: tab.id,
    page,
    // With the simple view up, the screenshot shows it, and its buttons are listed first in the page.
    screenshot: page ? await screenshot(tab.windowId) : null,
    simple,
  };
  debug("background", "pageContext:", {
    tabId: tab.id,
    url: tab.url,
    extracted: page !== null,
    elements: page?.elements.length ?? 0,
    headings: page?.headings.length ?? 0,
    hasScreenshot: context.screenshot !== null,
    simple,
  });
  return context;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Waits for whatever the step set off: an in-page update, a navigation, or a new
// tab. The active tab is checked, not the one acted on, so a new tab is covered.
async function settle(): Promise<void> {
  const started = performance.now();
  await delay(SETTLE_MS);
  while (performance.now() - started < MAX_LOAD_WAIT_MS) {
    const tab = await activeTab();
    if (tab?.status !== "loading") break;
    await delay(250);
  }
  debug("background", `settle: page ready after ${since(started)}`);
}

async function act(tabId: number, step: PageAction): Promise<ActResult> {
  let result: ActResult | null;
  try {
    switch (step.kind) {
      case "back":
        await chrome.tabs.goBack(tabId);
        result = { ok: true };
        break;
      case "forward":
        await chrome.tabs.goForward(tabId);
        result = { ok: true };
        break;
      case "open":
        await chrome.tabs.update(tabId, { url: step.url });
        result = { ok: true };
        break;
      case "wait":
        await delay(WAIT_STEP_MS);
        result = { ok: true };
        break;
      default:
        result = await sendToTab<ActResult>(tabId, { type: "mack:act", step });
    }
  } catch (error) {
    // For example going back when there is no earlier page.
    debug("background", `act: "${step.kind}" failed`, error);
    result = null;
  }
  if (result?.ok) await settle();
  return result ?? { ok: false, reason: "failed" };
}

async function startOrReport(typingOnly = false): Promise<void> {
  try {
    await start(typingOnly);
  } catch (error) {
    debug("background", "start: failed", error);
    await stop({
      ...IDLE_SESSION,
      error: error instanceof Error ? error.message : "Mack could not start.",
    });
  }
}

// There is no popup: the toolbar icon turns Mack on and off, and everything else
// is in the panel on the page.
// Chrome only runs the manifest's content script when a page loads. A tab that
// was already open when Mack was installed or reloaded has none (or a dead one
// from the old version), so Mack's bar could not appear there until a refresh.
// This puts the content script into such a tab.
async function ensureContentScript(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (tab?.id === undefined || !/^https?:/.test(tab.url ?? "")) return;
  if ((await sendToTab<boolean>(tab.id, { type: "mack:ping" })) === true) return;
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
    debug("background", `content script added to tab ${tab.id}, which had none`);
  } catch (error) {
    // Chrome's own pages and the Web Store refuse scripts.
    debug("background", `could not add the content script to tab ${tab.id}`, error);
  }
}

chrome.action.onClicked.addListener((tab) => {
  void (async () => {
    const stored = await chrome.storage.local.get(STORAGE.session);
    const session = stored[STORAGE.session] as MackSession | undefined;
    // An "active" session without its document is left over from a crash.
    if (session?.active && (await hasOffscreen())) {
      await stop();
      return;
    }
    await ensureContentScript(tab);
    await startOrReport();
  })();
});

// While Mack is on, a tab the user switches to must be able to show the bar too.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void (async () => {
    if (await isActive()) await ensureContentScript(await chrome.tabs.get(tabId));
  })().catch(() => undefined);
});

// The icon is the only sign of Mack on pages where it cannot draw its panel.
function showOnIcon(session: MackSession): void {
  const text = session.active ? "ON" : session.error ? "!" : "";
  void chrome.action.setBadgeText({ text });
  void chrome.action.setBadgeBackgroundColor({ color: session.active ? "#18181b" : "#b91c1c" });
  void chrome.action.setTitle({
    title: session.active ? "Stop Mack" : (session.error ?? "Start Mack"),
  });
}

async function isActive(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STORAGE.session);
  return (stored[STORAGE.session] as MackSession | undefined)?.active === true;
}

const simpleViewWorker = createSimpleViewWorker({ isActive, stop: () => stop() });

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  const handled = simpleViewWorker.handle(raw, sender, sendResponse);
  if (handled !== undefined) return handled;

  const message = raw as RuntimeMessage;
  debug("background", "message received:", message);
  switch (message.type) {
    case "mack:start":
      void startOrReport(message.typingOnly);
      return false;
    case "mack:need-microphone":
      // Closed without the closing sound: Mack starts again as soon as the user answers.
      void closeOffscreen()
        .then(() => setSession(IDLE_SESSION))
        .then(() => chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") }));
      return false;
    case "mack:stop":
      void stop();
      return false;
    case "mack:status":
      if (message.session.active) void setSession(message.session);
      else void stop(message.session);
      return false;
    case "mack:line":
      void addLine(message.line);
      return false;
    case "mack:highlight":
      void sendToTab(message.tabId, { type: "mack:highlight", elementId: message.elementId });
      return false;
    case "mack:voices":
      void chrome.storage.local.set({ [STORAGE.voices]: message.voices });
      return false;
    case "mack:act":
      void act(message.tabId, message.step).then(sendResponse);
      return true;
    case "mack:simple":
      void sendToTab<GuideReply>(message.tabId, {
        type: "mack:simple",
        op: message.op,
        elementId: message.elementId,
        ...(message.text ? { text: message.text } : {}),
      }).then(async (reply) => {
        // Like a step on the page: answered once the page it leads to has loaded.
        if (reply?.ok && (message.op === "press" || message.op === "search")) await settle();
        sendResponse(reply ?? ({ ok: false } satisfies GuideReply));
      });
      return true;
    case "mack:guide":
      void sendToTab<GuideReply>(message.tabId, { type: "mack:guide", text: message.text }).then(
        (reply) => sendResponse(reply ?? ({ ok: false } satisfies GuideReply)),
      );
      return true;
    case "mack:context":
      void pageContext().then(sendResponse);
      return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE.session]) {
    showOnIcon((changes[STORAGE.session].newValue as MackSession | undefined) ?? IDLE_SESSION);
  }
  // Rejects when Mack is not running, which needs no handling.
  const tell = (message: RuntimeMessage): void =>
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  if (changes[STORAGE.pushToTalk]) {
    tell({ type: "mack:mode", pushToTalk: changes[STORAGE.pushToTalk].newValue === true });
  }
  if (changes[STORAGE.language]) {
    tell({ type: "mack:language", language: readLanguage(changes[STORAGE.language].newValue) });
  }
  if (changes[STORAGE.voice]) {
    const voice = changes[STORAGE.voice].newValue;
    tell({ type: "mack:voice", voiceId: typeof voice === "string" ? voice : "" });
  }
});

// The offscreen document does not survive a browser restart or an extension reload.
chrome.runtime.onStartup.addListener(() => void setSession(IDLE_SESSION));
chrome.runtime.onInstalled.addListener(() => {
  void setSession(IDLE_SESSION);
  // Tabs that are already open would otherwise need a refresh before Mack works in them.
  void chrome.tabs
    .query({ url: ["http://*/*", "https://*/*"] })
    .then((tabs) => Promise.all(tabs.map(ensureContentScript)))
    .catch(() => undefined);
});
