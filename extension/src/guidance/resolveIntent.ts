import {
  ContractError,
  parseGuidanceRequest,
  type GuidanceProposal,
  type GuidanceRequest,
  type ModelClient,
} from './contract.pending';
import { ModelOutputError, groundReply, parseModelReply } from './ground';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';

const MAX_ATTEMPTS = 2;

export type GuidanceErrorCode = 'invalid_request' | 'aborted' | 'model_failed' | 'invalid_model_output';

export class GuidanceError extends Error {
  readonly code: GuidanceErrorCode;

  constructor(code: GuidanceErrorCode, message: string) {
    super(message);
    this.name = 'GuidanceError';
    this.code = code;
  }
}

export interface GuidanceDeps {
  model: ModelClient;
  signal?: AbortSignal;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new GuidanceError('aborted', 'The guidance request was cancelled.');
}

export async function resolveIntent(
  input: GuidanceRequest,
  { model, signal }: GuidanceDeps,
): Promise<GuidanceProposal> {
  let request: GuidanceRequest;
  try {
    request = parseGuidanceRequest(input);
  } catch (error) {
    if (error instanceof ContractError) throw new GuidanceError('invalid_request', error.message);
    throw error;
  }

  let rejection: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal);

    let reply: string;
    try {
      reply = await model.complete({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(request, rejection),
        signal,
      });
    } catch (error) {
      throwIfAborted(signal);
      const reason = error instanceof Error ? error.message : String(error);
      throw new GuidanceError('model_failed', `The model call failed: ${reason}`);
    }
    // A reply that arrives after cancellation must never become a proposal.
    throwIfAborted(signal);

    try {
      const outcome = groundReply(request, parseModelReply(reply));
      // Versions come from the request, never from the model, so Role 4 can
      // discard this proposal if the page or screen has moved on.
      return {
        requestId: request.requestId,
        snapshotVersion: request.snapshotVersion,
        screenVersion: request.screenVersion,
        ...outcome,
      };
    } catch (error) {
      if (!(error instanceof ModelOutputError)) throw error;
      rejection = error.message;
    }
  }

  throw new GuidanceError('invalid_model_output', `The model reply was rejected: ${rejection}`);
}
