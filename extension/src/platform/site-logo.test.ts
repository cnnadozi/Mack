// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://example.com/plans"}
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
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.title = "";
});

const favicon = { src: "https://example.com/favicon.ico", kind: "icon", background: "#ffffff" };

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
    expect(siteLogo()).toEqual({ src: "https://example.com/logo.png", alt: "Example Bank", background: "#ffffff", kind: "logo" });
  });

  it("finds a logo pushed down by a cookie banner", () => {
    page('<div data-box="0,0,1200,300">Cookies</div><header><a href="/"><svg data-box="30,338,162,30" class="site-header__logotype" aria-label="GOV.UK"><path d="M0 0h1v1H0z"/></svg></a></header>');
    expect(siteLogo()).toMatchObject({ alt: "GOV.UK", kind: "logo" });
  });

  it("ignores big hero images, images far down the page, and unlabeled pictures, falling back to the site icon", () => {
    document.title = "Find a plan | Example Health";
    page(`<main>
      <img data-box="0,0,1200,500" src="https://example.com/hero.jpg" alt="Family logo">
      <img data-box="0,900,100,40" src="https://example.com/footer-logo.png" alt="Footer logo">
      <img data-box="0,20,100,40" src="https://example.com/photo.jpg" alt="Smiling doctor">
    </main>`);
    expect(siteLogo()).toEqual({ ...favicon, alt: "Example Health" });
  });

  it("ignores generic link labels like Home and names the site from its title instead", () => {
    document.title = "Internal Revenue Service | An official website of the United States government";
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, hostname: "www.irs.gov", origin: "https://www.irs.gov", href: "https://www.irs.gov/" } as Location);
    page('<header><a href="/" aria-label="Home"><img data-box="10,10,160,50" src="https://example.com/logo.svg" alt="" class="site-logo"></a></header>');
    expect(siteLogo()).toMatchObject({ alt: "Internal Revenue Service", kind: "logo" });
  });

  it("strips 'home page' from otherwise useful labels", () => {
    page('<header><a href="/"><img data-box="10,10,160,50" src="https://example.com/l.png" alt="Example Bank home page" class="logo"></a></header>');
    expect(siteLogo()).toMatchObject({ alt: "Example Bank" });
    page('<header><a href="/"><svg data-box="10,10,160,50" aria-label="NYPL Header Logo"><path d="M0 0h1v1H0z"/></svg></a></header>');
    expect(siteLogo()).toMatchObject({ alt: "NYPL" });
  });

  it("prefers the largest declared site icon and the site's own name", () => {
    document.head.innerHTML = '<meta property="og:site_name" content="Example Library"><link rel="icon" href="/fav-16.png" sizes="16x16"><link rel="apple-touch-icon" href="/touch.png">';
    page("<main></main>");
    expect(siteLogo()).toEqual({ src: "https://example.com/touch.png", alt: "Example Library", background: "#ffffff", kind: "icon" });
  });

  it("uses a logo drawn as a CSS background on the home link", () => {
    page('<header style="background-color: rgb(0, 51, 102)"><a href="/" aria-label="Example City" data-box="10,10,140,40" style="background-image: url(https://example.com/brand.png)"></a></header>');
    expect(siteLogo()).toEqual({ src: "https://example.com/brand.png", alt: "Example City", background: "#003366", kind: "logo" });
  });

  it("skips SVG logos that reference shapes outside themselves", () => {
    page('<header><a href="/"><svg data-box="10,10,100,40" aria-label="Site logo"><use href="/sprite.svg#logo"></use></svg></a></header>');
    expect(siteLogo()).toMatchObject({ kind: "icon", src: favicon.src });
  });
});
