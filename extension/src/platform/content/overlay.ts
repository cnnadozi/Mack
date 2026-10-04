// What Mack draws on the website. This file holds the part that must be cheap on
// every page: the shadow root (so the site's CSS cannot restyle Mack and Mack's
// cannot leak into the site) and the highlight ring around the element Mack is
// pointing at. The bar itself is React and shadcn/ui (panel.tsx), downloaded the
// first time Mack is on.

import { debug } from "../debug";
import { IDLE_SESSION, STORAGE, type MackSession } from "../messages";
import { translator } from "../../ui/i18n-text";
import { elementFor } from "./extract";

const HIGHLIGHT_SECONDS = 30;

// Bright yellow with a black edge reads on light and dark pages alike; the rest of the
// page is dimmed a little and a tag says what to do, so the target is impossible to miss.
const STYLES = `
.ring {
  position: fixed; z-index: 2147483647; display: none; box-sizing: border-box; pointer-events: none;
  border: 5px solid #ffd60a; border-radius: 12px;
  box-shadow: 0 0 0 3px #111111, 0 0 28px 10px rgba(255, 214, 10, 0.85), 0 0 0 9999px rgba(0, 0, 0, 0.35);
  animation: mack-ring 1.2s ease-in-out infinite;
}
@keyframes mack-ring {
  50% { box-shadow: 0 0 0 3px #111111, 0 0 44px 18px rgba(255, 214, 10, 1), 0 0 0 9999px rgba(0, 0, 0, 0.35); }
}
.tag {
  position: fixed; z-index: 2147483647; display: none; pointer-events: none;
  padding: 8px 16px; border-radius: 999px; border: 3px solid #111111;
  background: #ffd60a; color: #111111;
  font: 800 20px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35); white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
@media (forced-colors: active) { .ring { border-color: Highlight; } .tag { forced-color-adjust: none; } }
`;

// Puts Mack in the browser's top layer: above anything the site shows (sticky headers,
// banners, chat widgets, however high their z-index) and unaffected by the site's
// transforms, so the bar stays where it is while the page scrolls.
function raise(host: HTMLElement): void {
  if (typeof host.showPopover !== "function") return;
  try {
    if (host.matches(":popover-open")) host.hidePopover();
    host.showPopover();
  } catch (error) {
    debug("content", "could not lift Mack into the top layer", error);
  }
}

let language = "";

let shadow: ShadowRoot | null = null;
let ring: HTMLElement | null = null;
let tag: HTMLElement | null = null;
let target: Element | null = null;
let highlightTimer = 0;
let ringAllowed = true;
let panelRequested = false;

// Built on first use so pages where Mack is never used get no extra DOM.
function mount(): ShadowRoot {
  if (shadow) return shadow;
  // Left behind by an earlier version of the extension that was reloaded while
  // this page was open; its script is dead, so its bar would sit there frozen.
  for (const stale of document.querySelectorAll("[data-mack-root], mack-root")) stale.remove();
  const host = document.createElement("div");
  host.setAttribute("data-mack-root", "");
  // Role 4's extractor and page observer skip anything carrying this attribute.
  host.setAttribute("data-mack-platform", "");
  host.setAttribute("popover", "manual");
  // A see-through, click-through layer over the whole window; only Mack's own pieces take clicks.
  host.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;pointer-events:none;color:inherit;";
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  ring = document.createElement("div");
  ring.className = "ring";
  ring.setAttribute("aria-hidden", "true");
  tag = document.createElement("div");
  tag.className = "tag";
  tag.setAttribute("aria-hidden", "true");
  shadow.append(style, ring, tag);
  document.documentElement.appendChild(host);
  raise(host);
  // Some pages rebuild the document while they load (document.write, frameworks
  // that replace <html>'s children), which throws the host away with the rest.
  // Without this Mack would be running but invisible.
  let watched: Element | null = null;
  const keepAttached = new MutationObserver(() => {
    const root = document.documentElement;
    if (!root) return;
    if (!host.isConnected) {
      root.appendChild(host);
      raise(host);
    }
    // A rebuilt page has a new <html>, whose children need watching in turn.
    if (root !== watched) {
      watched = root;
      keepAttached.observe(root, { childList: true });
    }
  });
  keepAttached.observe(document, { childList: true });
  watched = document.documentElement;
  keepAttached.observe(watched, { childList: true });
  return shadow;
}

function trackTarget(): void {
  if (!ring || !target) return;
  if (!target.isConnected) {
    highlight(null);
    return;
  }
  const rect = target.getBoundingClientRect();
  ring.style.left = `${rect.left - 8}px`;
  ring.style.top = `${rect.top - 8}px`;
  ring.style.width = `${rect.width + 16}px`;
  ring.style.height = `${rect.height + 16}px`;
  if (tag) {
    // Above the target, or below it when there is no room at the top of the window.
    const above = rect.top - 8 - tag.offsetHeight - 12;
    tag.style.top = `${above >= 8 ? above : rect.bottom + 20}px`;
    tag.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - tag.offsetWidth / 2, 8), window.innerWidth - tag.offsetWidth - 8)}px`;
  }
  requestAnimationFrame(trackTarget);
}

/** The ring is switched off while Role 4's simple view covers the page it points at. */
export function setRingAllowed(allowed: boolean): void {
  ringAllowed = allowed;
  if (!allowed) highlight(null);
}

export function highlight(elementId: string | null): void {
  window.clearTimeout(highlightTimer);
  target = elementId && ringAllowed ? elementFor(elementId) : null;
  if (!target) {
    // An id is only valid for the snapshot that created it, and the element may have left the page.
    if (elementId && ringAllowed) {
      debug("content", `highlight: no element on the page for "${elementId}"`);
    }
    if (ring) ring.style.display = "none";
    if (tag) tag.style.display = "none";
    return;
  }
  debug("content", `highlight: pointing at "${elementId}"`, target);
  mount();
  if (!ring) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  ring.style.display = "block";
  if (tag) {
    tag.textContent = `👆 ${translator(language).t("clickHere")}`;
    tag.style.display = "block";
  }
  trackTarget();
  highlightTimer = window.setTimeout(() => highlight(null), HIGHLIGHT_SECONDS * 1000);
}

async function showPanel(): Promise<void> {
  if (panelRequested) return;
  panelRequested = true;
  try {
    const { mountPanel } = await import("./panel");
    mountPanel(mount());
  } catch (error) {
    panelRequested = false;
    debug("content", "could not load Mack's bar", error);
  }
}

export async function initOverlay(): Promise<void> {
  const isOn = (value: unknown): boolean =>
    ((value as MackSession | undefined) ?? IDLE_SESSION).active;
  const stored = await chrome.storage.local.get([STORAGE.session, STORAGE.language]);
  language = String(stored[STORAGE.language] ?? "");
  if (isOn(stored[STORAGE.session])) void showPanel();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE.language]) language = String(changes[STORAGE.language].newValue ?? "");
    if (area !== "local" || !changes[STORAGE.session]) return;
    const session = (changes[STORAGE.session].newValue as MackSession | undefined) ?? IDLE_SESSION;
    debug("content", "session changed:", session);
    // Once loaded, the bar follows the session by itself.
    if (session.active) void showPanel();
    else highlight(null);
  });
}
