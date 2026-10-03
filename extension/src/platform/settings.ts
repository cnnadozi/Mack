export const KEY_STORAGE = "geminiKey";
export const MODEL_STORAGE = "geminiModel";
export const DEFAULT_MODEL = "gemini-3.8-flash";
export const GOAL_TTL_MS = 15 * 60_000;

function httpsUrl(value: string | undefined): URL | undefined {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url : undefined;
  } catch { return undefined; }
}

// Chrome refuses script injection on the Web Store.
export function supportedUrl(value: string | undefined): boolean {
  const url = httpsUrl(value);
  if (!url) return false;
  if (url.hostname === "chromewebstore.google.com") return false;
  return !(url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore"));
}

const SUFFIX_PARTS = new Set(["co", "com", "gov", "ac", "org", "net", "edu"]);

// Approximates the public suffix list without bundling it: "x.co.uk" and "www.gov.uk" are their own sites.
export function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const [second, last] = labels.slice(-2) as [string, string];
  const take = SUFFIX_PARTS.has(second) && /^[a-z]{2}$/.test(last) ? 3 : 2;
  return labels.slice(-take).join(".");
}

export function sameSite(a: string | undefined, b: string | undefined): boolean {
  const left = httpsUrl(a);
  const right = httpsUrl(b);
  return !!left && !!right && registrableDomain(left.hostname) === registrableDomain(right.hostname);
}

// Opening these could change something or only fetch a file, so they are never peeked or deep-linked.
export const UNSAFE_LINK = /log ?out|sign ?out|unsubscribe|delete|remove|cancel|cart|checkout|print|download|\.(pdf|zip|docx?|xlsx?|pptx?)(\?|#|$)/i;

export async function trustedSession(): Promise<void> {
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export const tabKey = (id: number) => `mack-tab:${id}`;
// leftAt: when the tab went to a page Mack can't run on (http, chrome://, Web Store), so the session survives a short hop.
export type TabSession = { active: boolean; goal?: string; goalAt?: number; goalFrom?: string; leftAt?: number };

export async function readStored(id: number): Promise<TabSession | undefined> {
  return (await chrome.storage.session.get(tabKey(id)))[tabKey(id)] as TabSession | undefined;
}

export async function readTab(id: number, now = Date.now()): Promise<{ active: boolean; goal?: string; goalFrom?: string }> {
  const stored = await readStored(id);
  if (stored?.active !== true) return { active: false };
  const fresh = typeof stored.goal === "string" && typeof stored.goalAt === "number" && now - stored.goalAt < GOAL_TTL_MS;
  return { active: true, ...(fresh ? { goal: stored.goal, ...(typeof stored.goalFrom === "string" ? { goalFrom: stored.goalFrom } : {}) } : {}) };
}
