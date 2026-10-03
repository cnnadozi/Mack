import { KEY_STORAGE, readTab, supportedUrl, tabKey, trustedSession } from "./platform/settings";

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
chrome.tabs.onRemoved.addListener((id) => { void chrome.storage.session.remove(tabKey(id)); });
