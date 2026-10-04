import { z } from "zod";

export type Version = string;
export type ActionId = string;
export type SourceAction = {
  id: ActionId;
  label: string;
  kind: "navigate" | "button" | "field" | "submit";
  context: string;
  disabled: boolean;
  href?: string; // sanitized, never guessed by the model
};
export type PageSnapshot = {
  version: Version;
  pageUrl: string; // sanitized
  title: string;
  headings: string[];
  context: string; // concise, excludes private form values
  actions: SourceAction[];
};
export type TaskButton = { actionId: ActionId; label: string };
export type ScreenSection = { id: string; heading?: string; buttons: TaskButton[] };
export type ScreenDesign = {
  title: string;
  mode: "simplified" | "original";
  sections: ScreenSection[];
  search?: SiteSearch;
};
// The site's own search box, offered in the simplified view; actionId must be a "site search; " field.
export type SiteSearch = { actionId: ActionId; label: string };
export type CommittedScreen = ScreenDesign & {
  snapshotVersion: Version;
  screenVersion: Version; // assigned only by Role 4
};
export type Stamp = {
  requestId: string;
  snapshotVersion: Version;
  screenVersion: Version; // input view revision, not output revision
};
export type DesignRequest = {
  stamp: Stamp;
  snapshot: PageSnapshot;
  goal?: string;
};
export type DesignProposal = {
  stamp: Stamp;
  status: "ready" | "use_original" | "not_found";
  design: ScreenDesign;
};
export type GuidanceRequest = {
  stamp: Stamp;
  snapshot: PageSnapshot;
  screen: CommittedScreen;
  utterance?: string;
  goal?: string;
};
export type GuidanceProposal = {
  stamp: Stamp;
  status: "ready" | "needs_clarification" | "not_found" | "use_original";
  responseText: string; // one short displayed and spoken instruction
  mode: "simplified" | "original";
  additions: TaskButton[]; // current source IDs only; no generated handlers
  targetActionId?: ActionId;
  clarificationOptions?: string[];
};
export type LensError = { code: string; message: string; retryable: boolean };
export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";
export type SpeechJob = {
  jobId: string;
  snapshotVersion: Version;
  screenVersion: Version;
  text: string;
};

// Role 4 owns model transport/runtime, timeout/cancellation, and credentials.
// JSON validation and prompts belong to each consumer (Roles 2 and 3).
export interface ModelClient {
  generateJSON(input: {
    task: "design" | "guide";
    system: string;
    payload: unknown;
  }, signal: AbortSignal): Promise<unknown>;
}
// Role 3 owns this function and prompt.
export type GenerateScreen = (request: DesignRequest, signal: AbortSignal) => Promise<DesignProposal>;
// Role 2 owns this function and prompt.
export type ResolveIntent = (request: GuidanceRequest, signal: AbortSignal) => Promise<GuidanceProposal>;
// Role 1 owns this controller. Role 4 instantiates/wires it.
export interface VoiceController {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  speak(job: SpeechJob): Promise<void>;
  cancelSpeech(): void;
  dispose(): void;
}
export type VoiceCallbacks = {
  onTranscript(text: string): void;
  onState(state: VoiceState): void;
  onError(error: LensError): void;
};

export type LensUIState = {
  screen: CommittedScreen;
  instruction: string;
  highlightedActionId?: ActionId;
  transcript: string;
  voiceState: VoiceState;
  busy: boolean;
  error?: LensError;
  clarificationOptions?: string[];
  accentColor?: string; // "#rrggbb" brand color of the source site; the UI adjusts it for contrast
  siteLogo?: SiteLogo;
};
// The source site's own logo, as an https image or an inert SVG data URL, with the color it sits on.
// kind "icon" is a small square site icon (no wordmark), so the UI shows the site name beside it.
export type SiteLogo = { src: string; alt: string; background: string; kind?: "logo" | "icon" };
export type LensAppProps = {
  state: LensUIState;
  onAction(id: ActionId): void;
  onRequest(text: string): void;
  onSearch(actionId: ActionId, text: string): void; // run the site's own search; Role 4 fills and submits the real field
  onMicStart(): void;
  onMicStop(): void;
  onReplay(): void;
  onBack(): void; // return to the full-screen simplified Mack view
  onPreviousPage(): void; // go to the previous website page
  onShowOriginal(): void;
  onRetry(): void;
  onExit(): void;
  onRendered(screenVersion: Version): void;
};

