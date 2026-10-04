// The conversation loop, for spoken and typed questions. It also speaks the
// instructions of Role 4's simple view, so there is one voice and one microphone. It runs in an offscreen document because a service
// worker has no microphone or audio output, and because the user must be able to
// stay on the website: no visible page is needed while talking.
//
// This is the only code that reads the provider keys. Offscreen documents can use
// chrome.runtime only, so everything else goes through the background worker.

import { DEFAULT_VOICE_ID } from "../../voice/fixed-sentence";
import { speakText, SpeechStopped, stopSpeech } from "../../voice/elevenlabs-speech";
import { playChime } from "../../voice/live/chime";
import { startMicListener, type MicListener } from "../../voice/live/mic-listener";
import { listVoices } from "../../voice/live/voices";
import { debug, since } from "../debug";
import { askGemini, transcribe, type Turn } from "../gemini";
import { replyCache, replyKey } from "../reply-cache";
import type {
  ActResult,
  GuideReply,
  PageAction,
  PageContext,
  RuntimeMessage,
  SessionState,
} from "../messages";
import { greetingIn } from "../messages";

const ELEVENLABS_API_KEY = import.meta.env.ELEVENLABS_API_KEY ?? "";
const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY ?? "";

const VOICE_SAMPLE = "This is how I sound now.";
const LEFT_TO_USER =
  "I'd rather you do this one yourself, because it may pay for something, delete something or sign you in. I've highlighted it for you.";
const TOO_MANY_STEPS =
  "I've done several steps and I'm not finished. Tell me to keep going if you want me to continue.";
// A task that needs more than this is probably going in circles.
const MAX_STEPS = 15;

type Asked = { audio: string } | { text: string };

const history: Turn[] = [];
// Stays null when there is no usable microphone; typed questions still work.
let listener: MicListener | null = null;
let lineCount = 0;
const startedWith = new URLSearchParams(location.search);
let pushToTalk = startedWith.has("ptt");
let voiceId = startedWith.get("voice") || DEFAULT_VOICE_ID;
// The language Mack answers in; "" is English.
let language = startedWith.get("language") ?? "";
// Each new question gets the next number. A turn that finds a newer number has
// been interrupted and must not speak or change the status any more.
let turnId = 0;
let resting = false;
// The question handed to the simple view's guidance, until its answer is spoken.
let guidedRequest: string | null = null;
// The turn in which a simple-view instruction is being spoken, so only that
// speech is cut off when the simple view asks for quiet.
let guidanceTurn = 0;

function send(message: RuntimeMessage): void {
  void chrome.runtime.sendMessage(message).catch((error: unknown) => {
    debug("offscreen", `could not send "${message.type}" to the background worker`, error);
  });
}

function status(state: SessionState, error?: string): void {
  send({ type: "mack:status", session: { active: true, state, error } });
}

function fail(error: string): void {
  send({ type: "mack:status", session: { active: false, state: "idle", error } });
}

function line(speaker: "user" | "mack", text: string, step = false): void {
  lineCount += 1;
  send({ type: "mack:line", line: { id: `${Date.now()}-${lineCount}`, speaker, text, step } });
}

async function say(text: string): Promise<void> {
  status("speaking");
  line("mack", text);
  const started = performance.now();
  debug("offscreen", "say: sending to ElevenLabs:", text);
  try {
    await speakText({ text, apiKey: ELEVENLABS_API_KEY, voiceId });
    debug("offscreen", `say: finished playing after ${since(started)}`);
  } catch (error) {
    if (!(error instanceof SpeechStopped)) {
      debug("offscreen", `say: ElevenLabs failed after ${since(started)}`, error);
      throw error;
    }
    debug("offscreen", "say: playback was stopped early");
  }
}

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong.";
}

// Between turns: hands-free listens for speech, push to talk waits for the button.
function rest(problem?: string): void {
  resting = true;
  const handsFree = listener !== null && !pushToTalk;
  status(handsFree ? "listening" : "ready", problem);
  if (handsFree) listener?.resume();
  else listener?.pause();
}

