import assert from "node:assert/strict";
import { test } from "node:test";

import { createVad, type VadEvent } from "./vad";
import { parseVoices } from "./voices";
import { encodeWavBase64 } from "./wav";

const CHUNK = 1600;

function chunk(level: number): Float32Array {
  return new Float32Array(CHUNK).fill(level);
}

function run(levels: number[]): VadEvent[] {
  const vad = createVad({ chunkSeconds: 0.1 });
  const events: VadEvent[] = [];
  for (const level of levels) {
    const event = vad.feed(chunk(level));
    if (event) events.push(event);
  }
  return events;
}

const quiet = (count: number) => Array<number>(count).fill(0.001);
const loud = (count: number) => Array<number>(count).fill(0.2);

test("a spoken sentence followed by silence becomes one utterance", () => {
  const events = run([...quiet(10), ...loud(12), ...quiet(12)]);
  assert.deepEqual(
    events.map((event) => event.type),
    ["speech-start", "utterance"],
  );
  const utterance = events[1] as { samples: Float32Array };
  // Includes the pre-roll before the first loud chunk and the trailing silence.
  assert.ok(utterance.samples.length >= 12 * CHUNK);
  assert.ok(utterance.samples.length <= 30 * CHUNK);
});

test("silence alone produces nothing", () => {
  assert.deepEqual(run(quiet(50)), []);
});

test("a very short noise is discarded", () => {
  const events = run([...quiet(10), ...loud(2), ...quiet(12)]);
  assert.deepEqual(
    events.map((event) => event.type),
    ["speech-start", "discarded"],
  );
});

test("a short pause inside a sentence does not split it", () => {
  const events = run([...quiet(5), ...loud(6), ...quiet(4), ...loud(6), ...quiet(12)]);
  assert.equal(events.filter((event) => event.type === "utterance").length, 1);
});

test("endless talking is cut off at the maximum length", () => {
  const events = run([...quiet(5), ...loud(400)]);
  assert.ok(events.some((event) => event.type === "utterance"));
});

test("WAV output has a valid header and the right size", () => {
  const bytes = Buffer.from(encodeWavBase64(new Float32Array([0, 1, -1, 0.5]), 16000), "base64");
  assert.equal(bytes.length, 44 + 8);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  assert.equal(bytes.readUInt32LE(24), 16000);
  assert.equal(bytes.readInt16LE(46), 0x7fff);
  assert.equal(bytes.readInt16LE(48), -0x7fff);
});

test("voices are read from the ElevenLabs list and sorted by name", () => {
  const voices = parseVoices({
    voices: [
      { voice_id: "b2", name: "Sarah", labels: { accent: "american", gender: "female" } },
      { voice_id: "a1", name: "George", labels: null },
      { name: "No id" },
    ],
  });
  assert.deepEqual(voices, [
    { id: "a1", name: "George", description: "" },
    { id: "b2", name: "Sarah", description: "american, female" },
  ]);
  assert.deepEqual(parseVoices({ detail: "unauthorized" }), []);
});
