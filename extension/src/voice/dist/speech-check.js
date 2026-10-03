import { DEFAULT_VOICE_ID, FIXED_SENTENCE } from "./fixed-sentence.js";
import { speakText, SpeechStopped, stopSpeech } from "./elevenlabs-speech.js";
import { readSessionCredentials, saveSessionCredentials, } from "./session-credentials.js";
const sentence = document.querySelector("#sentence");
const status = document.querySelector("#status");
const apiKeyInput = document.querySelector("#api-key");
const voiceIdInput = document.querySelector("#voice-id");
const saveButton = document.querySelector("#save-key");
const speakButton = document.querySelector("#speak");
if (sentence) {
    sentence.textContent = FIXED_SENTENCE;
}
if (voiceIdInput && !voiceIdInput.value) {
    voiceIdInput.value = DEFAULT_VOICE_ID;
}
publish("idle", "Enter an API key, then speak the sentence.", null, null);
saveButton?.addEventListener("click", () => {
    void storeKey();
});
speakButton?.addEventListener("click", () => {
    void speakFixedSentence();
});
window.addEventListener("pagehide", () => {
    stopSpeech();
});
async function storeKey() {
    try {
        await saveSessionCredentials(apiKeyInput?.value ?? "", voiceIdInput?.value ?? "");
        if (apiKeyInput) {
            apiKeyInput.value = "";
        }
        publish("idle", "Saved for this browser session.", null, null);
    }
    catch (error) {
        publish("error", messageFrom(error), null, null);
    }
}
async function speakFixedSentence() {
    if (speakButton) {
        speakButton.disabled = true;
    }
    try {
        if (apiKeyInput?.value.trim()) {
            await saveSessionCredentials(apiKeyInput.value, voiceIdInput?.value ?? "");
            apiKeyInput.value = "";
        }
        const credentials = await readSessionCredentials();
        if (!credentials) {
            throw new Error("Enter an ElevenLabs API key. It stays in this browser session only.");
        }
        publish("requesting", "Asking ElevenLabs to speak.", null, null);
        const spoken = await speakText({
            text: FIXED_SENTENCE,
            apiKey: credentials.apiKey,
            voiceId: credentials.voiceId,
            onPlaybackStart: () => {
                publish("playing", "Speaking the sentence.", null, null);
            },
        });
        publish("spoken", `Spoken: ${spoken.text}`, spoken.durationSeconds, spoken.peak);
    }
    catch (error) {
        if (error instanceof SpeechStopped) {
            publish("idle", "Speech stopped.", null, null);
            return;
        }
        publish("error", messageFrom(error), null, null);
    }
    finally {
        if (speakButton) {
            speakButton.disabled = false;
        }
    }
}
function publish(state, detail, durationSeconds, peak) {
    document.body.dataset.speechState = state;
    document.body.dataset.speechSentence = FIXED_SENTENCE;
    if (durationSeconds === null) {
        delete document.body.dataset.speechSeconds;
    }
    else {
        document.body.dataset.speechSeconds = String(durationSeconds);
    }
    if (peak === null) {
        delete document.body.dataset.speechPeak;
    }
    else {
        document.body.dataset.speechPeak = String(peak);
    }
    if (status) {
        status.textContent = detail;
    }
    window.__mackSpeechCheck = {
        state,
        sentence: FIXED_SENTENCE,
        detail,
        durationSeconds,
        peak,
    };
}
function messageFrom(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Speech failed.";
}
