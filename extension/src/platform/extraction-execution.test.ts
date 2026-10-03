import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignProposal, DesignRequest, LensAppProps } from "../../../shared/contracts";
import { NO_SIMPLE_VIEW, goalFromLabel, startPlatform } from "./controller";
import { deepLink, extractPage, MAX_ACTIONS } from "./extractor";
import { addPeekedLinks, peekCandidates, type PeekPage } from "./peek";

// jsdom serves pages from https://www.uhc.com/ via vitest's url option below.
beforeEach(() => {
  history.replaceState(null, "", "/");
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
    return [{ width: 100, height: 40 }] as unknown as DOMRectList;
  });
  document.body.inert = false;
});
afterEach(() => { vi.restoreAllMocks(); document.querySelectorAll("mack-root, [data-mack-platform]").forEach((el) => el.remove()); document.body.innerHTML = ""; });

const byLabel = (label: string) => extractPage().snapshot.actions.find((a) => a.label === label);

describe("extraction context prefixes", () => {
  it("visible actions have no location prefix; Mack DOM and input values are excluded", () => {
    document.body.innerHTML = '<a href="/find-a-doctor">Find a doctor</a><label>Member ID<input value="SECRET-123"></label>';
    const host = document.createElement("mack-root"); host.dataset.mack = ""; host.innerHTML = '<a href="/x">Mack link</a>'; document.documentElement.append(host);
    const { snapshot } = extractPage();
    expect(snapshot.actions.find((a) => a.label === "Find a doctor")).toMatchObject({ kind: "navigate", context: "" });
    expect(JSON.stringify(snapshot)).not.toContain("SECRET-123");
    expect(JSON.stringify(snapshot)).not.toContain("Mack link");
  });
  it("marks menu toggles and field types, and names unlabeled password/email inputs", () => {
    document.body.innerHTML = '<button aria-expanded="false">Menu</button><button aria-haspopup="true">Account</button><button aria-controls="x">Shop</button><button>Plain</button><input type="password"><input type="email"><label>ZIP Code<input type="text"></label>';
    expect(byLabel("Menu")?.context).toMatch(/^opens menu; /);
    expect(byLabel("Account")?.context).toMatch(/^opens menu; /);
    expect(byLabel("Shop")?.context).toMatch(/^opens menu; /);
    expect(byLabel("Plain")?.context).toBe("");
    expect(byLabel("Password")).toMatchObject({ kind: "field", context: "password field; " });
    expect(byLabel("Email")).toMatchObject({ kind: "field", context: "email field; " });
    expect(byLabel("ZIP Code")?.context).toBe("text field; ");
  });
  it("includes hidden same-site menu links named after their trigger, region label, or 'site menu'", () => {
    document.body.innerHTML = `
      <button aria-controls="member-menu" aria-expanded="false">Member resources</button>
      <ul id="member-menu" style="display:none"><li><a href="https://member.uhc.com/claims?x=1">Check coverage and claims</a></li><li><a href="/logout">Log out</a></li></ul>
      <nav aria-label="Main" style="display:none"><a href="/medicare">Medicare</a><a href="https://evil.example/">Elsewhere</a><a href="mailto:a@b.c">Mail</a></nav>
      <div style="display:none"><a href="/pharmacy">Pharmacy benefits</a><a href="/empty"></a></div>`;
    const { snapshot, hrefs, deep } = extractPage();
    const claims = snapshot.actions.find((a) => a.label === "Check coverage and claims")!;
    expect(claims).toMatchObject({ kind: "navigate", context: "menu: Member resources", href: "https://member.uhc.com/claims", disabled: false });
    expect(hrefs.get(claims.id)).toBe("https://member.uhc.com/claims?x=1");
    expect(deep.has(claims.id)).toBe(true);
    expect(snapshot.actions.find((a) => a.label === "Medicare")?.context).toBe("menu: Main");
    expect(snapshot.actions.find((a) => a.label === "Pharmacy benefits")?.context).toBe("menu: site menu");
    for (const label of ["Log out", "Elsewhere", "Mail"]) expect(snapshot.actions.find((a) => a.label === label)).toBeUndefined();
  });
  it("caps total actions", () => {
    document.body.innerHTML = Array.from({ length: MAX_ACTIONS + 50 }, (_, i) => `<a href="/p${i}">Link ${i}</a>`).join("");
    expect(extractPage().snapshot.actions).toHaveLength(MAX_ACTIONS);
  });
});

