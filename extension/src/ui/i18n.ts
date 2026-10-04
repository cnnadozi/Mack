import { useEffect, useState } from "react";
import { STORAGE } from "../platform/messages";
import { translator, type Translator } from "./i18n-text";

export { translator, type MessageKey, type Translator } from "./i18n-text";

/** The translator for the language chosen in Mack's settings; follows changes live. */
export function useTranslator(): Translator {
  const [language, setLanguage] = useState("");
  useEffect(() => {
    // Outside the extension (tests, previews) there is no chrome.storage, and English is used.
    const storage = typeof chrome !== "undefined" ? chrome.storage : undefined;
    if (!storage?.local) return;
    // A change can arrive before the first read finishes; the older read must not overwrite it.
    let changed = false;
    void storage.local.get(STORAGE.language).then((stored) => {
      if (!changed) setLanguage(String(stored[STORAGE.language] ?? ""));
    });
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== "local" || !changes[STORAGE.language]) return;
      changed = true;
      setLanguage(String(changes[STORAGE.language].newValue ?? ""));
    };
    storage.onChanged.addListener(onChanged);
    return () => storage.onChanged.removeListener(onChanged);
  }, []);
  return translator(language);
}
