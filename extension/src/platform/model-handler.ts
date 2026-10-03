import { ModelMessageSchema, type ModelInput, type ModelReply } from "./protocol";
import { ProviderRejected } from "./provider";
import { supportedUrl } from "./settings";

export function authorizedSender(sender: chrome.runtime.MessageSender, extensionId: string): boolean {
  return sender.id === extensionId && sender.tab?.id !== undefined && sender.frameId === 0 &&
    typeof sender.documentId === "string" && supportedUrl(sender.url);
}

type Dependencies = {
  extensionId: string;
  readAccess(tabId: number): Promise<{ active: boolean; key?: string; model: string }>;
  generate(input: ModelInput, key: string, model: string, signal: AbortSignal): Promise<Record<string, unknown>>;
};

export function createModelHandler(deps: Dependencies) {
  const jobs = new Map<string, { tabId: number; documentId: string; controller: AbortController }>();
  const keyFor = (sender: chrome.runtime.MessageSender, id: string) => `${sender.tab!.id}:${sender.documentId}:${id}`;
  return {
    cancelTab(tabId: number) {
      for (const [id, job] of jobs) if (job.tabId === tabId) { job.controller.abort(); jobs.delete(id); }
    },
    async handle(raw: unknown, sender: chrome.runtime.MessageSender): Promise<ModelReply> {
      if (!authorizedSender(sender, deps.extensionId)) return { ok: false, error: "unauthorized" };
      const parsed = ModelMessageSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: "invalid_request" };
      const message = parsed.data;
      const id = keyFor(sender, message.requestId);
      if (message.type === "mack:cancel") {
        jobs.get(id)?.controller.abort();
        return { ok: true, result: {} };
      }
      if (jobs.has(id) || [...jobs.values()].filter((j) => j.tabId === sender.tab!.id).length >= 2) return { ok: false, error: "busy" };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      jobs.set(id, { tabId: sender.tab!.id!, documentId: sender.documentId!, controller });
      try {
        const access = await deps.readAccess(sender.tab!.id!);
        if (controller.signal.aborted) return { ok: false, error: "aborted" };
        if (!access.active) return { ok: false, error: "inactive" };
        if (!access.key) return { ok: false, error: "missing_key" };
        const result = await deps.generate(message.input, access.key, access.model, controller.signal);
        return controller.signal.aborted ? { ok: false, error: "aborted" } : { ok: true, result };
      } catch (error) {
        if (controller.signal.aborted) return { ok: false, error: "aborted" };
        if (error instanceof ProviderRejected) return { ok: false, error: "model_rejected", detail: error.message.slice(0, 300) };
        return { ok: false, error: "model_failed" };
      } finally { clearTimeout(timeout); if (jobs.get(id)?.controller === controller) jobs.delete(id); }
    },
  };
}
