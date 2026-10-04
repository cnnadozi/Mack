import type { ThemeMode } from "./theme";

const THEME_KEY = "mackTheme";

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
