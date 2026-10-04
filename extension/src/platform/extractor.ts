import type { PageSnapshot, SiteLogo, SourceAction } from "../../../shared/contracts";
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

type Rgb = [number, number, number];

function parseColor(value: string | null | undefined): { rgb: Rgb; alpha: number } | undefined {
  const v = (value ?? "").trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split("").map((c) => c + c).join("") : hex[1]!;
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb, alpha: 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (!fn) return undefined;
  const a = fn[4] === undefined ? 1 : fn[4].endsWith("%") ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
  return { rgb: [fn[1], fn[2], fn[3]].map((n) => Math.round(Number(n))) as Rgb, alpha: a };
}

// Grays, near-white and near-black say nothing about a brand.
function chroma([r, g, b]: Rgb): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

// Unstyled link colors are the browser's, not the site's.
const BROWSER_DEFAULTS = new Set(["#0000ee", "#0000ff", "#551a8b", "#ff0000"]);

const toHex = (rgb: Rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;

/** The site's brand color: its theme-color, else the dominant saturated color of its header, buttons and links. */
export function brandColor(): string | undefined {
  const meta = parseColor(document.querySelector('meta[name="theme-color"]')?.getAttribute("content"));
  if (meta && meta.alpha > 0.5 && chroma(meta.rgb) >= 0.25) return toHex(meta.rgb);
  const weights = new Map<string, number>();
  const add = (value: string, weight: number) => {
    const color = parseColor(value);
    if (!color || color.alpha < 0.5 || chroma(color.rgb) < 0.25) return;
    const key = toHex(color.rgb);
    if (BROWSER_DEFAULTS.has(key)) return;
    weights.set(key, (weights.get(key) ?? 0) + weight);
  };
  const candidates = document.body.querySelectorAll<HTMLElement>("header, nav, header *, nav *, button, [role=button], a[href]");
  let seen = 0;
  for (const element of candidates) {
    if (seen++ > 600) break;
    if (isMack(element) || !visible(element)) continue;
    const style = getComputedStyle(element);
    const inChrome = !!element.closest("header, nav");
    add(style.backgroundColor, inChrome || element.matches("button, [role=button]") ? 3 : 1);
    if (element.matches("a[href]")) add(style.color, 1);
  }
  let best: string | undefined;
  for (const [color, weight] of weights) if (!best || weight > weights.get(best)!) best = color;
  return best;
}

const LOGO_WORDS = /logo|brand/i;
const MAX_LOGO_BYTES = 150_000;
const SVG_PAINT = ["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "clip-rule"] as const;

function logoLabel(element: Element): string {
  for (let node: Element | null = element, depth = 0; node && depth < 4; node = node.parentElement, depth++) {
    const label = node.getAttribute("alt") || node.getAttribute("aria-label") || node.querySelector(":scope > title")?.textContent;
    if (label?.trim()) return clean(label.replace(/\s*logo\s*$/i, ""), 120);
  }
  return "";
}

function backgroundBehind(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const color = parseColor(getComputedStyle(node).backgroundColor);
    if (color && color.alpha >= 0.5) return toHex(color.rgb);
  }
  return "#ffffff";
}

function isHomeLink(anchor: HTMLAnchorElement | null): boolean {
  if (!anchor) return false;
  try {
    const url = new URL(anchor.getAttribute("href") ?? "", location.href);
    return url.origin === location.origin && (url.pathname === "/" || url.pathname === "");
  } catch { return false; }
}

// SVG shown through <img> never runs scripts or handlers, but it also loses page CSS, so computed paint is copied inline.
function svgDataUrl(svg: SVGSVGElement): string | undefined {
  const ids = new Set(Array.from(svg.querySelectorAll("[id]"), (el) => el.id));
  const external = Array.from(svg.querySelectorAll("use")).some((use) => {
    const ref = use.getAttribute("href") ?? use.getAttribute("xlink:href") ?? "";
    return !ref.startsWith("#") || !ids.has(ref.slice(1));
  });
  if (external) return undefined;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const copies = [clone, ...Array.from(clone.querySelectorAll("*"))];
  originals.forEach((original, i) => {
    const copy = copies[i];
    if (!copy) return;
    const style = getComputedStyle(original);
    for (const prop of SVG_PAINT) {
      const value = style.getPropertyValue(prop);
      if (value && value !== "normal") copy.setAttribute(prop, value === "currentcolor" || value === "currentColor" ? style.color : value);
    }
  });
  clone.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
  for (const el of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    for (const attr of Array.from(el.attributes)) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
  }
  // Logos are often sized by page CSS (width="0", padding tricks), which an image cannot see; use the rendered size.
  const box = svg.getBoundingClientRect();
  clone.setAttribute("width", String(Math.max(1, Math.round(box.width))));
  clone.setAttribute("height", String(Math.max(1, Math.round(box.height))));
  clone.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  return url.length <= MAX_LOGO_BYTES ? url : undefined;
}

/** The site's own logo from its header, so the simplified view still clearly belongs to that site. */
export function siteLogo(): SiteLogo | undefined {
  const candidates = document.body.querySelectorAll<HTMLElement | SVGSVGElement>("img, svg");
  let best: { element: HTMLImageElement | SVGSVGElement; score: number } | undefined;
  let seen = 0;
  for (const element of candidates) {
    if (seen++ > 400) break;
    if (isMack(element) || (element instanceof SVGSVGElement && element.parentElement?.closest("svg"))) continue;
    const box = element.getBoundingClientRect();
    if (box.top + scrollY > 220 || box.width < 16 || box.height < 12 || box.width > 420 || box.height > 160) continue;
    if (element instanceof HTMLElement && !visible(element)) continue;
    let score = 0;
    for (let node: Element | null = element, depth = 0; node && depth < 4; node = node.parentElement, depth++) {
      const words = `${node.getAttribute("alt") ?? ""} ${node.getAttribute("aria-label") ?? ""} ${node.getAttribute("class") ?? ""} ${node.id} ${node.querySelector(":scope > title")?.textContent ?? ""}`;
      if (LOGO_WORDS.test(words)) { score += 5; break; }
    }
    if (isHomeLink(element.closest("a"))) score += 4;
    if (element.closest("header, [role=banner], nav")) score += 2;
    if (box.left < 400) score += 1;
    if (score >= 5 && (!best || score > best.score)) best = { element: element as HTMLImageElement | SVGSVGElement, score };
  }
  if (!best) return undefined;
  const { element } = best;
  const alt = logoLabel(element) || clean(document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ?? location.hostname.replace(/^www\./, ""), 120);
  const background = backgroundBehind(element);
  if (element instanceof SVGSVGElement) {
    const src = svgDataUrl(element);
    return src ? { src, alt, background } : undefined;
  }
  const src = element.currentSrc || element.src;
  return /^https:\/\//.test(src) && src.length <= 2000 ? { src, alt, background } : undefined;
}
