import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  LoaderCircle,
  Maximize,
  Mic,
  RotateCcw,
  X,
} from "lucide-react";

import type {
  LensAppProps,
  LensUIState,
  ScreenSection,
  TaskButton,
  VoiceState,
} from "../../../shared/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isMoreSection } from "./design/validate";
import type { ScreenDetails } from "./details";
import { RichView } from "./RichView";
import { SiteLogoView, SiteSearchBox } from "./site";
import { paletteFor } from "./theme";

export type MackAppProps = LensAppProps & {
  /**
   * The extension's own on-page panel takes the typed and spoken requests, so the
   * request bar is left out, and on the original page only a small guide is shown.
   */
  embedded?: boolean;
  /** One wide column of buttons, for the simplest screen. */
  singleColumn?: boolean;
  /**
   * Detail from the extension that turns the screen into a redesign of the page
   * (see details.ts and RichView.tsx). Without it the plain list of buttons is shown.
   */
  details?: ScreenDetails;
};

type Dock = "bottom-right" | "bottom-left" | "top-left" | "top-right";
const DOCK_ORDER: Dock[] = ["bottom-right", "bottom-left", "top-left", "top-right"];
const DOCK_CLASS: Record<Dock, string> = {
  "bottom-right": "right-4 bottom-4",
  "bottom-left": "bottom-4 left-4",
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
};

// Just under the extension's own panel, which must stay on top of the simple view.
const LAYER = "z-[2147483646]";

const VOICE_STATUS: Record<VoiceState, string> = {
  idle: "",
  listening: "Listening… press Stop when you are done.",
  processing: "Working on what you said…",
  speaking: "Speaking…",
  error: "The microphone is not available. You can type instead.",
};

