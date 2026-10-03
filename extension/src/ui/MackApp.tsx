import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { LensAppProps, LensUIState, ScreenSection, TaskButton, VoiceState } from "../../../shared/contracts";
import { isMoreSection } from "./design/validate";

// Pending contract proposal: onPreviousPage joins LensAppProps once Role 4 lands it in shared/contracts.ts.
export type MackAppProps = LensAppProps & { onPreviousPage?(): void };

type Dock = "bottom-right" | "bottom-left" | "top-left" | "top-right";
const DOCK_ORDER: Dock[] = ["bottom-right", "bottom-left", "top-left", "top-right"];

const VOICE_STATUS: Record<VoiceState, string> = {
  idle: "",
  listening: "Listening… press Stop when you are done.",
  processing: "Working on what you said…",
  speaking: "Speaking…",
  error: "The microphone is not available. You can type instead.",
};

const ICONS = {
  back: "M15 5 8 12l7 7",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  close: "M6 6l12 12M18 6 6 18",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3",
  replay: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4",
  chevron: "M9 6l6 6-6 6",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="mack-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconButton(props: { icon: keyof typeof ICONS; label: string; onClick(): void }) {
  return (
    <button type="button" className="mack-icon-btn" aria-label={props.label} title={props.label} onClick={props.onClick}>
      <Icon name={props.icon} />
    </button>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function MackApp(props: MackAppProps) {
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

function SimplifiedView(props: MackAppProps) {
  const { state, onAction, onBack, onPreviousPage, onShowOriginal, onExit } = props;
  const { screen, highlightedActionId } = state;
  const badgeId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const buttonCount = screen.sections.reduce((n, s) => n + s.buttons.length, 0);
  const mainSections = screen.sections.filter((section) => !isMoreSection(section));
  const moreSections = screen.sections.filter(isMoreSection);
  const moreCount = moreSections.reduce((n, s) => n + s.buttons.length, 0);
  const [showMore, setShowMore] = useState(false);
  // A highlighted target must be visible before Role 4 speaks about it, so it opens the collapsed area.
  const highlightInMore = !!highlightedActionId && moreSections.some((s) => s.buttons.some((b) => b.actionId === highlightedActionId));
  const moreOpen = showMore || highlightInMore;
  const sectionProps = { highlightedActionId, badgeId: `${badgeId}-badge`, onAction };

  useEffect(() => setShowMore(false), [screen.snapshotVersion]);

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
          <IconButton icon="back" label="Previous page" onClick={onPreviousPage ?? onBack} />
          <h1 className="mack-title">{screen.title}</h1>
          <div className="mack-toolbar" role="toolbar" aria-label="Mack controls">
            <button type="button" className="mack-btn" onClick={onShowOriginal}>Original page</button>
            <button type="button" className="mack-btn" onClick={onExit}>Exit Mack</button>
          </div>
        </header>

        <Guidance {...props} />

        <div ref={gridRef}>
          {mainSections.map((section, index) => (
            <SectionView key={section.id} section={section} index={index} idPrefix={badgeId} {...sectionProps} />
          ))}
          {moreSections.length > 0 && (
            <div className="mack-more">
              <button
                type="button"
                className="mack-btn mack-more-toggle"
                aria-expanded={moreOpen}
                aria-controls={`${badgeId}-more`}
                onClick={() => setShowMore(!moreOpen)}
              >
                <span className="mack-chevron" data-open={moreOpen || undefined}><Icon name="chevron" /></span>
                {moreOpen ? "Fewer options" : `More options (${moreCount})`}
              </button>
              {moreOpen && (
                <div id={`${badgeId}-more`}>
                  {moreSections.map((section, index) => (
                    <SectionView key={section.id} section={section} index={index + 1} idPrefix={badgeId} {...sectionProps} />
                  ))}
                </div>
              )}
            </div>
          )}
          {buttonCount === 0 && !state.busy && (
            <p className="mack-empty">No simple actions are ready for this page yet. You can ask below or open the original page.</p>
          )}
        </div>

        <RequestBar {...props} />
      </div>
    </section>
  );
}

function SectionView(props: {
  section: ScreenSection;
  index: number;
  idPrefix: string;
  highlightedActionId?: string;
  badgeId: string;
  onAction(id: string): void;
}) {
  const { section, index, idPrefix, highlightedActionId, badgeId, onAction } = props;
  const headingId = `${idPrefix}-${section.id}`;
  return (
    <section className="mack-section" aria-labelledby={section.heading ? headingId : undefined}>
      {section.heading ? (
        <h2 id={headingId}>{section.heading}</h2>
      ) : (
        index > 0 && <h2 className="mack-visually-hidden">More actions</h2>
      )}
      <ul className="mack-grid">
        {section.buttons.map((button) => (
          <li key={button.actionId}>
            <TaskButtonView
              button={button}
              highlighted={button.actionId === highlightedActionId}
              badgeId={badgeId}
              onAction={onAction}
            />
          </li>
        ))}
      </ul>
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

function OriginalPanel(props: MackAppProps) {
  const { state, onBack, onPreviousPage, onExit } = props;
  const [dock, setDock] = useState<Dock>("bottom-right");
  const nextDock = DOCK_ORDER[(DOCK_ORDER.indexOf(dock) + 1) % DOCK_ORDER.length];

  return (
    <aside className="mack-panel" data-dock={dock} aria-label="Mack guide">
      <header className="mack-panel-header">
        {onPreviousPage ? <IconButton icon="back" label="Previous page" onClick={onPreviousPage} /> : <span />}
        <h1 className="mack-title">{state.screen.title}</h1>
        <div className="mack-panel-tools">
          <IconButton icon="expand" label="Full screen" onClick={onBack} />
          <IconButton icon="close" label="Exit Mack" onClick={onExit} />
        </div>
      </header>
      <Guidance {...props} />
      <RequestBar {...props} compact />
      <footer className="mack-panel-footer">
        <button
          type="button"
          className="mack-btn"
          onClick={() => setDock(nextDock)}
          aria-label={`Move this panel to the ${nextDock.replace("-", " ")}`}
          title={`Move this panel to the ${nextDock.replace("-", " ")}`}
        >
          Move panel
        </button>
      </footer>
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
          <Icon name="mic" />
          {listening ? "Stop" : "Speak"}
        </button>
        <button type="button" className="mack-btn" onClick={onReplay} disabled={!state.instruction}>
          <Icon name="replay" />
          Repeat instruction
        </button>
      </div>
    </form>
  );
}
