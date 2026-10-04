import type { PageSnapshot, SourceAction } from "../../../shared/contracts";
import { sameSite, UNSAFE_LINK } from "./settings";

export const MACK_SELECTOR = "mack-root[data-mack], [data-mack-platform]";
export const MAX_ACTIONS = 400;
const excluded = `${MACK_SELECTOR}, input, textarea, select, script, style, noscript, [contenteditable]`;

export function isMack(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return !!element?.closest(MACK_SELECTOR);
}

export function visible(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest("[hidden], [aria-hidden='true']")) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  }
  return element.getClientRects().length > 0;
}

export function disabled(element: HTMLElement): boolean {
  return element.matches(":disabled") || !!element.closest("[aria-disabled='true']");
}

export function sanitizedUrl(value: string, base = location.href): string | undefined {
  try {
    const url = new URL(value, base);
    if (!["https:", "http:"].includes(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`;
  } catch { return undefined; }
}

export function clean(value: string | null | undefined, limit = 160): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function safeText(element: Element, limit = 500): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.parentElement?.closest(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  let result = "";
  while (result.length < limit * 2 && walker.nextNode()) {
    const parent = walker.currentNode.parentElement;
    if (parent instanceof HTMLElement && visible(parent)) result += ` ${walker.currentNode.textContent ?? ""}`;
  }
  return clean(result, limit);
}

// For hidden or fetched links, where visibility can't be checked: join text nodes with spaces and drop icon-font words.
export function linkText(anchor: Element): string {
  const label = clean(anchor.getAttribute("aria-label"));
  if (label) return label;
  const doc = anchor.ownerDocument;
  const walker = doc.createTreeWalker(anchor, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.parentElement?.closest("[aria-hidden='true'], .material-icons, .material-symbols-outlined, script, style, svg")
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? "");
  return clean(parts.join(" ")) || clean(anchor.getAttribute("title"));
}

function isField(element: HTMLElement): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

function labelFor(element: HTMLElement): string {
  const aria = clean(element.getAttribute("aria-label"));
  if (aria) return aria;
  const labelledBy = element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  if (labelledBy?.length) return clean(labelledBy.map((el) => safeText(el, 160)).join(" "));
  if (isField(element)) {
    const label = clean(Array.from(element.labels ?? []).map((l) => safeText(l, 160)).join(" "))
      || clean(element.getAttribute("placeholder")) || clean(element.getAttribute("name"));
    if (label) return label;
    if (element instanceof HTMLInputElement && element.type === "password") return "Password";
    if (element instanceof HTMLInputElement && element.type === "email") return "Email";
    return "";
  }
  // Button inputs show their value as the label; it is not user-entered data.
  if (element instanceof HTMLInputElement) return clean(element.value) || clean(element.getAttribute("alt"));
  return safeText(element, 160) || clean(element.getAttribute("title"));
}

export function sourceKind(element: HTMLElement): SourceAction["kind"] {
  if (element instanceof HTMLAnchorElement) return "navigate";
  if (element instanceof HTMLButtonElement && element.type === "submit" && element.form) return "submit";
  if (element instanceof HTMLInputElement && ["submit", "image"].includes(element.type)) return "submit";
  if (element instanceof HTMLInputElement && element.type === "button") return "button";
  if (element.matches("input, textarea, select, [contenteditable]")) return "field";
  return "button";
}

function regionContext(element: HTMLElement): string {
  const region = element.closest("section, nav, article, fieldset, form, header, footer, aside, main");
  const heading = region?.querySelector("h1,h2,h3,legend");
  return heading ? safeText(heading, 200) : "";
}

function contextFor(element: HTMLElement, kind: SourceAction["kind"]): string {
  let prefix = "";
  if (kind === "field") prefix = `${element instanceof HTMLInputElement ? element.type : isField(element) ? element.type : "text"} field; `;
  else if (kind === "button" && ["aria-expanded", "aria-haspopup", "aria-controls"].some((a) => element.hasAttribute(a))) prefix = "opens menu; ";
  // Role 3's prompt matches these prefixes exactly, including the trailing space.
  return `${prefix}${regionContext(element)}`.slice(0, 200);
}

function menuName(element: HTMLElement): string {
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.id) {
      const id = node.id;
      const trigger = Array.from(document.querySelectorAll("[aria-controls]")).find((el) => el.getAttribute("aria-controls")!.split(/\s+/).includes(id));
      const name = clean(trigger?.getAttribute("aria-label") || trigger?.textContent, 40);
      if (name) return name;
    }
    const labelled = clean(node.getAttribute("aria-label"), 40);
    if (labelled) return labelled;
  }
  return "site menu";
}

export type Extraction = {
  snapshot: PageSnapshot;
  registry: Map<string, HTMLElement>;
  // Full URLs stay local; the snapshot only carries origin + path.
  hrefs: Map<string, string>;
  // Hidden-menu and peeked actions open their extracted href instead of clicking.
  deep: Set<string>;
  fingerprint: string;
};

export function fingerprintOf(snapshot: PageSnapshot): string {
  return JSON.stringify([snapshot.title, snapshot.headings, snapshot.actions.map((a) => [a.label, a.kind, a.disabled, a.href ?? "", a.context])]);
}

export function extractPage(): Extraction {
  const version = crypto.randomUUID();
  const registry = new Map<string, HTMLElement>();
  const hrefs = new Map<string, string>();
  const deep = new Set<string>();
  const actions: SourceAction[] = [];
  const here = sanitizedUrl(location.href)!;
  for (const element of document.body.querySelectorAll<HTMLElement>("a[href], button, input, textarea, select, [role=button], [role=link], [contenteditable]")) {
    if (actions.length >= MAX_ACTIONS) break;
    if (isMack(element) || element.matches("input[type=hidden]")) continue;
    const id = `${version}:${actions.length}`;
    if (!visible(element)) {
      if (!(element instanceof HTMLAnchorElement)) continue;
      const href = sanitizedUrl(element.href);
      const label = linkText(element);
      if (!href || !label || href === here || !sameSite(element.href, location.href) || UNSAFE_LINK.test(`${label} ${element.href}`)) continue;
      actions.push({ id, label, kind: "navigate", context: clean(`menu: ${menuName(element)}`, 200), disabled: false, href });
      hrefs.set(id, element.href); deep.add(id); registry.set(id, element);
      continue;
    }
    const label = labelFor(element);
    if (!label) continue;
    const kind = sourceKind(element);
    const href = element instanceof HTMLAnchorElement ? sanitizedUrl(element.href) : undefined;
    if (kind === "navigate" && !href) continue;
    actions.push({ id, label, kind, context: contextFor(element, kind), disabled: disabled(element), ...(href ? { href } : {}) });
    registry.set(id, element);
    if (element instanceof HTMLAnchorElement) hrefs.set(id, element.href);
  }
  const snapshot: PageSnapshot = {
    version, pageUrl: here, title: document.title.slice(0, 200),
    headings: Array.from(document.body.querySelectorAll<HTMLElement>("h1,h2,h3")).filter((el) => !isMack(el) && visible(el)).map((el) => safeText(el, 200)).filter(Boolean).slice(0, 30),
    context: safeText(document.body, 3000), actions,
  };
  return { snapshot, registry, hrefs, deep, fingerprint: fingerprintOf(snapshot) };
}

export function liveTarget(extraction: Extraction, id: string): HTMLElement {
  const source = extraction.snapshot.actions.find((action) => action.id === id);
  const element = extraction.registry.get(id);
  if (!source || !element || extraction.deep.has(id) || !visible(element) || disabled(element) || isMack(element)) throw new Error("That action is no longer available. Refresh Mack and try again.");
  if (source.kind !== sourceKind(element) || labelFor(element) !== source.label) throw new Error("That action has changed. Refresh Mack and try again.");
  if (element instanceof HTMLAnchorElement && sanitizedUrl(element.href) !== source.href) throw new Error("That link has changed. Refresh Mack and try again.");
  return element;
}

// Re-validated just before navigating: same site, http(s), not an unsafe link, and still the extracted address.
export function deepLink(extraction: Extraction, id: string): string {
  const href = extraction.hrefs.get(id);
  const source = extraction.snapshot.actions.find((action) => action.id === id);
  if (!href || !source || !extraction.deep.has(id) || !sameSite(href, location.href) || UNSAFE_LINK.test(`${source.label} ${href}`) || sanitizedUrl(href) !== source.href) {
    throw new Error("Mack can't open that link safely. Refresh Mack and try again.");
  }
  return href;
}
