export const KEY_STORAGE = "anthropicKey";
export const MODEL = "claude-sonnet-5-5";
export const SITE_ORIGIN = "https://www.gov.uk";

export function supportedUrl(value: string | undefined): boolean {
  try { return new URL(value ?? "").origin === SITE_ORIGIN; } catch { return false; }
}

export async function trustedSession(): Promise<void> {
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export const tabKey = (id: number) => `mack-tab:${id}`;
export type TabSession = { active: boolean; goal?: string };

export async function readTab(id: number): Promise<TabSession> {
  const stored = (await chrome.storage.session.get(tabKey(id)))[tabKey(id)] as unknown;
  if (typeof stored !== "object" || stored === null || !("active" in stored) || stored.active !== true) return { active: false };
  return { active: true, goal: "goal" in stored && typeof stored.goal === "string" ? stored.goal : undefined };
}
