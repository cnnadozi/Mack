import { ICON_NAMES } from "../ui/details";
import { jsonObject, type ModelInput } from "./protocol";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Mirrors the reply shape Role 3's DESIGN_SYSTEM_PROMPT asks for; Role 3's grounding still validates it.
export const DESIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "title", "sections"],
  properties: {
    status: { type: "string", enum: ["ready", "use_original", "not_found"] },
    title: { type: "string" },
    // Optional detail for a richer screen (see ui/details.ts); none of it is trusted.
    summary: { type: "string" },
    highlights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text"],
        properties: { title: { type: "string" }, text: { type: "string" } },
      },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "heading", "buttons"],
        properties: {
          priority: { type: "string", enum: ["main", "more"] },
          heading: { type: "string" },
          description: { type: "string" },
          buttons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["actionId", "label"],
              properties: {
                actionId: { type: "string" },
                label: { type: "string" },
                description: { type: "string" },
                icon: { type: "string", enum: [...ICON_NAMES] },
              },
            },
          },
        },
      },
    },
  },
};

// Raised for provider-reported failures; the message comes from the provider, never from the key.
export class ProviderRejected extends Error {}

export function geminiBody(input: ModelInput) {
  return {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      ...(input.task === "design" ? { responseJsonSchema: DESIGN_SCHEMA } : {}),
      temperature: 0.2,
    },
  };
}

export async function generateJSON(
  input: ModelInput,
  key: string,
  model: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(geminiBody(input)),
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };
  if (!response.ok)
    throw new ProviderRejected(
      `Gemini ${response.status}: ${data.error?.message ?? "request failed"}`,
    );
  if (data.promptFeedback?.blockReason)
    throw new ProviderRejected(`Gemini blocked the request (${data.promptFeedback.blockReason})`);
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text)
    throw new ProviderRejected(`Gemini returned no text (${candidate?.finishReason ?? "unknown"})`);
  if (candidate?.finishReason && candidate.finishReason !== "STOP")
    throw new ProviderRejected(`Gemini stopped early (${candidate.finishReason})`);
  return jsonObject(JSON.parse(text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")));
}
