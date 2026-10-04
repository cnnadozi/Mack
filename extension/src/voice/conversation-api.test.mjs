import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_NAME,
  decodePcm16,
  encodePcm16,
  findOrCreateAgent,
  getSignedUrl,
  parseServerEvent,
} from "./dist/conversation-api.js";

function fakeFetch(...bodies) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];
    return new Response(JSON.stringify(body.json), { status: body.status ?? 200 });
  };
  return { fetchImpl, calls };
}

test("an existing agent with the Mack name is reused", async () => {
  const { fetchImpl, calls } = fakeFetch({
    json: { agents: [{ agent_id: "other", name: `${AGENT_NAME} 2` }, { agent_id: "a1", name: AGENT_NAME }] },
  });
  assert.equal(await findOrCreateAgent("key", "voice1234", fetchImpl), "a1");
  assert.equal(calls.length, 1);
});

test("an agent is created with the chosen voice when none exists", async () => {
  const { fetchImpl, calls } = fakeFetch({ json: { agents: [] } }, { json: { agent_id: "new" } });
  assert.equal(await findOrCreateAgent("key", "voice1234", fetchImpl), "new");
  const body = JSON.parse(calls[1].init.body);
  assert.equal(calls[1].init.method, "POST");
  assert.equal(body.name, AGENT_NAME);
  assert.equal(body.conversation_config.tts.voice_id, "voice1234");
});

test("the key travels in a header and never in a URL", async () => {
  const { fetchImpl, calls } = fakeFetch({ json: { signed_url: "wss://example/signed" } });
  assert.equal(await getSignedUrl("secret-key", "a1", fetchImpl), "wss://example/signed");
  assert.equal(calls[0].url.includes("secret-key"), false);
  assert.equal(calls[0].init.headers["xi-api-key"], "secret-key");
});

test("a rejected key gives a readable error", async () => {
  const { fetchImpl } = fakeFetch({ status: 401, json: { detail: { message: "Invalid API key" } } });
  await assert.rejects(getSignedUrl("bad", "a1", fetchImpl), /rejected the API key. Invalid API key/);
});

test("server messages are parsed into events", () => {
  const parse = (value) => parseServerEvent(JSON.stringify(value));
  assert.deepEqual(
    parse({
      type: "conversation_initiation_metadata",
      conversation_initiation_metadata_event: {
        agent_output_audio_format: "pcm_24000",
        user_input_audio_format: "pcm_16000",
      },
    }),
    { kind: "ready", inputRate: 16000, outputRate: 24000 },
  );
  assert.deepEqual(
    parse({ type: "user_transcript", user_transcription_event: { user_transcript: " hello " } }),
    { kind: "user_text", text: "hello" },
  );
  assert.deepEqual(
    parse({ type: "agent_response", agent_response_event: { agent_response: "Hi there" } }),
    { kind: "agent_text", text: "Hi there" },
  );
  assert.deepEqual(
    parse({ type: "audio", audio_event: { audio_base_64: "AAA=", event_id: 4 } }),
    { kind: "audio", eventId: 4, base64: "AAA=" },
  );
  assert.deepEqual(parse({ type: "interruption", interruption_event: { event_id: 5 } }), {
    kind: "interruption",
    eventId: 5,
  });
  assert.deepEqual(parse({ type: "ping", ping_event: { event_id: 6 } }), { kind: "ping", eventId: 6 });
  assert.deepEqual(parse({ type: "vad_score" }), { kind: "ignored" });
  assert.deepEqual(parseServerEvent("not json"), { kind: "ignored" });
});

test("an audio format that is not raw PCM is reported, not played", () => {
  const event = parseServerEvent(
    JSON.stringify({
      type: "conversation_initiation_metadata",
      conversation_initiation_metadata_event: {
        agent_output_audio_format: "ulaw_8000",
        user_input_audio_format: "pcm_16000",
      },
    }),
  );
  assert.equal(event.kind, "error");
});

test("PCM audio survives an encode and decode round trip", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
  const decoded = decodePcm16(encodePcm16(samples));
  assert.equal(decoded.length, samples.length);
  const expected = [0, 0.5, -0.5, 1, -1, 1];
  decoded.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 0.001));
});
