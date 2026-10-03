import { describe, expect, it, vi } from "vitest";
import type { DesignRequest, ModelClient } from "../../../../shared/contracts";
import { createGenerateScreen } from "../design/generateScreen";
import { buildDesignPayload, DESIGN_SYSTEM_PROMPT } from "../design/prompt";
import { DesignError, groundDesign } from "../design/validate";
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
        id: "s1",
        heading: "Find something",
        buttons: [
          { actionId: "a1", label: "Search for books and movies" },
          { actionId: "a3", label: "See upcoming events" },
        ],
      },
      { id: "s2", heading: "Visit", buttons: [{ actionId: "a2", label: "Opening hours and locations" }] },
      { id: "s3", heading: "Your account", buttons: [{ actionId: "a5", label: "Sign in to my account" }] },
    ]);
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
