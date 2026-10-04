import { extensionChrome } from "./chrome-api.js";
import { DEFAULT_VOICE_ID } from "./fixed-sentence.js";
const VOICE_ID_FIELD = "elevenlabsVoiceId";
// Generated from .env.local by scripts/sync-env.mjs and ignored by git, so the
// key is never typed into a page and never committed.
const LOCAL_ENV_PATH = "local-env.js";
export async function saveVoiceId(voiceId) {
    await extensionChrome().storage.session.set({
        [VOICE_ID_FIELD]: voiceId.trim() || DEFAULT_VOICE_ID,
    });
}
async function readLocalApiKey() {
    let apiKey;
    try {
        const url = extensionChrome().runtime.getURL(LOCAL_ENV_PATH);
        apiKey = (await import(url)).ELEVENLABS_API_KEY;
    }
    catch {
        // The generated file does not exist yet.
    }
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
        throw new Error("No ElevenLabs API key found. Put ELEVENLABS_API_KEY in .env.local, run node scripts/sync-env.mjs, then reload the extension.");
    }
    return apiKey.trim();
}
export async function readCredentials() {
    const apiKey = await readLocalApiKey();
    const stored = await extensionChrome().storage.session.get([VOICE_ID_FIELD]);
    const voiceId = stored[VOICE_ID_FIELD];
    return {
        apiKey,
        voiceId: typeof voiceId === "string" && voiceId.length > 0 ? voiceId : DEFAULT_VOICE_ID,
    };
}
