import type { ModelClient } from "../../../shared/contracts";
import { ModelInputSchema, ModelReplySchema } from "./protocol";

const errors = {
  missing_key: "Open Mack's extension options and save your API key again.",
  unauthorized: "Mack cannot access this page.", invalid_request: "Mack could not prepare the model request.",
  inactive: "Mack is no longer active on this page.", busy: "Mack is already processing a request. Try again.",
  model_failed: "The model request failed or timed out. Check your key and connection, then try again.",
  model_rejected: "The model provider rejected the request.",
  aborted: "The request was cancelled.",
};

export function createModelClient(send: (message: unknown) => Promise<unknown> = (message) => chrome.runtime.sendMessage(message)): ModelClient {
  return {
    generateJSON(input, signal) {
      const parsed = ModelInputSchema.parse(JSON.parse(JSON.stringify(input)));
      if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const cancel = () => {
          void send({ type: "mack:cancel", requestId }).catch(() => {});
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", cancel, { once: true });
        void send({ type: "mack:model", requestId, input: parsed }).then((raw) => {
          if (signal.aborted) return;
          const reply = ModelReplySchema.parse(raw);
          if (!reply.ok) throw Object.assign(new Error(reply.detail ? `${errors[reply.error]} ${reply.detail}` : errors[reply.error]), { code: reply.error });
          resolve(reply.result);
        }).catch((error: unknown) => reject(error)).finally(() => signal.removeEventListener("abort", cancel));
      });
    },
  };
}
