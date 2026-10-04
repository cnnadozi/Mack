// Light or dark, for Mack's bar and the simple view. Each lives in its own shadow
// root; the theme is an attribute on the root's host element, which the shared
// stylesheet (ui/mount.tsx) turns into shadcn/ui's colour tokens.

import { STORAGE } from "../messages";

export type Theme = "light" | "dark";

/** The stored choice, or the system's setting until the user has made one. */
export function resolveTheme(stored: unknown): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Keeps the host's theme in step with the setting. Returns a function that stops it. */
export function followTheme(host: Element): () => void {
  const apply = (stored: unknown): void => host.setAttribute("data-theme", resolveTheme(stored));
  apply(undefined);
  void chrome.storage.local.get(STORAGE.theme).then((stored) => apply(stored[STORAGE.theme]));
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === "local" && changes[STORAGE.theme]) apply(changes[STORAGE.theme].newValue);
  };
  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
