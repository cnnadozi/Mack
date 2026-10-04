// ElevenLabs Agents (conversational) API: account calls plus the pure helpers for
// its WebSocket messages. Nothing here touches the microphone or the DOM.

const API_ORIGIN = "https://api.elevenlabs.io";

export const AGENT_NAME = "Mack conversation check";

const AGENT_PROMPT =
  "You are Mack, a friendly voice assistant. Chat naturally with the user. " +
  "Keep every reply to one or two short, plain sentences. " +
  "Do not give step-by-step instructions for using a website; " +
  "say that Mack's on-screen guidance handles that.";

const FIRST_MESSAGE = "Hi, I'm Mack. What would you like to talk about?";

type Fetch = typeof fetch;

async function request<T>(
  fetchImpl: Fetch,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetchImpl(`${API_ORIGIN}${path}`, {
    ...init,
    referrerPolicy: "no-referrer",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(await failureMessage(response));
  }
  return (await response.json()) as T;
}

async function failureMessage(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { detail?: { message?: string } | string };
    detail = typeof body.detail === "string" ? body.detail : (body.detail?.message ?? "");
  } catch {
    // Not a JSON error body.
  }
  if (response.status === 401) {
    return `ElevenLabs rejected the API key. ${detail}`.trim();
  }
  return `ElevenLabs request failed (${response.status}). ${detail}`.trim();
}

// Reuses one agent per account by name, so repeated runs do not pile up agents.
export async function findOrCreateAgent(
  apiKey: string,
  voiceId: string,
  fetchImpl: Fetch = fetch,
): Promise<string> {
  const search = new URLSearchParams({ search: AGENT_NAME, page_size: "30" });
  const listed = await request<{ agents?: { agent_id: string; name: string }[] }>(
    fetchImpl,
    apiKey,
    `/v1/convai/agents?${search}`,
  );
  const existing = listed.agents?.find((agent) => agent.name === AGENT_NAME);
  if (existing) return existing.agent_id;

  const created = await request<{ agent_id: string }>(
    fetchImpl,
    apiKey,
    "/v1/convai/agents/create",
    {
      method: "POST",
      body: JSON.stringify({
        name: AGENT_NAME,
        conversation_config: {
          agent: {
            prompt: { prompt: AGENT_PROMPT },
            first_message: FIRST_MESSAGE,
            language: "en",
          },
          tts: { voice_id: voiceId },
        },
      }),
    },
  );
  return created.agent_id;
}

// The signed URL lets the page open the WebSocket without putting the key in a URL.
export async function getSignedUrl(
  apiKey: string,
  agentId: string,
  fetchImpl: Fetch = fetch,
): Promise<string> {
  const query = new URLSearchParams({ agent_id: agentId });
  const body = await request<{ signed_url: string }>(
    fetchImpl,
    apiKey,
    `/v1/convai/conversation/get-signed-url?${query}`,
  );
  return body.signed_url;
}

export type ServerEvent =
  | { kind: "ready"; inputRate: number; outputRate: number }
  | { kind: "user_text"; text: string }
  | { kind: "agent_text"; text: string }
  | { kind: "agent_correction"; text: string }
  | { kind: "audio"; eventId: number; base64: string }
  | { kind: "interruption"; eventId: number }
  | { kind: "ping"; eventId: number }
  | { kind: "error"; message: string }
  | { kind: "ignored" };

// Audio formats arrive as names like "pcm_16000"; only raw PCM is played here.
export function pcmRate(format: unknown): number {
  const match = typeof format === "string" ? /^pcm_(\d+)$/.exec(format) : null;
  if (!match) {
    throw new Error(`Unsupported ElevenLabs audio format: ${String(format)}`);
  }
  return Number(match[1]);
}

export function parseServerEvent(raw: string): ServerEvent {
  let data: Record<string, any>;
  try {
    data = JSON.parse(raw) as Record<string, any>;
  } catch {
    return { kind: "ignored" };
  }

  switch (data.type) {
    case "conversation_initiation_metadata": {
      const meta = data.conversation_initiation_metadata_event ?? {};
      try {
        return {
          kind: "ready",
          inputRate: pcmRate(meta.user_input_audio_format),
          outputRate: pcmRate(meta.agent_output_audio_format),
        };
      } catch (error) {
        return { kind: "error", message: (error as Error).message };
      }
    }
    case "user_transcript":
      return text("user_text", data.user_transcription_event?.user_transcript);
    case "agent_response":
      return text("agent_text", data.agent_response_event?.agent_response);
    case "agent_response_correction":
      return text(
        "agent_correction",
        data.agent_response_correction_event?.corrected_agent_response,
      );
    case "audio": {
      const base64 = data.audio_event?.audio_base_64;
      if (typeof base64 !== "string" || base64.length === 0) return { kind: "ignored" };
      return { kind: "audio", eventId: Number(data.audio_event.event_id) || 0, base64 };
    }
    case "interruption":
      return { kind: "interruption", eventId: Number(data.interruption_event?.event_id) || 0 };
    case "ping":
      return { kind: "ping", eventId: Number(data.ping_event?.event_id) || 0 };
    case "client_error":
      return { kind: "error", message: "ElevenLabs reported an error in the conversation." };
    default:
      return { kind: "ignored" };
  }
}

function text(
  kind: "user_text" | "agent_text" | "agent_correction",
  value: unknown,
): ServerEvent {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? { kind, text: trimmed } : { kind: "ignored" };
}

// Microphone samples (-1..1 floats) to base64 16-bit little-endian PCM.
export function encodePcm16(samples: Float32Array): string {
  const view = new DataView(new ArrayBuffer(samples.length * 2));
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(index * 2, Math.round(clamped * 0x7fff), true);
  }
  const bytes = new Uint8Array(view.buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodePcm16(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const view = new DataView(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    view.setUint8(index, binary.charCodeAt(index));
  }
  const samples = new Float32Array(Math.floor(binary.length / 2));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000;
  }
  return samples;
}
