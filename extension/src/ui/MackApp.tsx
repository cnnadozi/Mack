import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, ChevronUp, Maximize2, Mic, RotateCcw, Sparkles, X, type LucideIcon } from "lucide-react";
import type { LensAppProps, LensUIState, ScreenSection, SiteLogo, TaskButton, VoiceState } from "../../../shared/contracts";
import { isMoreSection } from "./design/validate";
import { taskIcon } from "./taskIcon";
import { themeStyle } from "./theme";

export type MackAppProps = LensAppProps;

type Dock = "bottom-right" | "bottom-left" | "top-left" | "top-right";
const DOCK_ORDER: Dock[] = ["bottom-right", "bottom-left", "top-left", "top-right"];

const VOICE_STATUS: Record<VoiceState, string> = {
  idle: "",
  listening: "Listening… press Stop when you are done.",
  processing: "Working on what you said…",
  speaking: "Speaking…",
  error: "The microphone is not available. You can type instead.",
};

function IconButton(props: { icon: LucideIcon; label: string; onClick(): void; expanded?: boolean; controls?: string }) {
  const Glyph = props.icon;
  return (
    <button
      type="button"
      className="mack-icon-btn"
      aria-label={props.label}
      title={props.label}
      aria-expanded={props.expanded}
      aria-controls={props.controls}
      onClick={props.onClick}
    >
      <Glyph size={24} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}

// The site's own logo keeps users sure they are still on that site; Mack is credited beside it.
function Brand({ logo }: { logo?: SiteLogo }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo?.src]);
  return (
    <p className="mack-brand">
      {logo && (
        <span className="mack-logo" style={{ background: logo.background }}>
          {failed ? (
            <span className="mack-logo-text">{logo.alt}</span>
          ) : (
            <img src={logo.src} alt={logo.alt} onError={() => setFailed(true)} />
          )}
        </span>
      )}
      <span className="mack-brand-mack">
        <Sparkles size={15} strokeWidth={2.4} aria-hidden="true" />
        {logo ? "Simplified by Mack" : "Mack"}
      </span>
    </p>
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
    <div className="mack" data-mode={state.screen.mode} aria-busy={state.busy || undefined} style={themeStyle(state.accentColor)}>
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
          <IconButton icon={ArrowLeft} label="Previous page" onClick={onPreviousPage} />
          <div className="mack-heading">
            <Brand logo={state.siteLogo} />
            <h1 className="mack-title">{screen.title}</h1>
          </div>
          <div className="mack-toolbar" role="toolbar" aria-label="Mack controls">
            <button type="button" className="mack-btn" onClick={onShowOriginal}>Original page</button>
            <button type="button" className="mack-btn" onClick={onExit}>Exit Mack</button>
          </div>
        </header>

        <Guidance {...props} />

        <div ref={gridRef} className="mack-tasks" key={screen.snapshotVersion}>
          {mainSections.map((section, index) => (
            <SectionView
              key={section.id}
              section={section}
              index={index}
              idPrefix={badgeId}
              variant="main"
              withPrimary={index === 0}
              {...sectionProps}
            />
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
                <span className="mack-chevron" data-open={moreOpen || undefined}>
                  <ChevronRight size={22} strokeWidth={2.6} aria-hidden="true" />
                </span>
                {moreOpen ? "Fewer options" : `More options (${moreCount})`}
              </button>
              {moreOpen && (
                <div id={`${badgeId}-more`} className="mack-more-list">
                  {moreSections.map((section, index) => (
                    <SectionView key={section.id} section={section} index={index + 1} idPrefix={badgeId} variant="more" {...sectionProps} />
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

type Variant = "primary" | "card" | "row";

function SectionView(props: {
  section: ScreenSection;
  index: number;
  idPrefix: string;
  variant: "main" | "more";
  withPrimary?: boolean;
  highlightedActionId?: string;
  badgeId: string;
  onAction(id: string): void;
}) {
  const { section, index, idPrefix, variant, withPrimary, highlightedActionId, badgeId, onAction } = props;
  const headingId = `${idPrefix}-${section.id}`;
  // The first button of the first main section is the single most likely next step, so it leads visually.
  const [primary, ...rest] = withPrimary ? section.buttons : [undefined, ...section.buttons];
  const restVariant: Variant = variant === "more" ? "row" : "card";
  const task = (button: TaskButton, kind: Variant, order: number) => (
    <TaskButtonView
      button={button}
      variant={kind}
      order={order}
      highlighted={button.actionId === highlightedActionId}
      badgeId={badgeId}
      onAction={onAction}
    />
  );
  return (
    <section className="mack-section" data-variant={variant} aria-labelledby={section.heading ? headingId : undefined}>
      {section.heading ? (
        <h2 id={headingId}>{section.heading}</h2>
      ) : (
        index > 0 && <h2 className="mack-visually-hidden">More actions</h2>
      )}
      {primary && <div className="mack-primary-slot">{task(primary, "primary", 0)}</div>}
      {rest.length > 0 && (
        <ul className={restVariant === "row" ? "mack-list" : "mack-grid"}>
          {rest.map((button, i) => button && <li key={button.actionId}>{task(button, restVariant, i + 1)}</li>)}
        </ul>
      )}
    </section>
  );
}

function TaskButtonView(props: {
  button: TaskButton;
  variant: Variant;
  order: number;
  highlighted: boolean;
  badgeId: string;
  onAction(id: string): void;
}) {
  const { button, variant, order, highlighted, badgeId, onAction } = props;
  const Glyph = taskIcon(button.label);
  const Trail = variant === "row" ? ChevronRight : ArrowRight;
  return (
    <button
      type="button"
      className="mack-task"
      data-variant={variant}
      data-action-id={button.actionId}
      data-highlighted={highlighted || undefined}
      aria-describedby={highlighted ? badgeId : undefined}
      style={{ "--order": order } as CSSProperties}
      onClick={() => onAction(button.actionId)}
    >
      <span className="mack-task-icon" aria-hidden="true">
        <Glyph size={variant === "primary" ? 30 : 26} strokeWidth={2.2} />
      </span>
      <span className="mack-task-label">{button.label}</span>
      {highlighted ? (
        <span className="mack-badge" id={badgeId}>Next step</span>
      ) : (
        variant !== "card" && <Trail className="mack-task-trail" size={26} strokeWidth={2.4} aria-hidden="true" />
      )}
    </button>
  );
}

function OriginalPanel(props: MackAppProps) {
  const { state, onBack, onPreviousPage, onExit } = props;
  const [dock, setDock] = useState<Dock>("bottom-right");
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();
  const nextDock = DOCK_ORDER[(DOCK_ORDER.indexOf(dock) + 1) % DOCK_ORDER.length];

  // New guidance or an error must never stay hidden behind the collapsed bar.
  useEffect(() => setCollapsed(false), [state.instruction, state.error, state.clarificationOptions]);

  return (
    <aside className="mack-panel" data-dock={dock} data-collapsed={collapsed || undefined} aria-label="Mack guide">
      <header className="mack-panel-header">
        <IconButton icon={ArrowLeft} label="Previous page" onClick={onPreviousPage} />
        <div className="mack-heading">
          <Brand logo={state.siteLogo} />
          <h1 className="mack-title">{state.screen.title}</h1>
        </div>
        <div className="mack-panel-tools">
          <IconButton
            icon={collapsed ? ChevronUp : ChevronDown}
            label={collapsed ? "Expand" : "Minimize"}
            expanded={!collapsed}
            controls={bodyId}
            onClick={() => setCollapsed(!collapsed)}
          />
          <IconButton icon={Maximize2} label="Full screen" onClick={onBack} />
          <IconButton icon={X} label="Exit Mack" onClick={onExit} />
        </div>
      </header>
      {!collapsed && (
        <div id={bodyId} className="mack-panel-body">
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
        </div>
      )}
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
          <Mic size={22} strokeWidth={2.4} aria-hidden="true" />
          {listening ? "Stop" : "Speak"}
        </button>
        <button type="button" className="mack-btn" onClick={onReplay} disabled={!state.instruction}>
          <RotateCcw size={22} strokeWidth={2.4} aria-hidden="true" />
          Repeat instruction
        </button>
      </div>
    </form>
  );
}
