// Remembers the model's design for a page, so coming back to that page (or going
// back and forward) shows its simple view at once instead of asking the model
// again. It is kept in sessionStorage: per tab, and gone when the tab closes.
//
// Action ids are only valid for one reading of the page: each is the reading's
// version plus the action's position. The request is compared, and the answer
// stored, with the version taken out, so a design is reused only when the page
// lists exactly the same actions in the same order, and its ids are then
// rewritten for the current reading.

const PREFIX = "mack-design:";
const KEEP_MS = 10 * 60_000;
const PLACEHOLDER = "#";

/** The version part shared by every action id in a design request's payload. */
function versionOf(payload: unknown): string | undefined {
  const page =
    (payload as { actions?: { id?: unknown }[]; page?: { searchFields?: { id?: unknown }[] } }) ??
    {};
  const id = page.actions?.[0]?.id ?? page.page?.searchFields?.[0]?.id;
  if (typeof id !== "string" || !id.includes(":")) return undefined;
  return id.slice(0, id.lastIndexOf(":"));
}

const swap = (json: string, from: string, to: string): string =>
  json.split(`"${from}:`).join(`"${to}:`);

// Short and fast; this only has to tell one request from another, not resist attack.
function hash(text: string): string {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1) {
    value = ((value << 5) + value + text.charCodeAt(index)) | 0;
  }
  return (value >>> 0).toString(36);
}

export interface DesignCache {
  /** The remembered answer to this request, with ids for the current page reading. */
  get(): unknown | undefined;
  set(result: unknown): void;
}

export function designCache(system: string, payload: unknown, now = Date.now): DesignCache {
  // A request with no action ids (the page's facts) has nothing to rewrite.
  const version = versionOf(payload);
  const out = (json: string): string => (version ? swap(json, version, PLACEHOLDER) : json);
  const back = (json: string): string => (version ? swap(json, PLACEHOLDER, version) : json);
  const key = PREFIX + hash(system + out(JSON.stringify(payload)));

  return {
    get() {
      try {
        const stored = JSON.parse(sessionStorage.getItem(key) ?? "null") as {
          at: number;
          result: string;
        } | null;
        if (!stored || now() - stored.at > KEEP_MS) return undefined;
        return JSON.parse(back(stored.result));
      } catch {
        return undefined;
      }
    },
    set(result) {
      try {
        const entry = { at: now(), result: out(JSON.stringify(result)) };
        sessionStorage.setItem(key, JSON.stringify(entry));
      } catch {
        // Storage is blocked or full on this site; the design is just not remembered.
      }
    },
  };
}
