// Runs Role 4's platform on this page: the AI-redesigned simple view (Role 3's UI),
// Role 2's guidance, and the links between them and the rest of the extension.
// Loaded only while Mack is on, because it brings React and the validators with it.

import { z } from "zod";

import type { LensAppProps, ModelClient, VoiceController } from "../../../../shared/contracts";
import {
  createGenerateScreen,
  ICON_NAMES,
  mountMackApp,
  readDetails,
  type ScreenDetails,
} from "../../ui";
import { startPlatform } from "../controller";
import { debug } from "../debug";
import { createResolveIntent } from "../guidance-adapter";
import type { GuideReply, RuntimeMessage } from "../messages";
import { createModelClient } from "../model-client";
import { PeekReplySchema } from "../protocol";
import { rememberToContinue } from "./continue";
import { pictureFor, siteLook } from "./page-look";
import { followTheme } from "./theme";

const SessionSchema = z.object({
  active: z.boolean(),
  goal: z.string().optional(),
  goalFrom: z.string().optional(),
});

// Longer than the background worker's own limit for one model request.
const GUIDE_WAIT_MS = 30_000;

// Added to Role 3's design prompt. The simple view is a redesign of the whole
// page, so it asks for more than Role 3's short menu: everything the page offers,
// organised the way this page is, with the detail to present it well.
const RICH_DESIGN = `This screen is a full, well-organised redesign of the page, not a short menu. This overrides the limits above on how many buttons to show:
- Cover everything a visitor can do or reach from this page. Put the main things in "main" sections and the rest in "more" sections. Group related actions under clear headings that reflect how THIS page is organised, for example its own product categories, departments or topics. Up to 40 buttons in total.
- Add "summary": one or two plain sentences saying what this page is and what the visitor can do here.
- Add "highlights": up to 6 key facts that the page itself states and a visitor would look for, such as opening hours, a price, a phone number, a deadline or a delivery time. Each is {"title","text"}. Use only facts present in the snapshot; use an empty list when there are none.
- Give each section a "description": one short sentence about what is in it.
- Give each button a "description": one short sentence saying what the visitor will find there or what happens, based on the snapshot, and an "icon": the one of ${ICON_NAMES.join(", ")} that fits it best.
- If page.searchFields lists a search box, always set "search" to it.
- Prefer status "ready". Use "use_original" only when the page's main purpose is filling in a form that asks for private details.`;

// What is added to Role 3's design prompt and Role 2's guidance prompt.
function extraInstructions(task: "design" | "guide", language: string): string {
  const parts = task === "design" ? [RICH_DESIGN] : [];
  if (language && task === "design") {
    parts.push(
      `Write the title, summary, highlights, and every heading, label and description in ${language}, translating the website's own wording faithfully.`,
    );
  }
  if (language && task === "guide") {
    parts.push(
      `Write the instruction, question, options and message in ${language}. Labels in double quotes stay exactly as given.`,
    );
  }
  return parts.join("\n\n");
}

// Adds those instructions, and hands the model's raw design to onDesign: Role 3's
// grounding keeps only the contract's fields, and the detail is in the rest.
function tunedModel(
  model: ModelClient,
  language: string,
  onDesign: (raw: unknown) => void,
): ModelClient {
  return {
    generateJSON: async (input, signal) => {
      const extra = extraInstructions(input.task, language);
      const result = await model.generateJSON(
        extra ? { ...input, system: `${input.system}\n\n${extra}` } : input,
        signal,
      );
      if (input.task === "design") onDesign(result);
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

  // The site's own look is read once; the model's detail arrives with each design.
  const site = siteLook();
  let fromModel: ScreenDetails = {};
  const model = tunedModel(createModelClient(), options.language, (raw) => {
    fromModel = readDetails(raw);
  });
  let platform: ReturnType<typeof startPlatform> | undefined;

  // Joins the model's detail with what the page itself provides for the buttons on screen.
  const detailsFor = (props: LensAppProps): ScreenDetails => {
    const extraction = platform?.getExtraction();
    const actions: NonNullable<ScreenDetails["actions"]> = {};
    for (const section of props.state.screen.sections) {
      for (const button of section.buttons) {
        const image = pictureFor(extraction?.registry.get(button.actionId));
        actions[button.actionId] = {
          ...fromModel.actions?.[button.actionId],
          ...(image ? { image } : {}),
        };
      }
    }
    return { ...fromModel, site, actions };
  };

  const inner = mountMackApp();
  const stopTheme = followTheme(inner.host);
  let running = true;
  platform = startPlatform({
    mount: {
      host: inner.host,
      render: (props: LensAppProps) => {
        options.onModeChange(props.state.screen.mode === "simplified");
        inner.render({
          ...props,
          embedded: true,
          details: detailsFor(props),
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
      },
      unmount: () => {
        stopTheme();
        inner.unmount();
      },
    },
    generateScreen: createGenerateScreen(model),
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
