import { GuidanceProposalSchema, parseGuidanceRequest, type ModelClient, type ResolveIntent } from "../../../shared/contracts";
import { resolveIntent as resolveProvisional } from "../guidance";

// Temporary bridge until Role 2 migrates extension/src/guidance/ to shared/contracts.ts
// (see docs/role-4-handoff.md). Role 2's prompt, grounding, and retries run unchanged.
type ProvisionalRequest = Parameters<typeof resolveProvisional>[0];
type ProvisionalProposal = Awaited<ReturnType<typeof resolveProvisional>>;

export function createResolveIntent(model: ModelClient): ResolveIntent {
  return async (raw, signal) => {
    const request = parseGuidanceRequest(raw);
    const text = (request.utterance ?? request.goal ?? "").trim();
    if (!text) throw new Error("Type or say what you want to do.");
    const provisional: ProvisionalRequest = {
      // Versions are echoed by code and re-stamped below, so placeholders are safe here.
      requestId: request.stamp.requestId, snapshotVersion: 0, screenVersion: 0, text,
      page: {
        url: request.snapshot.pageUrl, title: request.snapshot.title, headings: request.snapshot.headings,
        text: request.snapshot.context ? [request.snapshot.context] : [],
        actions: request.snapshot.actions.map((a) => ({ id: a.id, kind: a.kind === "navigate" ? "link" : a.kind, label: a.label, disabled: a.disabled })),
      },
      screen: {
        title: request.screen.title,
        sections: request.screen.sections.map((s) => ({ title: s.heading, actions: s.buttons.map((b) => ({ ...b })) })),
      },
    };
    const proposal = await resolveProvisional(provisional, {
      signal,
      model: {
        complete: async ({ system, user, signal: inner }) =>
          JSON.stringify(await model.generateJSON({ task: "guide", system, payload: user }, inner ?? signal)),
      },
    });
    return GuidanceProposalSchema.parse(toV1(proposal, request.stamp, request.screen.mode));
  };
}

function toV1(p: ProvisionalProposal, stamp: Parameters<ResolveIntent>[0]["stamp"], mode: "simplified" | "original") {
  switch (p.status) {
    case "ready":
      return { stamp, status: "ready", mode: "simplified", responseText: p.instruction, targetActionId: p.targetActionId, additions: p.additions };
    case "use_original":
      return { stamp, status: "use_original", mode: "original", responseText: p.instruction, targetActionId: p.targetActionId, additions: [] };
    case "clarification":
      return { stamp, status: "needs_clarification", mode, responseText: p.question, additions: [], clarificationOptions: p.options };
    case "missing_target":
      return { stamp, status: "not_found", mode, responseText: p.message, additions: [] };
  }
}
