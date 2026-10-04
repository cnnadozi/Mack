// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { brandColor } from "./extractor";

function page(head: string, body: string) {
  document.head.innerHTML = head;
  document.body.innerHTML = body;
  // jsdom has no layout, so every element would look invisible.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("brandColor", () => {
  it("uses a saturated theme-color meta tag", () => {
    page('<meta name="theme-color" content="#002677">', "");
    expect(brandColor()).toBe("#002677");
  });

  it("ignores a white or gray theme-color and falls back to the page's dominant brand color", () => {
    page(
      '<meta name="theme-color" content="#ffffff">',
      `<header><a href="/a" style="background-color: rgb(0, 38, 119)">Plans</a><button style="background-color: rgb(0, 38, 119)">Sign in</button></header>
       <main><a href="/b" style="color: rgb(200, 30, 30)">Red link</a><button style="background-color: rgb(240, 240, 240)">Gray</button></main>`,
    );
    expect(brandColor()).toBe("#002677");
  });

  it("ignores the browser's default link colors", () => {
    page("", '<main><a href="/a" style="color: rgb(0, 0, 238)">One</a><a href="/b" style="color: rgb(0, 0, 238)">Two</a><a href="/c" style="color: rgb(6, 116, 140)">Teal</a></main>');
    expect(brandColor()).toBe("#06748c");
  });

  it("returns undefined when the page has no brand color", () => {
    page("", '<main><a href="/a" style="color: rgb(20, 20, 20)">Plain</a><button style="background-color: rgb(255, 255, 255)">Go</button></main>');
    expect(brandColor()).toBeUndefined();
  });

  it("skips Mack's own UI", () => {
    page("", '<mack-root data-mack><button style="background-color: rgb(200, 0, 0)">Mack</button></mack-root>');
    expect(brandColor()).toBeUndefined();
  });
});
