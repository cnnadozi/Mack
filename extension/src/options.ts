import { DEFAULT_MODEL, KEY_STORAGE, MODEL_STORAGE, trustedSession } from "./platform/settings";
import { generateJSON, ProviderRejected } from "./platform/provider";

const form = document.querySelector<HTMLFormElement>("#setup")!;
const keyInput = document.querySelector<HTMLInputElement>("#api-key")!;
const modelInput = document.querySelector<HTMLInputElement>("#model")!;
const status = document.querySelector<HTMLElement>("#status")!;

void chrome.storage.session.get(MODEL_STORAGE).then((stored) => {
  modelInput.value = typeof stored[MODEL_STORAGE] === "string" ? stored[MODEL_STORAGE] : DEFAULT_MODEL;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  const model = modelInput.value.trim();
  if (!key || !model) return;
  status.textContent = `Testing ${model}…`;
  try {
    await generateJSON({ task: "guide", system: "Reply with the JSON object {\"ok\":true}.", payload: "ping" }, key, model, AbortSignal.timeout(15000));
  } catch (error) {
    // Some Gemini models reject generateContent ("only supports Interactions API"); say so instead of saving.
    status.textContent = error instanceof ProviderRejected ? `${model} can't be used: ${error.message}` : "The test request failed. Check your connection and try again.";
    return;
  }
  try {
    await trustedSession();
    await chrome.storage.session.set({ [KEY_STORAGE]: key, [MODEL_STORAGE]: model });
    keyInput.value = "";
    status.textContent = `Saved (${model}). Open a supported site and click Mack.`;
  } catch { status.textContent = "Could not save the key. Reload Mack and try again."; }
});
document.querySelector("#forget")!.addEventListener("click", async () => {
  try {
    await chrome.storage.session.remove([KEY_STORAGE, MODEL_STORAGE]);
    status.textContent = "Key removed.";
  } catch { status.textContent = "Could not remove the key. Reload Mack to clear this session."; }
});
