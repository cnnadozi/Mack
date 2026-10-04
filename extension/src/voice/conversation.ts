import { extensionChrome } from "./chrome-api.js";
import { findOrCreateAgent, getSignedUrl } from "./conversation-api.js";
import {
  startConversation,
  type ConversationSession,
  type ConversationState,
} from "./conversation-session.js";
import { readCredentials } from "./session-credentials.js";

const toggle = document.querySelector<HTMLButtonElement>("#toggle");
const status = document.querySelector<HTMLElement>("#status");
const showText = document.querySelector<HTMLInputElement>("#show-text");
const transcript = document.querySelector<HTMLOListElement>("#transcript");

const STATE_TEXT: Record<ConversationState, string> = {
  connecting: "Connecting to ElevenLabs.",
  listening: "Listening. Speak whenever you are ready.",
  speaking: "Mack is speaking.",
};

let session: ConversationSession | null = null;
let lastAgentLine: HTMLElement | null = null;

toggle?.addEventListener("click", () => {
  if (session) {
    session.stop();
  } else {
    void start();
  }
});

showText?.addEventListener("change", () => {
  if (transcript) transcript.hidden = !showText.checked;
});

window.addEventListener("pagehide", () => {
  session?.stop();
});

async function start(): Promise<void> {
  if (!toggle) return;
  toggle.disabled = true;
  publish("connecting", STATE_TEXT.connecting);
  try {
    const credentials = await readCredentials();
    const agentId = await findOrCreateAgent(credentials.apiKey, credentials.voiceId);
    const signedUrl = await getSignedUrl(credentials.apiKey, agentId);
    session = await startConversation(
      {
        signedUrl,
        workletUrl: extensionChrome().runtime.getURL("src/voice/conversation-mic-worklet.js"),
      },
      {
        onState: (state) => publish(state, STATE_TEXT[state]),
        onUserText: (text) => addLine("You", text),
        onAgentText: (text) => {
          lastAgentLine = addLine("Mack", text);
        },
        // ElevenLabs sends a correction when the user cut Mack off mid-sentence.
        onAgentCorrection: (text) => {
          if (lastAgentLine) lastAgentLine.textContent = text;
        },
        onEnd: (error) => {
          session = null;
          toggle.textContent = "Start conversation";
          toggle.setAttribute("aria-pressed", "false");
          publish(error ? "error" : "idle", error ?? "Conversation ended.");
        },
      },
    );
    toggle.textContent = "End conversation";
    toggle.setAttribute("aria-pressed", "true");
  } catch (error) {
    session = null;
    publish("error", messageFrom(error));
  } finally {
    toggle.disabled = false;
  }
}

function addLine(speaker: "You" | "Mack", text: string): HTMLElement {
  const item = document.createElement("li");
  item.dataset.speaker = speaker;
  const name = document.createElement("strong");
  name.textContent = `${speaker}: `;
  const words = document.createElement("span");
  words.textContent = text;
  item.append(name, words);
  transcript?.append(item);
  item.scrollIntoView({ block: "nearest" });
  return words;
}

function publish(state: ConversationState | "idle" | "error", detail: string): void {
  document.body.dataset.conversationState = state;
  if (status) status.textContent = detail;
}

function messageFrom(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission was denied. Allow the microphone for Mack, then start again.";
  }
  if (name === "NotFoundError") {
    return "No microphone is available.";
  }
  return error instanceof Error && error.message ? error.message : "The conversation could not start.";
}