describe("peek one page ahead", () => {
  it("prefers menu/hub links, skips unsafe ones, and adds only new same-site links with labels and hrefs", () => {
    document.body.innerHTML = `<nav><a href="/member-resources">Member resources</a></nav>
      <a href="/news">Latest news</a><a href="/sign-out">Sign out</a><a href="/forms/claim.pdf">Claim form</a><a href="/cart">Cart</a>
      ${Array.from({ length: 10 }, (_, i) => `<a href="/support-${i}">Support ${i}</a>`).join("")}`;
    const extraction = extractPage();
    const candidates = peekCandidates(extraction);
    expect(candidates.length).toBeLessThanOrEqual(8);
    expect(candidates[0]!.label).toBe("Member resources");
    for (const bad of ["Sign out", "Claim form", "Cart"]) expect(candidates.some((c) => c.label === bad)).toBe(false);
    const html = `<p>Private-looking page text</p><a href="/member-resources">Member resources</a><a href="/pharmacy">Pharmacy</a><a href="https://other.example/x">Other</a><a href="/logout">Log out</a>${Array.from({ length: 40 }, (_, i) => `<a href="/deep-${i}">Deep ${i}</a>`).join("")}`;
    const pages: PeekPage[] = [{ url: candidates[0]!.url, finalUrl: candidates[0]!.url, html }];
    const added = addPeekedLinks(extraction, candidates, pages);
    expect(added).toBe(30);
    const pharmacy = extraction.snapshot.actions.find((a) => a.label === "Pharmacy")!;
    expect(pharmacy).toMatchObject({ kind: "navigate", context: 'one click away via "Member resources"', href: "https://www.uhc.com/pharmacy" });
    expect(extraction.deep.has(pharmacy.id)).toBe(true);
    expect(JSON.stringify(extraction.snapshot)).not.toContain("Private-looking");
    for (const bad of ["Other", "Log out"]) expect(extraction.snapshot.actions.find((a) => a.label === bad)).toBeUndefined();
    expect(extraction.snapshot.actions.filter((a) => a.href === "https://www.uhc.com/member-resources")).toHaveLength(1);
  });
});

function setup(options: { design?: (request: DesignRequest) => DesignProposal; peek?: (urls: string[]) => Promise<PeekPage[]>; initialGoal?: string } = {}) {
  let props!: LensAppProps;
  const host = document.createElement("mack-root"); host.dataset.mack = ""; host.attachShadow({ mode: "open" }); document.documentElement.append(host);
  const requests: DesignRequest[] = [];
  const navigate = vi.fn();
  const saveGoal = vi.fn();
  const generateScreen = vi.fn(async (request: DesignRequest): Promise<DesignProposal> => {
    requests.push(request);
    if (options.design) return options.design(request);
    const usable = request.snapshot.actions.filter((a) => a.kind === "navigate" || a.kind === "button");
    return { stamp: request.stamp, status: "ready", design: { title: "T", mode: "simplified", sections: [{ id: "main-1", buttons: usable.slice(0, 6).map((a) => ({ actionId: a.id, label: a.label === "Sign in" ? "Check claims (sign in first)" : a.label })) }] } };
  });
  const platform = startPlatform({
    mount: { host, render: (p) => { props = p; }, unmount: () => host.remove() },
    generateScreen, resolveIntent: async (request) => ({ stamp: request.stamp, status: "not_found", mode: request.screen.mode, additions: [], responseText: "No matching action." }),
    saveGoal, onExit: vi.fn(), navigate, initialGoal: options.initialGoal, ...(options.peek ? { peek: options.peek } : {}),
  });
  const ready = () => vi.waitFor(() => expect(platform.getState().busy).toBe(false));
  const idOf = (label: string) => platform.getState().screen.sections.flatMap((s) => s.buttons).find((b) => b.label === label)!.actionId;
  return { platform, props: () => props, requests, navigate, saveGoal, generateScreen, ready, idOf };
}

