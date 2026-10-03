import type { PageSnapshot, SourceAction } from "../../../shared/contracts";

export const MACK_SELECTOR = "mack-root[data-mack], [data-mack-platform]";
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

export function sanitizedUrl(value: string): string | undefined {
  try {
    const url = new URL(value, location.href);
    if (!["https:", "http:"].includes(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`;
  } catch { return undefined; }
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
  return result.replace(/\s+/g, " ").trim().slice(0, limit);
}

function labelFor(element: HTMLElement): string {
  const aria = element.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim().slice(0, 160);
  const labelledBy = element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  if (labelledBy?.length) return labelledBy.map((el) => safeText(el, 160)).join(" ").slice(0, 160);
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return Array.from(element.labels ?? []).map((label) => safeText(label, 160)).join(" ").slice(0, 160);
  }
  return safeText(element, 160) || element.getAttribute("title")?.trim().slice(0, 160) || "";
}

export function sourceKind(element: HTMLElement): SourceAction["kind"] {
  if (element instanceof HTMLAnchorElement) return "navigate";
  if (element instanceof HTMLButtonElement && element.type === "submit" && element.form) return "submit";
  if (element instanceof HTMLInputElement && ["submit", "image"].includes(element.type)) return "submit";
  if (element.matches("input:not([type=button]), textarea, select, [contenteditable]")) return "field";
  return "button";
}

export type Extraction = { snapshot: PageSnapshot; registry: Map<string, HTMLElement> };
export function extractPage(): Extraction {
  const version = crypto.randomUUID();
  const registry = new Map<string, HTMLElement>();
  const actions: SourceAction[] = [];
  for (const element of document.body.querySelectorAll<HTMLElement>("a[href], button, input, textarea, select, [role=button], [contenteditable]")) {
    if (isMack(element) || !visible(element) || element.matches("input[type=hidden], input[type=password]")) continue;
    const label = labelFor(element);
    if (!label) continue;
    const kind = sourceKind(element);
    const href = element instanceof HTMLAnchorElement ? sanitizedUrl(element.href) : undefined;
    if (kind === "navigate" && !href) continue;
    const id = `${version}:${actions.length}`;
    const region = element.closest("section, nav, article, fieldset");
    const heading = region?.querySelector("h1,h2,h3,legend");
    actions.push({ id, label, kind, context: heading ? safeText(heading, 200) : "", disabled: disabled(element), ...(href ? { href } : {}) });
    registry.set(id, element);
    if (actions.length >= 200) break;
  }
  return {
    snapshot: {
      version, pageUrl: sanitizedUrl(location.href)!, title: document.title.slice(0, 200),
      headings: Array.from(document.body.querySelectorAll<HTMLElement>("h1,h2,h3")).filter((el) => !isMack(el) && visible(el)).map((el) => safeText(el, 200)).filter(Boolean).slice(0, 30),
      context: safeText(document.body, 3000), actions,
    },
    registry,
  };
}

export function liveTarget(extraction: Extraction, id: string): HTMLElement {
  const source = extraction.snapshot.actions.find((action) => action.id === id);
  const element = extraction.registry.get(id);
  if (!source || !element || !visible(element) || disabled(element) || isMack(element)) throw new Error("That action is no longer available. Refresh Mack and try again.");
  if (source.kind !== sourceKind(element) || labelFor(element) !== source.label) throw new Error("That action has changed. Refresh Mack and try again.");
  if (element instanceof HTMLAnchorElement && sanitizedUrl(element.href) !== source.href) throw new Error("That link has changed. Refresh Mack and try again.");
  return element;
}
