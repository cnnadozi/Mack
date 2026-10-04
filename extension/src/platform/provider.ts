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
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "heading", "buttons"],
        properties: {
          priority: { type: "string", enum: ["main", "more"] },
          heading: { type: "string" },
          buttons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["actionId", "label"],
              properties: { actionId: { type: "string" }, label: { type: "string" } },
            },
          },
        },
      },
    },
    search: {
      type: "object",
      additionalProperties: false,
      required: ["actionId", "label"],
      properties: { actionId: { type: "string" }, label: { type: "string" } },
    },
  },
};

// Raised for provider-reported failures; the message comes from the provider, never from the key.
export class ProviderRejected extends Error {}

// Mack's calls rank links and return short JSON. Thinking roughly doubled latency (2.1 s -> 1.0 s on
// gemini-3.8-flash) without changing which tasks it chose, so it is turned down where the model allows.
export function thinkingFor(model: string): Record<string, unknown> | undefined {
  if (/^gemini-3/i.test(model)) return { thinkingLevel: "low" };
  if (/^gemini-2\.5-flash/i.test(model)) return { thinkingBudget: 0 };
  return undefined;
}

export function geminiBody(input: ModelInput, model = "") {
  const thinking = thinkingFor(model);
  return {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: "user", parts: [{ text: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      ...(input.task === "design" ? { responseJsonSchema: DESIGN_SCHEMA } : {}),
      ...(thinking ? { thinkingConfig: thinking } : {}),
      temperature: 0.2,
    },
  };
}

export async function generateJSON(input: ModelInput, key: string, model: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const post = (body: unknown) => fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal,
  });
  const body = geminiBody(input, model);
  let response = await post(body);
  // A model that rejects the thinking setting still works without it.
  if (response.status === 400 && body.generationConfig.thinkingConfig && /thinking/i.test(await response.clone().text())) {
    const { thinkingConfig: _, ...generationConfig } = body.generationConfig;
    response = await post({ ...body, generationConfig });
  }
  const data = await response.json().catch(() => ({})) as {
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };
  if (!response.ok) throw new ProviderRejected(`Gemini ${response.status}: ${data.error?.message ?? "request failed"}`);
  if (data.promptFeedback?.blockReason) throw new ProviderRejected(`Gemini blocked the request (${data.promptFeedback.blockReason})`);
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  if (!text) throw new ProviderRejected(`Gemini returned no text (${candidate?.finishReason ?? "unknown"})`);
  if (candidate?.finishReason && candidate.finishReason !== "STOP") throw new ProviderRejected(`Gemini stopped early (${candidate.finishReason})`);
  return jsonObject(JSON.parse(text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")));
}
