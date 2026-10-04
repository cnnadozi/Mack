// Runs on the audio thread and hands the microphone to the page in 100 ms chunks.
// Plain JavaScript in public/ because Chrome loads worklet files directly by URL.

const CHUNK_SAMPLES = 1600; // 100 ms at 16 kHz; must match CHUNK_SECONDS in mic-listener.ts

class MackMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(CHUNK_SAMPLES);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      for (const sample of channel) {
        this.chunk[this.filled] = sample;
        this.filled += 1;
        if (this.filled === CHUNK_SAMPLES) {
          this.port.postMessage(this.chunk.slice());
          this.filled = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("mack-mic", MackMicProcessor);
