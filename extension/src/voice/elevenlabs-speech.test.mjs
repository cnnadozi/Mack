import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { buildSpeechRequest } from "./dist/elevenlabs-speech.js";
import { FIXED_SENTENCE } from "./dist/fixed-sentence.js";

test("speech request sends only the fixed sentence and keeps the key out of the URL", () => {
  const request = buildSpeechRequest(
    "JBFqnCBsd6RMkjVDRZzb",
    FIXED_SENTENCE,
    "test-key",
  );
  const body = JSON.parse(String(request.init.body));

  assert.equal(body.text, "Mack is speaking this sentence.");
  assert.equal(body.model_id, "eleven_flash_v2_5");
  assert.equal(request.init.headers["xi-api-key"], "test-key");
  assert.equal(request.url.includes("test-key"), false);
  assert.equal(String(request.init.body).includes("test-key"), false);
  assert.match(request.url, /\/v1\/text-to-speech\/JBFqnCBsd6RMkjVDRZzb/);
  assert.match(request.url, /output_format=mp3_44100_128/);
});

test("voice files do not record the microphone or persist the key", async () => {
  const names = await readdir(new URL(".", import.meta.url));
  const sources = names.filter(
    (name) => /\.(ts|js|html|css)$/.test(name) && !name.endsWith(".test.mjs"),
  );
  const banned = ["getUserMedia", "MediaRecorder", "audioCapture", "storage.local", "storage.sync", "localStorage"];
  for (const name of sources) {
    const text = await readFile(new URL(name, import.meta.url), "utf8");
    for (const token of banned) {
      assert.equal(text.includes(token), false, `${name} contains ${token}`);
    }
  }
});
