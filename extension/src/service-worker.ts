import { KEY_STORAGE, readTab, supportedUrl, tabKey, trustedSession } from "./platform/settings";
import { authorizedSender, createModelHandler } from "./platform/model-handler";
import { generateJSON } from "./platform/provider";
import { SessionMessageSchema } from "./platform/protocol";

const model = createModelHandler({
  extensionId: chrome.runtime.id,
  readAccess: async (id) => {
    await trustedSession();
    const session = await readTab(id);
    const key = (await chrome.storage.session.get(KEY_STORAGE))[KEY_STORAGE] as unknown;
    return { active: session.active, key: typeof key === "string" ? key : undefined };
  },
  generate: generateJSON,
});

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
    if (parsed.data.type === "mack:session") return respond(session);
    if (parsed.data.type === "mack:resume") {
      if (session.active) await inject(id);
      return respond({ ok: true });
    }
    if (parsed.data.type === "mack:exit") {
      model.cancelTab(id);
      await chrome.storage.session.remove(tabKey(id));
    } else if (session.active) {
      await chrome.storage.session.set({ [tabKey(id)]: { active: true, goal: parsed.data.goal } });
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
      await chrome.action.setTitle({ tabId: tab.id, title: "Open https://www.gov.uk/ to try Mack" });
      return;
    }
    await trustedSession();
    if (!(await chrome.storage.session.get(KEY_STORAGE))[KEY_STORAGE]) {
      await chrome.runtime.openOptionsPage();
      return;
    }
    await chrome.storage.session.set({ [tabKey(tab.id)]: { active: true } });
    await inject(tab.id);
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  })().catch(() => {
    if (tab.id !== undefined) void chrome.action.setBadgeText({ tabId: tab.id, text: "ERR" });
  });
});

chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.status === "loading") model.cancelTab(id);
  void (async () => {
    const session = await readTab(id);
    if (!session.active) return;
    if (tab.url && !supportedUrl(tab.url)) {
      await chrome.storage.session.remove(tabKey(id));
      return;
    }
    if (change.status === "complete" && supportedUrl(tab.url)) await inject(id);
  })().catch(() => { void chrome.action.setBadgeText({ tabId: id, text: "ERR" }); });
});
chrome.tabs.onRemoved.addListener((id) => { model.cancelTab(id); void chrome.storage.session.remove(tabKey(id)); });
