import { GuidanceProposalSchema, validateDesign, type CommittedScreen, type GuidanceProposal, type PageSnapshot } from "../../../shared/contracts";

export function mergeGuidance(screen: CommittedScreen, snapshot: PageSnapshot, raw: GuidanceProposal): { screen: CommittedScreen; proposal: GuidanceProposal } {
  const proposal = GuidanceProposalSchema.parse(raw);
  const sections = screen.sections.map((s) => ({ ...s, buttons: [...s.buttons] }));
  const existing = new Map(sections.flatMap((s) => s.buttons).map((b) => [b.actionId, b.label]));
  const sources = new Map(snapshot.actions.map((a) => [a.id, a]));
  const added = [];
  for (const button of proposal.additions) {
    const source = sources.get(button.actionId);
    if (!source || source.disabled || !["navigate", "button"].includes(source.kind)) throw new Error("Invalid addition");
    if (existing.has(button.actionId)) {
      if (existing.get(button.actionId) !== button.label) throw new Error("Cannot rename an existing action");
      continue;
    }
    existing.set(button.actionId, button.label);
    added.push(button);
  }
  if (added.length) {
    const section = sections.find((s) => s.heading === "For your request");
    if (section) section.buttons.push(...added);
    else sections.push({ id: `request-${crypto.randomUUID()}`, heading: "For your request", buttons: added });
  }
  const target = proposal.targetActionId ? sources.get(proposal.targetActionId) : undefined;
  if (proposal.status === "ready" && (!target || proposal.mode !== "simplified")) throw new Error("Ready guidance needs a simplified target");
  if (proposal.status === "use_original" && (!target || proposal.mode !== "original" || proposal.additions.length)) throw new Error("Original guidance needs an original target");
  if (["not_found", "needs_clarification"].includes(proposal.status) && (target || proposal.targetActionId || proposal.additions.length)) throw new Error("Non-target guidance cannot add actions");
  if (proposal.status === "needs_clarification" && (proposal.clarificationOptions?.length ?? 0) < 2) throw new Error("Clarification needs choices");
  if (target) {
    if (target.disabled) throw new Error("Disabled target");
    const label = proposal.mode === "original" ? target.label : existing.get(target.id);
    if (!label || !proposal.responseText.includes(label)) throw new Error("Instruction must name the exact visible target");
    if (proposal.mode === "simplified" && !["navigate", "button"].includes(target.kind)) throw new Error("Forms require the original page");
  }
  const next = { ...screen, mode: proposal.mode, sections: proposal.mode === "original" ? [] : sections };
  validateDesign({ title: next.title, mode: next.mode, sections: next.sections }, snapshot);
  return { screen: next, proposal };
}