describe("execution", () => {
  it("navigates menu and peeked links to their exact extracted href, never clicking them", async () => {
    document.body.innerHTML = '<a href="/visible">Visible</a><ul id="m" style="display:none"><li><a href="/claims?tab=2#top">Claims</a></li></ul>';
    const click = vi.spyOn(HTMLElement.prototype, "click");
    const h = setup();
    await h.ready();
    h.props().onAction(h.idOf("Claims"));
    expect(h.navigate).toHaveBeenCalledWith("https://www.uhc.com/claims?tab=2#top");
    expect(click).not.toHaveBeenCalled();
    expect(h.saveGoal).toHaveBeenCalledWith("Claims", location.href);
    h.platform.exit();
  });
  it("refuses a deep link whose stored href no longer validates", async () => {
    document.body.innerHTML = '<ul style="display:none"><li><a href="/claims">Claims</a></li></ul>';
    const h = setup();
    await h.ready();
    const id = h.idOf("Claims");
    h.platform.getExtraction().hrefs.set(id, "https://evil.example/claims");
    expect(() => deepLink(h.platform.getExtraction(), id)).toThrow();
    h.props().onAction(id);
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.platform.getState().error?.message).toMatch(/can't open that link safely/);
    h.platform.exit();
  });
  it("clicks visible buttons after rechecking them, and redesigns when a button doesn't navigate", async () => {
    document.body.innerHTML = '<button type="button" aria-expanded="false">Open menu</button>';
    const button = document.querySelector("button")!;
    const click = vi.fn(); button.addEventListener("click", click);
    const h = setup();
    await h.ready();
    h.props().onAction(h.idOf("Open menu"));
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.body.inert).toBe(true);
    await vi.waitFor(() => expect(h.generateScreen).toHaveBeenCalledTimes(2), { timeout: 2000 });
    h.platform.exit();
  });
  it("blocks disabled and detached targets", async () => {
    document.body.innerHTML = '<button type="button">Help</button><a href="/gone">Gone</a>';
    const h = setup();
    await h.ready();
    document.querySelector("button")!.disabled = true;
    h.props().onAction(h.idOf("Help"));
    expect(h.platform.getState().error).toBeDefined();
    h.platform.exit();
  });
});

