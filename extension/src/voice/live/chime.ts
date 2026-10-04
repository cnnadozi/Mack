// Short sounds for Mack turning on and off, made with the Web Audio API so no
// audio file has to ship with the extension.

// C5, E5, G5: rising when Mack turns on, falling when it turns off.
const NOTES = [523.25, 659.25, 783.99];
const NOTE_GAP_SECONDS = 0.09;
const NOTE_SECONDS = 0.32;
const VOLUME = 0.16;

/** How long a chime lasts, for callers that must wait for it to finish. */
export const CHIME_MS = Math.round((NOTE_GAP_SECONDS * (NOTES.length - 1) + NOTE_SECONDS) * 1000);

export function playChime(kind: "on" | "off"): void {
  const context = new AudioContext();
  const notes = kind === "on" ? NOTES : [...NOTES].reverse();
  notes.forEach((frequency, index) => {
    const start = context.currentTime + index * NOTE_GAP_SECONDS;
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    // A fast attack and a long fade make it ring like a bell instead of beeping.
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(VOLUME, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + NOTE_SECONDS);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + NOTE_SECONDS);
  });
  window.setTimeout(() => void context.close().catch(() => undefined), CHIME_MS + 200);
}
