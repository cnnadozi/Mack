// Debug logging shared by every extension context. Each context has its own
// console, so the scope prefix says where a line came from:
//   background  chrome://extensions > Mack > "service worker"
//   offscreen   chrome://extensions > Mack > "offscreen.html" (only while talking)
//   content     the website's own DevTools console
//   popup       right-click the popup > Inspect
//
// Never pass an API key, base64 audio or screenshot data, or a form field's value:
// log sizes and counts instead.

const ENABLED = true;

export type DebugScope = "background" | "offscreen" | "gemini" | "content" | "popup" | "permission";

export function debug(scope: DebugScope, message: string, ...details: unknown[]): void {
  if (!ENABLED) return;
  console.log(`[Mack:${scope}] ${message}`, ...details);
}

/** Milliseconds since `start` (a performance.now() value), for timing slow steps. */
export function since(start: number): string {
  return `${Math.round(performance.now() - start)}ms`;
}
