// Reads what the shared contract does not carry about the page's look, so the
// simple view can look like a redesign of this website: the site's name, its
// preview picture, and the pictures next to its links. Everything here comes
// from the page, never from the model.

import type { ScreenDetails } from "../../ui";

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
  return {
    name: meta("og:site_name") ?? location.hostname.replace(/^www\./, ""),
    image: webUrl(meta("og:image")),
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
