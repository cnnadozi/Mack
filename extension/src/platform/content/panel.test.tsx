import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE } from "../messages";

const createSimpleView = vi.fn();
vi.mock("./simple-view", () => ({
  createSimpleView,
  subscribeSimpleView: () => () => undefined,
  simpleViewState: () => VIEW,
}));
const VIEW = { available: true, creating: false, showing: false };

let stored: Record<string, unknown>;
let sent: unknown[];
let changed: Set<(changes: Record<string, { newValue?: unknown }>, area: string) => void>;

async function show(initial: Record<string, unknown>) {
  stored = {
    [STORAGE.session]: { active: true, state: "listening" },
    [STORAGE.transcript]: [{ id: "1", speaker: "mack", text: "Hi, I'm Mack." }],
    ...initial,
  };
  const { Panel } = await import("./panel");
  await act(async () => void render(<Panel />));
}

beforeEach(() => {
  sent = [];
  changed = new Set();
  vi.stubGlobal("chrome", {
    runtime: {
      getURL: (path: string) => path,
      sendMessage: async (message: unknown) => void sent.push(message),
    },
    storage: {
      local: {
        get: async (key: string) => (key in stored ? { [key]: stored[key] } : {}),
        set: async (values: Record<string, unknown>) => {
          Object.assign(stored, values);
          const changes = Object.fromEntries(
            Object.entries(values).map(([key, newValue]) => [key, { newValue }]),
          );
          for (const listener of changed) listener(changes, "local");
        },
      },
      onChanged: {
        addListener: (listener: Parameters<typeof changed.add>[0]) => changed.add(listener),
        removeListener: (listener: Parameters<typeof changed.add>[0]) => changed.delete(listener),
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  createSimpleView.mockClear();
});

describe("Mack's bar", () => {
  it("shows nothing while Mack is off", async () => {
    await show({ [STORAGE.session]: { active: false, state: "idle" } });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("shows the simple view button and the conversation, and no talk button while Mack listens by itself", async () => {
    await show({});
    screen.getByText("Hi, I'm Mack.");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /talk/i })).toBeNull();
    screen.getByRole("img", { name: "Listening" });
    fireEvent.click(screen.getByRole("button", { name: /Simple view/ }));
    expect(createSimpleView).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });

  it("records only while the button is held when push to talk is on", async () => {
    await show({ [STORAGE.pushToTalk]: true });
    const talk = screen.getByRole("button", { name: "Hold to talk" });
    talk.setPointerCapture = vi.fn();
    fireEvent.pointerDown(talk);
    fireEvent.pointerUp(talk);
    expect(sent).toEqual([
      { type: "mack:talk", held: true },
      { type: "mack:talk", held: false },
    ]);
  });

  it("keeps the settings to voice, language, push to talk and text input", async () => {
    await show({});
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    screen.getByLabelText("Mack's voice");
    expect(screen.getAllByRole("switch").map((item) => item.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
    ]);
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "Spanish" } });
    expect(stored[STORAGE.language]).toBe("Spanish");
    await act(async () => void fireEvent.click(screen.getByLabelText("Push to talk")));
    expect(stored[STORAGE.pushToTalk]).toBe(true);
  });

  it("swaps the talk button for a text box when text input is switched on", async () => {
    await show({ [STORAGE.pushToTalk]: true });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await act(async () => void fireEvent.click(screen.getByLabelText("Text input")));
    expect(screen.queryByRole("button", { name: /talk/i })).toBeNull();
    const box = screen.getByRole("textbox", { name: /Type a question/ });
    fireEvent.change(box, { target: { value: "  where is the price " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sent).toEqual([{ type: "mack:typed", text: "where is the price" }]);
  });

  it("switches between light and dark, with the button just before the conversation one", async () => {
    await show({});
    const names = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(names.indexOf("Switch to dark mode") + 1).toBe(names.indexOf("Hide conversation"));
    await act(
      async () => void fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" })),
    );
    expect(stored[STORAGE.theme]).toBe("dark");
    await act(
      async () =>
        void fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" })),
    );
    expect(stored[STORAGE.theme]).toBe("light");
  });

  it("shows that Mack is working through a task, with the current step and a way to stop", async () => {
    await show({
      [STORAGE.session]: { active: true, state: "working" },
      [STORAGE.transcript]: [
        { id: "1", speaker: "mack", text: "Opening the menu", step: true },
        { id: "2", speaker: "user", text: "Search for a good car" },
        { id: "3", speaker: "mack", text: "Typing good car", step: true },
        { id: "4", speaker: "mack", text: "Pressing Search", step: true },
      ],
    });
    const note = screen
      .getAllByRole("status")
      .find((item) => /Mack is working/.test(item.textContent ?? ""))!;
    expect(note.textContent).toContain("step 2");
    expect(note.textContent).toContain("Pressing Search");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(sent).toEqual([{ type: "mack:halt" }]);
  });

  it("shows no working note while Mack is only listening", async () => {
    await show({});
    expect(screen.queryByText(/Mack is working/)).toBeNull();
  });

  it("turns Mack off from the bar", async () => {
    await show({});
    fireEvent.click(screen.getByRole("button", { name: "Turn Mack off" }));
    expect(sent).toEqual([{ type: "mack:stop" }]);
  });
});