function labelOf(context: PageContext, elementId: string): string {
  return context.page?.elements.find((element) => element.id === elementId)?.label ?? elementId;
}

// The record of a step that is shown to the model on the next round.
function describe(step: PageAction, context: PageContext, result: ActResult): string {
  const name = (elementId: string): string => `"${labelOf(context, elementId)}"`;
  let what: string;
  switch (step.kind) {
    case "click":
      what = `click ${name(step.elementId)}`;
      break;
    case "type":
      what = `type "${step.text}" into ${name(step.elementId)}${step.submit ? " and press Enter" : ""}`;
      break;
    case "hover":
      what = `hover over ${name(step.elementId)}`;
      break;
    case "press":
      what = `press the ${step.key} key${step.elementId ? ` on ${name(step.elementId)}` : ""}`;
      break;
    case "scroll":
      what = `scroll ${step.direction}`;
      break;
    case "open":
      what = `open ${step.url}`;
      break;
    case "back":
    case "forward":
      what = `go ${step.kind} one page`;
      break;
    case "wait":
      what = "wait for the page";
      break;
  }
  return result.ok
    ? `Done: ${what}.`
    : `Failed: ${what}. It had no effect or was not possible here.`;
}

// One question from the user. A plain question or "where is" takes one round. A
// task takes several: the model picks a step, Mack does it, and the model sees the
// page that results, until it reports that the task is finished.
async function answer(asked: Asked): Promise<void> {
  turnId += 1;
  const id = turnId;
  resting = false;
  // A new question cuts off whatever Mack was still saying or doing.
  stopSpeech();
  // Half-duplex: the microphone is ignored while Mack thinks and speaks, so Mack
  // never answers its own voice.
  listener?.pause();
  status("thinking");
  let problem: string | undefined;
  const started = performance.now();
  const getContext = (): Promise<PageContext> =>
    chrome.runtime.sendMessage({ type: "mack:context" } satisfies RuntimeMessage);
  try {
    // The page is read while the audio is transcribed, so neither waits for the other.
    let [heard, context] = await Promise.all([
      "text" in asked
        ? asked.text
        : transcribe({ apiKey: GEMINI_API_KEY, audioWavBase64: asked.audio }),
      getContext(),
    ]);
    if (id !== turnId) return;
    debug("offscreen", `answer: question and page ready after ${since(started)}`, {
      heard,
      tabId: context.tabId,
      elements: context.page?.elements.length ?? 0,
      hasScreenshot: context.screenshot !== null,
    });
    // No clear words (a cough, a door): stay quiet and keep listening.
    if (!heard) {
      debug("offscreen", "answer: empty transcript, staying quiet");
      return;
    }
    line("user", heard);

    const steps: string[] = [];
    let spoken = "";
    for (;;) {
      // Only the first round can be answered from memory: after a step the page
      // has changed and the model has to look at it again.
      const key = steps.length === 0 ? replyKey(`${language} ${heard}`, context.page) : null;
      const remembered = key ? replyCache.get(key) : undefined;
      const reply =
        remembered ??
        (await askGemini({ apiKey: GEMINI_API_KEY, heard, context, history, steps, language }));
      if (id !== turnId) return;
      debug(
        "offscreen",
        `answer: round ${steps.length + 1} after ${since(started)}${remembered ? " (from cache)" : ""}`,
        reply,
      );

      const step = reply.step;
      if (!step || context.tabId === null) {
        // Tasks are never remembered, and neither is an empty answer.
        if (key && !step && reply.reply) replyCache.set(key, reply);
        // The simple view covers the real page, so pointing at something there
        // would show nothing. Role 2's guidance answers on the simple view
        // instead: it highlights the matching button and Mack speaks its instruction.
        if (context.simple && context.tabId !== null && steps.length === 0 && reply.targetId) {
          guidedRequest = heard;
          const guided = await guideOnSimpleView(context.tabId, heard);
          if (id !== turnId) return;
          if (guided) return;
          guidedRequest = null;
          debug("offscreen", "answer: the simple view had no guidance, using Mack's own answer");
        }
        if (context.tabId !== null) {
          send({ type: "mack:highlight", tabId: context.tabId, elementId: reply.targetId });
        }
        spoken = reply.reply;
        break;
      }
      if (steps.length >= MAX_STEPS) {
        debug("offscreen", `answer: stopping after ${MAX_STEPS} steps`);
        spoken = TOO_MANY_STEPS;
        break;
      }

      status("working");
      // Steps are shown as text only: speaking each one would make a task slow.
      if (reply.reply) line("mack", reply.reply, true);
      // The background worker answers once the page has settled after the step.
      const result = (await chrome.runtime.sendMessage({
        type: "mack:act",
        tabId: context.tabId,
        step,
      } satisfies RuntimeMessage)) as ActResult;
      if (id !== turnId) return;
      steps.push(describe(step, context, result));
      debug("offscreen", `answer: step ${steps.length}:`, steps[steps.length - 1]);
      if (!result.ok && result.reason === "sensitive") {
        spoken = LEFT_TO_USER;
        break;
      }
      context = await getContext();
      if (id !== turnId) return;
    }

    if (!spoken) {
      debug("offscreen", "answer: the reply text was empty, nothing will be spoken");
      return;
    }
    history.push({ role: "user", text: heard }, { role: "model", text: spoken });
    await say(spoken);
  } catch (error) {
    debug("offscreen", `answer: failed after ${since(started)}`, error);
    problem = messageFrom(error);
  } finally {
    if (id === turnId) {
      debug("offscreen", `answer: turn finished in ${since(started)}`);
      rest(problem);
    } else {
      debug("offscreen", "answer: turn was interrupted by a newer question");
    }
  }
}

