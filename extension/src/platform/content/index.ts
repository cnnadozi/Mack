// Content script: runs on every page. In the top frame it draws Mack's panel, runs
// Role 4's simple view, and answers the background worker's requests to read the
// page and to point at, click or type into an element. It never sees an API key.

import { debug } from "../debug";
import type { ExtractReply, TabMessage } from "../messages";
import { act } from "./act";
import { extractPage } from "./extract";
import { highlight, initOverlay } from "./overlay";
import { actInSimpleView, guideInSimpleView, initSimpleView, simpleViewShowing } from "./simple-view";

// The background worker adds this script to tabs that have none; the flag stops a
// second copy from starting if it is ever added to a tab that already has one.
const scope = globalThis as typeof globalThis & { __mackContentScript?: boolean };

if (window.top === window && !scope.__mackContentScript) {
  scope.__mackContentScript = true;
  debug("content", "ready on", location.href);
  void initOverlay();
  void initSimpleView();

  chrome.runtime.onMessage.addListener((message: TabMessage, _sender, sendResponse) => {
    if (message.type === "mack:ping") {
      sendResponse(true);
    } else if (message.type === "mack:extract") {
      const reply: ExtractReply = { page: extractPage(), simple: simpleViewShowing() };
      debug(
        "content",
        `extract: ${reply.page.elements.length} elements, ${reply.page.headings.length} headings`,
        reply,
      );
      sendResponse(reply);
    } else if (message.type === "mack:highlight") {
      debug("content", "highlight requested for", message.elementId);
      highlight(message.elementId);
    } else if (message.type === "mack:act") {
      void act(message.step).then(sendResponse);
      return true;
    } else if (message.type === "mack:simple") {
      sendResponse({ ok: actInSimpleView(message.op, message.elementId, message.text ?? "") });
    } else if (message.type === "mack:guide") {
      void guideInSimpleView(message.text).then(sendResponse, () => sendResponse({ ok: false }));
      return true;
    }
    return false;
  });
}
