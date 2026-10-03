import { KEY_STORAGE, trustedSession } from "./platform/settings";

const form = document.querySelector<HTMLFormElement>("#setup")!;
const input = document.querySelector<HTMLInputElement>("#api-key")!;
const status = document.querySelector<HTMLElement>("#status")!;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = input.value.trim();
  if (!key) return;
  try {
    await trustedSession();
    await chrome.storage.session.set({ [KEY_STORAGE]: key });
    status.textContent = "Key saved. Open GOV.UK and click Mack.";
  } catch { status.textContent = "Could not save the key. Reload Mack and try again."; }
  finally { input.value = ""; }
});
document.querySelector("#forget")!.addEventListener("click", async () => {
  try {
    await chrome.storage.session.remove(KEY_STORAGE);
    status.textContent = "Key removed.";
  } catch { status.textContent = "Could not remove the key. Reload Mack to clear this session."; }
});
