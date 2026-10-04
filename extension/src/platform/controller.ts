import {
  DesignProposalSchema, LensUIStateSchema, SiteLogoSchema, SpeechJobSchema, parseDesignRequest, parseGuidanceRequest, sameStamp, validateDesign,
  type CommittedScreen, type GenerateScreen, type SiteLogo, type LensAppProps, type LensUIState, type ResolveIntent, type Stamp,
  type VoiceCallbacks, type VoiceController,
} from "../../../shared/contracts";
import { brandColor, deepLink, siteLogo, extractPage, isMack, liveTarget, sourceKind, type Extraction } from "./extractor";
import { addPeekedLinks, hasPasswordField, peekCandidates, type Peek } from "./peek";
import { mergeGuidance } from "./state";

type Mount = { host: HTMLElement; render(props: LensAppProps): void; unmount(): void };
type Dependencies = {
  mount: Mount; generateScreen: GenerateScreen; resolveIntent: ResolveIntent;
  createVoice?: (callbacks: VoiceCallbacks) => VoiceController;
  initialGoal?: string; saveGoal(goal: string, fromUrl?: string): void; onExit(): void;
  extract?: () => Extraction;
  brandColor?: () => string | undefined;
  siteLogo?: () => SiteLogo | undefined;
  peek?: Peek;
  navigate?: (url: string) => void;
};

const BUTTON_SETTLE_MS = 900;
const NAVIGATE_CONFIRM_MS = 1800;
export const NO_SIMPLE_VIEW = "This page has no simple view, so you can use it as it is. Press Exit to close Mack.";
const DESIGN_INSTRUCTION = {
  ready: "Choose what you want to do.",
  use_original: "This page works best as it is. Use the page normally, or ask Mack below.",
  not_found: "Mack found nothing to simplify here. Use the page as it is, or ask Mack below.",
} as const;

export const goalFromLabel = (label: string) => label.replace(/\s*\(sign in first\)\s*$/i, "").trim();

