import { describe, expect, it, vi } from "vitest";
import { createModelHandler } from "./model-handler";
import { createModelClient } from "./model-client";
import type { ModelInput } from "./protocol";

const sender = { id: "extension", frameId: 0, documentId: "doc", url: "https://www.gov.uk/", tab: { id: 1 } } as chrome.runtime.MessageSender;
const request = { type: "mack:model", requestId: "550e8400-e29b-41d4-a716-446655440000", input: { task: "design", system: "JSON", payload: { actions: [] } } };
describe("model boundary", () => {
  it("rejects forged senders, subframes, malformed payloads and inactive tabs before provider access", async () => {
    const generate = vi.fn(async () => ({}));
    const handler = createModelHandler({ extensionId: "extension", readAccess: async () => ({ active: false }), generate });
    for (const bad of [{ ...sender, id: "other" }, { ...sender, frameId: 1 }, { ...sender, url: "https://evil.example/" }])
      expect(await handler.handle(request, bad)).toEqual({ ok: false, error: "unauthorized" });
    expect(await handler.handle({ ...request, input: { ...request.input, payload: undefined } }, sender)).toEqual({ ok: false, error: "invalid_request" });
    expect(await handler.handle(request, sender)).toEqual({ ok: false, error: "inactive" });
    expect(generate).not.toHaveBeenCalled();
  });
  it("cancellation is scoped to the sender document and suppresses late results", async () => {
    let release!: (value: Record<string, unknown>) => void;
    const generate = vi.fn((_input: ModelInput, _key: string, _signal: AbortSignal) => new Promise<Record<string, unknown>>((resolve) => { release = resolve; }));
    const handler = createModelHandler({ extensionId: "extension", readAccess: async () => ({ active: true, key: "test-placeholder" }), generate });
    const result = handler.handle(request, sender);
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    await handler.handle({ type: "mack:cancel", requestId: request.requestId }, { ...sender, documentId: "other-doc" });
    expect(generate.mock.calls[0]?.[2]?.aborted).not.toBe(true);
    await handler.handle({ type: "mack:cancel", requestId: request.requestId }, sender);
    release({ late: true });
    expect(await result).toEqual({ ok: false, error: "aborted" });
  });
  it("never forwards provider errors containing credentials", async () => {
    const handler = createModelHandler({ extensionId: "extension", readAccess: async () => ({ active: true, key: "test-placeholder" }), generate: async () => { throw new Error("key=test-placeholder"); } });
    expect(await handler.handle(request, sender)).toEqual({ ok: false, error: "model_failed" });
  });
  it("serializes cancellation without sending an AbortSignal", async () => {
    const send = vi.fn((_message: unknown) => new Promise<unknown>(() => {}));
    const model = createModelClient(send);
    const controller = new AbortController();
    const result = model.generateJSON({ task: "guide", system: "JSON", payload: {} }, controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow();
    expect(send.mock.calls[1]?.[0]).toMatchObject({ type: "mack:cancel" });
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty("signal");
  });
});
