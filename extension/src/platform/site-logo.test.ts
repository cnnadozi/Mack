// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { siteLogo } from "./extractor";

// jsdom has no layout; data-box="left,top,width,height" stands in for the rendered position.
function page(body: string) {
  document.body.innerHTML = body;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const [left = 0, top = 0, width = 0, height = 0] = (this.closest("[data-box]")?.getAttribute("data-box") ?? "").split(",").map(Number);
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("siteLogo", () => {
  it("turns a header SVG logo into an inert, rendered-size image on the color behind it", () => {
    page(`<header style="background-color: rgb(255, 208, 0)"><a href="/">
      <svg data-box="20,40,157,41" width="0" height="0" viewBox="0 0 360 92" style="padding-bottom:25%" aria-label="Liberty Mutual Insurance logo" onload="alert(1)">
        <script>alert(1)</script><path d="M0 0h10v10H0z" fill="#1a1446"/>
      </svg></a></header>`);
    const logo = siteLogo()!;
    expect(logo.alt).toBe("Liberty Mutual Insurance");
    expect(logo.background).toBe("#ffd000");
    expect(logo.src.startsWith("data:image/svg+xml")).toBe(true);
    const xml = decodeURIComponent(logo.src.split(",").slice(1).join(","));
    expect(xml).toContain('width="157"');
    expect(xml).toContain('height="41"');
    expect(xml).not.toMatch(/<script|onload|padding-bottom/i);
  });

  it("uses an https header image labelled as a logo", () => {
    page('<header><a href="https://example.com/x"><img data-box="10,10,120,40" src="https://example.com/logo.png" alt="Example Bank logo"></a></header>');
    expect(siteLogo()).toEqual({ src: "https://example.com/logo.png", alt: "Example Bank", background: "#ffffff" });
  });

  it("ignores big hero images, images far down the page, and unlabeled pictures", () => {
    page(`<main>
      <img data-box="0,0,1200,500" src="https://example.com/hero.jpg" alt="Family logo">
      <img data-box="0,900,100,40" src="https://example.com/footer-logo.png" alt="Footer logo">
      <img data-box="0,20,100,40" src="https://example.com/photo.jpg" alt="Smiling doctor">
    </main>`);
    expect(siteLogo()).toBeUndefined();
  });

  it("skips SVG logos that reference shapes outside themselves", () => {
    page('<header><a href="/"><svg data-box="10,10,100,40" aria-label="Site logo"><use href="/sprite.svg#logo"></use></svg></a></header>');
    expect(siteLogo()).toBeUndefined();
  });
});
