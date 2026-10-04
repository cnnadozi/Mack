import { useCallback, useEffect, useState } from "react";

// A value in chrome.storage.local that stays in sync across the popup, the
// background worker and content scripts.
export function useStored<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    void chrome.storage.local.get(key).then((stored) => {
      if (stored[key] !== undefined) setValue(stored[key] as T);
    });
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area === "local" && changes[key]) {
        setValue((changes[key].newValue as T | undefined) ?? fallback);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
    // The fallback is a constant for each caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      void chrome.storage.local.set({ [key]: next });
    },
    [key],
  );

  return [value, update];
}
