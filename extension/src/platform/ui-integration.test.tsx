import { act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createGenerateScreen, mountMackApp } from "../ui";
import { startPlatform } from "./controller";

let running: ReturnType<typeof startPlatform> | undefined;
afterEach(async () => { await act(async () => running?.exit()); running = undefined; vi.restoreAllMocks(); document.body.inert = false; });
it("mounts Role 3 outside body, commits live-model-shaped design, and restores original state", async () => {
  document.body.innerHTML = '<h1>GOV.UK</h1><a href="https://www.gov.uk/browse/benefits">Benefits</a>';
  document.body.inert = false;
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => [{ width: 100, height: 40 }] as unknown as DOMRectList);
  const model = { generateJSON: vi.fn(async (input) => {
    const payload = input.payload as { actions: { id: string }[] };
    return { status: "ready", title: "GOV.UK", sections: [{ heading: "Information", buttons: [{ actionId: payload.actions[0]!.id, label: "Find benefits" }] }] };
  }) };
  let platform!: ReturnType<typeof startPlatform>;
  const mount = mountMackApp();
  await act(async () => {
    platform = startPlatform({ mount, generateScreen: createGenerateScreen(model), resolveIntent: async () => { throw new Error("unused"); }, saveGoal: vi.fn(), onExit: vi.fn() });
    running = platform;
  });
  expect(mount.host.parentElement).toBe(document.documentElement);
  expect(document.body.inert).toBe(true);
  expect(mount.host.shadowRoot?.textContent).toContain("Find benefits");
  expect(mount.host.shadowRoot?.querySelectorAll("[data-action-id]")).toHaveLength(1);
  expect(model.generateJSON).toHaveBeenCalledTimes(1);
  await act(async () => {
    const original = Array.from(mount.host.shadowRoot!.querySelectorAll("button")).find((b) => b.textContent === "Original page")!;
    original.click();
  });
  expect(document.body.inert).toBe(false);
  await act(async () => platform.exit());
  expect(mount.host.isConnected).toBe(false);
});