export function startPlatform(deps: Dependencies) {
  const extract = deps.extract ?? extractPage;
  const readAccent = deps.brandColor ?? brandColor;
  const readLogo = deps.siteLogo ?? siteLogo;
  const withAccent = (accentColor: string | undefined) => (accentColor ? { accentColor } : {});
  const withLogo = (logo: SiteLogo | undefined) => (logo && SiteLogoSchema.safeParse(logo).success ? { siteLogo: logo } : {});
  // Branding is a nicety; a strange page must never stop Mack from loading.
  const safely = <T,>(read: () => T | undefined) => { try { return read(); } catch { return undefined; } };
  const navigate = deps.navigate ?? ((url: string) => location.assign(url));
  const previousBody = document.body;
  const previousInert = previousBody.inert;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  let currentBody = previousBody;
  let bodyInert = previousInert;
  let extraction!: Extraction;
  let state: LensUIState = {
    screen: { title: document.title || "This page", mode: "simplified", sections: [], snapshotVersion: "pending", screenVersion: crypto.randomUUID() },
    instruction: "", transcript: "", voiceState: "idle", busy: true,
  };
  let active = true;
  let goal = deps.initialGoal;
  // The page where the goal was set. Returning there (or pressing previous page) drops the goal.
  let goalFrom: string | undefined;
  let designPending = false;
  let designAbort: AbortController | undefined;
  let guideAbort: AbortController | undefined;
  let designStamp: Stamp | undefined;
  let guideStamp: Stamp | undefined;
  let speechVersion: string | undefined;
  let highlight: HTMLElement | undefined;
  let actionPending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let mutationTimer: ReturnType<typeof setTimeout> | undefined;
  let simplifiedScreen: CommittedScreen | undefined;
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
    if (clickTimer) clearTimeout(clickTimer);
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
  function commit(patch: Partial<LensUIState>, screen: Partial<CommittedScreen> = {}) {
    state = { ...state, ...patch, screen: { ...state.screen, ...screen, screenVersion: crypto.randomUUID() } };
    render();
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
    let message = error instanceof Error ? error.message : "Mack could not finish. Try again or use the original page.";
    // Role 3 wraps transport failures; the transport's own message says what to fix (key, model, network).
    const cause = error instanceof Error ? error.cause : undefined;
    if (cause instanceof Error && cause.message && !message.includes(cause.message)) message = `${message} ${cause.message}`;
    commit({ busy: false, error: { code, message, retryable: true } });
  }
  function setGoal(next: string) {
    goal = next.trim().slice(0, 2000) || undefined;
    goalFrom = goal ? location.href : undefined;
    deps.saveGoal(goal ?? "", goalFrom);
  }
  function dropGoal() {
    if (!goal && !goalFrom) return;
    goal = undefined; goalFrom = undefined;
    deps.saveGoal("");
  }
  async function peekAhead(target: Extraction, signal: AbortSignal) {
    const candidates = deps.peek && !hasPasswordField(target) ? peekCandidates(target) : [];
    if (!deps.peek || !candidates.length) return;
    const pages = await deps.peek(candidates.map((c) => c.url)).catch(() => []);
    if (!signal.aborted) addPeekedLinks(target, candidates, pages);
  }
  async function refresh(next?: Extraction) {
    if (!active) return;
    invalidate(); actionPending = false; simplifiedScreen = undefined;
    designPending = true;
    const controller = designAbort = new AbortController();
    try {
      extraction = next ?? extract();
      state = {
        screen: { title: extraction.snapshot.title || "This page", mode: "simplified", sections: [], snapshotVersion: extraction.snapshot.version, screenVersion: crypto.randomUUID() },
        instruction: "", transcript: state?.transcript ?? "", voiceState: voice ? "idle" : "error", busy: true,
        ...withAccent(safely(readAccent)),
        ...withLogo(safely(readLogo)),
      };
      render();
      const expected = designStamp = stamp();
      if (deps.peek) {
        await peekAhead(extraction, controller.signal);
        if (controller.signal.aborted) return;
      }
      const proposal = DesignProposalSchema.parse(await deps.generateScreen(parseDesignRequest({ stamp: expected, snapshot: extraction.snapshot, ...(goal ? { goal } : {}) }), controller.signal));
      if (!current(expected, proposal.stamp, designStamp) || controller.signal.aborted) return;
      validateDesign(proposal.design, extraction.snapshot);
      if ((proposal.status === "ready") !== (proposal.design.mode === "simplified")) throw new Error("Design status does not match its mode");
      designPending = false;
      commit({ busy: false, instruction: DESIGN_INSTRUCTION[proposal.status] }, { ...proposal.design, snapshotVersion: extraction.snapshot.version });
      if (goal) void guide(goal);
    } catch (error) {
      if (!active || controller.signal.aborted || designAbort !== controller) return;
      designPending = false; fail(error);
    }
  }
  async function guide(text: string) {
    guideAbort?.abort(); cancelSpeech(); clearHighlight();
    const controller = guideAbort = new AbortController();
    commit({ busy: true, instruction: "", highlightedActionId: undefined, clarificationOptions: undefined, error: undefined });
    const expected = guideStamp = stamp();
    try {
      const proposal = await deps.resolveIntent(parseGuidanceRequest({ stamp: expected, snapshot: extraction.snapshot, screen: state.screen, utterance: text, goal }), controller.signal);
      if (!current(expected, proposal.stamp, guideStamp) || controller.signal.aborted) return;
      const accepted = mergeGuidance(state.screen, extraction.snapshot, proposal);
      const target = accepted.proposal.targetActionId;
      if (target && accepted.screen.mode === "original") liveTarget(extraction, target);
      if (state.screen.mode === "simplified" && accepted.screen.mode === "original") simplifiedScreen = state.screen;
      state = {
        ...state, screen: { ...accepted.screen, screenVersion: crypto.randomUUID() }, instruction: accepted.proposal.responseText,
        highlightedActionId: target, clarificationOptions: accepted.proposal.clarificationOptions,
        busy: false, error: undefined,
      };
      speechVersion = state.screen.screenVersion;
      applyMode();
      if (state.screen.mode === "original" && target) {
        highlight = liveTarget(extraction, target);
        highlight.setAttribute("data-mack-highlight", "");
        highlight.scrollIntoView?.({ block: "center", behavior: "auto" });
      }
      render();
    } catch (error) { if (active && !controller.signal.aborted && guideAbort === controller) fail(error); }
  }
  function request(text: string) {
    if (!active || !text.trim()) return;
    setGoal(text);
    guideAbort?.abort(); cancelSpeech(); clearHighlight();
    if (!designPending && goal) void guide(goal);
  }
  function speak(version: string) {
    if (!active || state.busy || version !== state.screen.screenVersion || speechVersion !== version || !state.instruction) return;
    if (state.highlightedActionId) {
      if (state.screen.mode === "simplified") {
        const target = Array.from(deps.mount.host.shadowRoot?.querySelectorAll<HTMLElement>("[data-action-id]") ?? []).find((el) => el.dataset.actionId === state.highlightedActionId);
        if (!target || target.matches(":disabled")) return;
      } else {
        try { liveTarget(extraction, state.highlightedActionId); } catch (error) { cancelSpeech(); fail(error); return; }
        if (!highlight) return;
      }
    }
    speechVersion = undefined;
    if (voice) void voice.speak(SpeechJobSchema.parse({ jobId: crypto.randomUUID(), snapshotVersion: state.screen.snapshotVersion, screenVersion: version, text: state.instruction })).catch((error) => { if (active && state.screen.screenVersion === version) fail(error); });
  }
  function shownLabel(id: string): string | undefined {
    return state.screen.sections.flatMap((s) => s.buttons).find((b) => b.actionId === id)?.label;
  }
  function action(id: string) {
    const label = shownLabel(id);
    if (!active || state.busy || actionPending || state.screen.mode !== "simplified" || !label) return;
    try {
      if (extraction.deep.has(id)) {
        const href = deepLink(extraction, id);
        setGoal(goalFromLabel(label));
        actionPending = true; invalidate();
        commit({ busy: true, instruction: `Opening “${label}”…`, highlightedActionId: undefined, error: undefined });
        navigate(href);
        clickTimer = setTimeout(() => { if (active && actionPending) { actionPending = false; fail(new Error("Mack could not open that page. Check your connection or retry.")); } }, NAVIGATE_CONFIRM_MS * 3);
        return;
      }
      const element = liveTarget(extraction, id);
      const kind = sourceKind(element);
      if (kind !== "navigate" && kind !== "button") throw new Error("Use that control directly on the original page.");
      setGoal(goalFromLabel(label));
      actionPending = true; invalidate();
      const before = location.href;
      currentBody.inert = bodyInert;
      try { element.click(); } finally { if (active) applyMode(); }
      if (kind === "button") {
        commit({ busy: true, instruction: `Opening “${label}”…`, highlightedActionId: undefined, error: undefined });
        // A button that doesn't navigate probably opened a menu or panel behind the overlay; re-read the page.
        clickTimer = setTimeout(() => { if (active && location.href === before) void refresh(); }, BUTTON_SETTLE_MS);
      } else {
        clickTimer = setTimeout(() => {
          if (!active || !actionPending) return;
          actionPending = false;
          fail(new Error("The action ran, but Mack could not confirm a page change. Check the original page or retry."));
        }, NAVIGATE_CONFIRM_MS);
      }
    } catch (error) { actionPending = false; fail(error); }
  }
  function original() {
    if (!active) return;
    if (state.screen.mode === "simplified" && !designPending && state.screen.sections.length) simplifiedScreen = state.screen;
    invalidate(); designPending = false;
    commit({ instruction: "", busy: false, highlightedActionId: undefined, clarificationOptions: undefined }, { mode: "original", sections: [] });
  }
  function back() {
    if (!active || state.screen.mode === "simplified") return;
    const saved = simplifiedScreen;
    if (!saved) { commit({ instruction: NO_SIMPLE_VIEW, busy: false, error: undefined }); return; }
    if (saved.snapshotVersion !== extraction.snapshot.version) { void refresh(); return; }
    invalidate(); simplifiedScreen = undefined;
    commit({ instruction: DESIGN_INSTRUCTION.ready, busy: false, error: undefined, highlightedActionId: undefined, clarificationOptions: undefined }, { ...saved });
  }
  function previousPage() {
    if (!active) return;
    dropGoal();
    scheduleRefresh();
    history.back();
  }
  function adoptOriginal(next: Extraction) {
    const pendingGuide = state.busy && !!guideStamp;
    invalidate(); extraction = next;
    commit({ instruction: "", busy: false, highlightedActionId: undefined, clarificationOptions: undefined }, { sections: [], snapshotVersion: next.snapshot.version });
    if (pendingGuide && goal) void guide(goal);
  }
  function pageChanged() {
    if (!active) return;
    if (location.href !== url) { urlChanged(); return; }
    if (!extraction) { void refresh(); return; }
    const next = extract();
    if (next.fingerprint === extraction.fingerprint) {
      // Same content re-rendered: keep current IDs (and any peeked links) but point them at the live nodes.
      const registry = new Map(extraction.registry);
      next.snapshot.actions.forEach((action, i) => {
        const old = extraction.snapshot.actions[i];
        const element = next.registry.get(action.id);
        if (old && element) registry.set(old.id, element);
      });
      extraction = { ...extraction, registry };
      return;
    }
    if (state.screen.mode === "original" && !designPending) adoptOriginal(next);
    else void refresh(next);
  }
  function exit(preserveSession = false) {
    if (!active) return;
    active = false; invalidate(); observer.disconnect(); clearInterval(urlPoll);
    if (timer) clearTimeout(timer);
    if (mutationTimer) clearTimeout(mutationTimer);
    window.removeEventListener("popstate", urlChanged); window.removeEventListener("hashchange", urlChanged);
    currentBody.inert = bodyInert;
    voice?.dispose(); highlightStyle.remove(); deps.mount.unmount();
    if (previousFocus?.isConnected) previousFocus.focus();
    if (!preserveSession) deps.onExit();
  }
  function unavailableVoice() {
    commit({ voiceState: "error", error: { code: "voice_unavailable", message: "Voice is not connected yet. You can type your request.", retryable: false } });
  }
  const props: LensAppProps = {
    get state() { return state; },
    onAction: action, onRequest: request,
    onMicStart: () => { if (voice) { cancelSpeech(); void voice.startListening().catch(fail); } else unavailableVoice(); },
    onMicStop: () => { if (voice) void voice.stopListening().catch(fail); },
    onReplay: () => { if (voice) { voice.cancelSpeech(); speechVersion = state.screen.screenVersion; speak(speechVersion); } else unavailableVoice(); },
    onBack: back, onPreviousPage: previousPage, onShowOriginal: original,
    onRetry: () => { void refresh(); }, onExit: () => exit(), onRendered: speak,
  };
  function scheduleRefresh() {
    invalidate(); designPending = true;
    if (state) commit({ instruction: "", highlightedActionId: undefined, clarificationOptions: undefined, busy: true });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void refresh(); }, 250);
  }
  function urlChanged() {
    if (location.href === url) return;
    url = location.href;
    if (goalFrom && location.href === goalFrom) dropGoal();
    scheduleRefresh();
  }
  const observer = new MutationObserver((records) => {
    const relevant = records.some((record) => {
      if (isMack(record.target)) return false;
      if (record.type === "childList") return [...record.addedNodes, ...record.removedNodes].some((node) => !isMack(node));
      return true;
    });
    if (!relevant) return;
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(pageChanged, 400);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["href", "disabled", "aria-disabled", "hidden", "class", "style", "aria-label", "aria-expanded"] });
  window.addEventListener("popstate", urlChanged); window.addEventListener("hashchange", urlChanged);
  const urlPoll = setInterval(urlChanged, 500);
  void refresh();
  return { exit, refresh, request, getState: () => state, getExtraction: () => extraction };
}
