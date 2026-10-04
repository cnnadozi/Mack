// Runs Role 4's platform on this page: the AI-redesigned simple view (Role 3's UI),
// Role 2's guidance, and the links between them and the rest of the extension.
// Loaded only while Mack is on, because it brings React and the validators with it.

import { z } from "zod";

import type { LensAppProps, ModelClient, VoiceController } from "../../../../shared/contracts";
import {
  createGenerateScreen,
  mountMackApp,
  readDetails,
  type MackAppProps,
  type ScreenDetails,
} from "../../ui";
import { startPlatform } from "../controller";
import { debug } from "../debug";
import { createResolveIntent } from "../guidance-adapter";
import type { GuideReply, RuntimeMessage } from "../messages";
import { createModelClient } from "../model-client";
import { PeekReplySchema } from "../protocol";
import { rememberToContinue } from "./continue";
import { designCache } from "./design-cache";
import { pictureFor, siteLook } from "./page-look";
import { buttonWords, pageFacts } from "./screen-words";
import { followTheme } from "./theme";

const SessionSchema = z.object({
  active: z.boolean(),
  goal: z.string().optional(),
  goalFrom: z.string().optional(),
});

// Longer than the background worker's own limit for one model request.
const GUIDE_WAIT_MS = 30_000;
const PEEK_WAIT_MS = 1500;

// Added to Role 3's design prompt. The simple view is a redesign of the whole
// page, so it asks for more than Role 3's short menu: everything the page offers,
// organised the way this page is, with the detail to present it well.
const RICH_DESIGN = `This screen is a full, well-organised redesign of the page, not a short menu. This overrides the limits above on how many buttons to show:
- Cover everything a visitor can do or reach from this page. Put the main things in "main" sections and the rest in "more" sections. Group related actions under clear headings that reflect how THIS page is organised, for example its own product categories, departments or topics. Up to 40 buttons in total.
- If page.searchFields lists a search box, always set "search" to it.
- Prefer status "ready". Use "use_original" only when the page's main purpose is filling in a form that asks for private details.
- Reply with the layout only: no summary, highlights, descriptions or icons. Those are written separately.`;

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
  options: { language: string; fresh: boolean },
  onDesign: (raw: unknown) => void,
): ModelClient {
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
      onDesign(result);
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

  // The site's own look is read once. The model's detail arrives in pieces: with
  // the design, and from the two requests for words that follow it.
  const site = siteLook();
  const rawModel = createModelClient();
  const words = new AbortController();
  const wordOptions = {
    model: rawModel,
    language: options.language,
    fresh: options.fresh,
    signal: words.signal,
  };
  let fromModel: ScreenDetails = {};
  let redraw = (): void => undefined;
  const addDetails = (more: ScreenDetails): void => {
    const actions = { ...fromModel.actions };
    for (const [id, detail] of Object.entries(more.actions ?? {}))
      actions[id] = { ...actions[id], ...detail };
    fromModel = {
      summary: more.summary ?? fromModel.summary,
      highlights: more.highlights?.length ? more.highlights : fromModel.highlights,
      sections: { ...fromModel.sections, ...more.sections },
      actions,
    };
    redraw();
  };
  const model = tunedModel(rawModel, options, (raw) => addDetails(readDetails(raw)));
  let platform: ReturnType<typeof startPlatform> | undefined;

  // Asks for the words once per reading of the page: the facts as soon as the
  // page has been read, the descriptions as soon as there are buttons to describe.
  const asked = { snapshot: "", buttons: false };
  const askForWords = (props: LensAppProps): void => {
    const { screen, busy } = props.state;
    const snapshot = platform?.getExtraction()?.snapshot;
    if (!snapshot || screen.mode !== "simplified") return;
    const failed = (what: string) => (error: unknown) => {
      if (!words.signal.aborted) debug("content", `simple view: no ${what} for this page`, error);
    };
    if (screen.snapshotVersion === snapshot.version && asked.snapshot !== snapshot.version) {
      asked.snapshot = snapshot.version;
      asked.buttons = false;
      fromModel = {};
      pageFacts(snapshot, wordOptions).then(addDetails, failed("summary"));
    }
    const ready = !busy && screen.sections.some((section) => section.buttons.length > 0);
    if (ready && asked.snapshot === snapshot.version && !asked.buttons) {
      asked.buttons = true;
      buttonWords(snapshot, screen, wordOptions).then(addDetails, failed("descriptions"));
    }
  };

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
  const viewProps = (props: LensAppProps): MackAppProps => ({
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
  const stopTheme = followTheme(inner.host);
  let running = true;
  platform = startPlatform({
    mount: {
      host: inner.host,
      render: (props: LensAppProps) => {
        redraw = () => {
          if (running) inner.render(viewProps(props));
        };
        options.onModeChange(props.state.screen.mode === "simplified");
        askForWords(props);
        inner.render(viewProps(props));
      },
      unmount: () => {
        words.abort();
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
