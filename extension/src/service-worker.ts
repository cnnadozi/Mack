import { DEFAULT_MODEL, GOAL_TTL_MS, KEY_STORAGE, MODEL_STORAGE, readStored, readTab, sameSite, supportedUrl, tabKey, trustedSession, UNSAFE_LINK } from "./platform/settings";
import { authorizedSender, createModelHandler } from "./platform/model-handler";
import { generateJSON } from "./platform/provider";
import { SessionMessageSchema } from "./platform/protocol";

async function credentials(): Promise<{ key?: string; model: string }> {
  await trustedSession();
  const stored = await chrome.storage.session.get([KEY_STORAGE, MODEL_STORAGE]);
  const key = stored[KEY_STORAGE] as unknown;
  const model = stored[MODEL_STORAGE] as unknown;
  return { key: typeof key === "string" && key ? key : undefined, model: typeof model === "string" && model ? model : DEFAULT_MODEL };
}

const model = createModelHandler({
  extensionId: chrome.runtime.id,
  readAccess: async (id) => ({ active: (await readTab(id)).active, ...(await credentials()) }),
  generate: generateJSON,
});

// Peeks run without cookies, so pages are seen as a signed-out visitor sees them: no personal data, no account actions.
async function peek(urls: string[], pageUrl: string) {
  const allowed = [...new Set(urls)].filter((url) => sameSite(url, pageUrl) && !UNSAFE_LINK.test(url)).slice(0, 8);
  const results = await Promise.allSettled(allowed.map(async (url) => {
    const response = await fetch(url, { credentials: "omit", redirect: "follow", signal: AbortSignal.timeout(3500) });
    if (!response.ok || !sameSite(response.url, pageUrl) || !(response.headers.get("content-type") ?? "").includes("text/html")) throw new Error("skip");
    return { url, finalUrl: response.url, html: (await response.text()).slice(0, 600_000) };
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
  const type = typeof raw === "object" && raw !== null && "type" in raw ? raw.type : undefined;
  if (type === "mack:model" || type === "mack:cancel") {
    void model.handle(raw, sender).then(respond);
    return true;
  }
  if (!authorizedSender(sender, chrome.runtime.id)) return false;
  const parsed = SessionMessageSchema.safeParse(raw);
  if (!parsed.success) return false;
  void (async () => {
    const id = sender.tab!.id!;
    const session = await readTab(id);
    const message = parsed.data;
    if (message.type === "mack:session") return respond(session);
    if (message.type === "mack:peek") return respond({ pages: session.active ? await peek(message.urls, sender.url!) : [] });
    if (message.type === "mack:resume") {
      if (session.active) await inject(id);
      return respond({ ok: true });
    }
    if (message.type === "mack:exit") {
      model.cancelTab(id);
      await chrome.storage.session.remove(tabKey(id));
    } else if (session.active) {
      const goal = message.goal.trim();
      await chrome.storage.session.set({ [tabKey(id)]: goal ? { active: true, goal, goalAt: Date.now() } : { active: true } });
    }
    respond({ ok: true });
  })().catch(() => respond({ ok: false }));
  return true;
});

async function inject(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

chrome.action.onClicked.addListener((tab) => {
  void (async () => {
    if (tab.id === undefined) return;
    if (!supportedUrl(tab.url)) {
      await chrome.action.setBadgeText({ tabId: tab.id, text: "SITE" });
      await chrome.action.setTitle({ tabId: tab.id, title: "Mack works on uhc.com, libertymutual.com and www.gov.uk" });
      return;
    }
    if (!(await credentials()).key) {
      await chrome.runtime.openOptionsPage();
      return;
    }
    const existing = await readTab(tab.id);
    if (!existing.active) await chrome.storage.session.set({ [tabKey(tab.id)]: { active: true } });
    await inject(tab.id);
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  })().catch(() => {
    if (tab.id !== undefined) void chrome.action.setBadgeText({ tabId: tab.id, text: "ERR" });
  });
});

chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.status === "loading") model.cancelTab(id);
  void (async () => {
    const stored = await readStored(id);
    if (stored?.active !== true) return;
    // Without host access Chrome omits tab.url, which also means the tab left the supported sites.
    if (!supportedUrl(tab.url)) {
      if (stored.leftAt === undefined) await chrome.storage.session.set({ [tabKey(id)]: { ...stored, leftAt: Date.now() } });
      return;
    }
    if (stored.leftAt !== undefined) {
      if (Date.now() - stored.leftAt > GOAL_TTL_MS) { await chrome.storage.session.remove(tabKey(id)); return; }
      const { leftAt: _, ...rest } = stored;
      await chrome.storage.session.set({ [tabKey(id)]: rest });
    }
    if (change.status === "complete") await inject(id);
  })().catch(() => { void chrome.action.setBadgeText({ tabId: id, text: "ERR" }); });
});
chrome.tabs.onRemoved.addListener((id) => { model.cancelTab(id); void chrome.storage.session.remove(tabKey(id)); });
