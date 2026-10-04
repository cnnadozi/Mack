// Lists the ElevenLabs voices this account can use, for the voice setting.

export interface VoiceOption {
  id: string;
  name: string;
  /** Short hint such as "british, male", when ElevenLabs provides one. */
  description: string;
}

// The current list endpoint first, then the older one that some keys still need.
const LIST_URLS = [
  "https://api.elevenlabs.io/v2/voices?page_size=100",
  "https://api.elevenlabs.io/v1/voices",
];

interface ListedVoice {
  voice_id?: unknown;
  name?: unknown;
  labels?: Record<string, unknown> | null;
}

export function parseVoices(body: unknown): VoiceOption[] {
  const listed = (body as { voices?: ListedVoice[] } | null)?.voices;
  if (!Array.isArray(listed)) return [];
  const voices: VoiceOption[] = [];
  for (const voice of listed) {
    if (typeof voice.voice_id !== "string" || typeof voice.name !== "string") continue;
    const description = [voice.labels?.accent, voice.labels?.gender]
      .filter((label): label is string => typeof label === "string" && label !== "")
      .join(", ");
    voices.push({ id: voice.voice_id, name: voice.name, description });
  }
  return voices.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listVoices(apiKey: string): Promise<VoiceOption[]> {
  let failure = "ElevenLabs returned no voices.";
  for (const url of LIST_URLS) {
    const response = await fetch(url, {
      referrerPolicy: "no-referrer",
      headers: { "xi-api-key": apiKey },
    });
    if (!response.ok) {
      failure = `ElevenLabs could not list voices (${response.status}).`;
      continue;
    }
    const voices = parseVoices(await response.json().catch(() => null));
    if (voices.length > 0) return voices;
  }
  throw new Error(failure);
}
