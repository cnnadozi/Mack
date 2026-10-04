import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProposal, DesignRequest, LensAppProps } from "../../../shared/contracts";
import { startPlatform } from "./controller";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
    return (this.closest("[data-hidden]") ? [] : [{ width: 100, height: 40 }]) as unknown as DOMRectList;
  });
  document.body.inert = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("mack-root").forEach((el) => el.remove());
  document.body.innerHTML = "";
});

// Shows the first two links, like a design that ignores the carousel.
function setup() {
  let props!: LensAppProps;
  const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
  const generateScreen = vi.fn(async (request: DesignRequest): Promise<DesignProposal> => {
    const shown = request.snapshot.actions.filter((a) => a.label.startsWith("Task")).slice(0, 2);
    return { stamp: request.stamp, status: "ready", design: { title: "Store", mode: "simplified", sections: [{ id: "main-1", buttons: shown.map((a) => ({ actionId: a.id, label: a.label })) }] } };
  });
  const platform = startPlatform({
    mount: { host, render: (p) => { props = p; }, unmount: () => host.remove() },
    generateScreen, resolveIntent: async (r) => ({ stamp: r.stamp, status: "not_found", mode: r.screen.mode, additions: [], responseText: "" }),
    saveGoal: vi.fn(), onExit: vi.fn(), navigate: vi.fn(),
  });
  return { platform, props: () => props, generateScreen, ready: () => vi.waitFor(() => expect(platform.getState().busy).toBe(false)) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 700));

describe("busy pages", () => {
  it("does not redesign while a carousel, ads or prices keep changing around the shown buttons", async () => {
    document.body.innerHTML = '<a href="/a">Task A</a><a href="/b">Task B</a><div id="carousel"><a href="/deal-0">Deal 0</a></div><span id="price">$1</span>';
    const h = setup();
    await h.ready();
    const designs = h.generateScreen.mock.calls.length;
    for (let i = 1; i <= 4; i++) {
      document.getElementById("carousel")!.innerHTML = `<a href="/deal-${i}">Deal ${i}</a>`;
      document.getElementById("price")!.textContent = `$${i + 1}`;
      await settle();
    }
    expect(h.generateScreen).toHaveBeenCalledTimes(designs);
    expect(h.platform.getState().screen.sections[0]!.buttons.map((b) => b.label)).toEqual(["Task A", "Task B"]);
    h.platform.exit();
  });

  it("re-links shown buttons the site re-rendered, so clicks reach the live element", async () => {
    document.body.innerHTML = '<div id="wrap"><a href="/a">Task A</a><a href="/b">Task B</a></div>';
    const h = setup();
    await h.ready();
    document.getElementById("wrap")!.innerHTML = '<a href="/a">Task A</a><a href="/b">Task B</a><a href="/new">New promo</a>';
    const fresh = document.querySelector<HTMLAnchorElement>('a[href="/a"]')!;
    const clicked = vi.fn((event: Event) => event.preventDefault());
    fresh.addEventListener("click", clicked);
    await settle();
    const id = h.platform.getState().screen.sections[0]!.buttons[0]!.actionId;
    expect(h.platform.getExtraction().registry.get(id)).toBe(fresh);
    h.props().onAction(id);
    expect(clicked).toHaveBeenCalledTimes(1);
    h.platform.exit();
  });

  it("redesigns once when a shown button disappears, then not again within the cool-down", async () => {
    document.body.innerHTML = '<div id="wrap"><a href="/a">Task A</a><a href="/b">Task B</a><a href="/c">Task C</a></div>';
    const h = setup();
    await h.ready();
    const designs = h.generateScreen.mock.calls.length;
    document.querySelector('a[href="/a"]')!.remove();
    await settle();
    await h.ready();
    expect(h.generateScreen).toHaveBeenCalledTimes(designs + 1);
    document.querySelector('a[href="/b"]')!.remove();
    await settle();
    expect(h.generateScreen).toHaveBeenCalledTimes(designs + 1);
    h.platform.exit();
  });
});
