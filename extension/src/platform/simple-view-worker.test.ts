import { beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_STORAGE, tabKey } from "./settings";
import { createSimpleViewWorker } from "./simple-view-worker";

const sender = {
  id: "extension",
  frameId: 0,
  documentId: "doc",
  url: "https://www.uhc.com/",
  tab: { id: 7 },
} as chrome.runtime.MessageSender;

let session: Record<string, unknown>;
let on: boolean;
const stop = vi.fn(async () => undefined);

beforeEach(() => {
  session = {};
  on = true;
  stop.mockClear();
  vi.stubGlobal("chrome", {
    runtime: { id: "extension" },
    tabs: { onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() } },
    storage: {
      session: {
        setAccessLevel: async () => undefined,
        get: async (keys: string | string[] | null) =>
          keys === null
            ? { ...session }
            : Object.fromEntries(
                [keys].flat().flatMap((key) => (key in session ? [[key, session[key]]] : [])),
              ),
        set: async (values: Record<string, unknown>) => void Object.assign(session, values),
        remove: async (keys: string | string[]) => {
          for (const key of [keys].flat()) delete session[key];
        },
      },
    },
  });
});

function worker() {
  return createSimpleViewWorker({ isActive: async () => on, stop });
}

function ask(message: unknown, from = sender): Promise<unknown> {
  return new Promise((resolve) => {
    const handled = worker().handle(message, from, resolve);
    if (handled !== true) resolve(handled);
  });
}

describe("simple view worker", () => {
  it("leaves the extension's own messages to the background worker", async () => {
    expect(await ask({ type: "mack:typed", text: "hello" })).toBeUndefined();
    expect(await ask({ type: "mack:context" })).toBeUndefined();
  });

  it("refuses platform messages from anything but the top frame of an https page", async () => {
    for (const bad of [
      { ...sender, frameId: 1 },
      { ...sender, url: "http://www.uhc.com/" },
      { ...sender, id: "other" },
    ]) {
      expect(await ask({ type: "mack:session" }, bad)).toBe(false);
    }
  });

  it("follows the toolbar switch and keeps the goal per tab", async () => {
    expect(await ask({ type: "mack:session" })).toEqual({ active: true });
    await ask({ type: "mack:goal", goal: " Find a doctor ", fromUrl: "https://www.uhc.com/" });
    expect(await ask({ type: "mack:session" })).toEqual({
      active: true,
      goal: "Find a doctor",
      goalFrom: "https://www.uhc.com/",
    });
    expect(
      await ask({ type: "mack:session" }, { ...sender, tab: { id: 8 } as chrome.tabs.Tab }),
    ).toEqual({
      active: true,
    });
    on = false;
    expect(await ask({ type: "mack:session" })).toEqual({ active: false });
  });

  it("forgets a goal when it is emptied, and every goal when Mack is turned off", async () => {
    await ask({ type: "mack:goal", goal: "Pay a bill" });
    await ask({ type: "mack:goal", goal: "" });
    expect(session[tabKey(7)]).toBeUndefined();

    await ask({ type: "mack:goal", goal: "Pay a bill" });
    session[KEY_STORAGE] = "placeholder";
    await worker().clearGoals();
    expect(Object.keys(session)).toEqual([KEY_STORAGE]);
  });

  it("turns Mack off when the simple view asks to exit", async () => {
    expect(await ask({ type: "mack:exit" })).toEqual({ ok: true });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("does not peek at other pages while Mack is off", async () => {
    on = false;
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    expect(await ask({ type: "mack:peek", urls: ["https://www.uhc.com/claims"] })).toEqual({
      pages: [],
    });
    expect(fetched).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
