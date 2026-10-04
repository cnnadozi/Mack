// What Mack draws on the website. This file holds the part that must be cheap on
// every page: the shadow root (so the site's CSS cannot restyle Mack and Mack's
// cannot leak into the site) and the highlight ring around the element Mack is
// pointing at. The bar itself is React and shadcn/ui (panel.tsx), downloaded the
// first time Mack is on.

import { debug } from "../debug";
import { IDLE_SESSION, STORAGE, type MackSession } from "../messages";
import { elementFor } from "./extract";

const HIGHLIGHT_SECONDS = 30;

// Dark with a white edge, so the ring stands out on light and dark pages alike.
const STYLES = `
.ring {
  position: fixed; z-index: 2147483647; display: none; box-sizing: border-box; pointer-events: none;
  border: 3px solid #18181b; border-radius: 10px;
  box-shadow: 0 0 0 3px #ffffff, 0 0 0 6px rgba(24, 24, 27, 0.3);
  animation: mack-ring 1.4s ease-in-out infinite;
}
@keyframes mack-ring {
  50% { box-shadow: 0 0 0 3px #ffffff, 0 0 0 12px rgba(24, 24, 27, 0.1); }
}
@media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
`;

let shadow: ShadowRoot | null = null;
let ring: HTMLElement | null = null;
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
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  ring = document.createElement("div");
  ring.className = "ring";
  ring.setAttribute("aria-hidden", "true");
  shadow.append(style, ring);
  document.documentElement.appendChild(host);
  // Some pages rebuild the document while they load (document.write, frameworks
  // that replace <html>'s children), which throws the host away with the rest.
  // Without this Mack would be running but invisible.
  let watched: Element | null = null;
  const keepAttached = new MutationObserver(() => {
    const root = document.documentElement;
    if (!root) return;
    if (!host.isConnected) root.appendChild(host);
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
    return;
  }
  debug("content", `highlight: pointing at "${elementId}"`, target);
  mount();
  if (!ring) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  ring.style.display = "block";
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
  const stored = await chrome.storage.local.get(STORAGE.session);
  if (isOn(stored[STORAGE.session])) void showPanel();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE.session]) return;
    const session = (changes[STORAGE.session].newValue as MackSession | undefined) ?? IDLE_SESSION;
    debug("content", "session changed:", session);
    // Once loaded, the bar follows the session by itself.
    if (session.active) void showPanel();
    else highlight(null);
  });
}
