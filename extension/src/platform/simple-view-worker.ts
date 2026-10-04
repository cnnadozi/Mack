// The service-worker half of Role 4's platform: it answers the simple view's
// requests for the model, for its saved goal, and for a look at the pages a link
// leads to. Adapted from Role 4's own service worker, with two differences: Mack
// is on for every tab at once (the toolbar icon), and the content script is
// always present, so nothing is injected.

import { debug } from "./debug";
import { authorizedSender, createModelHandler } from "./model-handler";
import { SessionMessageSchema } from "./protocol";
import { generateJSON } from "./provider";
import {
  DEFAULT_MODEL,
  KEY_STORAGE,
  MODEL_STORAGE,
  readTab,
  sameSite,
  tabKey,
  trustedSession,
  UNSAFE_LINK,
} from "./settings";

// The key from .env.local. A key saved on the options page for this browser
// session is used instead when there is one.
const BUILD_KEY = import.meta.env.GEMINI_API_KEY ?? "";

const MAX_PEEKS = 8;
const PEEK_TIMEOUT_MS = 3500;
const MAX_PEEK_CHARS = 600_000;

async function credentials(): Promise<{ key?: string; model: string }> {
  await trustedSession();
  const stored = await chrome.storage.session.get([KEY_STORAGE, MODEL_STORAGE]);
  const key = stored[KEY_STORAGE] as unknown;
  const model = stored[MODEL_STORAGE] as unknown;
  return {
    key: typeof key === "string" && key ? key : BUILD_KEY || undefined,
    model: typeof model === "string" && model ? model : DEFAULT_MODEL,
  };
}

// Peeks run without cookies, so pages are seen as a signed-out visitor sees them:
// no personal data, no account actions.
async function peek(urls: string[], pageUrl: string) {
  const allowed = [...new Set(urls)]
    .filter((url) => sameSite(url, pageUrl) && !UNSAFE_LINK.test(url))
    .slice(0, MAX_PEEKS);
  const results = await Promise.allSettled(
    allowed.map(async (url) => {
      const response = await fetch(url, {
        credentials: "omit",
        redirect: "follow",
        signal: AbortSignal.timeout(PEEK_TIMEOUT_MS),
      });
      const html = (response.headers.get("content-type") ?? "").includes("text/html");
      if (!response.ok || !sameSite(response.url, pageUrl) || !html) throw new Error("skip");
      return {
        url,
        finalUrl: response.url,
        html: (await response.text()).slice(0, MAX_PEEK_CHARS),
      };
    }),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export function createSimpleViewWorker(deps: {
  /** Whether Mack is turned on. */
  isActive(): Promise<boolean>;
  /** Turns Mack off. */
  stop(): Promise<unknown>;
}) {
  const model = createModelHandler({
    extensionId: chrome.runtime.id,
    readAccess: async () => ({ active: await deps.isActive(), ...(await credentials()) }),
    generate: generateJSON,
  });

  // A model answer for a page the tab has left is of no use to anyone.
  chrome.tabs.onUpdated.addListener((id, change) => {
    if (change.status === "loading") model.cancelTab(id);
  });
  chrome.tabs.onRemoved.addListener((id) => {
    model.cancelTab(id);
    void chrome.storage.session.remove(tabKey(id));
  });

  return {
    /**
     * Handles one of the platform's messages. The result is what a
     * chrome.runtime.onMessage listener returns; undefined means the message
     * was not one of the platform's.
     */
    handle(
      raw: unknown,
      sender: chrome.runtime.MessageSender,
      respond: (response: unknown) => void,
    ): boolean | undefined {
      const type = typeof raw === "object" && raw !== null && "type" in raw ? raw.type : undefined;
      if (type === "mack:model" || type === "mack:cancel") {
        debug("background", `simple view: ${type} from tab ${sender.tab?.id}`);
        void model.handle(raw, sender).then((reply) => {
          if (!reply.ok) debug("background", "simple view: model request failed", reply);
          respond(reply);
        });
        return true;
      }
      const parsed = SessionMessageSchema.safeParse(raw);
      if (!parsed.success) return undefined;
      if (!authorizedSender(sender, chrome.runtime.id)) return false;
      const message = parsed.data;
      const tabId = sender.tab!.id!;
      debug("background", `simple view: ${message.type} from tab ${tabId}`);
      void (async () => {
        const on = await deps.isActive();
        switch (message.type) {
          case "mack:session": {
            const { goal, goalFrom } = on
              ? await readTab(tabId)
              : { goal: undefined, goalFrom: undefined };
            return respond({
              active: on,
              ...(goal ? { goal } : {}),
              ...(goal && goalFrom ? { goalFrom } : {}),
            });
          }
          case "mack:peek":
            return respond({ pages: on ? await peek(message.urls, sender.url!) : [] });
          case "mack:goal": {
            const goal = message.goal.trim();
            if (!on || !goal) await chrome.storage.session.remove(tabKey(tabId));
            // goalFrom is the page where the goal was set, so returning there drops it.
            else {
              await chrome.storage.session.set({
                [tabKey(tabId)]: {
                  active: true,
                  goal,
                  goalAt: Date.now(),
                  ...(message.fromUrl ? { goalFrom: message.fromUrl } : {}),
                },
              });
            }
            return respond({ ok: true });
          }
          case "mack:exit":
            await deps.stop();
            return respond({ ok: true });
          case "mack:resume":
            return respond({ ok: true });
        }
      })().catch(() => respond({ ok: false }));
      return true;
    },

    /** Forgets every tab's goal, for when Mack is turned off. */
    async clearGoals(): Promise<void> {
      const stored = await chrome.storage.session.get(null);
      const keys = Object.keys(stored).filter((key) => key.startsWith(tabKey(0).slice(0, -1)));
      if (keys.length > 0) await chrome.storage.session.remove(keys);
    },
  };
}
