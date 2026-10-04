import { describe, expect, it, vi } from "vitest";
import type { DesignRequest, ModelClient } from "../../../../shared/contracts";
import { createGenerateScreen } from "../design/generateScreen";
import { buildDesignPayload, DESIGN_SYSTEM_PROMPT } from "../design/prompt";
import { DesignError, groundDesign, isMoreSection } from "../design/validate";
import { createFixtureModelClient, fixtureModelDesign, fixtureSnapshot } from "../fixtures";

const stamp = { requestId: "r1", snapshotVersion: "snap-fixture-1", screenVersion: "v0" };
const request: DesignRequest = { stamp, snapshot: fixtureSnapshot, goal: "find opening hours" };

describe("groundDesign", () => {
  it("keeps only real, eligible, non-duplicate actions and assigns section ids in code", () => {
    const proposal = groundDesign(fixtureModelDesign, fixtureSnapshot, stamp);
    expect(proposal.status).toBe("ready");
    expect(proposal.stamp).toBe(stamp);
    expect(proposal.design.mode).toBe("simplified");
    expect(proposal.design.sections).toEqual([
      {
        id: "main-1",
        heading: "Find something",
        buttons: [
          { actionId: "a1", label: "Search for books and movies" },
          { actionId: "a3", label: "See upcoming events" },
        ],
      },
      { id: "main-2", heading: "Visit", buttons: [{ actionId: "a2", label: "Opening hours and locations" }] },
      { id: "main-3", heading: "Your account", buttons: [{ actionId: "a5", label: "Sign in to my account" }] },
    ]);
  });

  it("encodes main and more priorities in section ids and always keeps something visible", () => {
    const raw = {
      status: "ready",
      title: "Find a doctor",
      sections: [
        { priority: "main", heading: "Find a doctor", buttons: [{ actionId: "a1", label: "Search for a doctor" }] },
        { priority: "more", heading: "Help", buttons: [{ actionId: "a10", label: "Contact us" }] },
      ],
    };
    expect(groundDesign(raw, fixtureSnapshot, stamp).design.sections.map((s) => s.id)).toEqual(["main-1", "more-2"]);
    const allMore = { ...raw, sections: raw.sections.map((s) => ({ ...s, priority: "more" })) };
    const ids = groundDesign(allMore, fixtureSnapshot, stamp).design.sections.map((s) => s.id);
    expect(ids).toEqual(["main-1", "more-2"]);
    expect(isMoreSection({ id: "more-2", buttons: [] })).toBe(true);
    expect(isMoreSection({ id: "request", buttons: [] })).toBe(false);
  });

  it("keeps a search box only when it points at a real site-search field", () => {
    const actions = [
      ...fixtureSnapshot.actions,
      { id: "q", label: "Search warehouse", kind: "field" as const, context: "site search; search field; header", disabled: false },
      { id: "zip", label: "ZIP code", kind: "field" as const, context: "text field; Find a warehouse", disabled: false },
    ];
    const snapshot = { ...fixtureSnapshot, actions };
    const withSearch = (search: unknown) => groundDesign({ ...fixtureModelDesign, search }, snapshot, stamp).design.search;
    expect(withSearch({ actionId: "q", label: "  Search Costco  " })).toEqual({ actionId: "q", label: "Search Costco" });
    expect(withSearch({ actionId: "q", label: "" })).toEqual({ actionId: "q", label: "Search this site" });
    expect(withSearch({ actionId: "zip", label: "Search" })).toBeUndefined();
    expect(withSearch({ actionId: "a1", label: "Search" })).toBeUndefined();
    expect(withSearch({ actionId: "nope", label: "Search" })).toBeUndefined();
    expect(withSearch(undefined)).toBeUndefined();
  });

  it("treats every copy of one destination as a single task", () => {
    const actions = [
      { id: "v", label: "Find a doctor", kind: "navigate" as const, context: "main", disabled: false, href: "https://e.org/find" },
      { id: "m", label: "Find a doctorFind a doctor", kind: "navigate" as const, context: "menu: Members", disabled: false, href: "https://e.org/find" },
    ];
    const raw = { status: "ready", title: "T", sections: [{ buttons: [{ actionId: "m", label: "Find a doctor" }, { actionId: "v", label: "Find a doctor near you" }] }] };
    const proposal = groundDesign(raw, { ...fixtureSnapshot, actions }, stamp);
    expect(proposal.design.sections[0].buttons).toEqual([{ actionId: "m", label: "Find a doctor" }]);
  });

  it("lets sign-in-first task buttons share the sign-in destination but never an id", () => {
    const signIn = (id: string, label: string) => ({ id, label, kind: "navigate" as const, context: "header", disabled: false, href: "https://e.org/login" });
    const actions = [signIn("s1", "Member sign in"), signIn("s2", "Sign in to your account"), signIn("s3", "Sign in or register")];
    const raw = {
      status: "ready",
      title: "T",
      sections: [
        {
          buttons: [
            { actionId: "s1", label: "Check claims (sign in first)" },
            { actionId: "s2", label: "Get your ID card (sign in first)" },
            { actionId: "s2", label: "Reused id (sign in first)" },
            { actionId: "s3", label: "Sign in" },
          ],
        },
      ],
    };
    const labels = groundDesign(raw, { ...fixtureSnapshot, actions }, stamp).design.sections[0].buttons.map((b) => b.label);
    expect(labels).toEqual(["Check claims (sign in first)", "Get your ID card (sign in first)", "Sign in"]);
  });

  it("does not cap the number of buttons", () => {
    const actions = Array.from({ length: 9 }, (_, i) => ({
      id: `x${i}`, label: `Thing ${i}`, kind: "navigate" as const, context: "", disabled: false, href: `https://e.org/${i}`,
    }));
    const snapshot = { ...fixtureSnapshot, actions };
    const raw = { status: "ready", title: "T", sections: [{ buttons: actions.map((a) => ({ actionId: a.id, label: a.label })) }] };
    const proposal = groundDesign(raw, snapshot, stamp);
    expect(proposal.design.sections[0].buttons).toHaveLength(9);
    expect(proposal.design.sections[0]).not.toHaveProperty("heading");
  });

  it("falls back to the source label and cleans control characters", () => {
    const raw = { status: "ready", title: "  Hi\u0007 there  ", sections: [{ heading: "", buttons: [{ actionId: "a1", label: "   " }] }] };
    const proposal = groundDesign(raw, fixtureSnapshot, stamp);
    expect(proposal.design.title).toBe("Hi there");
    expect(proposal.design.sections[0].buttons[0].label).toBe("Catalog");
  });

  it("returns not_found for an honest empty design", () => {
    const proposal = groundDesign({ status: "ready", title: "x", sections: [] }, fixtureSnapshot, stamp);
    expect(proposal.status).toBe("not_found");
    expect(proposal.design.mode).toBe("original");
  });

  it("passes through use_original with no buttons", () => {
    const proposal = groundDesign({ status: "use_original", title: "Form", sections: [{ buttons: [{ actionId: "a1", label: "x" }] }] }, fixtureSnapshot, stamp);
    expect(proposal).toEqual({ stamp, status: "use_original", design: { title: "Form", mode: "original", sections: [] } });
  });

  it("rejects ungrounded and malformed output as retryable errors", () => {
    const ungrounded = { status: "ready", title: "x", sections: [{ buttons: [{ actionId: "nope", label: "Fake" }] }] };
    expect(() => groundDesign(ungrounded, fixtureSnapshot, stamp)).toThrow(DesignError);
    for (const bad of [null, "text", [], { status: "maybe" }, { status: "ready", sections: "no" }]) {
      try {
        groundDesign(bad, fixtureSnapshot, stamp);
        throw new Error("expected failure");
      } catch (e) {
        expect(e).toBeInstanceOf(DesignError);
        expect((e as DesignError).retryable).toBe(true);
      }
    }
  });
});

