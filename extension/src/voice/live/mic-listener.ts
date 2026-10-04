// Hands-free listening: keeps the microphone open and reports each finished
// sentence as a WAV recording. Runs in the offscreen document; a service worker
// has no microphone.

import { createVad } from "./vad";
import { encodeWavBase64 } from "./wav";

const SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 0.1; // must match CHUNK_SAMPLES in public/mic-worklet.js
const MIN_MANUAL_SECONDS = 0.3;
const MAX_MANUAL_SECONDS = 30;

export interface MicListenerCallbacks {
  onSpeechStart(): void;
  onUtterance(wavBase64: string): void;
  /** A sound that was too short to be speech ended; go back to plain listening. */
  onDiscarded(): void;
}

export interface MicListener {
  /** While paused, microphone audio is ignored (Mack is thinking or speaking). */
  pause(): void;
  resume(): void;
  /**
   * Push to talk: records everything from now until finishManual(), without the
   * voice detector and even while paused. The recording is then reported through
   * onUtterance, or onDiscarded when it is too short to hold a word.
   */
  startManual(): void;
  finishManual(): void;
  dispose(): void;
}

export async function startMicListener(
  workletUrl: string,
  callbacks: MicListenerCallbacks,
): Promise<MicListener> {
  // Echo cancellation keeps Mack's own voice from being picked up as the user's.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });

  // Running the context at 16 kHz lets Chrome do the resampling.
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    await context.audioWorklet.addModule(workletUrl);
    if (context.state === "suspended") await context.resume();
  } catch (error) {
    for (const track of stream.getTracks()) track.stop();
    void context.close();
    throw error;
  }

  const vad = createVad({ chunkSeconds: CHUNK_SECONDS });
  let paused = false;
  let manual: Float32Array[] | null = null;

  function finishManual(): void {
    const chunks = manual;
    manual = null;
    if (!chunks) return;
    if (chunks.length * CHUNK_SECONDS < MIN_MANUAL_SECONDS) {
      callbacks.onDiscarded();
      return;
    }
    const samples = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    callbacks.onUtterance(encodeWavBase64(samples, SAMPLE_RATE));
  }

  const worklet = new AudioWorkletNode(context, "mack-mic");
  worklet.port.onmessage = (message: MessageEvent<Float32Array>) => {
    if (manual) {
      manual.push(message.data);
      // A stuck button must not record forever.
      if (manual.length * CHUNK_SECONDS >= MAX_MANUAL_SECONDS) finishManual();
      return;
    }
    if (paused) return;
    const event = vad.feed(message.data);
    if (!event) return;
    if (event.type === "speech-start") callbacks.onSpeechStart();
    else if (event.type === "discarded") callbacks.onDiscarded();
    else callbacks.onUtterance(encodeWavBase64(event.samples, SAMPLE_RATE));
  };

  // The worklet only runs while connected to the output; the zero gain keeps
  // the user's own voice out of the speakers.
  const silent = context.createGain();
  silent.gain.value = 0;
  context.createMediaStreamSource(stream).connect(worklet).connect(silent).connect(context.destination);

  return {
    pause: () => {
      paused = true;
      vad.reset();
    },
    resume: () => {
      vad.reset();
      paused = false;
    },
    startManual: () => {
      vad.reset();
      manual = [];
    },
    finishManual,
    dispose: () => {
      paused = true;
      manual = null;
      worklet.port.onmessage = null;
      for (const track of stream.getTracks()) track.stop();
      void context.close().catch(() => undefined);
    },
  };
}