describe("goal carry and lifecycle triggers", () => {
  it("stores the displayed label without '(sign in first)' and passes the goal into every design request", async () => {
    expect(goalFromLabel("Check claims (sign in first)")).toBe("Check claims");
    document.body.innerHTML = '<a href="/sign-in">Sign in</a>';
    const h = setup({ initialGoal: "Find a doctor" });
    await h.ready();
    expect(h.requests[0]!.goal).toBe("Find a doctor");
    vi.spyOn(HTMLElement.prototype, "click").mockImplementation(() => {});
    h.props().onAction(h.idOf("Check claims (sign in first)"));
    expect(h.saveGoal).toHaveBeenCalledWith("Check claims", location.href);
    h.platform.refresh();
    await vi.waitFor(() => expect(h.requests.at(-1)!.goal).toBe("Check claims"));
    h.props().onRequest("pay my bill");
    expect(h.saveGoal).toHaveBeenLastCalledWith("pay my bill", location.href);
    h.platform.exit();
  });
  it("drops the goal when the page returns to the URL where it was set", async () => {
    document.body.innerHTML = '<a href="/claims">Claims</a>';
    const h = setup({ initialGoal: "Find a doctor" });
    await h.ready();
    vi.spyOn(HTMLElement.prototype, "click").mockImplementation(() => {});
    h.props().onAction(h.idOf("Claims"));
    const from = location.href;
    expect(h.saveGoal).toHaveBeenCalledWith("Claims", from);
    history.pushState({}, "", "/claims");
    await vi.waitFor(() => expect(h.requests.at(-1)!.goal).toBe("Claims"), { timeout: 2000 });
    history.pushState({}, "", from);
    await vi.waitFor(() => expect(h.saveGoal).toHaveBeenLastCalledWith(""), { timeout: 2000 });
    await vi.waitFor(() => expect(h.requests.at(-1)!.goal).toBeUndefined(), { timeout: 2000 });
    h.platform.exit();
  });
  it("previousPage clears the goal before going back", async () => {
    document.body.innerHTML = '<a href="/a">Account</a>';
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const h = setup({ initialGoal: "Find a doctor" });
    await h.ready();
    h.props().onPreviousPage();
    expect(h.saveGoal).toHaveBeenLastCalledWith("");
    expect(back).toHaveBeenCalled();
    h.platform.refresh();
    await vi.waitFor(() => expect(h.requests.at(-1)!.goal).toBeUndefined());
    h.platform.exit();
  });
  it("redesigns when form fields render late in simplified mode", async () => {
    document.body.innerHTML = '<a href="/a">Account</a>';
    const h = setup();
    await h.ready();
    document.body.insertAdjacentHTML("beforeend", '<form><label>Username<input></label><input type="password"></form>');
    await vi.waitFor(() => expect(h.generateScreen).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(h.requests[1]!.snapshot.actions.some((a) => a.context === "password field; ")).toBe(true);
    h.platform.exit();
  });
  it("skips peeking on pages with a password field and peeks otherwise", async () => {
    document.body.innerHTML = '<a href="/member">Member resources</a>';
    const peek = vi.fn(async (urls: string[]) => urls.map((url) => ({ url, finalUrl: url, html: '<a href="/claims">Claims</a>' })));
    const h = setup({ peek });
    await h.ready();
    expect(peek).toHaveBeenCalledTimes(1);
    expect(h.requests[0]!.snapshot.actions.find((a) => a.label === "Claims")?.context).toBe('one click away via "Member resources"');
    h.platform.exit();
    document.body.innerHTML = '<a href="/member">Member resources</a><input type="password">';
    const second = setup({ peek });
    await second.ready();
    expect(peek).toHaveBeenCalledTimes(1);
    second.platform.exit();
  });
});

describe("callbacks", () => {
  it("onBack restores the committed simplified screen, or explains there is none", async () => {
    document.body.innerHTML = '<a href="/a">Account</a>';
    const h = setup();
    await h.ready();
    const designed = h.platform.getState().screen.sections;
    h.props().onShowOriginal();
    expect(h.platform.getState().screen.mode).toBe("original");
    expect(document.body.inert).toBe(false);
    h.props().onBack();
    expect(h.platform.getState().screen.sections).toEqual(designed);
    expect(document.body.inert).toBe(true);
    h.platform.exit();

    const none = setup({ design: (r) => ({ stamp: r.stamp, status: "use_original", design: { title: "Sign in", mode: "original", sections: [] } }) });
    await none.ready();
    expect(none.platform.getState().screen.mode).toBe("original");
    none.props().onBack();
    expect(none.platform.getState().instruction).toBe(NO_SIMPLE_VIEW);
    none.platform.exit();
  });
  it("not_found also uses original mode; onPreviousPage goes back in history; onExit restores inert", async () => {
    document.body.inert = false;
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const h = setup({ design: (r) => ({ stamp: r.stamp, status: "not_found", design: { title: "T", mode: "original", sections: [] } }) });
    await h.ready();
    expect(h.platform.getState().screen.mode).toBe("original");
    h.props().onPreviousPage();
    expect(back).toHaveBeenCalled();
    h.props().onExit();
    expect(document.body.inert).toBe(false);
    expect(document.querySelector("mack-root")).toBeNull();
  });
});
