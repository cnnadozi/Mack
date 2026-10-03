import { extensionChrome } from "./chrome-api.js";

const button = document.querySelector("#open-speech-check");

button?.addEventListener("click", () => {
  const url = extensionChrome().runtime.getURL("src/voice/speech-check.html");
  void extensionChrome().tabs.create({ url });
});
