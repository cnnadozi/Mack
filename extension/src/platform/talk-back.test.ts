import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProposal, DesignRequest, LensAppProps } from "../../../shared/contracts";
import { startPlatform } from "./controller";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList);
  document.body.inert = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("mack-root").forEach((el) => el.remove());
  document.body.innerHTML = "";
});

function setup(language = "") {
  let props!: LensAppProps;
  const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
  const announce = vi.fn();
  const generateScreen = vi.fn(async (request: DesignRequest): Promise<DesignProposal> => {
    const links = request.snapshot.actions.filter((a) => a.kind === "navigate");
    const box = request.snapshot.actions.find((a) => a.context.startsWith("site search; "));
    return {
      stamp: request.stamp, status: "ready",
      design: { title: "T", mode: "simplified", sections: [{ id: "main-1", buttons: links.map((a) => ({ actionId: a.id, label: a.label })) }], ...(box ? { search: { actionId: box.id, label: "Search" } } : {}) },
    };
  });
  const platform = startPlatform({
    mount: { host, render: (p) => { props = p; }, unmount: () => host.remove() },
    generateScreen, resolveIntent: async (r) => ({ stamp: r.stamp, status: "not_found", mode: r.screen.mode, additions: [], responseText: "" }),
    saveGoal: vi.fn(), onExit: vi.fn(), navigate: vi.fn(), announce, language,
  });
  return { platform, props: () => props, announce, ready: () => vi.waitFor(() => expect(platform.getState().busy).toBe(false)) };
}

describe("Mack talks back", () => {
  it("says the simple view is ready, then what it is opening and searching", async () => {
    document.body.innerHTML = '<a href="/doctor">Find a doctor</a><form role="search"><input name="q" aria-label="Search"></form>';
    document.querySelector("form")!.addEventListener("submit", (e) => e.preventDefault());
    const h = setup();
    await h.ready();
    expect(h.announce).toHaveBeenLastCalledWith("Here is a simpler version of this page. Choose what you want to do.");
    h.props().onSearch(h.platform.getState().screen.search!.actionId, "flu shots");
    expect(h.announce).toHaveBeenLastCalledWith("Searching for “flu shots”.");
    h.platform.exit();
  });

  it("speaks and shows its words in the chosen language", async () => {
    document.body.innerHTML = '<a href="/doctor">Find a doctor</a>';
    const h = setup("Spanish");
    await h.ready();
    expect(h.platform.getState().instruction).toBe("Aquí tiene una versión más sencilla de esta página. Elija lo que quiere hacer.");
    expect(h.announce).toHaveBeenLastCalledWith(h.platform.getState().instruction);
    h.platform.exit();
  });
});
