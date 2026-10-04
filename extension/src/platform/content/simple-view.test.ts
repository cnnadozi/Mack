import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE } from "../messages";
import { rememberToContinue } from "./continue";

const setRingAllowed = vi.fn();
const stopSimple = vi.fn();
const guide = vi.fn(async () => ({ ok: true }));
const startSimpleView = vi.fn(
  async (options: {
    language: string;
    onShowOriginal(): void;
    onModeChange(simple: boolean): void;
  }) => {
    options.onModeChange(true);
    return { guide, stop: stopSimple };
  },
);

vi.mock("./overlay", () => ({ setRingAllowed }));
vi.mock("./platform-host", async (original) => ({
  ...(await original<typeof import("./platform-host")>()),
  startSimpleView,
}));

let stored: Record<string, unknown>;
let changed: ((changes: Record<string, { newValue?: unknown }>, area: string) => void)[];

// Starting the simple view takes a few promise turns (page load, lazy import).
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

async function set(values: Record<string, unknown>): Promise<void> {
  Object.assign(stored, values);
  const changes = Object.fromEntries(
    Object.entries(values).map(([key, newValue]) => [key, { newValue }]),
  );
  for (const listener of changed) listener(changes, "local");
  await settle();
}

async function load(initial: Record<string, unknown>) {
  stored = initial;
  changed = [];
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("chrome", {
    storage: {
      local: { get: async () => ({ ...stored }), set },
      onChanged: { addListener: (listener: (typeof changed)[number]) => changed.push(listener) },
    },
  });
  // Loaded up front: the first import of the platform is slow, and the page
  // imports it lazily.
  await import("./platform-host");
  const module = await import("./simple-view");
  await module.initSimpleView();
  await settle();
  return module;
}

const ON = { [STORAGE.session]: { active: true, state: "listening" } };

describe("simple view on a page", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("cannot be created while Mack is off", async () => {
    const view = await load({});
    view.createSimpleView();
    await settle();
    expect(startSimpleView).not.toHaveBeenCalled();
    expect(await view.guideInSimpleView("where is it")).toEqual({ ok: false });
  });

  it("is not created just because Mack is on", async () => {
    const view = await load(ON);
    expect(startSimpleView).not.toHaveBeenCalled();
    expect(view.simpleViewShowing()).toBe(false);
    expect(view.simpleViewState()).toEqual({ available: true, creating: false, showing: false });
  });

  it("is created on request, in the chosen language, and tells the bar", async () => {
    const view = await load({ ...ON, [STORAGE.language]: "Spanish" });
    const heard = vi.fn();
    view.subscribeSimpleView(heard);
    view.createSimpleView();
    expect(view.simpleViewState()).toMatchObject({ creating: true, showing: false });
    await settle();
    expect(startSimpleView).toHaveBeenCalledTimes(1);
    expect(startSimpleView.mock.calls[0]![0].language).toBe("Spanish");
    expect(view.simpleViewShowing()).toBe(true);
    expect(setRingAllowed).toHaveBeenLastCalledWith(false);
    expect(view.simpleViewState()).toMatchObject({ creating: false, showing: true });
    expect(heard).toHaveBeenCalled();
    expect(await view.guideInSimpleView("where is it")).toEqual({ ok: true });
  });

  it("is made again when asked again, replacing the one that is up", async () => {
    const view = await load(ON);
    view.createSimpleView();
    await settle();
    view.createSimpleView();
    await settle();
    expect(stopSimple).toHaveBeenCalledTimes(1);
    expect(startSimpleView).toHaveBeenCalledTimes(2);
    expect(view.simpleViewState()).toMatchObject({ showing: true });
  });

  it("goes away when its own Original page button is pressed", async () => {
    const view = await load(ON);
    view.createSimpleView();
    await settle();
    startSimpleView.mock.calls[0]![0].onShowOriginal();
    expect(stopSimple).toHaveBeenCalledTimes(1);
    expect(view.simpleViewState()).toMatchObject({ creating: false, showing: false });
    expect(setRingAllowed).toHaveBeenLastCalledWith(true);
  });

  it("continues on the page one of its buttons led to, once", async () => {
    rememberToContinue();
    await load(ON);
    expect(startSimpleView).toHaveBeenCalledTimes(1);
    await load(ON);
    expect(startSimpleView).not.toHaveBeenCalled();
  });

  it("is removed when Mack is turned off", async () => {
    const view = await load(ON);
    view.createSimpleView();
    await settle();
    await set({ [STORAGE.session]: { active: false, state: "idle" } });
    expect(stopSimple).toHaveBeenCalledTimes(1);
    expect(view.simpleViewShowing()).toBe(false);
  });
});
