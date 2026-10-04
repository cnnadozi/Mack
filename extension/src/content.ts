import { z } from "zod";
import { createGenerateScreen, mountMackApp } from "./ui";
import { startPlatform } from "./platform/controller";
import { createModelClient } from "./platform/model-client";
import { createResolveIntent } from "./platform/guidance-adapter";
import { CachedDesignReplySchema, PeekReplySchema } from "./platform/protocol";

type Activation = { platform?: ReturnType<typeof startPlatform> };
const scope = globalThis as typeof globalThis & { __mackActivation?: Activation };
if (!scope.__mackActivation) {
  const activation: Activation = {};
  scope.__mackActivation = activation;
  void (async () => {
    const session = z.object({ active: z.boolean(), goal: z.string().optional(), goalFrom: z.string().optional() }).parse(await chrome.runtime.sendMessage({ type: "mack:session" }));
    if (!session.active) { delete scope.__mackActivation; return; }
    // The goal was set on this exact page, so the user came back to it: the goal no longer applies.
    const returned = !!session.goal && session.goalFrom === location.href;
    if (returned) void chrome.runtime.sendMessage({ type: "mack:goal", goal: "" }).catch(() => {});
    const model = createModelClient();
    const mount = mountMackApp();
    const onPageHide = () => { activation.platform?.exit(true); delete scope.__mackActivation; };
    const platform = startPlatform({
      mount, generateScreen: createGenerateScreen(model),
      resolveIntent: createResolveIntent(model),
      initialGoal: returned ? undefined : session.goal,
      saveGoal: (goal, fromUrl) => { void chrome.runtime.sendMessage({ type: "mack:goal", goal, ...(fromUrl ? { fromUrl } : {}) }).catch(() => {}); },
      peek: async (urls) => PeekReplySchema.parse(await chrome.runtime.sendMessage({ type: "mack:peek", urls })).pages,
      designCache: {
        get: async () => CachedDesignReplySchema.parse(await chrome.runtime.sendMessage({ type: "mack:design-get" })).entry,
        put: (entry) => { void chrome.runtime.sendMessage({ type: "mack:design-put", entry }).catch(() => {}); },
      },
      onExit: () => {
        window.removeEventListener("pagehide", onPageHide);
        delete scope.__mackActivation;
        void chrome.runtime.sendMessage({ type: "mack:exit" }).catch(() => {});
      },
    });
    activation.platform = platform;
    window.addEventListener("pagehide", onPageHide, { once: true });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) void chrome.runtime.sendMessage({ type: "mack:resume" }).catch(() => {});
    }, { once: true });
  })().catch(() => { delete scope.__mackActivation; });
}
