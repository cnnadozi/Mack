// Content script: runs on every page. In the top frame it answers the background
// worker's requests to read the page and to point at, click or type into an element. It never sees an API key.

import { debug } from "../debug";
import type { TabMessage } from "../messages";
import { act } from "./act";
import { extractPage } from "./extract";
import { highlight, initOverlay } from "./overlay";

if (window.top === window) {
  debug("content", "ready on", location.href);
  void initOverlay();

  chrome.runtime.onMessage.addListener((message: TabMessage, _sender, sendResponse) => {
    if (message.type === "mack:extract") {
      const snapshot = extractPage();
      debug(
        "content",
        `extract: ${snapshot.elements.length} elements, ${snapshot.headings.length} headings`,
        snapshot,
      );
      sendResponse(snapshot);
    } else if (message.type === "mack:highlight") {
      debug("content", "highlight requested for", message.elementId);
      highlight(message.elementId);
    } else if (message.type === "mack:act") {
      void act(message.step).then(sendResponse);
      return true;
    }
    return false;
  });
}
