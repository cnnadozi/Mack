import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProposal, GuidanceRequest, LensAppProps, ModelClient } from "../../../shared/contracts";
import { startPlatform } from "./controller";
import { extractPage } from "./extractor";
import { createResolveIntent } from "./guidance-adapter";

// Canned model replies stand in for the live provider; they are not demo data.
beforeEach(() => {
  document.body.innerHTML = '<h1>GOV.UK</h1><a href="https://www.gov.uk/browse/benefits">Benefits</a><button type="button">Help</button><label>Postcode<input></label>';
  document.body.inert = false;
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => [{ width: 100, height: 40 }] as unknown as DOMRectList);
});
afterEach(() => { vi.restoreAllMocks(); document.querySelectorAll("mack-root, [data-mack-platform]").forEach((el) => el.remove()); });

const ids = (snapshot: GuidanceRequest["snapshot"]) => ({
  benefits: snapshot.actions.find((a) => a.label === "Benefits")!.id,
  help: snapshot.actions.find((a) => a.label === "Help")!.id,
  postcode: snapshot.actions.find((a) => a.label === "Postcode")!.id,
});

function setup(guideReply: (payload: string) => unknown | Promise<unknown>) {
  let props!: LensAppProps;
  const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
  const model: ModelClient = { generateJSON: vi.fn(async (input) => guideReply(input.payload as string)) };
  const generateScreen = vi.fn(async (request): Promise<DesignProposal> => ({
    stamp: request.stamp, status: "ready",
    design: { title: "GOV.UK", mode: "simplified", sections: [{ id: "main", buttons: [{ actionId: ids(request.snapshot).benefits, label: "Find benefits" }] }] },
  }));
  const platform = startPlatform({
    mount: { host, render: (p) => { props = { ...p }; }, unmount: () => host.remove() },
    generateScreen, resolveIntent: createResolveIntent(model), saveGoal: vi.fn(), onExit: vi.fn(),
  });
  return { platform, model, generateScreen, props: () => props };
}

describe("Role 2 guidance through the platform adapter", () => {
  it("sends Role 2 vocabulary to the model and commits an omitted action into one request section", async () => {
    const h = setup((payload) => {
      const page = JSON.parse(payload).page as { actions: { id: string; kind: string; label: string }[] };
      expect(page.actions.find((a) => a.label === "Benefits")?.kind).toBe("link");
      const help = page.actions.find((a) => a.label === "Help")!.id;
      return { status: "ready", targetActionId: help, additionLabel: "Get help", instruction: 'Press "Get help".' };
    });
    await vi.waitFor(() => expect(h.platform.getState().busy).toBe(false));
    h.platform.request("I need help");
    await vi.waitFor(() => expect(h.platform.getState().instruction).toBe('Press "Get help".'));
    const state = h.platform.getState();
    expect(h.model.generateJSON).toHaveBeenCalledWith(expect.objectContaining({ task: "guide" }), expect.any(AbortSignal));
    expect(state.screen.sections.map((s) => s.heading)).toEqual([undefined, "For your request"]);
    expect(state.screen.sections[0]!.buttons[0]!.label).toBe("Find benefits");
    expect(state.highlightedActionId).toBe(state.screen.sections[1]!.buttons[0]!.actionId);
    h.platform.exit();
  });

  it("switches to the original page for a field target and highlights the source element", async () => {
    const h = setup((payload) => {
      const page = JSON.parse(payload).page as { actions: { id: string; label: string }[] };
      return { status: "use_original", targetActionId: page.actions.find((a) => a.label === "Postcode")!.id, instruction: 'Type your postcode in the "Postcode" box.' };
    });
    await vi.waitFor(() => expect(h.platform.getState().busy).toBe(false));
    h.platform.request("check my area");
    await vi.waitFor(() => expect(h.platform.getState().screen.mode).toBe("original"));
    expect(document.body.inert).toBe(false);
    expect(document.querySelector("input")?.hasAttribute("data-mack-highlight")).toBe(true);
    h.platform.exit();
    expect(document.querySelector("[data-mack-highlight]")).toBeNull();
  });

  it("discards a delayed guidance reply once a newer request has started", async () => {
    const replies: ((value: unknown) => void)[] = [];
    const h = setup(() => new Promise((resolve) => replies.push(resolve)));
    await vi.waitFor(() => expect(h.platform.getState().busy).toBe(false));
    h.platform.request("first");
    await vi.waitFor(() => expect(replies).toHaveLength(1));
    h.platform.request("second");
    await vi.waitFor(() => expect(replies).toHaveLength(2));
    replies[0]!({ status: "missing_target", message: "Obsolete answer." });
    replies[1]!({ status: "missing_target", message: "Nothing on this page does that." });
    await vi.waitFor(() => expect(h.platform.getState().instruction).toBe("Nothing on this page does that."));
    h.platform.exit();
  });
});

describe("page change handling", () => {
  it("ignores re-renders with the same content but redesigns when actions change", async () => {
    const h = setup(() => ({ status: "missing_target", message: "None." }));
    await vi.waitFor(() => expect(h.platform.getState().busy).toBe(false));
    document.querySelector("h1")!.className = "focus-ring";
    const link = document.querySelector("a")!; link.replaceWith(link.cloneNode(true));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(h.generateScreen).toHaveBeenCalledTimes(1);
    h.props().onAction(h.platform.getState().screen.sections[0]!.buttons[0]!.actionId);
    expect(h.platform.getState().error).toBeUndefined();
    document.body.insertAdjacentHTML("beforeend", '<a href="https://www.gov.uk/new">New service</a>');
    await vi.waitFor(() => expect(h.generateScreen).toHaveBeenCalledTimes(2), { timeout: 2000 });
    h.platform.exit();
  });

  it("keeps original mode when the page changes and Back restores the saved simplified screen", async () => {
    const h = setup(() => ({ status: "missing_target", message: "None." }));
    await vi.waitFor(() => expect(h.platform.getState().busy).toBe(false));
    const designed = h.platform.getState().screen;
    h.props().onShowOriginal();
    h.props().onBack();
    expect(h.platform.getState().screen.mode).toBe("simplified");
    expect(h.platform.getState().screen.sections).toEqual(designed.sections);
    expect(h.generateScreen).toHaveBeenCalledTimes(1);

    h.props().onShowOriginal();
    document.body.insertAdjacentHTML("beforeend", '<p><a href="https://www.gov.uk/error">Fix this error</a></p>');
    await vi.waitFor(() => expect(h.platform.getState().screen.snapshotVersion).not.toBe(designed.snapshotVersion), { timeout: 2000 });
    expect(h.platform.getState().screen.mode).toBe("original");
    expect(document.body.inert).toBe(false);
    expect(h.generateScreen).toHaveBeenCalledTimes(1);
    h.props().onBack();
    await vi.waitFor(() => expect(h.generateScreen).toHaveBeenCalledTimes(2));
    h.platform.exit();
  });
});

it("rejects guidance requests with no text before calling the model", async () => {
  const model: ModelClient = { generateJSON: vi.fn() };
  const { snapshot } = extractPage();
  const screen = { title: "T", mode: "simplified" as const, sections: [], snapshotVersion: snapshot.version, screenVersion: "s" };
  await expect(createResolveIntent(model)({ stamp: { requestId: "r", snapshotVersion: snapshot.version, screenVersion: "s" }, snapshot, screen }, new AbortController().signal)).rejects.toThrow();
  expect(model.generateJSON).not.toHaveBeenCalled();
});