async function guideOnSimpleView(tabId: number, text: string): Promise<boolean> {
  const reply = (await chrome.runtime
    .sendMessage({ type: "mack:guide", tabId, text } satisfies RuntimeMessage)
    .catch(() => null)) as GuideReply | null;
  debug("offscreen", "guideOnSimpleView:", reply);
  return reply?.ok === true;
}

// An instruction from Role 4's simple view, spoken in Mack's voice.
async function speakGuidance(text: string): Promise<void> {
  turnId += 1;
  const id = turnId;
  guidanceTurn = id;
  resting = false;
  listener?.pause();
  if (guidedRequest) {
    history.push({ role: "user", text: guidedRequest }, { role: "model", text });
    guidedRequest = null;
  }
  let problem: string | undefined;
  try {
    await say(text);
  } catch (error) {
    debug("offscreen", "speakGuidance: failed", error);
    problem = messageFrom(error);
  }
  if (id === turnId) rest(problem);
}

// The voice setting changed: say a short sample so the user hears the new voice.
async function changeVoice(next: string): Promise<void> {
  voiceId = next || DEFAULT_VOICE_ID;
  turnId += 1;
  const id = turnId;
  resting = false;
  listener?.pause();
  let problem: string | undefined;
  try {
    await say(VOICE_SAMPLE);
  } catch (error) {
    debug("offscreen", "changeVoice: sample failed", error);
    problem = messageFrom(error);
  }
  if (id === turnId) rest(problem);
}

// Push to talk: the button on the page is held down, then let go.
function hold(held: boolean): void {
  if (!listener) return;
  if (!held) {
    listener.finishManual();
    return;
  }
  turnId += 1;
  resting = false;
  stopSpeech();
  listener.startManual();
  status("hearing");
}

const STOP = Symbol("stop");

