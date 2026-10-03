import type { DesignRequest, GenerateScreen, ModelClient } from "../../../../shared/contracts";
import { buildDesignPayload, DESIGN_SYSTEM_PROMPT } from "./prompt";
import { DesignError, groundDesign } from "./validate";

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

export function createGenerateScreen(model: ModelClient): GenerateScreen {
  return async (request: DesignRequest, signal: AbortSignal) => {
    throwIfAborted(signal);
    const { stamp, snapshot, goal } = request;

    const eligible = snapshot.actions.some((a) => !a.disabled && (a.kind === "navigate" || a.kind === "button"));
    if (!eligible) {
      const hasForm = snapshot.actions.some((a) => a.kind === "field" || a.kind === "submit");
      return {
        stamp,
        status: hasForm ? "use_original" : "not_found",
        design: { title: snapshot.title || "This page", mode: "original", sections: [] },
      };
    }

    let raw: unknown;
    try {
      raw = await model.generateJSON(
        { task: "design", system: DESIGN_SYSTEM_PROMPT, payload: buildDesignPayload(snapshot, goal) },
        signal,
      );
    } catch (error) {
      throwIfAborted(signal);
      if (error instanceof DesignError) throw error;
      throw new DesignError("design_model_failed", "Mack could not reach the design model.", true);
    }
    throwIfAborted(signal);

    // The stamp is echoed from the request in code so a model can never claim a different version.
    return groundDesign(raw, snapshot, stamp);
  };
}
