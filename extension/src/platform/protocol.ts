import { z } from "zod";

const json: z.ZodType<unknown> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.string(), z.number().finite(), z.array(json), z.record(json),
]));
export const ModelInputSchema = z.object({
  task: z.enum(["design", "guide"]), system: z.string().min(1).max(20000),
  payload: json,
}).strict().refine((value) => JSON.stringify(value).length <= 200000, "Model payload too large");
export const ModelMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mack:model"), requestId: z.string().uuid(), input: ModelInputSchema }).strict(),
  z.object({ type: z.literal("mack:cancel"), requestId: z.string().uuid() }).strict(),
]);
export const SessionMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mack:session") }).strict(),
  z.object({ type: z.literal("mack:goal"), goal: z.string().max(2000) }).strict(),
  z.object({ type: z.literal("mack:exit") }).strict(),
  z.object({ type: z.literal("mack:resume") }).strict(),
  z.object({ type: z.literal("mack:peek"), urls: z.array(z.string().url()).max(8) }).strict(),
]);
export const ModelErrorSchema = z.enum(["unauthorized", "invalid_request", "inactive", "busy", "missing_key", "model_failed", "model_rejected", "aborted"]);
export const ModelReplySchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.record(json) }).strict(),
  z.object({ ok: z.literal(false), error: ModelErrorSchema, detail: z.string().max(300).optional() }).strict(),
]);
export const PeekReplySchema = z.object({
  pages: z.array(z.object({ url: z.string().url(), finalUrl: z.string().url(), html: z.string() }).strict()).max(8),
}).strict();
export type ModelInput = z.infer<typeof ModelInputSchema>;
export type ModelMessage = z.infer<typeof ModelMessageSchema>;
export type ModelReply = z.infer<typeof ModelReplySchema>;

export function jsonObject(value: unknown): Record<string, unknown> {
  return z.record(json).parse(value);
}
