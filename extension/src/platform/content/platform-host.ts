// Runs Role 4's platform on this page: the AI-redesigned simple view (Role 3's UI),
// Role 2's guidance, and the links between them and the rest of the extension.
// Loaded only while Mack is on, because it brings React and the validators with it.

import { z } from "zod";

import type {
  DesignProposal,
  GenerateScreen,
  LensAppProps,
  ModelClient,
  VoiceController,
} from "../../../../shared/contracts";
import { createGenerateScreen, isMoreSection, mountMackApp } from "../../ui";
import { startPlatform } from "../controller";
import { debug } from "../debug";
import { createResolveIntent } from "../guidance-adapter";
import type { GuideReply, RuntimeMessage } from "../messages";
import { createModelClient } from "../model-client";
import { PeekReplySchema } from "../protocol";
import { rememberToContinue } from "./continue";
import { followTheme } from "./theme";

const SessionSchema = z.object({
  active: z.boolean(),
  goal: z.string().optional(),
  goalFrom: z.string().optional(),
});

// Longer than the background worker's own limit for one model request.
const GUIDE_WAIT_MS = 30_000;

// The simple view is kept very simple: one column of a few big buttons. The model
// is told so, and the limit is applied in code as well so it never shows more.
const MAX_BUTTONS = 3;
const KEEP_IT_SIMPLE = `The user wants the SIMPLEST possible screen. Return exactly one section with priority "main" and at most ${MAX_BUTTONS} buttons: only the things most people come to this page to do. Return no "more" sections. Labels must be very short and plain, one to three words.`;

// What is added to Role 3's design prompt and Role 2's guidance prompt.
function extraInstructions(task: "design" | "guide", language: string): string {
  const parts = task === "design" ? [KEEP_IT_SIMPLE] : [];
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

function tunedModel(model: ModelClient, language: string): ModelClient {
  return {
    generateJSON: (input, signal) => {
      const extra = extraInstructions(input.task, language);
      return model.generateJSON(
        extra ? { ...input, system: `${input.system}\n\n${extra}` } : input,
        signal,
      );
    },
  };
}

export function limitDesign(proposal: DesignProposal): DesignProposal {
  let left = MAX_BUTTONS;
  const sections = proposal.design.sections.flatMap((section) => {
    const buttons = isMoreSection(section) ? [] : section.buttons.slice(0, left);
    left -= buttons.length;
    return buttons.length > 0 ? [{ ...section, buttons }] : [];
  });
  return { ...proposal, design: { ...proposal.design, sections } };
}

function limited(generate: GenerateScreen): GenerateScreen {
  return async (request, signal) => limitDesign(await generate(request, signal));
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

  const model = tunedModel(createModelClient(), options.language);
  const inner = mountMackApp();
  const stopTheme = followTheme(inner.host);
  let running = true;
  const platform = startPlatform({
    mount: {
      host: inner.host,
      render: (props: LensAppProps) => {
        options.onModeChange(props.state.screen.mode === "simplified");
        inner.render({
          ...props,
          embedded: true,
          singleColumn: true,
          onShowOriginal: options.onShowOriginal,
          onAction: (id) => {
            rememberToContinue();
            props.onAction(id);
          },
        });
      },
      unmount: () => {
        stopTheme();
        inner.unmount();
      },
    },
    generateScreen: limited(createGenerateScreen(model)),
    // The simple view is made when the user asks for it, not whenever the page changes.
    redesignOnPageChange: false,
    onOutdated: options.onShowOriginal,
    resolveIntent: createResolveIntent(model),
    createVoice,
    initialGoal: returned ? undefined : session.goal,
    saveGoal,
    peek: async (urls) =>
      PeekReplySchema.parse(await chrome.runtime.sendMessage({ type: "mack:peek", urls })).pages,
    // "Exit Mack" in the simple view turns Mack off, like the X on the panel.
    onExit: () => {
      running = false;
      options.onModeChange(false);
      void send({ type: "mack:stop" });
    },
  });

  return {
    async guide(text) {
      if (!running || platform.getState().screen.mode !== "simplified") return { ok: false };
      platform.request(text);
      const deadline = Date.now() + GUIDE_WAIT_MS;
      while (running && platform.getState().busy && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      const state = platform.getState();
      // When ok, the controller speaks the instruction itself through createVoice.
      return { ok: running && !state.busy && !state.error && state.instruction !== "" };
    },
    stop() {
      if (!running) return;
      running = false;
      // "true" keeps the session: this page is going away, not Mack.
      platform.exit(true);
      options.onModeChange(false);
    },
  };
}