function IconButton(props: {
  icon: ReactNode;
  label: string;
  onClick(): void;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-12 rounded-xl [&_svg:not([class*='size-'])]:size-6"
      aria-label={props.label}
      title={props.label}
      aria-expanded={props.expanded}
      aria-controls={props.controls}
      onClick={props.onClick}
    >
      {props.icon}
    </Button>
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
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

  const original = props.embedded ? <EmbeddedGuide {...props} /> : <OriginalPanel {...props} />;
  return (
    <div
      className="mack font-sans text-base text-foreground antialiased"
      // The site's brand colour, made readable. Not "--accent": that is a shadcn token.
      style={{ "--brand": paletteFor(state.accentColor).accent } as CSSProperties}
      data-mode={state.screen.mode}
      aria-busy={state.busy || undefined}
    >
      {state.screen.mode === "original" ? (
        original
      ) : props.details ? (
        <RichView {...props} details={props.details} guidance={<Guidance {...props} />} />
      ) : (
        <SimplifiedView {...props} />
      )}
    </div>
  );
}

function SimplifiedView(props: MackAppProps) {
  const { state, onAction, onSearch, onPreviousPage, onShowOriginal, onExit } = props;
  const { screen, highlightedActionId } = state;
  const badgeId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const buttonCount = screen.sections.reduce((n, s) => n + s.buttons.length, 0);
  const mainSections = screen.sections.filter((section) => !isMoreSection(section));
  const moreSections = screen.sections.filter(isMoreSection);
  const moreCount = moreSections.reduce((n, s) => n + s.buttons.length, 0);
  const [showMore, setShowMore] = useState(false);
  // A highlighted target must be visible before Role 4 speaks about it, so it opens the collapsed area.
  const highlightInMore =
    !!highlightedActionId &&
    moreSections.some((s) => s.buttons.some((b) => b.actionId === highlightedActionId));
  const moreOpen = showMore || highlightInMore;
  const sectionProps = {
    highlightedActionId,
    badgeId: `${badgeId}-badge`,
    onAction,
    singleColumn: props.singleColumn,
  };

  useEffect(() => setShowMore(false), [screen.snapshotVersion]);

  useEffect(() => {
    if (!highlightedActionId) return;
    const target = Array.from(
      gridRef.current?.querySelectorAll<HTMLElement>("[data-action-id]") ?? [],
    ).find((el) => el.dataset.actionId === highlightedActionId);
    target?.scrollIntoView?.({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [highlightedActionId, screen.screenVersion]);

  return (
    <section
      className={cn(
        "mack-overlay fixed inset-0 overflow-y-auto overscroll-contain bg-background",
        LAYER,
      )}
      aria-label="Mack simplified view"
    >
      <div
        className={cn(
          "mx-auto flex min-h-full max-w-[820px] flex-col gap-5 px-4 pt-6",
          // Room to scroll the last buttons clear of the extension's floating bar.
          props.embedded ? "pb-40" : "pb-0",
        )}
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <IconButton icon={<ArrowLeft />} label="Previous page" onClick={onPreviousPage} />
          <h1 className="m-0 min-w-0 flex-[1_1_200px] truncate text-xl leading-tight font-semibold">
            {screen.title}
          </h1>
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Mack controls">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4 text-xl"
              onClick={onShowOriginal}
            >
              Original page
            </Button>
            <Button type="button" variant="outline" className="h-11 px-4 text-xl" onClick={onExit}>
              Exit Mack
            </Button>
          </div>
        </header>

        {state.siteLogo && (
          <div className="flex flex-wrap items-center gap-3">
            <SiteLogoView logo={state.siteLogo} />
            <span className="text-sm text-muted-foreground">Simplified by Mack</span>
          </div>
        )}
        {screen.search && <SiteSearchBox search={screen.search} onSearch={onSearch} />}

        <Guidance {...props} />

        <div ref={gridRef} className="flex flex-col gap-6">
          {mainSections.map((section, index) => (
            <SectionView
              key={section.id}
              section={section}
              index={index}
              idPrefix={badgeId}
              variant={index === 0 ? "lead" : "card"}
              {...sectionProps}
            />
          ))}
          {moreSections.length > 0 && (
            <div className="flex flex-col gap-6">
              <Button
                type="button"
                variant="ghost"
                className="h-11 self-start px-3 text-xl"
                aria-expanded={moreOpen}
                aria-controls={`${badgeId}-more`}
                onClick={() => setShowMore(!moreOpen)}
              >
                <ChevronRight
                  className={cn(
                    "size-5 transition-transform motion-reduce:transition-none",
                    moreOpen && "rotate-90",
                  )}
                />
                {moreOpen ? "Fewer options" : `More options (${moreCount})`}
              </Button>
              {moreOpen && (
                <div id={`${badgeId}-more`} className="flex flex-col gap-6">
                  {moreSections.map((section, index) => (
                    <SectionView
                      key={section.id}
                      section={section}
                      index={index + 1}
                      idPrefix={badgeId}
                      variant="row"
                      {...sectionProps}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {buttonCount === 0 && !state.busy && (
            <p className="m-0 text-xl text-muted-foreground">
              No simple actions are ready for this page yet. You can ask below or open the original
              page.
            </p>
          )}
        </div>

        {!props.embedded && <RequestBar {...props} />}
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
  singleColumn?: boolean;
  /** "lead" makes the section's first button the one primary next step. */
  variant: "lead" | "card" | "row";
  onAction(id: string): void;
}) {
  const { section, index, idPrefix, highlightedActionId, badgeId, onAction } = props;
  const headingId = `${idPrefix}-${section.id}`;
  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby={section.heading ? headingId : undefined}
    >
      {section.heading ? (
        <h2 id={headingId} className="m-0 text-xl font-semibold">
          {section.heading}
        </h2>
      ) : (
        index > 0 && <h2 className="sr-only">More actions</h2>
      )}
      <ul
        className={cn(
          "m-0 grid list-none grid-cols-1 gap-3 p-0",
          !props.singleColumn && "sm:grid-cols-2",
        )}
      >
        {section.buttons.map((button, position) => (
          <li key={button.actionId}>
            <TaskButtonView
              button={button}
              variant={
                props.variant === "row"
                  ? "row"
                  : props.variant === "lead" && position === 0
                    ? "primary"
                    : "card"
              }
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

function TaskButtonView(props: {
  button: TaskButton;
  highlighted: boolean;
  variant: "primary" | "card" | "row";
  badgeId: string;
  onAction(id: string): void;
}) {
  const { button, highlighted, variant, badgeId, onAction } = props;
  return (
    <Button
      type="button"
      variant={
        highlighted || variant === "primary" ? "default" : variant === "row" ? "ghost" : "outline"
      }
      data-variant={variant}
      className={cn(
        "h-full min-h-16 w-full justify-between gap-3 rounded-xl px-5 py-4 text-left text-2xl font-semibold whitespace-normal",
        variant === "row" && "min-h-12 py-2 text-xl font-medium",
        highlighted &&
          "ring-4 ring-ring/60 forced-colors:outline-4 forced-colors:outline-[Highlight]",
      )}
      data-action-id={button.actionId}
      data-highlighted={highlighted || undefined}
      aria-describedby={highlighted ? badgeId : undefined}
      onClick={() => onAction(button.actionId)}
    >
      <span>{button.label}</span>
      {highlighted && (
        <Badge
          variant="secondary"
          className="px-2.5 py-1 text-sm forced-colors:border-2 forced-colors:border-[CanvasText]"
          id={badgeId}
        >
          Next step
        </Badge>
      )}
    </Button>
  );
}

function OriginalPanel(props: MackAppProps) {
  const { state, onBack, onPreviousPage, onExit } = props;
  const [dock, setDock] = useState<Dock>("bottom-right");
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();
  const nextDock = DOCK_ORDER[(DOCK_ORDER.indexOf(dock) + 1) % DOCK_ORDER.length]!;

  // New guidance or an error must never stay hidden behind the collapsed bar.
  useEffect(
    () => setCollapsed(false),
    [state.instruction, state.error, state.clarificationOptions],
  );

  return (
    <aside
      className={cn("fixed w-[min(420px,calc(100vw-32px))]", LAYER, DOCK_CLASS[dock])}
      data-dock={dock}
      data-collapsed={collapsed || undefined}
      aria-label="Mack guide"
    >
      <Card className="max-h-[calc(100vh-32px)] gap-4 overflow-y-auto p-4 shadow-lg">
        <header className="flex items-center gap-2">
          <IconButton icon={<ArrowLeft />} label="Previous page" onClick={onPreviousPage} />
          <h1 className="m-0 min-w-0 flex-1 truncate text-xl font-bold">{state.screen.title}</h1>
          <div className="flex gap-2">
            <IconButton
              icon={collapsed ? <ChevronUp /> : <ChevronDown />}
              label={collapsed ? "Expand" : "Minimize"}
              expanded={!collapsed}
              controls={bodyId}
              onClick={() => setCollapsed(!collapsed)}
            />
            <IconButton icon={<Maximize />} label="Full screen" onClick={onBack} />
            <IconButton icon={<X />} label="Exit Mack" onClick={onExit} />
          </div>
        </header>
        {!collapsed && (
          <div id={bodyId} className="flex flex-col gap-4">
            <Guidance {...props} />
            <RequestBar {...props} compact />
            <footer>
              <Button
                type="button"
                variant="ghost"
                className="h-11 px-3 text-base"
                onClick={() => setDock(nextDock)}
                aria-label={`Move this panel to the ${nextDock.replace("-", " ")}`}
                title={`Move this panel to the ${nextDock.replace("-", " ")}`}
              >
                Move panel
              </Button>
            </footer>
          </div>
        )}
      </Card>
    </aside>
  );
}

// What the embedded app shows over the original page: Mack's instruction for the
// highlighted control, if there is one, and the way back to the simple view.
function EmbeddedGuide(props: MackAppProps) {
  const { state, onBack } = props;
  const hasGuidance =
    state.busy || !!state.instruction || !!state.error || !!state.clarificationOptions?.length;
  return (
    <aside
      className={cn(
        "fixed top-4 right-4 flex w-[min(360px,calc(100vw-32px))] flex-col items-end gap-2",
        LAYER,
      )}
      aria-label="Mack guide"
    >
      <Button
        type="button"
        variant="outline"
        className="h-11 bg-background px-4 text-base shadow-md"
        onClick={onBack}
      >
        <LayoutGrid />
        Simple view
      </Button>
      {hasGuidance && (
        <Card className="w-full gap-3 p-4 shadow-lg">
          <Guidance {...props} />
        </Card>
      )}
    </aside>
  );
}

function Guidance(props: MackAppProps) {
  const { state, onRetry, onRequest } = props;
  // The extension's panel already shows whether Mack is listening or speaking.
  const voiceStatus = props.embedded ? "" : VOICE_STATUS[state.voiceState];
  return (
    <>
      <p className="m-0 text-xl font-medium empty:hidden" aria-live="polite" aria-atomic="true">
        {state.instruction}
      </p>
      <div role="status" aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        {state.busy && (
          <p className="m-0 flex items-center gap-2 text-xl text-muted-foreground">
            <LoaderCircle
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Working…
          </p>
        )}
        {voiceStatus && <p className="m-0 text-xl text-muted-foreground">{voiceStatus}</p>}
      </div>
      {state.error && <ErrorBanner error={state.error} onRetry={onRetry} />}
      {state.clarificationOptions && state.clarificationOptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-xl font-semibold">Did you mean:</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {state.clarificationOptions.map((option) => (
              <li key={option}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4 text-xl"
                  onClick={() => onRequest(option)}
                >
                  {option}
                </Button>
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
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xl text-destructive"
      role="alert"
    >
      <p className="m-0 min-w-0 flex-1">{props.error.message}</p>
      {props.error.retryable && (
        <Button
          type="button"
          variant="outline"
          className="h-11 px-4 text-xl text-foreground"
          onClick={props.onRetry}
        >
          Try again
        </Button>
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
    <form
      className={cn(
        "flex flex-col gap-3",
        !props.compact && "sticky bottom-0 mt-auto border-t bg-background py-4",
      )}
      onSubmit={submit}
    >
      <Label htmlFor={inputId} className="text-xl">
        {props.compact ? "Ask Mack" : "What do you want to do?"}
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          className="h-12 text-xl md:text-xl"
          type="text"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type or press Speak"
        />
        <Button type="submit" className="h-12 px-5 text-xl" disabled={!draft.trim()}>
          Send
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={listening ? "destructive" : "outline"}
          className="h-11 px-4 text-xl [&_svg:not([class*='size-'])]:size-5"
          aria-pressed={listening}
          disabled={state.voiceState === "processing"}
          onClick={listening ? onMicStop : onMicStart}
        >
          <Mic />
          {listening ? "Stop" : "Speak"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-4 text-xl [&_svg:not([class*='size-'])]:size-5"
          onClick={onReplay}
          disabled={!state.instruction}
        >
          <RotateCcw />
          Repeat instruction
        </Button>
      </div>
    </form>
  );
}