// Opens the microphone. Returns a note for the user when Mack has to run without
// it, or STOP when Mack cannot start at all.
async function openMicrophone(): Promise<string | undefined | typeof STOP> {
  if (startedWith.has("nomic")) {
    return "The microphone is off, so Mack cannot hear you. You can still type your question.";
  }
  try {
    listener = await startMicListener(chrome.runtime.getURL("mic-worklet.js"), {
      onSpeechStart: () => {
        debug("offscreen", "mic: speech started");
        status("hearing");
      },
      onDiscarded: () => {
        debug("offscreen", "mic: sound was too short to be speech, discarded");
        rest();
      },
      onUtterance: (audio) => {
        // Base64 is 4 characters per 3 bytes.
        debug(
          "offscreen",
          `mic: utterance captured, ${Math.round((audio.length * 0.75) / 1024)} KB of WAV`,
        );
        void answer({ audio });
      },
    });
    debug("offscreen", "main: microphone is open");
    return undefined;
  } catch (error) {
    debug("offscreen", "main: could not open the microphone, typing still works", error);
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      const permission = await navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .catch(() => null);
      if (permission?.state === "prompt") {
        debug(
          "offscreen",
          "main: the microphone has never been asked for, opening the permission page",
        );
        send({ type: "mack:need-microphone" });
        return STOP;
      }
      return "The microphone is blocked, so Mack cannot hear you. You can still type your question.";
    } else if (name === "NotFoundError") {
      return "No microphone was found. You can still type your question.";
    } else {
      fail(messageFrom(error));
      return STOP;
    }
  }
}

async function main(): Promise<void> {
  // Only whether each key exists: a key's value must never reach the console.
  debug("offscreen", "main: starting", {
    hasElevenLabsKey: ELEVENLABS_API_KEY !== "",
    hasGeminiKey: GEMINI_API_KEY !== "",
  });
  if (!ELEVENLABS_API_KEY || !GEMINI_API_KEY) {
    fail(
      "API keys are missing. Put ELEVENLABS_API_KEY and GEMINI_API_KEY in .env.local, then run npm run build.",
    );
    return;
  }

  // Not awaited: the voice list is only for the settings and must not delay Mack.
  listVoices(ELEVENLABS_API_KEY).then(
    (voices) => {
      debug("offscreen", `main: ElevenLabs offers ${voices.length} voices`);
      send({ type: "mack:voices", voices });
    },
    (error: unknown) => debug("offscreen", "main: could not load the voice list", error),
  );

  const microphone = await openMicrophone();
  if (microphone === STOP) return;
  let problem = microphone;

  playChime("on");
  listener?.pause();
  const id = turnId;
  try {
    await say(greetingIn(language));
  } catch (error) {
    debug("offscreen", "main: greeting failed", error);
    problem = messageFrom(error);
  }
  // A question typed during the greeting has already taken over.
  if (id === turnId) rest(problem);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  switch (message.type) {
    case "mack:typed": {
      const text = message.text.replace(/\s+/g, " ").trim();
      debug("offscreen", "typed question:", text);
      if (text) void answer({ text });
      break;
    }
    case "mack:halt":
      debug("offscreen", "task stopped by the user");
      // Bumping the turn makes the running task give up before its next step.
      turnId += 1;
      stopSpeech();
      rest();
      break;
    case "mack:say":
      debug("offscreen", "simple view instruction:", message.text);
      if (message.text.trim()) void speakGuidance(message.text.trim());
      break;
    case "mack:hush":
      if (guidanceTurn === turnId) stopSpeech();
      break;
    case "mack:talk":
      debug("offscreen", message.held ? "talk button held" : "talk button released");
      hold(message.held);
      break;
    case "mack:bye":
      debug("offscreen", "turning off");
      // Bumping the turn stops any task that is still running.
      turnId += 1;
      stopSpeech();
      listener?.dispose();
      listener = null;
      playChime("off");
      break;
    case "mack:voice":
      debug("offscreen", "voice is now", message.voiceId || "(default)");
      void changeVoice(message.voiceId);
      break;
    case "mack:language":
      debug("offscreen", "language is now", message.language || "English");
      language = message.language;
      break;
    case "mack:mode":
      debug("offscreen", "push to talk is now", message.pushToTalk);
      pushToTalk = message.pushToTalk;
      if (resting) rest();
      break;
  }
  return false;
});

window.addEventListener("pagehide", () => {
  debug("offscreen", "pagehide: releasing the microphone and stopping speech");
  listener?.dispose();
  stopSpeech();
});

void main();
