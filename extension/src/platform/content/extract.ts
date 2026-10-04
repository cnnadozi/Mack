// Reads the page so the model can only talk about things that exist: the real,
// visible controls, plus the readable text of the whole page from top to bottom.
// Elements stay in a local registry; only labels, ids and text leave the page.

import type { PageElement, PageSnapshot } from "../messages";

const CONTROLS =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], [role="textbox"], [contenteditable="true"], [contenteditable=""]';
const MAX_ELEMENTS = 300;
const MAX_HEADINGS = 30;
const MAX_LABEL = 80;
// About 10,000 tokens: enough for long pages without making every answer slow.
const MAX_CONTENT_CHARS = 40_000;
const BUTTON_INPUT_TYPES = new Set(["button", "submit", "reset", "image"]);

// Subtrees with no readable text, or with text the user typed (private).
const SKIPPED_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS", "VIDEO", "AUDIO",
  "IFRAME", "OBJECT", "EMBED", "TEXTAREA", "SELECT", "INPUT", "HEAD",
]);
// Tags that start a new line of text. A tag list is used instead of computed
// styles because asking for styles on every element is slow on large pages.
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "DD", "DETAILS", "DIV", "DL", "DT",
  "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "HEADER", "HR", "LI", "MAIN", "NAV",
  "OL", "P", "PRE", "SECTION", "TABLE", "TD", "TH", "TR", "UL",
]);

// Ids are only valid for the snapshot that created them.
let registry = new Map<string, WeakRef<Element>>();

export function elementFor(id: string): Element | null {
  const element = registry.get(id)?.deref();
  return element?.isConnected ? element : null;
}

function tidy(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
}

function isEditor(element: Element): boolean {
  return element instanceof HTMLElement && element.isContentEditable;
}

function isField(element: Element): boolean {
  if (element instanceof HTMLInputElement) return !BUTTON_INPUT_TYPES.has(element.type);
  return (
    element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement || isEditor(element)
  );
}

// Whether a box is ticked is needed to use it, and unlike typed text is not private.
function checkedState(element: Element): string {
  const role = element.getAttribute("role");
  let checked: boolean;
  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
    checked = element.checked;
  } else if (role === "checkbox" || role === "radio" || role === "switch") {
    checked = element.getAttribute("aria-checked") === "true";
  } else {
    return "";
  }
  return checked ? " (checked)" : " (not checked)";
}

function labelOf(element: Element): string {
  const aria = tidy(element.getAttribute("aria-label"));
  if (aria) return aria;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = tidy(
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" "),
    );
    if (text) return text;
  }

  // Never the editor's text: a draft the user is writing is private.
  if (isEditor(element)) {
    return (
      tidy(element.getAttribute("aria-placeholder")) ||
      tidy(element.getAttribute("data-placeholder")) ||
      tidy(element.getAttribute("title")) ||
      "Text box"
    );
  }

  if (isField(element)) {
    const field = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    // Never the field's value: what the user typed is private.
    return (
      tidy(field.labels?.[0]?.innerText) ||
      tidy(field.getAttribute("placeholder")) ||
      tidy(field.getAttribute("title")) ||
      tidy(field.getAttribute("name"))
    );
  }
  if (element instanceof HTMLInputElement) {
    return tidy(element.value) || tidy(element.alt) || tidy(element.title);
  }

  return (
    tidy((element as HTMLElement).innerText) ||
    tidy(element.querySelector("img[alt]")?.getAttribute("alt")) ||
    tidy(element.getAttribute("title"))
  );
}

function regionOf(rect: DOMRect): string {
  if (rect.bottom <= 0) return "above the visible area";
  if (rect.top >= window.innerHeight) return "below the visible area";
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  const vertical = y < 1 / 3 ? "top" : y < 2 / 3 ? "middle" : "bottom";
  const horizontal = x < 1 / 3 ? "left" : x < 2 / 3 ? "center" : "right";
  return `${vertical} ${horizontal}`;
}

function isRendered(element: Element): boolean {
  if (element.checkVisibility({ checkVisibilityCSS: true })) return true;
  // "display: contents" wrappers have no box of their own, so checkVisibility says
  // false, but their children are on the page.
  return getComputedStyle(element).display === "contents";
}

function collectControls(): Map<Element, PageElement> {
  const onScreen: { element: Element; item: Omit<PageElement, "id"> }[] = [];
  const offScreen: typeof onScreen = [];

  for (const element of document.querySelectorAll(CONTROLS)) {
    if (element instanceof HTMLButtonElement && element.disabled) continue;
    if (element.getAttribute("aria-disabled") === "true") continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const name = labelOf(element);
    if (!name) continue;
    const label = name + checkedState(element);

    const kind: PageElement["kind"] = isField(element)
      ? "field"
      : element instanceof HTMLAnchorElement
        ? "link"
        : "button";
    const region = regionOf(rect);
    (region.includes("visible area") ? offScreen : onScreen).push({
      element,
      item: { kind, label, region },
    });
  }

  // If the page has more controls than the limit, what the user can see wins.
  const controls = new Map<Element, PageElement>();
  [...onScreen, ...offScreen].slice(0, MAX_ELEMENTS).forEach(({ element, item }, index) => {
    controls.set(element, { id: `m${index + 1}`, ...item });
  });
  return controls;
}

// Walks the page in reading order and writes one line per block of text, with
// each known control marked in place so the text around it says what it is for.
function readContent(controls: Map<Element, PageElement>): string {
  const lines: string[] = [];
  let pending = "";
  let size = 0;
  let full = false;

  const flush = (): void => {
    const text = pending.replace(/\s+/g, " ").trim();
    pending = "";
    if (!text || full) return;
    if (size + text.length > MAX_CONTENT_CHARS) {
      full = true;
      return;
    }
    lines.push(text);
    size += text.length + 1;
  };

  const visit = (node: Node): void => {
    if (full) return;
    if (node.nodeType === Node.TEXT_NODE) {
      pending += node.nodeValue ?? "";
      return;
    }
    if (!(node instanceof Element)) return;

    const control = controls.get(node);
    if (control) {
      pending += ` [${control.id} ${control.kind}: ${control.label}] `;
      return;
    }

    const tag = node.tagName.toUpperCase();
    if (SKIPPED_TAGS.has(tag)) return;
    if (node.hasAttribute("data-mack-root") || node.getAttribute("aria-hidden") === "true") return;
    // Drafts the user is writing (an email, a comment) are private, like field values.
    if (node instanceof HTMLElement && node.isContentEditable) return;
    if (!isRendered(node)) return;

    const heading = /^H[1-6]$/.test(tag);
    const block = heading || BLOCK_TAGS.has(tag);
    if (block) flush();
    if (heading) pending += `${"#".repeat(Number(tag[1]))} `;
    // An open shadow root holds what is actually displayed for that element.
    for (const child of (node.shadowRoot ?? node).childNodes) visit(child);
    if (block) flush();
  };

  if (document.body) visit(document.body);
  flush();
  if (full) lines.push("(The page continues; the rest was left out for length.)");
  return lines.join("\n");
}

export function extractPage(): PageSnapshot {
  const controls = collectControls();
  registry = new Map();
  for (const [element, item] of controls) registry.set(item.id, new WeakRef(element));

  const headings = [...document.querySelectorAll("h1, h2, h3")]
    .filter((heading) => heading.checkVisibility())
    .map((heading) => tidy(heading.textContent))
    .filter(Boolean)
    .slice(0, MAX_HEADINGS);

  return {
    url: location.href,
    title: tidy(document.title),
    headings,
    elements: [...controls.values()],
    content: readContent(controls),
  };
}
