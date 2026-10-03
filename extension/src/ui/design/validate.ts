import type {
  DesignProposal,
  LensError,
  PageSnapshot,
  ScreenDesign,
  ScreenSection,
  SourceAction,
  Stamp,
  TaskButton,
} from "../../../../shared/contracts";

export class DesignError extends Error implements LensError {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DesignError";
  }
}

const STATUSES = ["ready", "use_original", "not_found"] as const;
type Status = (typeof STATUSES)[number];

const MAX_LABEL = 60;
const SIGN_IN_FIRST = /\(sign in first\)$/i;
const MAX_TITLE = 80;
const MAX_HEADING = 60;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function duplicateKey(action: SourceAction): string | undefined {
  // Distinct ids pointing at the same destination (header, menu and footer copies) are one task.
  return action.href || undefined;
}

/**
 * Turns raw model output into a grounded ScreenDesign. Ids must exist in the snapshot and be
 * eligible for simplified view; anything else is dropped rather than trusted.
 */
export function groundDesign(raw: unknown, snapshot: PageSnapshot, stamp: Stamp): DesignProposal {
  if (!isRecord(raw)) throw new DesignError("design_invalid", "The design response was not a JSON object.", true);

  const status = raw.status as Status;
  if (!STATUSES.includes(status)) {
    throw new DesignError("design_invalid", "The design response had an unknown status.", true);
  }

  const title = cleanText(raw.title, MAX_TITLE) || cleanText(snapshot.title, MAX_TITLE) || "This page";
  if (status !== "ready") return { stamp, status, design: { title, mode: "original", sections: [] } };

  if (!Array.isArray(raw.sections)) {
    throw new DesignError("design_invalid", "The design response had no sections list.", true);
  }

  const byId = new Map(snapshot.actions.map((a) => [a.id, a]));
  const seenIds = new Set<string>();
  const seenDuplicates = new Set<string>();
  const sections: ScreenSection[] = [];
  let proposedButtons = 0;

  for (const rawSection of raw.sections) {
    if (!isRecord(rawSection) || !Array.isArray(rawSection.buttons)) continue;
    const buttons: TaskButton[] = [];
    for (const rawButton of rawSection.buttons) {
      if (!isRecord(rawButton)) continue;
      proposedButtons++;
      const action = typeof rawButton.actionId === "string" ? byId.get(rawButton.actionId) : undefined;
      if (!action || action.disabled || (action.kind !== "navigate" && action.kind !== "button")) continue;
      if (seenIds.has(action.id)) continue;
      const label = cleanText(rawButton.label, MAX_LABEL) || cleanText(action.label, MAX_LABEL);
      if (!label) continue;
      // "Check claims (sign in first)" deliberately shares the sign-in destination with other buttons.
      const dup = SIGN_IN_FIRST.test(label) ? undefined : duplicateKey(action);
      if (dup && seenDuplicates.has(dup)) continue;
      seenIds.add(action.id);
      if (dup) seenDuplicates.add(dup);
      buttons.push({ actionId: action.id, label });
    }
    if (buttons.length === 0) continue;
    const heading = cleanText(rawSection.heading, MAX_HEADING);
    sections.push({ id: `s${sections.length + 1}`, ...(heading ? { heading } : {}), buttons });
  }

  if (sections.length === 0) {
    if (proposedButtons > 0) {
      throw new DesignError("design_ungrounded", "The design referenced no usable actions on this page.", true);
    }
    return { stamp, status: "not_found", design: { title, mode: "original", sections: [] } };
  }

  const design: ScreenDesign = { title, mode: "simplified", sections };
  return { stamp, status: "ready", design };
}
