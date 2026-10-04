import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProposal, GuidanceProposal, LensAppProps, PageSnapshot, Stamp } from "../../../shared/contracts";
import { extractPage, liveTarget, type Extraction } from "./extractor";
import { mergeGuidance } from "./state";
import { startPlatform } from "./controller";

beforeEach(() => {
  document.body.innerHTML = '<h1>Public heading</h1><a href="https://www.gov.uk/browse/benefits?private=secret">Benefits</a><label>Name<input value="private-name"></label><textarea>private-note</textarea><button type="button">Help</button><form><button>Submit</button></form>';
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => [{ width: 100, height: 40 }] as unknown as DOMRectList);
  document.body.inert = false;
});
afterEach(() => { vi.restoreAllMocks(); document.querySelectorAll("mack-root, [data-mack-platform]").forEach((el) => el.remove()); });

describe("extractor and registry", () => {
  it("excludes Mack DOM and form values, strips query data, scopes IDs to the snapshot", () => {
    const host = document.createElement("mack-root"); host.dataset.mack = ""; host.innerHTML = '<a href="https://www.gov.uk/">Mack private text</a>'; document.documentElement.append(host);
    const result = extractPage();
    const serialized = JSON.stringify(result.snapshot);
    for (const privateText of ["private-name", "private-note", "Mack private text", "private=secret"]) expect(serialized).not.toContain(privateText);
    expect(result.snapshot.actions.find((a) => a.label === "Benefits")?.kind).toBe("navigate");
    expect(result.snapshot.actions.find((a) => a.label === "Submit")?.kind).toBe("submit");
    expect(result.snapshot.actions.every((a) => a.id.startsWith(result.snapshot.version))).toBe(true);
  });
  it("rejects detached, disabled, hidden, relabelled and changed links", () => {
    const result = extractPage(); const link = result.snapshot.actions.find((a) => a.kind === "navigate")!;
    const el = result.registry.get(link.id)!;
    el.setAttribute("href", "https://www.gov.uk/new"); expect(() => liveTarget(result, link.id)).toThrow();
    el.remove(); expect(() => liveTarget(result, link.id)).toThrow();
    const button = result.snapshot.actions.find((a) => a.label === "Help")!; const target = result.registry.get(button.id)!;
    target.setAttribute("aria-disabled", "true"); expect(() => liveTarget(result, button.id)).toThrow();
    target.removeAttribute("aria-disabled"); target.hidden = true; expect(() => liveTarget(result, button.id)).toThrow();
    target.hidden = false; target.textContent = "Different"; expect(() => liveTarget(result, button.id)).toThrow();
  });
});

