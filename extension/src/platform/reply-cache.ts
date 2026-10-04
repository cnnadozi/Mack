// Remembers Mack's answer to a question about a page, so asking the same thing
// again on the same page is answered at once, without another Gemini call.
//
// Only answers are remembered, never tasks: a task changes the page, so doing it
// again has to start from what the page looks like now.

import { createCache } from "./cache";
import type { MackReply } from "./gemini";
import type { PageSnapshot } from "./messages";

const MAX_ANSWERS = 30;
const KEEP_MS = 5 * 60 * 1000;

// Speech-to-text does not punctuate or capitalise the same way twice.
function normalise(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// The whole page is in the key: element ids are only valid for one snapshot, so an
// answer that points at "m12" may only be reused when the page reads exactly the same.
export function replyKey(question: string, page: PageSnapshot | null): string {
  return JSON.stringify([normalise(question), page?.url, page?.elements, page?.content]);
}

export const replyCache = createCache<MackReply>({ maxEntries: MAX_ANSWERS, ttlMs: KEEP_MS });
