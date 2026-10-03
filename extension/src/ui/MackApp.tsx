import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { LensAppProps, LensUIState, TaskButton, VoiceState } from "../../../shared/contracts";

type Dock = "bottom-right" | "bottom-left" | "top-left" | "top-right";
const DOCK_ORDER: Dock[] = ["bottom-right", "bottom-left", "top-left", "top-right"];

const VOICE_STATUS: Record<VoiceState, string> = {
  idle: "",
  listening: "Listening… press Stop when you are done.",
  processing: "Working on what you said…",
  speaking: "Speaking…",
  error: "The microphone is not available. You can type instead.",
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function MackApp(props: LensAppProps) {
  const { state, onRendered } = props;
  const { screenVersion } = state.screen;
  const lastAcked = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Role 4 treats this as a one-time acknowledgement per committed version, not a render signal.
    if (lastAcked.current === screenVersion) return;
    lastAcked.current = screenVersion;
    onRendered(screenVersion);
  }, [screenVersion, onRendered]);

  return (
    <div className="mack" data-mode={state.screen.mode} aria-busy={state.busy || undefined}>
      {state.screen.mode === "original" ? <OriginalPanel {...props} /> : <SimplifiedView {...props} />}
    </div>
  );
}

function SimplifiedView(props: LensAppProps) {
  const { state, onAction, onBack, onShowOriginal, onExit } = props;
  const { screen, highlightedActionId } = state;
  const badgeId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const buttonCount = screen.sections.reduce((n, s) => n + s.buttons.length, 0);

  useEffect(() => {
    if (!highlightedActionId) return;
    const target = Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-action-id]") ?? []).find(
      (el) => el.dataset.actionId === highlightedActionId,
    );
    target?.scrollIntoView?.({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [highlightedActionId, screen.screenVersion]);

  return (
    <section className="mack-overlay" aria-label="Mack simplified view">
      <div className="mack-shell">
        <header className="mack-header">
          <h1 className="mack-title">{screen.title}</h1>
          <div className="mack-toolbar" role="toolbar" aria-label="Mack controls">
            <button type="button" className="mack-btn" onClick={onBack}>Back</button>
            <button type="button" className="mack-btn" onClick={onShowOriginal}>Original page</button>
            <button type="button" className="mack-btn" onClick={onExit}>Exit Mack</button>
          </div>
        </header>

        <Guidance {...props} />

        <div ref={gridRef}>
          {screen.sections.map((section, index) => (
            <section key={section.id} className="mack-section" aria-labelledby={section.heading ? `${badgeId}-${section.id}` : undefined}>
              {section.heading ? (
                <h2 id={`${badgeId}-${section.id}`}>{section.heading}</h2>
              ) : (
                index > 0 && <h2 className="mack-visually-hidden">More actions</h2>
              )}
              <ul className="mack-grid">
                {section.buttons.map((button) => (
                  <li key={button.actionId}>
                    <TaskButtonView
                      button={button}
                      highlighted={button.actionId === highlightedActionId}
                      badgeId={`${badgeId}-badge`}
                      onAction={onAction}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {buttonCount === 0 && !state.busy && (
            <p className="mack-empty">No simple actions are ready for this page yet. You can ask below or open the original page.</p>
          )}
        </div>

        <RequestBar {...props} />
      </div>
    </section>
  );
}

function TaskButtonView(props: { button: TaskButton; highlighted: boolean; badgeId: string; onAction(id: string): void }) {
  const { button, highlighted, badgeId, onAction } = props;
  return (
    <button
      type="button"
      className="mack-task"
      data-action-id={button.actionId}
      data-highlighted={highlighted || undefined}
      aria-describedby={highlighted ? badgeId : undefined}
      onClick={() => onAction(button.actionId)}
    >
      <span>{button.label}</span>
      {highlighted && <span className="mack-badge" id={badgeId}>Next step</span>}
    </button>
  );
}

function OriginalPanel(props: LensAppProps) {
  const { state, onBack, onExit } = props;
  const [dock, setDock] = useState<Dock>("bottom-right");
  const nextDock = DOCK_ORDER[(DOCK_ORDER.indexOf(dock) + 1) % DOCK_ORDER.length];

  return (
    <aside className="mack-panel" data-dock={dock} aria-label="Mack guide">
      <header className="mack-header">
        <h1 className="mack-title">{state.screen.title}</h1>
        <div className="mack-toolbar" role="toolbar" aria-label="Mack controls">
          <button type="button" className="mack-btn" onClick={onBack}>Back</button>
          <button
            type="button"
            className="mack-btn"
            onClick={() => setDock(nextDock)}
            aria-label={`Move this panel to the ${nextDock.replace("-", " ")}`}
          >
            Move
          </button>
          <button type="button" className="mack-btn" onClick={onExit}>Exit</button>
        </div>
      </header>
      <Guidance {...props} />
      <RequestBar {...props} compact />
    </aside>
  );
}

function Guidance(props: LensAppProps) {
  const { state, onRetry, onRequest } = props;
  const voiceStatus = VOICE_STATUS[state.voiceState];
  return (
    <>
      <p className="mack-instruction" aria-live="polite" aria-atomic="true">{state.instruction}</p>
      <div role="status" aria-live="polite">
        {state.busy && (
          <p className="mack-status"><span className="mack-spinner" aria-hidden="true" />Working…</p>
        )}
        {voiceStatus && <p className="mack-status">{voiceStatus}</p>}
      </div>
      {state.error && <ErrorBanner error={state.error} onRetry={onRetry} />}
      {state.clarificationOptions && state.clarificationOptions.length > 0 && (
        <div className="mack-choices">
          <h2>Did you mean:</h2>
          <ul>
            {state.clarificationOptions.map((option) => (
              <li key={option}>
                <button type="button" className="mack-btn" onClick={() => onRequest(option)}>{option}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ErrorBanner(props: { error: NonNullable<LensUIState["error"]>; onRetry(): void }) {
  return (
    <div className="mack-error" role="alert">
      <p>{props.error.message}</p>
      {props.error.retryable && (
        <button type="button" className="mack-btn" onClick={props.onRetry}>Try again</button>
      )}
    </div>
  );
}

function RequestBar(props: LensAppProps & { compact?: boolean }) {
  const { state, onRequest, onMicStart, onMicStop, onReplay } = props;
  const inputId = useId();
  const [draft, setDraft] = useState(state.transcript);

  useEffect(() => {
    // A new transcript replaces the draft so the user can see and correct what was heard.
    setDraft(state.transcript);
  }, [state.transcript]);

  const listening = state.voiceState === "listening";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onRequest(text);
    setDraft("");
  };

  return (
    <form className="mack-request" onSubmit={submit}>
      <label htmlFor={inputId}>{props.compact ? "Ask Mack" : "What do you want to do?"}</label>
      <div className="mack-request-row">
        <input
          id={inputId}
          className="mack-input"
          type="text"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type or press Speak"
        />
        <button type="submit" className="mack-btn mack-btn--primary" disabled={!draft.trim()}>Send</button>
      </div>
      <div className="mack-request-row">
        <button
          type="button"
          className="mack-btn"
          aria-pressed={listening}
          disabled={state.voiceState === "processing"}
          onClick={listening ? onMicStop : onMicStart}
        >
          {listening ? "Stop" : "Speak"}
        </button>
        <button type="button" className="mack-btn" onClick={onReplay} disabled={!state.instruction}>
          Repeat instruction
        </button>
      </div>
    </form>
  );
}
