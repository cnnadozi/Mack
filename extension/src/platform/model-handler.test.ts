import { afterEach, describe, expect, it, vi } from "vitest";
import { createModelHandler } from "./model-handler";
import { createModelClient } from "./model-client";
import { DESIGN_SCHEMA, generateJSON, ProviderRejected } from "./provider";
import type { ModelInput } from "./protocol";

afterEach(() => { vi.unstubAllGlobals(); });
const sender = { id: "extension", frameId: 0, documentId: "doc", url: "https://www.uhc.com/", tab: { id: 1 } } as chrome.runtime.MessageSender;
const request = { type: "mack:model", requestId: "550e8400-e29b-41d4-a716-446655440000", input: { task: "design", system: "JSON", payload: { actions: [] } } };
const access = { active: true, key: "test-placeholder", model: "gemini-test" };
describe("model boundary", () => {
  it("rejects forged senders, subframes, unsupported sites, malformed payloads and inactive tabs before provider access", async () => {
    const generate = vi.fn(async () => ({}));
    const handler = createModelHandler({ extensionId: "extension", readAccess: async () => ({ active: false, model: "m" }), generate });
    for (const bad of [{ ...sender, id: "other" }, { ...sender, frameId: 1 }, { ...sender, url: "https://evil.example/" }, { ...sender, url: "http://www.uhc.com/" }])
      expect(await handler.handle(request, bad)).toEqual({ ok: false, error: "unauthorized" });
    expect(await handler.handle({ ...request, input: { ...request.input, payload: undefined } }, sender)).toEqual({ ok: false, error: "invalid_request" });
    expect(await handler.handle(request, sender)).toEqual({ ok: false, error: "inactive" });
    expect(generate).not.toHaveBeenCalled();
  });
  it("accepts subdomains of a supported site", async () => {
    const handler = createModelHandler({ extensionId: "extension", readAccess: async () => access, generate: async () => ({ ok: true }) });
    expect(await handler.handle(request, { ...sender, url: "https://member.uhc.com/myuhc" })).toEqual({ ok: true, result: { ok: true } });
  });
  it("cancellation is scoped to the sender document and suppresses late results", async () => {
    let release!: (value: Record<string, unknown>) => void;
    const generate = vi.fn((_input: ModelInput, _key: string, _model: string, _signal: AbortSignal) => new Promise<Record<string, unknown>>((resolve) => { release = resolve; }));
    const handler = createModelHandler({ extensionId: "extension", readAccess: async () => access, generate });
    const result = handler.handle(request, sender);
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    await handler.handle({ type: "mack:cancel", requestId: request.requestId }, { ...sender, documentId: "other-doc" });
    expect(generate.mock.calls[0]?.[3]?.aborted).not.toBe(true);
    await handler.handle({ type: "mack:cancel", requestId: request.requestId }, sender);
    release({ late: true });
    expect(await result).toEqual({ ok: false, error: "aborted" });
  });
  it("never forwards unknown errors, but passes provider-reported reasons", async () => {
    const leaky = createModelHandler({ extensionId: "extension", readAccess: async () => access, generate: async () => { throw new Error("key=test-placeholder"); } });
    expect(await leaky.handle(request, sender)).toEqual({ ok: false, error: "model_failed" });
    const rejected = createModelHandler({ extensionId: "extension", readAccess: async () => access, generate: async () => { throw new ProviderRejected("Gemini 400: only supports Interactions API"); } });
    expect(await rejected.handle(request, sender)).toEqual({ ok: false, error: "model_rejected", detail: "Gemini 400: only supports Interactions API" });
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

describe("Gemini provider", () => {
  it("sends the key as a header, the system prompt as systemInstruction, and the design schema only for design", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"status":"not_found","title":"T","sections":[]}' }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateJSON({ task: "design", system: "SYS", payload: { a: 1 } }, "test-placeholder", "gemini-3.8-flash", new AbortController().signal);
    expect(result).toEqual({ status: "not_found", title: "T", sections: [] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-placeholder");
    expect(url).not.toContain("test-placeholder");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("SYS");
    expect(body.contents[0].parts[0].text).toBe('{"a":1}');
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: DESIGN_SCHEMA });

    await generateJSON({ task: "guide", system: "SYS", payload: "already text" }, "test-placeholder", "m", new AbortController().signal);
    const guideBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(guideBody.contents[0].parts[0].text).toBe("already text");
    expect(guideBody.generationConfig.responseJsonSchema).toBeUndefined();
  });
  it("reports provider rejections with the provider's message", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "This model only supports Interactions API." } }), { status: 400 }));
    await expect(generateJSON({ task: "design", system: "S", payload: {} }, "k", "m", new AbortController().signal)).rejects.toThrow(/Gemini 400: This model only supports Interactions API/);
  });
});
