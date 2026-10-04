import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProposal, DesignRequest } from "../../../shared/contracts";
import { startPlatform } from "./controller";
import { geminiBody, generateJSON, thinkingFor } from "./provider";
import type { CachedDesign } from "./protocol";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList);
  document.body.inert = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.querySelectorAll("mack-root").forEach((el) => el.remove());
  document.body.innerHTML = "";
});

function setup(options: { cache?: CachedDesign; peek?: () => Promise<never[]> } = {}) {
  const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
  const generateScreen = vi.fn(async (request: DesignRequest): Promise<DesignProposal> => {
    const links = request.snapshot.actions.filter((a) => a.kind === "navigate");
    return { stamp: request.stamp, status: "ready", design: { title: "Fresh", mode: "simplified", sections: [{ id: "main-1", buttons: links.slice(0, 2).map((a) => ({ actionId: a.id, label: a.label })) }] } };
  });
  const put = vi.fn();
  const platform = startPlatform({
    mount: { host, render: () => {}, unmount: () => host.remove() },
    generateScreen, resolveIntent: async (r) => ({ stamp: r.stamp, status: "not_found", mode: r.screen.mode, additions: [], responseText: "" }),
    saveGoal: vi.fn(), onExit: vi.fn(), navigate: vi.fn(),
    designCache: { get: async () => options.cache, put },
    ...(options.peek ? { peek: options.peek } : {}),
  });
  return { platform, generateScreen, put, ready: () => vi.waitFor(() => expect(platform.getState().busy).toBe(false), { timeout: 3000 }) };
}

describe("remembered designs", () => {
  it("shows a remembered design instantly, without asking the model, when all its buttons are on the page", async () => {
    document.body.innerHTML = '<a href="/doctor">Find a doctor</a><a href="/claims">Claims</a>';
    const h = setup({ cache: { title: "Home", sections: [{ id: "main-1", buttons: [{ key: "navigate\u0000Find a doctor\u0000https://www.uhc.com/doctor", label: "Find a doctor" }] }] } });
    await h.ready();
    expect(h.generateScreen).not.toHaveBeenCalled();
    expect(h.platform.getState().screen.title).toBe("Home");
    h.platform.exit();
  });

  it("asks the model when a remembered button is missing, and remembers the fresh design by stable keys", async () => {
    document.body.innerHTML = '<a href="/doctor">Find a doctor</a><a href="/claims">Claims</a>';
    const h = setup({ cache: { title: "Old", sections: [{ id: "main-1", buttons: [{ key: "navigate\u0000Gone\u0000https://www.uhc.com/gone", label: "Gone" }] }] } });
    await h.ready();
    expect(h.generateScreen).toHaveBeenCalledTimes(1);
    expect(h.put).toHaveBeenCalledWith({ title: "Fresh", sections: [{ id: "main-1", buttons: [
      { key: "navigate\u0000Find a doctor\u0000https://www.uhc.com/doctor", label: "Find a doctor" },
      { key: "navigate\u0000Claims\u0000https://www.uhc.com/claims", label: "Claims" },
    ] }] });
    h.platform.exit();
  });
});

describe("peek wait", () => {
  it("does not let a slow peek hold up the design for more than about 1.5 s", async () => {
    document.body.innerHTML = '<nav><a href="/members">Members</a><a href="/help">Help</a></nav>';
    const h = setup({ peek: () => new Promise(() => {}) });
    const start = Date.now();
    await h.ready();
    expect(Date.now() - start).toBeLessThan(2500);
    expect(h.generateScreen).toHaveBeenCalledTimes(1);
    h.platform.exit();
  });
});

describe("thinking", () => {
  it("turns thinking down where the model supports it", () => {
    expect(thinkingFor("gemini-3.8-flash")).toEqual({ thinkingLevel: "low" });
    expect(thinkingFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingFor("gemini-2.5-pro")).toBeUndefined();
    expect(geminiBody({ task: "design", system: "s", payload: {} }, "gemini-3.8-flash").generationConfig).toMatchObject({ thinkingConfig: { thinkingLevel: "low" } });
  });

  it("retries without the thinking setting when a model rejects it", async () => {
    const bodies: { generationConfig: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return bodies.length === 1
        ? new Response(JSON.stringify({ error: { message: "Thinking level LOW is not supported for this model." } }), { status: 400 })
        : new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 });
    }));
    await expect(generateJSON({ task: "guide", system: "s", payload: {} }, "k", "gemini-3.9-flash", new AbortController().signal)).resolves.toEqual({ ok: true });
    expect(bodies[0]!.generationConfig.thinkingConfig).toBeDefined();
    expect(bodies[1]!.generationConfig.thinkingConfig).toBeUndefined();
  });
});
