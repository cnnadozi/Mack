import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProposal, DesignRequest, LensAppProps } from "../../../shared/contracts";
import { startPlatform } from "./controller";
import { extractPage, isSiteSearch } from "./extractor";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList);
  document.body.inert = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("mack-root").forEach((el) => el.remove());
  document.body.innerHTML = "";
});

const field = (html: string) => {
  document.body.innerHTML = html;
  return document.querySelector<HTMLInputElement>("input#t")!;
};

describe("isSiteSearch", () => {
  it("recognizes common site-search boxes", () => {
    expect(isSiteSearch(field('<input id="t" type="search">'))).toBe(true);
    expect(isSiteSearch(field('<form role="search"><input id="t"></form>'))).toBe(true);
    expect(isSiteSearch(field('<form action="/s"><input id="t" name="q"></form>'))).toBe(true);
    expect(isSiteSearch(field('<input id="t" placeholder="Search Costco">'))).toBe(true);
    expect(isSiteSearch(field('<form action="/CatalogSearch"><input id="t" name="keyword"></form>'))).toBe(true);
  });

  it("never treats login, payment, multi-field or unrelated boxes as search", () => {
    expect(isSiteSearch(field('<form><input id="t" name="q"><input type="password"></form>'))).toBe(false);
    expect(isSiteSearch(field('<form><input id="t" type="search"><input><input><input></form>'))).toBe(false);
    expect(isSiteSearch(field('<input id="t" placeholder="ZIP code">'))).toBe(false);
    expect(isSiteSearch(field('<input id="t" type="email" placeholder="Search">'))).toBe(false);
    expect(isSiteSearch(field('<input id="t" type="search" disabled>'))).toBe(false);
  });

  it("marks site-search fields with the site search context prefix", () => {
    document.body.innerHTML = '<input type="search" aria-label="Search warehouse"><label>ZIP<input></label>';
    const actions = extractPage().snapshot.actions;
    expect(actions.find((a) => a.label === "Search warehouse")?.context).toMatch(/^site search; search field; /);
    expect(actions.find((a) => a.label === "ZIP")?.context).toMatch(/^text field; /);
  });
});

describe("onSearch", () => {
  function setup() {
    let props!: LensAppProps;
    const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
    const generateScreen = vi.fn(async (request: DesignRequest): Promise<DesignProposal> => {
      const box = request.snapshot.actions.find((a) => a.context.startsWith("site search; "))!;
      const link = request.snapshot.actions.find((a) => a.kind === "navigate")!;
      return { stamp: request.stamp, status: "ready", design: { title: "T", mode: "simplified", sections: [{ id: "main-1", buttons: [{ actionId: link.id, label: link.label }] }], search: { actionId: box.id, label: "Search Example" } } };
    });
    const saveGoal = vi.fn();
    const platform = startPlatform({
      mount: { host, render: (p) => { props = p; }, unmount: () => host.remove() },
      generateScreen, resolveIntent: async (r) => ({ stamp: r.stamp, status: "not_found", mode: r.screen.mode, additions: [], responseText: "" }),
      saveGoal, onExit: vi.fn(), navigate: vi.fn(),
    });
    return { platform, props: () => props, saveGoal, ready: () => vi.waitFor(() => expect(platform.getState().busy).toBe(false)) };
  }

  it("fills the site's real search box and submits its form, carrying the query as the goal", async () => {
    document.body.innerHTML = '<a href="/deals">Deals</a><form role="search" action="/s"><input name="q" aria-label="Search"></form>';
    const form = document.querySelector("form")!;
    const seen: string[] = [];
    form.addEventListener("submit", (event) => { event.preventDefault(); seen.push(form.querySelector("input")!.value); });
    const h = setup();
    await h.ready();
    const search = h.platform.getState().screen.search!;
    expect(search.label).toBe("Search Example");
    h.props().onSearch(search.actionId, "  paper towels ");
    expect(seen).toEqual(["paper towels"]);
    expect(h.saveGoal).toHaveBeenCalledWith("Find paper towels", location.href);
    expect(h.platform.getState().instruction).toMatch(/Searching for “paper towels”/);
    h.platform.exit();
  });

  it("presses Enter in a box without a form, then falls back to the search button beside it", async () => {
    document.body.innerHTML = '<a href="/deals">Deals</a><div class="bar"><input aria-label="Search Costco" placeholder="Search Costco"><button aria-label="Search">🔍</button></div>';
    const input = document.querySelector("input")!;
    const keys: string[] = [];
    input.addEventListener("keydown", (e) => keys.push(`${e.key}:${input.value}`));
    const clicked = vi.fn();
    document.querySelector("button")!.addEventListener("click", clicked);
    const h = setup();
    await h.ready();
    h.props().onSearch(h.platform.getState().screen.search!.actionId, "paper towels");
    expect(keys).toEqual(["Enter:paper towels"]);
    await vi.waitFor(() => expect(clicked).toHaveBeenCalledTimes(1), { timeout: 2000 });
    h.platform.exit();
  });

  it("ignores a search for any field other than the design's search box", async () => {
    document.body.innerHTML = '<a href="/deals">Deals</a><form role="search"><input name="q" aria-label="Search"></form>';
    const submit = vi.fn((event: Event) => event.preventDefault());
    document.querySelector("form")!.addEventListener("submit", submit);
    const h = setup();
    await h.ready();
    const link = h.platform.getState().screen.sections[0]!.buttons[0]!.actionId;
    h.props().onSearch(link, "anything");
    h.props().onSearch(h.platform.getState().screen.search!.actionId, "   ");
    expect(submit).not.toHaveBeenCalled();
    h.platform.exit();
  });
});

