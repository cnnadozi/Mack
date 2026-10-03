export const KEY_STORAGE = "geminiKey";
export const MODEL_STORAGE = "geminiModel";
export const DEFAULT_MODEL = "gemini-3.8-flash";
export const GOAL_TTL_MS = 15 * 60_000;

// Each entry is one site; its subdomains are treated as the same site. Must match manifest host_permissions.
export const SITES = ["uhc.com", "libertymutual.com", "www.gov.uk"] as const;

export function siteOf(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:") return undefined;
    return SITES.find((site) => url.hostname === site || url.hostname.endsWith(`.${site}`));
  } catch { return undefined; }
}

export const supportedUrl = (value: string | undefined): boolean => siteOf(value) !== undefined;

export function sameSite(a: string | undefined, b: string | undefined): boolean {
  const site = siteOf(a);
  return site !== undefined && site === siteOf(b);
}

// Opening these could change something or only fetch a file, so they are never peeked or deep-linked.
export const UNSAFE_LINK = /log ?out|sign ?out|unsubscribe|delete|remove|cancel|cart|checkout|print|download|\.(pdf|zip|docx?|xlsx?|pptx?)(\?|#|$)/i;

export async function trustedSession(): Promise<void> {
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export const tabKey = (id: number) => `mack-tab:${id}`;
// leftAt: when the tab went to an unsupported site (e.g. a third-party sign-in), so the session survives the hop.
export type TabSession = { active: boolean; goal?: string; goalAt?: number; leftAt?: number };

export async function readStored(id: number): Promise<TabSession | undefined> {
  return (await chrome.storage.session.get(tabKey(id)))[tabKey(id)] as TabSession | undefined;
}

export async function readTab(id: number, now = Date.now()): Promise<{ active: boolean; goal?: string }> {
  const stored = await readStored(id);
  if (stored?.active !== true) return { active: false };
  const fresh = typeof stored.goal === "string" && typeof stored.goalAt === "number" && now - stored.goalAt < GOAL_TTL_MS;
  return { active: true, ...(fresh ? { goal: stored.goal } : {}) };
}
