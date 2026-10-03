// Development fixture. Role 3 owns the microphone controls shown to users.
import {
  MicrophoneCaptureError,
  createMicrophoneCapture,
  measureRecording,
  type MicrophoneCaptureState,
} from "./capture.js";

export interface MicCheckResult {
  ok: boolean;
  state: MicrophoneCaptureState;
  extensionId: string;
  origin: string;
  deviceLabel?: string;
  mimeType?: string;
  byteLength?: number;
  durationMs?: number;
  livePeak?: number;
  liveRms?: number;
  trackSampleRate?: number | null;
  decodedDurationMs?: number;
  decodedPeak?: number;
  decodedRms?: number;
  decodedSampleRate?: number;
  sampleCount?: number;
  nonZeroSamples?: number;
  deviceReleased?: boolean;
  code?: string;
  error?: string;
}

declare const chrome: {
  runtime: {
    id: string;
  };
};

declare global {
  interface Window {
    __mackRecordFor?: (durationMs: number, deviceId?: string) => Promise<MicCheckResult>;
    __mackLastResult?: MicCheckResult;
  }
}

const status = document.querySelector<HTMLElement>("#status");
const button = document.querySelector<HTMLButtonElement>("#record");
const capture = createMicrophoneCapture({
  onState: (next) => {
    button?.setAttribute("aria-pressed", next === "listening" ? "true" : "false");
  },
});

function show(result: MicCheckResult): MicCheckResult {
  window.__mackLastResult = result;
  if (status) status.textContent = JSON.stringify(result, null, 2);
  return result;
}

async function recordFor(durationMs: number, deviceId?: string): Promise<MicCheckResult> {
  try {
    await capture.start(deviceId ? { deviceId } : {});
    await new Promise((resolve) => window.setTimeout(resolve, durationMs));
    if (capture.state !== "listening") {
      return show({
        ok: false,
        state: capture.state,
        extensionId: chrome.runtime.id,
        origin: location.origin,
        error: "Recording ended before the timed capture finished.",
      });
    }
    const recording = await capture.stop();
    const level = await measureRecording(recording.blob);
    return show({
      ok: recording.byteLength > 0 && level.durationMs > 0 && level.sampleCount > 0,
      state: capture.state,
      extensionId: chrome.runtime.id,
      origin: location.origin,
      deviceLabel: recording.deviceLabel,
      mimeType: recording.mimeType,
      byteLength: recording.byteLength,
      durationMs: recording.durationMs,
      livePeak: recording.peak,
      liveRms: recording.rms,
      trackSampleRate: recording.sampleRate,
      decodedDurationMs: level.durationMs,
      decodedPeak: level.peak,
      decodedRms: level.rms,
      decodedSampleRate: level.sampleRate,
      sampleCount: level.sampleCount,
      nonZeroSamples: level.nonZeroSamples,
      deviceReleased: recording.deviceReleased,
    });
  } catch (error) {
    return show({
      ok: false,
      state: capture.state,
      extensionId: chrome.runtime.id,
      origin: location.origin,
      code: error instanceof MicrophoneCaptureError ? error.code : undefined,
      error: error instanceof Error ? error.message : "Recording failed.",
    });
  }
}

window.__mackRecordFor = recordFor;

let holding = false;

async function beginHold(): Promise<void> {
  if (holding || !button) return;
  holding = true;
  button.textContent = "Recording…";
  try {
    await capture.start();
    if (!holding && capture.state === "listening") {
      await capture.stop();
      button.textContent = "Hold to record";
      return;
    }
    if (status) status.textContent = "Listening…";
  } catch (error) {
    holding = false;
    button.textContent = "Hold to record";
    show({
      ok: false,
      state: capture.state,
      extensionId: chrome.runtime.id,
      origin: location.origin,
      code: error instanceof MicrophoneCaptureError ? error.code : undefined,
      error: error instanceof Error ? error.message : "Recording failed.",
    });
  }
}

async function endHold(): Promise<void> {
  if (!holding || !button) return;
  holding = false;
  button.textContent = "Hold to record";
  if (capture.state !== "listening") return;
  try {
    const recording = await capture.stop();
    const level = await measureRecording(recording.blob);
    show({
      ok: recording.byteLength > 0 && level.durationMs > 0,
      state: capture.state,
      extensionId: chrome.runtime.id,
      origin: location.origin,
      deviceLabel: recording.deviceLabel,
      mimeType: recording.mimeType,
      byteLength: recording.byteLength,
      durationMs: recording.durationMs,
      livePeak: recording.peak,
      liveRms: recording.rms,
      trackSampleRate: recording.sampleRate,
      decodedDurationMs: level.durationMs,
      decodedPeak: level.peak,
      decodedRms: level.rms,
      decodedSampleRate: level.sampleRate,
      sampleCount: level.sampleCount,
      nonZeroSamples: level.nonZeroSamples,
      deviceReleased: recording.deviceReleased,
    });
  } catch (error) {
    show({
      ok: false,
      state: capture.state,
      extensionId: chrome.runtime.id,
      origin: location.origin,
      code: error instanceof MicrophoneCaptureError ? error.code : undefined,
      error: error instanceof Error ? error.message : "Recording failed.",
    });
  }
}

button?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  void beginHold();
});
button?.addEventListener("pointerup", () => {
  void endHold();
});
button?.addEventListener("pointercancel", () => {
  void endHold();
});
button?.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.key !== " " && event.key !== "Enter") return;
  event.preventDefault();
  void beginHold();
});
button?.addEventListener("keyup", (event) => {
  if (event.key !== " " && event.key !== "Enter") return;
  event.preventDefault();
  void endHold();
});
window.addEventListener("pointerup", () => {
  if (holding) void endHold();
});
