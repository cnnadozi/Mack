// Voice activity detection: decides when the user started and finished a sentence
// from the loudness of microphone chunks. Pure logic, no browser APIs.

export interface VadOptions {
  /** Seconds of audio in each chunk passed to feed(). */
  chunkSeconds: number;
  minThreshold?: number;
  startChunks?: number;
  endSilenceSeconds?: number;
  minSpeechSeconds?: number;
  maxSeconds?: number;
  prerollChunks?: number;
}

export type VadEvent =
  | { type: "speech-start" }
  | { type: "utterance"; samples: Float32Array }
  | { type: "discarded" };

export interface Vad {
  feed(chunk: Float32Array): VadEvent | null;
  reset(): void;
}

function rms(chunk: Float32Array): number {
  let sum = 0;
  for (const sample of chunk) sum += sample * sample;
  return chunk.length > 0 ? Math.sqrt(sum / chunk.length) : 0;
}

export function createVad(options: VadOptions): Vad {
  const minThreshold = options.minThreshold ?? 0.012;
  const startChunks = options.startChunks ?? 2;
  const endSilenceChunks = Math.ceil((options.endSilenceSeconds ?? 0.9) / options.chunkSeconds);
  const minSpeechChunks = Math.ceil((options.minSpeechSeconds ?? 0.3) / options.chunkSeconds);
  const maxChunks = Math.ceil((options.maxSeconds ?? 20) / options.chunkSeconds);
  const prerollChunks = options.prerollChunks ?? 3;

  // Tracks the room's background level so a noisy room does not count as speech.
  let noiseFloor = 0.004;
  let preroll: Float32Array[] = [];
  let recorded: Float32Array[] = [];
  let speaking = false;
  let loudRun = 0;
  let silentRun = 0;
  let loudChunks = 0;

  function reset(): void {
    preroll = [];
    recorded = [];
    speaking = false;
    loudRun = 0;
    silentRun = 0;
    loudChunks = 0;
  }

  function finish(): VadEvent {
    const enoughSpeech = loudChunks >= minSpeechChunks;
    const chunks = recorded;
    reset();
    if (!enoughSpeech) return { type: "discarded" };
    const samples = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    return { type: "utterance", samples };
  }

  function feed(chunk: Float32Array): VadEvent | null {
    const level = rms(chunk);
    const threshold = Math.min(0.08, Math.max(minThreshold, noiseFloor * 3));
    const loud = level > threshold;

    if (!speaking) {
      if (!loud) noiseFloor = noiseFloor * 0.95 + level * 0.05;
      preroll.push(chunk);
      if (preroll.length > prerollChunks + startChunks) preroll.shift();
      loudRun = loud ? loudRun + 1 : 0;
      if (loudRun < startChunks) return null;
      // The pre-roll keeps the first syllable, which is quieter than the threshold.
      speaking = true;
      recorded = preroll;
      preroll = [];
      loudChunks = loudRun;
      silentRun = 0;
      return { type: "speech-start" };
    }

    recorded.push(chunk);
    if (loud) {
      loudChunks += 1;
      silentRun = 0;
    } else {
      silentRun += 1;
    }
    if (silentRun >= endSilenceChunks || recorded.length >= maxChunks) return finish();
    return null;
  }

  return { feed, reset };
}