describe("Mack's voice on the simple view", () => {
  function setup() {
    const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
    const generateScreen = vi.fn(async (request: DesignRequest): Promise<DesignProposal> => {
      const box = request.snapshot.actions.find((a) => a.context.startsWith("site search; "))!;
      const link = request.snapshot.actions.find((a) => a.kind === "navigate")!;
      return { stamp: request.stamp, status: "ready", design: { title: "T", mode: "simplified", sections: [{ id: "main-1", buttons: [{ actionId: link.id, label: link.label }] }], search: { actionId: box.id, label: "Search Example" } } };
    });
    const navigate = vi.fn();
    const platform = startPlatform({
      mount: { host, render: () => undefined, unmount: () => host.remove() },
      generateScreen, resolveIntent: async (r) => ({ stamp: r.stamp, status: "not_found", mode: r.screen.mode, additions: [], responseText: "" }),
      saveGoal: vi.fn(), onExit: vi.fn(), navigate,
    });
    return { platform, navigate, ready: () => vi.waitFor(() => expect(platform.getState().busy).toBe(false)) };
  }

  it("points at, presses and searches with what the simple view shows, and nothing else", async () => {
    document.body.innerHTML = '<a href="/claims">Claims</a><a href="/other">Other</a><form role="search" action="/s"><input name="q" aria-label="Search"></form>';
    const form = document.querySelector("form")!;
    const seen: string[] = [];
    form.addEventListener("submit", (event) => { event.preventDefault(); seen.push(form.querySelector("input")!.value); });
    const h = setup();
    await h.ready();
    const { screen } = h.platform.getState();
    const claims = screen.sections[0].buttons[0].actionId;
    const hidden = h.platform.getExtraction().snapshot.actions.find((a) => a.label === "Other")!.id;

    expect(h.platform.point(hidden)).toBe(false);
    expect(h.platform.point(screen.search!.actionId)).toBe(true);
    expect(h.platform.getState().highlightedActionId).toBe(screen.search!.actionId);

    expect(h.platform.press(screen.search!.actionId)).toBe(false);
    expect(h.platform.search(claims, "x")).toBe(false);
    expect(h.platform.search(screen.search!.actionId, "paper towels")).toBe(true);
    expect(seen).toEqual(["paper towels"]);
    h.platform.exit();
  });
});
