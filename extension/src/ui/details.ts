// The extra detail that turns the simple view from a list of buttons into a
// redesign of the page: a summary, key facts, descriptions and icons from the
// model, and the site's own name, colour and pictures read from the page.
//
// None of this is part of the shared contract. It only decorates buttons the
// contract has already grounded in real page actions, so a missing or wrong
// detail can change how the screen looks but never what a button does.

export const ICON_NAMES = [
  "search",
  "cart",
  "user",
  "phone",
  "mail",
  "map",
  "calendar",
  "info",
  "help",
  "home",
  "star",
  "heart",
  "settings",
  "document",
  "card",
  "delivery",
  "tag",
  "book",
  "play",
  "download",
  "sign-in",
  "message",
  "clock",
  "shield",
  "globe",
  "work",
  "gift",
  "list",
  "image",
  "arrow",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export type ScreenDetails = {
  site?: {
    name: string;
    /** The site's own icon. */
    icon?: string;
    /** The site's main colour as a CSS colour, and whether white text is readable on it. */
    color?: string;
    lightText?: boolean;
    /** The page's own preview picture. */
    image?: string;
  };
  summary?: string;
  highlights?: { title: string; text: string }[];
  /** By section heading. */
  sections?: Record<string, { description?: string }>;
  /** By action id. */
  actions?: Record<string, { description?: string; icon?: IconName; image?: string }>;
  /** The page's own search box, when it has one. */
  search?: { label: string; onSearch(text: string): void };
};

const MAX_SUMMARY = 320;
const MAX_DESCRIPTION = 140;
const MAX_HIGHLIGHTS = 6;

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : [];
}

export const sectionKey = (heading: string | undefined): string =>
  (heading ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Picks the decorative fields out of the model's raw design answer. Never throws. */
export function readDetails(raw: unknown): ScreenDetails {
  const design = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const details: ScreenDetails = { sections: {}, actions: {} };
  const summary = text(design.summary, MAX_SUMMARY);
  if (summary) details.summary = summary;
  details.highlights = list(design.highlights)
    .map((item) => ({ title: text(item.title, 40), text: text(item.text, 160) }))
    .filter((item) => item.title && item.text)
    .slice(0, MAX_HIGHLIGHTS);

  for (const section of list(design.sections)) {
    const description = text(section.description, MAX_DESCRIPTION);
    if (description) details.sections![sectionKey(text(section.heading, 200))] = { description };
    for (const button of list(section.buttons)) {
      if (typeof button.actionId !== "string") continue;
      const icon = ICON_NAMES.find((name) => name === button.icon);
      const about = text(button.description, MAX_DESCRIPTION);
      details.actions![button.actionId] = {
        ...(about ? { description: about } : {}),
        ...(icon ? { icon } : {}),
      };
    }
  }
  return details;
}
