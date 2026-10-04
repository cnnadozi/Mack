// Reads what makes the page look like itself, so the simple view can look like a
// redesign of this website and not a generic screen: the site's name and icon,
// its main colour, its preview picture, the pictures next to its links, and its
// search box. Everything here comes from the page, never from the model.

import type { ScreenDetails } from "../../ui";
import type { Extraction } from "../extractor";

type Rgba = [number, number, number, number];

function parseColor(value: string): Rgba | null {
  const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!match) return null;
  const parts = match[1]!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(part))) return null;
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

// Solid and clearly a colour: not white, black, grey or see-through.
function isBrandLike([red, green, blue, alpha]: Rgba): boolean {
  return alpha > 0.5 && Math.max(red, green, blue) - Math.min(red, green, blue) > 45;
}

function resolved(cssColor: string): Rgba | null {
  const probe = document.createElement("span");
  probe.style.color = cssColor;
  document.documentElement.appendChild(probe);
  const color = parseColor(getComputedStyle(probe).color);
  probe.remove();
  return color;
}

// The colour the site declares for itself, else the first strong colour on its
// header, navigation or buttons, else the colour of its links.
function brandColor(): Rgba | null {
  const declared = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
  const fromMeta = declared ? resolved(declared) : null;
  if (fromMeta && isBrandLike(fromMeta)) return fromMeta;

  const surfaces = document.querySelectorAll(
    'header, nav, [role="banner"], button, [role="button"], input[type="submit"], a[class*="btn"], a[class*="button"]',
  );
  for (const element of Array.from(surfaces).slice(0, 80)) {
    const color = parseColor(getComputedStyle(element).backgroundColor);
    if (color && isBrandLike(color)) return color;
  }
  for (const link of Array.from(document.querySelectorAll("a[href]")).slice(0, 20)) {
    const color = parseColor(getComputedStyle(link).color);
    if (color && isBrandLike(color)) return color;
  }
  return null;
}

function webUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function siteLook(): NonNullable<ScreenDetails["site"]> {
  const meta = (property: string): string | undefined =>
    document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.content.trim() ||
    undefined;
  const color = brandColor();
  return {
    name: meta("og:site_name") ?? location.hostname.replace(/^www\./, ""),
    icon:
      webUrl(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href) ??
      `${location.origin}/favicon.ico`,
    image: webUrl(meta("og:image")),
    ...(color
      ? {
          color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
          // Perceived brightness; white text is readable on anything darker than this.
          lightText: 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2] < 150,
        }
      : {}),
  };
}

const MIN_PICTURE = 64;
// A picture belongs to a link when they share a small card, not a whole menu.
const MAX_LINKS_IN_CARD = 3;

/** The page's own picture for a link or button, such as a product photo. */
export function pictureFor(element: Element | undefined): string | undefined {
  if (!element) return undefined;
  let image = element.querySelector("img");
  if (!image) {
    const card = element.closest(
      'li, article, figure, [class*="card"], [class*="tile"], [class*="product"]',
    );
    if (card && card.querySelectorAll("a[href]").length <= MAX_LINKS_IN_CARD) {
      image = card.querySelector("img");
    }
  }
  if (!image || image.naturalWidth < MIN_PICTURE || image.naturalHeight < MIN_PICTURE)
    return undefined;
  return webUrl(image.currentSrc || image.src);
}

/** The page's search box, if it has one that is safe to type into. */
export function searchField(
  extraction: Extraction,
): { label: string; element: HTMLElement } | undefined {
  for (const action of extraction.snapshot.actions) {
    if (action.kind !== "field" || action.disabled) continue;
    const element = extraction.registry.get(action.id);
    if (!(element instanceof HTMLInputElement)) continue;
    const isSearch =
      element.type === "search" ||
      (element.type === "text" && /search/i.test(`${action.label} ${element.name} ${element.id}`));
    if (isSearch) return { label: action.label || "Search", element };
  }
  return undefined;
}
