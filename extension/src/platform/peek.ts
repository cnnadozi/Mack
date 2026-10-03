import { clean, linkText, MAX_ACTIONS, sanitizedUrl, type Extraction } from "./extractor";
import { sameSite, UNSAFE_LINK } from "./settings";

export const MAX_PEEK_PAGES = 8;
const MAX_LINKS_PER_PAGE = 30;
const HUB = /member|account|customer|support|help|service|resource|manage|claim|bill|pay|pharm|prescri|benefit|find|tool|portal|my |coverage|order|track/i;
const LOW_VALUE = /news|article|blog|career|job|investor|press|about us|stor(y|ies)|award|reward|promo|offer|sweepstake|podcast|video/i;

export type PeekPage = { url: string; finalUrl: string; html: string };
export type Peek = (urls: string[]) => Promise<PeekPage[]>;
type Candidate = { url: string; label: string };

export function hasPasswordField(extraction: Extraction): boolean {
  return extraction.snapshot.actions.some((a) => a.kind === "field" && a.context.startsWith("password field"));
}

export function peekCandidates(extraction: Extraction): Candidate[] {
  const seen = new Set([extraction.snapshot.pageUrl]);
  const scored: (Candidate & { score: number })[] = [];
  for (const action of extraction.snapshot.actions) {
    const raw = extraction.hrefs.get(action.id);
    if (action.kind !== "navigate" || !raw || !action.href || seen.has(action.href)) continue;
    if (!sameSite(raw, location.href) || UNSAFE_LINK.test(`${action.label} ${raw}`)) continue;
    seen.add(action.href);
    const inMenu = action.context.startsWith("menu:") || !!extraction.registry.get(action.id)?.closest("nav, header, [role=navigation]");
    const score = (inMenu ? 2 : 0) + (HUB.test(action.label) ? 3 : 0) - (LOW_VALUE.test(`${action.label} ${raw}`) ? 3 : 0);
    scored.push({ url: raw, label: action.label, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, MAX_PEEK_PAGES).map(({ url, label }) => ({ url, label }));
}

// Adds only link labels and hrefs found on the peeked pages; their text is never kept.
export function addPeekedLinks(extraction: Extraction, candidates: Candidate[], pages: PeekPage[]): number {
  const { snapshot } = extraction;
  const known = new Set(snapshot.actions.map((a) => a.href).filter(Boolean));
  known.add(snapshot.pageUrl);
  let added = 0;
  for (const page of pages) {
    const via = candidates.find((c) => c.url === page.url)?.label;
    if (!via || !sameSite(page.finalUrl, location.href)) continue;
    const doc = new DOMParser().parseFromString(page.html, "text/html");
    let perPage = 0;
    for (const anchor of doc.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      if (perPage >= MAX_LINKS_PER_PAGE || snapshot.actions.length >= MAX_ACTIONS) break;
      let full: string;
      try { full = new URL(anchor.getAttribute("href") ?? "", page.finalUrl).href; } catch { continue; }
      const href = sanitizedUrl(full);
      const label = linkText(anchor);
      if (!href || !label || known.has(href) || !sameSite(full, location.href) || UNSAFE_LINK.test(`${label} ${full}`)) continue;
      known.add(href);
      const id = `${snapshot.version}:p${snapshot.actions.length}`;
      snapshot.actions.push({ id, label, kind: "navigate", context: clean(`one click away via "${via}"`, 200), disabled: false, href });
      extraction.hrefs.set(id, full); extraction.deep.add(id);
      perPage++; added++;
    }
  }
  return added;
}
