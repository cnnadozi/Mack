import { extensionChrome } from "./chrome-api.js";
import { DEFAULT_VOICE_ID } from "./fixed-sentence.js";

const API_KEY_FIELD = "elevenlabsApiKey";
const VOICE_ID_FIELD = "elevenlabsVoiceId";

export interface SpeechCredentials {
  apiKey: string;
  voiceId: string;
}

export async function saveSessionCredentials(
  apiKey: string,
  voiceId: string,
): Promise<void> {
  const trimmedKey = apiKey.trim();
  const trimmedVoice = voiceId.trim() || DEFAULT_VOICE_ID;
  if (!trimmedKey) {
    throw new Error("Enter an ElevenLabs API key.");
  }
  await extensionChrome().storage.session.set({
    [API_KEY_FIELD]: trimmedKey,
    [VOICE_ID_FIELD]: trimmedVoice,
  });
}

export async function readSessionCredentials(): Promise<SpeechCredentials | null> {
  const stored = await extensionChrome().storage.session.get([
    API_KEY_FIELD,
    VOICE_ID_FIELD,
  ]);
  const apiKey = stored[API_KEY_FIELD];
  const voiceId = stored[VOICE_ID_FIELD];
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return null;
  }
  return {
    apiKey,
    voiceId:
      typeof voiceId === "string" && voiceId.length > 0
        ? voiceId
        : DEFAULT_VOICE_ID,
  };
}
