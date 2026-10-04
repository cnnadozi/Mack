import { DEFAULT_VOICE_ID, FIXED_SENTENCE } from "./fixed-sentence.js";
import { speakText, SpeechStopped, stopSpeech } from "./elevenlabs-speech.js";
import { readCredentials, saveVoiceId } from "./session-credentials.js";
const sentence = document.querySelector("#sentence");
const status = document.querySelector("#status");
const voiceIdInput = document.querySelector("#voice-id");
const speakButton = document.querySelector("#speak");
if (sentence) {
    sentence.textContent = FIXED_SENTENCE;
}
if (voiceIdInput && !voiceIdInput.value) {
    voiceIdInput.value = DEFAULT_VOICE_ID;
}
publish("idle", "Ready. Choose Speak the sentence.", null, null);
speakButton?.addEventListener("click", () => {
    void speakFixedSentence();
});
window.addEventListener("pagehide", () => {
    stopSpeech();
});
async function speakFixedSentence() {
    if (speakButton) {
        speakButton.disabled = true;
    }
    try {
        await saveVoiceId(voiceIdInput?.value ?? "");
        const credentials = await readCredentials();
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