function fixture() {
  const extraction = extractPage();
  const first = extraction.snapshot.actions.find((a) => a.label === "Benefits")!;
  const extra = extraction.snapshot.actions.find((a) => a.label === "Help")!;
  const screen = { title: "Test", mode: "simplified" as const, snapshotVersion: extraction.snapshot.version, screenVersion: "screen-1", sections: [{ id: "main", buttons: [{ actionId: first.id, label: "Find benefits" }] }] };
  const stamp = { requestId: "request", snapshotVersion: extraction.snapshot.version, screenVersion: screen.screenVersion };
  return { extraction, first, extra, screen, stamp };
}
describe("guidance commits", () => {
  it("preserves existing labels/order and deduplicates additions in one request section", () => {
    const { extraction, first, extra, screen, stamp } = fixture();
    const proposal: GuidanceProposal = { stamp, status: "ready", mode: "simplified", responseText: "Press Help.", targetActionId: extra.id, additions: [{ actionId: extra.id, label: "Help" }, { actionId: extra.id, label: "Help" }] };
    const merged = mergeGuidance(screen, extraction.snapshot, proposal).screen;
    expect(merged.sections[0]?.buttons[0]).toEqual({ actionId: first.id, label: "Find benefits" });
    expect(merged.sections[1]?.heading).toBe("For your request");
    expect(merged.sections[1]?.buttons).toHaveLength(1);
    expect(mergeGuidance(merged, extraction.snapshot, proposal).screen.sections).toHaveLength(2);
    expect(() => mergeGuidance(screen, extraction.snapshot, { ...proposal, additions: [{ actionId: first.id, label: "Rename" }] })).toThrow();
  });
  it("rejects invented targets and simplified form guidance", () => {
    const { extraction, screen, stamp } = fixture();
    for (const id of ["invented", extraction.snapshot.actions.find((a) => a.kind === "submit")!.id]) {
      expect(() => mergeGuidance(screen, extraction.snapshot, { stamp, status: "ready", responseText: "Press Submit", mode: "simplified", additions: [], targetActionId: id })).toThrow();
    }
  });
});

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness(generate?: (stamp: Stamp, snapshot: PageSnapshot) => Promise<DesignProposal>) {
  let props!: LensAppProps;
  const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
  const resolveIntent = vi.fn(async (request): Promise<GuidanceProposal> => ({ stamp: request.stamp, status: "not_found", mode: request.screen.mode, additions: [], responseText: "No matching action." }));
  let version = 0;
  const extracts: Extraction[] = [];
  const platform = startPlatform({
    mount: { host, render: (p) => { props = { ...p }; }, unmount: () => host.remove() },
    generateScreen: async (request) => generate ? generate(request.stamp, request.snapshot) : ({ stamp: request.stamp, status: "ready", design: { title: "Test", mode: "simplified", sections: [{ id: "s", buttons: [{ actionId: request.snapshot.actions[0]!.id, label: "Benefits" }] }] } }),
    resolveIntent, saveGoal: vi.fn(), onExit: vi.fn(),
    extract: () => { const result = extractPage(); result.snapshot.title = `Page ${++version}`; extracts.push(result); return result; },
  });
  return { platform, resolveIntent, extracts, getProps: () => props };
}
describe("platform lifecycle", () => {
  it("queues only the newest input while design is pending", async () => {
    const pending = deferred<DesignProposal>(); let stamp!: Stamp; let snapshot!: PageSnapshot;
    const h = harness(async (s, page) => { stamp = s; snapshot = page; return pending.promise; });
    h.platform.request("first"); h.platform.request("latest");
    expect(h.resolveIntent).not.toHaveBeenCalled();
    pending.resolve({ stamp, status: "ready", design: { title: "Test", mode: "simplified", sections: [{ id: "s", buttons: [{ actionId: snapshot.actions[0]!.id, label: "Benefits" }] }] } });
    await vi.waitFor(() => expect(h.resolveIntent).toHaveBeenCalledTimes(1));
    expect(h.resolveIntent.mock.calls[0]?.[0].utterance).toBe("latest");
    h.platform.exit();
  });
  it("discards delayed design results and failures after a new snapshot", async () => {
    const jobs: { deferred: ReturnType<typeof deferred<DesignProposal>>; stamp: Stamp }[] = [];
    const h = harness(async (stamp) => { const d = deferred<DesignProposal>(); jobs.push({ deferred: d, stamp }); return d.promise; });
    const refreshed = h.platform.refresh();
    const newest = jobs[1]!;
    newest.deferred.resolve({ stamp: newest.stamp, status: "use_original", design: { title: "New page", mode: "original", sections: [] } });
    await refreshed;
    jobs[0]!.deferred.reject(new Error("obsolete failure"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.platform.getState().screen.title).toBe("New page");
    expect(h.platform.getState().error).toBeUndefined();
    h.platform.exit();
  });
  it("restores body inert in original mode and on exit; never clicks from proposals", async () => {
    const click = vi.spyOn(HTMLElement.prototype, "click");
    const h = harness();
    await vi.waitFor(() => expect(h.platform.getState().busy).toBe(false));
    expect(document.body.inert).toBe(true);
    h.platform.request("help");
    await vi.waitFor(() => expect(h.resolveIntent).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
    h.getProps().onShowOriginal(); expect(document.body.inert).toBe(false);
    h.platform.exit(); expect(document.body.inert).toBe(false); expect(h.getProps().state.screen.mode).toBe("original");
  });
});
