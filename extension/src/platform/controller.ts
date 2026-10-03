import {
  DesignProposalSchema, LensUIStateSchema, SpeechJobSchema, parseDesignRequest, parseGuidanceRequest, sameStamp, validateDesign,
  type GenerateScreen, type LensAppProps, type LensUIState, type ResolveIntent, type Stamp, type VoiceCallbacks, type VoiceController,
} from "../../../shared/contracts";
import { extractPage, isMack, liveTarget, sourceKind, type Extraction } from "./extractor";
import { mergeGuidance } from "./state";

type Mount = { host: HTMLElement; render(props: LensAppProps): void; unmount(): void };
type Dependencies = {
  mount: Mount; generateScreen: GenerateScreen; resolveIntent: ResolveIntent;
  createVoice?: (callbacks: VoiceCallbacks) => VoiceController;
  initialGoal?: string; saveGoal(goal: string): void; onExit(): void;
  extract?: () => Extraction;
};

export function startPlatform(deps: Dependencies) {
  const extract = deps.extract ?? extractPage;
  const previousBody = document.body;
  const previousInert = previousBody.inert;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  let currentBody = previousBody;
  let bodyInert = previousInert;
  let extraction: Extraction;
  let state: LensUIState;
  let active = true;
  let goal = deps.initialGoal;
  let designPending = false;
  let designAbort: AbortController | undefined;
  let guideAbort: AbortController | undefined;
  let designStamp: Stamp | undefined;
  let guideStamp: Stamp | undefined;
  let speechVersion: string | undefined;
  let highlight: HTMLElement | undefined;
  let actionPending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let url = location.href;

  const voice = deps.createVoice?.({
    onTranscript: (text) => { if (active) { state = { ...state, transcript: text }; request(text); } },
    onState: (voiceState) => { if (active) { state = { ...state, voiceState }; render(); } },
    onError: (error) => { if (active) { state = { ...state, error, voiceState: "error" }; render(); } },
  });

  function clearHighlight() { highlight?.removeAttribute("data-mack-highlight"); highlight = undefined; }
  const highlightStyle = document.createElement("style");
  highlightStyle.dataset.mackPlatform = "";
  highlightStyle.textContent = "[data-mack-highlight] { outline: 4px double #1264bd !important; outline-offset: 5px !important; }";
  document.documentElement.append(highlightStyle);

  function cancelSpeech() { speechVersion = undefined; voice?.cancelSpeech(); }
  function invalidate() {
    designAbort?.abort(); guideAbort?.abort(); designStamp = undefined; guideStamp = undefined;
    cancelSpeech(); clearHighlight();
  }
  function applyMode() {
    if (currentBody !== document.body) {
      currentBody.inert = bodyInert;
      currentBody = document.body; bodyInert = currentBody.inert;
    }
    currentBody.inert = state.screen.mode === "simplified" ? true : bodyInert;
  }
  function render() {
    if (!active) return;
    applyMode();
    LensUIStateSchema.parse(state);
    deps.mount.render(props);
  }
  function stamp(): Stamp {
    return { requestId: crypto.randomUUID(), snapshotVersion: extraction.snapshot.version, screenVersion: state.screen.screenVersion };
  }
  function current(expected: Stamp, actual: Stamp, latest: Stamp | undefined): boolean {
    return active && !!latest && sameStamp(expected, latest) && sameStamp(expected, actual) &&
      extraction.snapshot.version === expected.snapshotVersion && state.screen.screenVersion === expected.screenVersion;
  }
  function fail(error: unknown) {
    if (!active) return;
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "platform_error";
    const message = error instanceof Error ? error.message : "Mack could not finish. Try again or use the original page.";
    state = { ...state, busy: false, error: { code, message, retryable: true }, screen: { ...state.screen, screenVersion: crypto.randomUUID() } };
    render();
  }
  async function refresh() {
    if (!active) return;
    invalidate(); actionPending = false;
    if (clickTimer) clearTimeout(clickTimer);
    designPending = true;
    const controller = designAbort = new AbortController();
    try {
      extraction = extract();
      state = {
        screen: { title: extraction.snapshot.title || "This page", mode: "simplified", sections: [], snapshotVersion: extraction.snapshot.version, screenVersion: crypto.randomUUID() },
        instruction: "", transcript: state?.transcript ?? "", voiceState: voice ? "idle" : "error", busy: true,
      };
      render();
      const expected = designStamp = stamp();
      const proposal = DesignProposalSchema.parse(await deps.generateScreen(parseDesignRequest({ stamp: expected, snapshot: extraction.snapshot, ...(goal ? { goal } : {}) }), controller.signal));
      if (!current(expected, proposal.stamp, designStamp) || controller.signal.aborted) return;
      validateDesign(proposal.design, extraction.snapshot);
      if ((proposal.status === "ready") !== (proposal.design.mode === "simplified")) throw new Error("Design status does not match its mode");
      state = { ...state, busy: false, screen: { ...proposal.design, snapshotVersion: extraction.snapshot.version, screenVersion: crypto.randomUUID() } };
      designPending = false;
      render();
      if (goal) request(goal);
    } catch (error) {
      if (!active || controller.signal.aborted || designAbort !== controller) return;
      designPending = false; fail(error);
    }
  }
  async function guide(text: string) {
    guideAbort?.abort(); cancelSpeech(); clearHighlight();
    const controller = guideAbort = new AbortController();
    state = { ...state, busy: true, instruction: "", highlightedActionId: undefined, clarificationOptions: undefined, error: undefined, screen: { ...state.screen, screenVersion: crypto.randomUUID() } };
    render();
    const expected = guideStamp = stamp();
    try {
      const proposal = await deps.resolveIntent(parseGuidanceRequest({ stamp: expected, snapshot: extraction.snapshot, screen: state.screen, utterance: text, goal }), controller.signal);
      if (!current(expected, proposal.stamp, guideStamp) || controller.signal.aborted) return;
      const accepted = mergeGuidance(state.screen, extraction.snapshot, proposal);
      if (accepted.proposal.targetActionId) liveTarget(extraction, accepted.proposal.targetActionId);
      state = {
        ...state, screen: { ...accepted.screen, screenVersion: crypto.randomUUID() }, instruction: accepted.proposal.responseText,
        highlightedActionId: accepted.proposal.targetActionId, clarificationOptions: accepted.proposal.clarificationOptions,
        busy: false, error: undefined,
      };
      speechVersion = state.screen.screenVersion;
      applyMode();
      if (state.screen.mode === "original" && state.highlightedActionId) {
        highlight = liveTarget(extraction, state.highlightedActionId);
        highlight.setAttribute("data-mack-highlight", "");
        highlight.scrollIntoView?.({ block: "center", behavior: "auto" });
      }
      render();
    } catch (error) { if (active && !controller.signal.aborted && guideAbort === controller) fail(error); }
  }
  function request(text: string) {
    if (!active || !text.trim()) return;
    goal = text.trim().slice(0, 2000);
    deps.saveGoal(goal);
    guideAbort?.abort(); cancelSpeech(); clearHighlight();
    if (!designPending) void guide(goal);
  }
  function speak(version: string) {
    if (!active || state.busy || version !== state.screen.screenVersion || speechVersion !== version || !state.instruction) return;
    if (state.highlightedActionId) {
      try { liveTarget(extraction, state.highlightedActionId); } catch (error) { cancelSpeech(); fail(error); return; }
      if (state.screen.mode === "simplified") {
        const target = Array.from(deps.mount.host.shadowRoot?.querySelectorAll<HTMLElement>("[data-action-id]") ?? []).find((el) => el.dataset.actionId === state.highlightedActionId);
        if (!target || target.matches(":disabled")) return;
      } else if (!highlight) return;
    }
    speechVersion = undefined;
    if (voice) void voice.speak(SpeechJobSchema.parse({ jobId: crypto.randomUUID(), snapshotVersion: state.screen.snapshotVersion, screenVersion: version, text: state.instruction })).catch((error) => { if (active && state.screen.screenVersion === version) fail(error); });
  }
  function action(id: string) {
    if (!active || state.busy || actionPending || state.screen.mode !== "simplified" || !state.screen.sections.some((s) => s.buttons.some((b) => b.actionId === id))) return;
    try {
      const element = liveTarget(extraction, id);
      if (!["navigate", "button"].includes(sourceKind(element))) throw new Error("Use that control directly on the original page.");
      actionPending = true;
      invalidate();
      currentBody.inert = bodyInert;
      try { element.click(); } finally { if (active) applyMode(); }
      clickTimer = setTimeout(() => {
        if (!active || !actionPending) return;
        actionPending = false;
        fail(new Error("The action ran, but Mack could not confirm a page change. Check the original page or retry."));
      }, 1800);
    } catch (error) { actionPending = false; fail(error); }
  }
  function original() {
    if (!active) return;
    invalidate(); designPending = false;
    state = { ...state, instruction: "", busy: false, highlightedActionId: undefined, clarificationOptions: undefined, screen: { ...state.screen, mode: "original", sections: [], screenVersion: crypto.randomUUID() } };
    render();
  }
  function exit() {
    if (!active) return;
    active = false; invalidate(); observer.disconnect(); clearInterval(urlPoll);
    if (timer) clearTimeout(timer);
    if (clickTimer) clearTimeout(clickTimer);
    window.removeEventListener("popstate", urlChanged); window.removeEventListener("hashchange", urlChanged);
    currentBody.inert = bodyInert;
    voice?.dispose(); highlightStyle.remove(); deps.mount.unmount();
    if (previousFocus?.isConnected) previousFocus.focus();
    deps.onExit();
  }
  function unavailableVoice() {
    state = { ...state, voiceState: "error", error: { code: "voice_unavailable", message: "Voice is not connected yet. You can type your request.", retryable: false } };
    render();
  }
  const props: LensAppProps = {
    get state() { return state; },
    onAction: action, onRequest: request,
    onMicStart: () => { if (voice) { cancelSpeech(); void voice.startListening().catch(fail); } else unavailableVoice(); },
    onMicStop: () => { if (voice) void voice.stopListening().catch(fail); },
    onReplay: () => { if (voice) { voice.cancelSpeech(); speechVersion = state.screen.screenVersion; speak(speechVersion); } else unavailableVoice(); },
    onBack: () => { scheduleRefresh(); history.back(); }, onShowOriginal: original,
    onRetry: () => { void refresh(); }, onExit: exit, onRendered: speak,
  };
  function scheduleRefresh() {
    invalidate(); designPending = true;
    if (state) {
      state = { ...state, instruction: "", highlightedActionId: undefined, clarificationOptions: undefined, busy: true, screen: { ...state.screen, screenVersion: crypto.randomUUID() } };
      render();
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void refresh(); }, 250);
  }
  function urlChanged() { if (location.href !== url) { url = location.href; scheduleRefresh(); } }
  const observer = new MutationObserver((records) => {
    const relevant = records.some((record) => {
      if (isMack(record.target)) return false;
      if (record.type === "childList") return [...record.addedNodes, ...record.removedNodes].some((node) => !isMack(node));
      return true;
    });
    if (relevant) scheduleRefresh();
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["href", "disabled", "aria-disabled", "hidden", "class", "style", "aria-label"] });
  window.addEventListener("popstate", urlChanged); window.addEventListener("hashchange", urlChanged);
  const urlPoll = setInterval(urlChanged, 500);
  void refresh();
  return { exit, refresh, request, getState: () => state };
}
