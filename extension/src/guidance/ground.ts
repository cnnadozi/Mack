import type { GuidanceOutcome, GuidanceRequest, SourceAction } from './contract.pending';
import { displayedLabels } from './prompt';

const MAX_LABEL_CHARS = 60;
const MAX_SENTENCE_CHARS = 240;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

// Thrown when the model's reply cannot be trusted. The message is safe to send
// back to the model as retry feedback.
export class ModelOutputError extends Error {}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function parseModelReply(reply: string): Record<string, unknown> {
  // Models often wrap JSON in code fences or a sentence, so take the outermost object.
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) throw new ModelOutputError('The reply was not a JSON object.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new ModelOutputError('The reply was not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ModelOutputError('The reply was not a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function sentence(value: unknown, field: string): string {
  const result = clean(value);
  if (result === '') throw new ModelOutputError(`"${field}" must be a non-empty string.`);
  return result.slice(0, MAX_SENTENCE_CHARS);
}

// The spoken sentence must name the exact visible label. If the model's wording
// does not, we replace it rather than speak a label the user cannot see.
function instructionFor(modelInstruction: unknown, label: string, fallback: string): string {
  const instruction = clean(modelInstruction);
  const usable =
    instruction !== '' && instruction.length <= MAX_SENTENCE_CHARS && instruction.includes(label);
  return usable ? instruction : fallback;
}

function originalFallback(action: SourceAction): string {
  if (action.kind === 'field') return `Find the "${action.label}" box on the page and fill it in.`;
  if (action.kind === 'submit') return `When you are ready, press "${action.label}" on the page yourself.`;
  return `Find "${action.label}" on the page and press it.`;
}

function additionLabel(
  modelLabel: unknown,
  source: SourceAction,
  shown: Map<string, string>,
): string {
  const label = clean(modelLabel);
  const taken = [...shown.values()].some((other) => other.toLowerCase() === label.toLowerCase());
  // Two buttons with the same name would make the spoken instruction ambiguous.
  if (label === '' || label.length > MAX_LABEL_CHARS || taken) return source.label;
  return label;
}

function groundTarget(
  request: GuidanceRequest,
  reply: Record<string, unknown>,
  wantsOriginal: boolean,
): GuidanceOutcome {
  const targetActionId = typeof reply.targetActionId === 'string' ? reply.targetActionId : '';
  const source = request.page.actions.find((action) => action.id === targetActionId);
  if (!source) {
    throw new ModelOutputError(
      `"targetActionId" must be an id from "actions". If nothing fits, use status "missing_target".`,
    );
  }
  if (source.disabled) {
    throw new ModelOutputError(
      `Action "${source.id}" is disabled. Pick another action or use status "missing_target".`,
    );
  }

  // Forms are never rebuilt as Mack buttons, whatever the model asked for.
  if (wantsOriginal || source.kind === 'field' || source.kind === 'submit') {
    return {
      status: 'use_original',
      targetActionId,
      instruction: instructionFor(reply.instruction, source.label, originalFallback(source)),
    };
  }

  const shown = displayedLabels(request);
  const existing = shown.get(targetActionId);
  const label = existing ?? additionLabel(reply.additionLabel, source, shown);
  return {
    status: 'ready',
    targetActionId,
    instruction: instructionFor(reply.instruction, label, `Press "${label}".`),
    additions: existing === undefined ? [{ actionId: targetActionId, label }] : [],
  };
}

function groundClarification(reply: Record<string, unknown>): GuidanceOutcome {
  const raw = Array.isArray(reply.options) ? reply.options : [];
  const options = [...new Set(raw.map(clean).filter((option) => option !== ''))]
    .map((option) => option.slice(0, MAX_LABEL_CHARS))
    .slice(0, MAX_OPTIONS);
  if (options.length < MIN_OPTIONS) {
    throw new ModelOutputError(`"options" must list ${MIN_OPTIONS} to ${MAX_OPTIONS} short choices.`);
  }
  return { status: 'clarification', question: sentence(reply.question, 'question'), options };
}

// Turns an untrusted model reply into an outcome that only references real,
// current source actions and exact visible labels.
export function groundReply(request: GuidanceRequest, reply: Record<string, unknown>): GuidanceOutcome {
  switch (reply.status) {
    case 'ready':
      return groundTarget(request, reply, false);
    case 'use_original':
      return groundTarget(request, reply, true);
    case 'clarification':
      return groundClarification(reply);
    case 'missing_target':
      return { status: 'missing_target', message: sentence(reply.message, 'message') };
    default:
      throw new ModelOutputError(
        `"status" must be ready, use_original, clarification, or missing_target.`,
      );
  }
}
