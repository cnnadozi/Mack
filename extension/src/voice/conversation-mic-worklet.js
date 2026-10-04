// Runs on the audio thread. Plain JavaScript because Chrome loads worklet files
// directly and the voice TypeScript build has no worklet typings.

const CHUNK_SAMPLES = 1600; // 100 ms at the 16 kHz the agent expects

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
