// Runs Role 4's platform on this page: the AI-redesigned simple view (Role 3's UI),
// Role 2's guidance, and the links between them and the rest of the extension.
// Loaded only while Mack is on, because it brings React and the validators with it.

import { z } from "zod";

import type { LensAppProps, ModelClient, VoiceController } from "../../../../shared/contracts";
import { createGenerateScreen, mountMackApp, type MackAppProps } from "../../ui";
import { startPlatform } from "../controller";
import { debug } from "../debug";
import { createResolveIntent } from "../guidance-adapter";
import type { GuideReply, RuntimeMessage } from "../messages";
import { createModelClient } from "../model-client";
import { PeekReplySchema } from "../protocol";
import { rememberToContinue } from "./continue";
import { designCache } from "./design-cache";
import { followTheme } from "./theme";

const SessionSchema = z.object({
  active: z.boolean(),
  goal: z.string().optional(),
  goalFrom: z.string().optional(),
});

// Longer than the background worker's own limit for one model request.
const GUIDE_WAIT_MS = 30_000;
const PEEK_WAIT_MS = 1500;

// What is added to Role 3's design prompt and Role 2's guidance prompt.
function extraInstructions(task: "design" | "guide", language: string): string {
  const parts: string[] = [];
  if (language && task === "design") {
    parts.push(
      `Write the title, every heading and every button label in ${language}, translating the website's own wording faithfully.`,
    );
  }
  if (language && task === "guide") {
    parts.push(
      `Write the instruction, question, options and message in ${language}. Labels in double quotes stay exactly as given.`,
    );
  }
  return parts.join("\n\n");
}

// Adds those instructions, and reuses a design made for this page earlier.
function tunedModel(model: ModelClient, options: { language: string; fresh: boolean }): ModelClient {
  // "Recreate" must give a new design; only the first one may come from memory.
  let mayReuse = !options.fresh;
  return {
    generateJSON: async (input, signal) => {
      const extra = extraInstructions(input.task, options.language);
      const request = extra ? { ...input, system: `${input.system}\n\n${extra}` } : input;
      if (input.task !== "design") return model.generateJSON(request, signal);

      const cache = designCache(request.system, request.payload);
      const remembered = mayReuse ? cache.get() : undefined;
      mayReuse = false;
      if (remembered)
        debug("content", "simple view: reusing the design made for this page earlier");
      const result = remembered ?? (await model.generateJSON(request, signal));
      if (!remembered) cache.set(result);
      return result;
    },
  };
}

export interface SimpleView {
  /** Asks Role 2's guidance to show the user where to go, on the simple view. */
  guide(text: string): Promise<GuideReply>;
  stop(): void;
}

function send(message: RuntimeMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message).catch((error: unknown) => {
    debug("content", `simple view: could not send "${message.type}"`, error);
  });
}

// Role 4's controller speaks and listens through this seam. Both go to the
// offscreen document, which owns the microphone and ElevenLabs.
function createVoice(): VoiceController {
  let spoke = false;
  return {
    startListening: async () => void (await send({ type: "mack:talk", held: true })),
    stopListening: async () => void (await send({ type: "mack:talk", held: false })),
    speak: async (job) => {
      spoke = true;
      await send({ type: "mack:say", text: job.text });
    },
    // The controller cancels on every page change; only speech it started is cut off.
    cancelSpeech: () => {
      if (!spoke) return;
      spoke = false;
      void send({ type: "mack:hush" });
    },
    dispose: () => undefined,
  };
}

export async function startSimpleView(options: {
  /** The language to write the simple view in; "" is English. */
  language: string;
  /** Ask the model again even if a design for this page is remembered. */
  fresh: boolean;
  /** The user pressed "Original page", or the tab moved to a page this view is not for. */
  onShowOriginal(): void;
  /** Whether the simple view is covering the page right now. */
  onModeChange(simple: boolean): void;
}): Promise<SimpleView> {
  const session = SessionSchema.parse(await chrome.runtime.sendMessage({ type: "mack:session" }));
  // The goal was set on this exact page, so the user came back to it: it no longer applies.
  const returned = !!session.goal && session.goalFrom === location.href;
  const saveGoal = (goal: string, fromUrl?: string): void => {
    void chrome.runtime
      .sendMessage({ type: "mack:goal", goal, ...(fromUrl ? { fromUrl } : {}) })
      .catch(() => undefined);
  };
  if (returned) saveGoal("");

  const model = tunedModel(createModelClient(), options);
  let platform: ReturnType<typeof startPlatform> | undefined;

  const inner = mountMackApp();
  const viewProps = (props: LensAppProps): MackAppProps => ({
    ...props,
    embedded: true,
    onShowOriginal: options.onShowOriginal,
    // The page a card or a search leads to continues in the simple view.
    onAction: (id) => {
      rememberToContinue();
      props.onAction(id);
    },
    onSearch: (id, text) => {
      rememberToContinue();
      props.onSearch(id, text);
    },
  });
  const stopTheme = followTheme(inner.host);
  let running = true;
  platform = startPlatform({
    mount: {
      host: inner.host,
      render: (props: LensAppProps) => {
        options.onModeChange(props.state.screen.mode === "simplified");
        inner.render(viewProps(props));
      },
      unmount: () => {
        stopTheme();
        inner.unmount();
      },
    },
    generateScreen: createGenerateScreen(model),
    language: options.language,
    // Straight to the offscreen voice, so a navigation that follows does not cut it off.
    announce: (text) => void send({ type: "mack:say", text }),
    // The simple view is made when the user asks for it, not whenever the page changes.
    redesignOnPageChange: false,
    onOutdated: options.onShowOriginal,
    resolveIntent: createResolveIntent(model),
    createVoice,
    initialGoal: returned ? undefined : session.goal,
    saveGoal,
    // Looking one click ahead adds shortcut links, but the design must not wait
    // long for slow pages: whatever has not arrived in time is left out.
    peek: (urls) =>
      Promise.race([
        chrome.runtime
          .sendMessage({ type: "mack:peek", urls })
          .then((reply) => PeekReplySchema.parse(reply).pages),
        new Promise<[]>((resolve) => window.setTimeout(() => resolve([]), PEEK_WAIT_MS)),
      ]),
    // "Exit Mack" in the simple view turns Mack off, like the X on the panel.
    onExit: () => {
      running = false;
      options.onModeChange(false);
      void send({ type: "mack:stop" });
    },
  });

  return {
    async guide(text) {
      if (!running || platform!.getState().screen.mode !== "simplified") return { ok: false };
      platform!.request(text);
      const deadline = Date.now() + GUIDE_WAIT_MS;
      while (running && platform!.getState().busy && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      const state = platform!.getState();
      // When ok, the controller speaks the instruction itself through createVoice.
      return { ok: running && !state.busy && !state.error && state.instruction !== "" };
    },
    stop() {
      if (!running) return;
      running = false;
      // "true" keeps the session: this page is going away, not Mack.
      platform!.exit(true);
      options.onModeChange(false);
    },
  };
}
