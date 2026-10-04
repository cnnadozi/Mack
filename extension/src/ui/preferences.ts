import { STORAGE } from "../platform/messages";
import type { ThemeMode } from "./theme";

// The same setting as the dark-mode button in Mack's bar, so both always agree.
const THEME_KEY = STORAGE.theme;

export function systemTheme(): ThemeMode {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Kept in the extension's own storage, never in the website's localStorage.
function extensionStorage(): chrome.storage.StorageArea | undefined {
  return typeof chrome !== "undefined" ? chrome.storage?.local : undefined;
}

export async function loadTheme(): Promise<ThemeMode | undefined> {
  try {
    const value = (await extensionStorage()?.get(THEME_KEY))?.[THEME_KEY];
    return value === "dark" || value === "light" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function saveTheme(mode: ThemeMode): void {
  try {
    void extensionStorage()?.set({ [THEME_KEY]: mode });
  } catch {
    // A preference that can't be saved just won't persist.
  }
}

/** Calls back whenever the theme is changed anywhere (e.g. from Mack's bar). Returns a function that stops it. */
export function onThemeChange(callback: (mode: ThemeMode | undefined) => void): () => void {
  const events = typeof chrome !== "undefined" ? chrome.storage?.onChanged : undefined;
  if (!events) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== "local" || !changes[THEME_KEY]) return;
    const value = changes[THEME_KEY].newValue;
    callback(value === "dark" || value === "light" ? value : undefined);
  };
  events.addListener(listener);
  return () => events.removeListener(listener);
}
