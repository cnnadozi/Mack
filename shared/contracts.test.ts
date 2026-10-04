import { describe, expect, it } from "vitest";
import { PageSnapshotSchema, parseGuidanceRequest, sameStamp, validateDesign, type PageSnapshot } from "./contracts";

const snapshot: PageSnapshot = {
  version: "page-1", pageUrl: "https://www.gov.uk/", title: "GOV.UK", headings: [], context: "",
  actions: [{ id: "page-1:0", label: "Benefits", kind: "navigate", context: "", disabled: false }],
};
describe("Contract v1", () => {
  it("rejects provisional kinds, private URLs, and duplicate IDs", () => {
    expect(PageSnapshotSchema.safeParse({ ...snapshot, actions: [{ ...snapshot.actions[0], kind: "link" }] }).success).toBe(false);
    expect(PageSnapshotSchema.safeParse({ ...snapshot, pageUrl: "https://www.gov.uk/?token=secret" }).success).toBe(false);
    expect(PageSnapshotSchema.safeParse({ ...snapshot, actions: [...snapshot.actions, ...snapshot.actions] }).success).toBe(false);
  });
  it("checks all three stamp fields", () => {
    const stamp = { requestId: "r", snapshotVersion: "page-1", screenVersion: "screen-1" };
    for (const field of Object.keys(stamp)) expect(sameStamp(stamp, { ...stamp, [field]: "old" })).toBe(false);
    expect(() => parseGuidanceRequest({ stamp, snapshot, screen: { title: "Test", mode: "simplified", sections: [], snapshotVersion: "page-1", screenVersion: "old" } })).toThrow();
  });
  it("blocks shortcuts for forms and unknown targets", () => {
    for (const id of ["unknown", "page-1:0"]) {
      const page = { ...snapshot, actions: snapshot.actions.map((a) => ({ ...a, kind: "submit" as const })) };
      expect(() => validateDesign({ title: "Test", mode: "simplified", sections: [{ id: "s", buttons: [{ actionId: id, label: "Go" }] }] }, page)).toThrow();
    }
  });
});
