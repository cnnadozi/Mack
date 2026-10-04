import { beforeEach, describe, expect, it } from "vitest";
import { designCache } from "./design-cache";

const payload = (version: string, labels = ["New cars", "Contact us"]) => ({
  page: { url: "https://shop.example/", searchFields: [{ id: `${version}:7`, label: "Search" }] },
  actions: labels.map((label, index) => ({ id: `${version}:${index}`, label, kind: "navigate" })),
});
const answer = (version: string) => ({
  status: "ready",
  search: { actionId: `${version}:7`, label: "Search the shop" },
  sections: [{ heading: "Cars", buttons: [{ actionId: `${version}:0`, label: "New cars" }] }],
});

describe("design cache", () => {
  beforeEach(() => sessionStorage.clear());

  it("reuses a design for the same page, with ids rewritten for the new reading", () => {
    designCache("SYS", payload("v1")).set(answer("v1"));
    expect(designCache("SYS", payload("v2")).get()).toEqual(answer("v2"));
  });

  it("does not reuse it when the page lists different actions, or the prompt differs", () => {
    designCache("SYS", payload("v1")).set(answer("v1"));
    expect(designCache("SYS", payload("v2", ["New cars", "Careers"])).get()).toBeUndefined();
    expect(designCache("SYS in Spanish", payload("v2")).get()).toBeUndefined();
  });

  it("forgets a design after ten minutes", () => {
    let time = 0;
    designCache("SYS", payload("v1"), () => time).set(answer("v1"));
    time = 10 * 60_000 + 1;
    expect(designCache("SYS", payload("v2"), () => time).get()).toBeUndefined();
  });

  it("also remembers a request that has no action ids", () => {
    const facts = { page: { url: "https://shop.example/", text: "Open 9 to 5" } };
    designCache("FACTS", facts).set({ summary: "A shop." });
    expect(designCache("FACTS", facts).get()).toEqual({ summary: "A shop." });
    expect(designCache("FACTS", { page: { ...facts.page, text: "Closed" } }).get()).toBeUndefined();
  });
});
