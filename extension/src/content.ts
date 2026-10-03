import { z } from "zod";
import { createGenerateScreen, mountMackApp } from "./ui";
import { startPlatform } from "./platform/controller";
import { createModelClient } from "./platform/model-client";

type Activation = { platform?: ReturnType<typeof startPlatform> };
const scope = globalThis as typeof globalThis & { __mackActivation?: Activation };
if (!scope.__mackActivation) {
  const activation: Activation = {};
  scope.__mackActivation = activation;
  void (async () => {
    const session = z.object({ active: z.boolean(), goal: z.string().optional() }).parse(await chrome.runtime.sendMessage({ type: "mack:session" }));
    if (!session.active) { delete scope.__mackActivation; return; }
    const model = createModelClient();
    const mount = mountMackApp();
    const onPageHide = () => { activation.platform?.exit(true); delete scope.__mackActivation; };
    const platform = startPlatform({
      mount, generateScreen: createGenerateScreen(model),
      resolveIntent: async () => { throw new Error("Guidance is not connected yet. Use the generated actions or open the original page."); },
      initialGoal: session.goal,
      saveGoal: (goal) => { void chrome.runtime.sendMessage({ type: "mack:goal", goal }).catch(() => {}); },
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
