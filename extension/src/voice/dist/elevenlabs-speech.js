import { TTS_MODEL_ID, TTS_OUTPUT_FORMAT, } from "./fixed-sentence.js";
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{8,40}$/;
let generation = 0;
let active = null;
let requestAbort = null;
let cancelWait = null;
export class SpeechStopped extends Error {
    constructor() {
        super("Speech was stopped.");
        this.name = "SpeechStopped";
    }
}
export function buildSpeechRequest(voiceId, text, apiKey) {
    const trimmedVoice = voiceId.trim();
    const trimmedKey = apiKey.trim();
    const spoken = text.trim();
    if (!VOICE_ID_PATTERN.test(trimmedVoice)) {
        throw new Error("Enter an ElevenLabs voice id.");
    }
    if (!trimmedKey) {
        throw new Error("Enter an ElevenLabs API key.");
    }
    if (!spoken) {
        throw new Error("There is no sentence to speak.");
    }
    const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${trimmedVoice}`);
    url.searchParams.set("output_format", TTS_OUTPUT_FORMAT);
    return {
        url: url.toString(),
        init: {
            method: "POST",
            referrerPolicy: "no-referrer",
            headers: {
                "xi-api-key": trimmedKey,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
            },
            body: JSON.stringify({
                text: spoken,
                model_id: TTS_MODEL_ID,
            }),
        },
    };
}
function stopPlayback() {
    generation += 1;
    cancelWait?.();
    cancelWait = null;
    const current = active;
    active = null;
    if (!current) {
        return;
    }
    current.audio.pause();
    current.audio.src = "";
    URL.revokeObjectURL(current.url);
    void current.context.close();
}
export function stopSpeech() {
    requestAbort?.abort();
    requestAbort = null;
    stopPlayback();
}
export async function speakText(input) {
    stopSpeech();
    const abort = new AbortController();
    requestAbort = abort;
    const request = buildSpeechRequest(input.voiceId, input.text, input.apiKey);
    request.init.signal = abort.signal;
    try {
        const response = await fetch(request.url, request.init);
        if (abort.signal.aborted) {
            throw new SpeechStopped();
        }
        if (!response.ok) {
            throw new Error(await errorMessage(response));
        }
        const blob = await response.blob();
        if (blob.size < 1000) {
            throw new Error("ElevenLabs returned an audio file that is too small to be speech.");
        }
        const filePeak = await decodedPeak(blob);
        if (filePeak < 0.02) {
            throw new Error("The speech audio was silent.");
        }
        input.onPlaybackStart?.();
        const played = await playAudioBlob(blob);
        return { text: input.text.trim(), ...played, peak: Math.max(played.peak, filePeak) };
    }
    catch (error) {
        if (abort.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
            throw new SpeechStopped();
        }
        throw error;
    }
    finally {
        if (requestAbort === abort) {
            requestAbort = null;
        }
    }
}
async function errorMessage(response) {
    const fallback = `ElevenLabs speech failed (${response.status}).`;
    const text = await response.text();
    try {
        const body = JSON.parse(text);
        if (Array.isArray(body.detail)) {
            const messages = body.detail
                .map((item) => item.msg)
                .filter((msg) => Boolean(msg));
            if (messages.length > 0) {
                return messages.join(" ");
            }
        }
        else if (body.detail?.message) {
            return body.detail.message;
        }
    }
    catch {
        if (text.trim()) {
            return text.trim().slice(0, 180);
        }
    }
    return fallback;
}
async function playAudioBlob(blob) {
    stopPlayback();
    const token = generation;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = "auto";
    const context = new AudioContext();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyser.connect(context.destination);
    audio.dataset.mackPlayback = "speech";
    document.body.append(audio);
    const mine = { audio, context, url };
    active = mine;
    const samples = new Uint8Array(analyser.fftSize);
    let peak = 0;
    const timer = window.setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        for (const value of samples) {
            const deviation = Math.abs(value - 128) / 128;
            if (deviation > peak) {
                peak = deviation;
            }
        }
    }, 40);
    try {
        await context.resume();
        await waitForAudio(audio, token);
        if (generation !== token) {
            throw new SpeechStopped();
        }
        if (!Number.isFinite(audio.duration) || audio.duration < 0.4) {
            throw new Error("The speech audio was too short to be the sentence.");
        }
        return { durationSeconds: audio.duration, peak };
    }
    finally {
        window.clearInterval(timer);
        if (generation === token) {
            cancelWait = null;
        }
        if (active === mine) {
            active = null;
            mine.audio.pause();
            mine.audio.remove();
            URL.revokeObjectURL(mine.url);
            await mine.context.close();
        }
    }
}
async function decodedPeak(blob) {
    const context = new AudioContext();
    try {
        const bytes = await blob.arrayBuffer();
        const buffer = await context.decodeAudioData(bytes.slice(0));
        let peak = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const data = buffer.getChannelData(channel);
            const step = Math.max(1, Math.floor(data.length / 12000));
            for (let index = 0; index < data.length; index += step) {
                const value = Math.abs(data[index] ?? 0);
                if (value > peak) {
                    peak = value;
                }
            }
        }
        return peak;
    }
    finally {
        await context.close();
    }
}
async function waitForAudio(audio, token) {
    await new Promise((resolve, reject) => {
        cancelWait = () => reject(new SpeechStopped());
        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            resolve();
            return;
        }
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("Could not read the speech audio.")), { once: true });
    });
    if (generation !== token) {
        throw new SpeechStopped();
    }
    await new Promise((resolve, reject) => {
        cancelWait = () => reject(new SpeechStopped());
        audio.addEventListener("ended", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("Audio playback failed.")), { once: true });
        void audio.play().catch(reject);
    });
}