describe("buildDesignPayload", () => {
  it("omits disabled and form actions but describes the form by label only", () => {
    const payload = buildDesignPayload(fixtureSnapshot, " find hours ");
    expect(payload.goal).toBe("find hours");
    expect(payload.actions.map((a) => a.id)).toEqual(["a1", "a2", "a3", "a4", "a5", "a9", "a10"]);
    expect(payload.page.formFieldCount).toBe(2);
    expect(payload.page.formFields).toEqual([
      { label: "Search", kind: "field", context: "Catalog search box" },
      { label: "Go", kind: "submit", context: "Catalog search" },
    ]);
  });
});

describe("createGenerateScreen", () => {
  it("calls the model once with the design task and echoes the request stamp", async () => {
    const model = createFixtureModelClient(fixtureModelDesign, 0);
    const spy = vi.spyOn(model, "generateJSON");
    const proposal = await createGenerateScreen(model)(request, new AbortController().signal);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ task: "design", system: DESIGN_SYSTEM_PROMPT });
    expect(proposal.stamp).toBe(stamp);
    expect(proposal.status).toBe("ready");
  });

  it("ignores a stamp the model tries to return", async () => {
    const model = createFixtureModelClient({ ...fixtureModelDesign, stamp: { requestId: "evil", snapshotVersion: "x", screenVersion: "y" } }, 0);
    const proposal = await createGenerateScreen(model)(request, new AbortController().signal);
    expect(proposal.stamp).toEqual(stamp);
  });

  it("rejects when aborted mid-flight", async () => {
    const controller = new AbortController();
    const pending = createGenerateScreen(createFixtureModelClient(fixtureModelDesign, 50))(request, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeDefined();
  });

  it("skips the model when nothing on the page can be simplified", async () => {
    const model: ModelClient = { generateJSON: vi.fn() };
    const formOnly = { ...fixtureSnapshot, actions: fixtureSnapshot.actions.filter((a) => a.kind === "field" || a.kind === "submit") };
    const proposal = await createGenerateScreen(model)({ stamp, snapshot: formOnly }, new AbortController().signal);
    expect(model.generateJSON).not.toHaveBeenCalled();
    expect(proposal.status).toBe("use_original");
  });

  it("keeps sign-in and payment pages on the original page without asking the model", async () => {
    const model: ModelClient = { generateJSON: vi.fn() };
    for (const field of [
      { label: "Password", context: "form" },
      { label: "Enter it here", context: "password field; form" },
      { label: "Card number", context: "checkout" },
    ]) {
      const snapshot = {
        ...fixtureSnapshot,
        actions: [...fixtureSnapshot.actions, { id: "pw", kind: "field" as const, disabled: false, ...field }],
      };
      const proposal = await createGenerateScreen(model)({ stamp, snapshot }, new AbortController().signal);
      expect(proposal.status).toBe("use_original");
      expect(proposal.design).toMatchObject({ mode: "original", sections: [] });
    }
    expect(model.generateJSON).not.toHaveBeenCalled();
  });

  it("still asks the model when the only field is a search box", async () => {
    const model = createFixtureModelClient(fixtureModelDesign, 0);
    const spy = vi.spyOn(model, "generateJSON");
    await createGenerateScreen(model)(request, new AbortController().signal);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("wraps transport failures as a retryable design error that keeps the cause", async () => {
    const cause = new Error("network down");
    const model: ModelClient = { generateJSON: () => Promise.reject(cause) };
    await expect(createGenerateScreen(model)(request, new AbortController().signal)).rejects.toMatchObject({
      code: "design_model_failed",
      retryable: true,
      cause,
    });
  });
});
