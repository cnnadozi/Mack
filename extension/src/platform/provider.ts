import Anthropic from "@anthropic-ai/sdk";
import { jsonObject, type ModelInput } from "./protocol";
import { MODEL } from "./settings";

export async function generateJSON(input: ModelInput, key: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 25000 });
  const message = await client.messages.create({
    model: MODEL, max_tokens: 4096,
    system: `${input.system}\nReturn only one JSON object. Do not include Markdown or commentary.`,
    messages: [{ role: "user", content: JSON.stringify(input.payload) }],
  }, { signal });
  if (message.stop_reason !== "end_turn") throw new Error("Incomplete model response");
  const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("").trim();
  const unfenced = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  return jsonObject(JSON.parse(unfenced));
}