const text = z.string().min(1);
export const VersionSchema = text;
export const ActionIdSchema = text;
const httpUrl = text.refine((value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}, "Expected a sanitized HTTP(S) URL without credentials, query, or fragment");
export const SourceActionSchema = z.object({
  id: ActionIdSchema, label: text, kind: z.enum(["navigate", "button", "field", "submit"]),
  context: z.string(), disabled: z.boolean(), href: httpUrl.optional(),
}).strict();
export const PageSnapshotSchema = z.object({
  version: VersionSchema, pageUrl: httpUrl, title: z.string(), headings: z.array(z.string()),
  context: z.string(), actions: z.array(SourceActionSchema),
}).strict().refine((v) => new Set(v.actions.map((a) => a.id)).size === v.actions.length, "Duplicate source IDs");
export const TaskButtonSchema = z.object({ actionId: ActionIdSchema, label: text }).strict();
export const ScreenSectionSchema = z.object({ id: text, heading: z.string().optional(), buttons: z.array(TaskButtonSchema) }).strict();
export const SiteSearchSchema = z.object({ actionId: ActionIdSchema, label: text }).strict();
export const ScreenDesignSchema = z.object({ title: text, mode: z.enum(["simplified", "original"]), sections: z.array(ScreenSectionSchema), search: SiteSearchSchema.optional() }).strict();
export const CommittedScreenSchema = ScreenDesignSchema.extend({ snapshotVersion: VersionSchema, screenVersion: VersionSchema });
export const StampSchema = z.object({ requestId: text, snapshotVersion: VersionSchema, screenVersion: VersionSchema }).strict();
export const DesignRequestSchema = z.object({ stamp: StampSchema, snapshot: PageSnapshotSchema, goal: z.string().optional() }).strict()
  .refine((v) => v.stamp.snapshotVersion === v.snapshot.version, "Snapshot version mismatch");
export const DesignProposalSchema = z.object({ stamp: StampSchema, status: z.enum(["ready", "use_original", "not_found"]), design: ScreenDesignSchema }).strict();
export const GuidanceRequestSchema = z.object({
  stamp: StampSchema, snapshot: PageSnapshotSchema, screen: CommittedScreenSchema,
  utterance: z.string().optional(), goal: z.string().optional(),
}).strict().refine((v) => v.stamp.snapshotVersion === v.snapshot.version && v.screen.snapshotVersion === v.snapshot.version && v.stamp.screenVersion === v.screen.screenVersion, "Request version mismatch");
export const GuidanceProposalSchema = z.object({
  stamp: StampSchema, status: z.enum(["ready", "needs_clarification", "not_found", "use_original"]),
  responseText: text, mode: z.enum(["simplified", "original"]), additions: z.array(TaskButtonSchema),
  targetActionId: ActionIdSchema.optional(), clarificationOptions: z.array(text).optional(),
}).strict();
export const LensErrorSchema = z.object({ code: text, message: text, retryable: z.boolean() }).strict();
export const VoiceStateSchema = z.enum(["idle", "listening", "processing", "speaking", "error"]);
export const SpeechJobSchema = z.object({ jobId: text, snapshotVersion: VersionSchema, screenVersion: VersionSchema, text }).strict();
export const LensUIStateSchema = z.object({
  screen: CommittedScreenSchema, instruction: z.string(), highlightedActionId: ActionIdSchema.optional(),
  transcript: z.string(), voiceState: VoiceStateSchema, busy: z.boolean(), error: LensErrorSchema.optional(),
  clarificationOptions: z.array(text).optional(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  siteLogo: z.lazy(() => SiteLogoSchema).optional(),
}).strict();
export const SiteLogoSchema = z.object({
  src: z.string().max(200_000).regex(/^(https:\/\/|data:image\/(svg\+xml|png|jpeg|webp|gif)[;,])/),
  alt: z.string().max(160),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  kind: z.enum(["logo", "icon"]).optional(),
}).strict();

export const parseDesignRequest = (value: unknown): DesignRequest => DesignRequestSchema.parse(value);
export const parseDesignProposal = (value: unknown): DesignProposal => DesignProposalSchema.parse(value);
export const parseGuidanceRequest = (value: unknown): GuidanceRequest => GuidanceRequestSchema.parse(value);
export const parseGuidanceProposal = (value: unknown): GuidanceProposal => GuidanceProposalSchema.parse(value);

export function sameStamp(a: Stamp, b: Stamp): boolean {
  return a.requestId === b.requestId && a.snapshotVersion === b.snapshotVersion && a.screenVersion === b.screenVersion;
}

export const SITE_SEARCH_PREFIX = "site search; ";

export function validateDesign(design: ScreenDesign, snapshot: PageSnapshot): void {
  ScreenDesignSchema.parse(design);
  const sources = new Map(snapshot.actions.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const sections = new Set<string>();
  if (design.mode === "original" && design.sections.length) throw new Error("Original mode cannot contain shortcuts");
  if (design.search) {
    const field = sources.get(design.search.actionId);
    if (design.mode === "original" || !field || field.disabled || field.kind !== "field" || !field.context.startsWith(SITE_SEARCH_PREFIX)) {
      throw new Error("Search must use the site's own search field");
    }
  }
  for (const section of design.sections) {
    if (sections.has(section.id)) throw new Error("Duplicate section ID");
    sections.add(section.id);
    for (const button of section.buttons) {
      const source = sources.get(button.actionId);
      if (!source || source.disabled || !["navigate", "button"].includes(source.kind) || seen.has(button.actionId)) {
        throw new Error("Unknown, disabled, duplicate, or unsafe action");
      }
      seen.add(button.actionId);
    }
  }
}
