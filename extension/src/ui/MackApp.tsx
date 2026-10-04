import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronRight, ChevronUp, Maximize2, Mic, Moon, RotateCcw, Search, Sun, X,
  type LucideIcon,
} from "lucide-react";
import type { LensAppProps, LensUIState, ScreenSection, SiteLogo, SiteSearch, TaskButton, VoiceState } from "../../../shared/contracts";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./components/ui/collapsible";
import { Input } from "./components/ui/input";
import { PortalContainerContext, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { isMoreSection } from "./design/validate";
import { cn } from "./lib/utils";
import { loadTheme, onThemeChange, saveTheme, systemTheme } from "./preferences";
import { taskIcon } from "./taskIcon";
import { themeStyle, type ThemeMode } from "./theme";
import { useTranslator, type MessageKey } from "./i18n";

export type MackAppProps = LensAppProps & {
  /** Inside the extension, Mack's bar takes typed and spoken requests and shows the voice state, so the view leaves those out. */
  embedded?: boolean;
};

type Dock = "bottom-right" | "bottom-left" | "top-left" | "top-right";
const DOCK_ORDER: Dock[] = ["bottom-right", "bottom-left", "top-left", "top-right"];

const VOICE_STATUS: Record<VoiceState, MessageKey | undefined> = {
  idle: undefined,
  listening: "voiceListening",
  processing: "voiceProcessing",
  speaking: "voiceSpeaking",
  error: "voiceError",
};

// Sizes stay large for older users: 48px icon targets, 19-24px labels (shadcn's defaults are smaller).
const CONTROL = "h-12 px-4 text-[19px] font-semibold rounded-xl [&_svg]:size-[22px]";
const FIELD = "h-14 rounded-xl border-2 px-4 text-[22px] md:text-[22px] bg-card";

function IconButton(props: { icon: LucideIcon; label: string; onClick(): void; expanded?: boolean; controls?: string }) {
  const Glyph = props.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12 shrink-0 rounded-xl border-2 [&_svg]:size-6"
          aria-label={props.label}
          aria-expanded={props.expanded}
          aria-controls={props.controls}
          onClick={props.onClick}
        >
          <Glyph strokeWidth={2.4} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  );
}

function ThemeToggle({ mode, onToggle }: { mode: ThemeMode; onToggle(): void }) {
  const { t } = useTranslator();
  return <IconButton icon={mode === "dark" ? Sun : Moon} label={mode === "dark" ? t("lightMode") : t("darkMode")} onClick={onToggle} />;
}

// The site's own logo, or its name when it has none, keeps users sure they are still on that site.
function Brand({ logo, name }: { logo?: SiteLogo; name?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo?.src]);
  if (!logo && !name) return null;
  return (
    <p className="mack-brand">
      {logo && (
        <span className="mack-logo" data-kind={logo.kind ?? "logo"} style={{ background: logo.background }}>
          {!failed && (
            <img
              src={logo.src}
              alt={logo.kind === "icon" ? "" : logo.alt}
              onError={() => setFailed(true)}
            />
          )}
          {/* A bare site icon or a broken image does not say which site this is, so the name is written out. */}
          {(failed || logo.kind === "icon") && <span className="mack-logo-text">{logo.alt}</span>}
        </span>
      )}
      {!logo && name && (
        <span className="mack-logo" data-kind="name">
          <span className="mack-logo-text">{name}</span>
        </span>
      )}
    </p>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function useTheme(): [ThemeMode, () => void] {
  const [mode, setMode] = useState<ThemeMode>(systemTheme);
  useEffect(() => {
    let live = true;
    let changed = false;
    void loadTheme().then((saved) => { if (live && saved && !changed) setMode(saved); });
    const stop = onThemeChange((next) => { changed = true; setMode(next ?? systemTheme()); });
    return () => { live = false; stop(); };
  }, []);
  const toggle = () => setMode((current) => {
    const next = current === "dark" ? "light" : "dark";
    saveTheme(next);
    return next;
  });
  return [mode, toggle];
}

export function MackApp(props: MackAppProps) {
  const { dir, lang } = useTranslator();
  const { state, onRendered } = props;
  const { screenVersion } = state.screen;
  const lastAcked = useRef<string | undefined>(undefined);
  const [mode, toggleMode] = useTheme();
  // Tooltips portal here, inside the themed root, so they get Mack's styles and stay usable while the page is inert.
  const [portal, setPortal] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Role 4 treats this as a one-time acknowledgement per committed version, not a render signal.
    if (lastAcked.current === screenVersion) return;
    lastAcked.current = screenVersion;
    onRendered(screenVersion);
  }, [screenVersion, onRendered]);

  return (
    <div
      className={cn("mack", mode === "dark" && "dark")}
      data-theme={mode}
      data-mode={state.screen.mode}
      dir={dir}
      lang={lang}
      aria-busy={state.busy || undefined}
      style={themeStyle(state.accentColor, mode)}
    >
      <PortalContainerContext.Provider value={portal}>
        <TooltipProvider>
          {state.screen.mode === "original"
            ? <OriginalPanel {...props} mode={mode} onToggleMode={toggleMode} />
            : <SimplifiedView {...props} mode={mode} onToggleMode={toggleMode} />}
        </TooltipProvider>
      </PortalContainerContext.Provider>
      <div ref={setPortal} className="mack-portal" />
    </div>
  );
}

type ViewProps = MackAppProps & { mode: ThemeMode; onToggleMode(): void };

function SimplifiedView(props: ViewProps) {
  const { t } = useTranslator();
  const { state, onAction, onPreviousPage, onShowOriginal, onExit, mode, onToggleMode } = props;
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
    <section className="mack-overlay" aria-label={t("simplifiedView")}>
      <div className="mack-shell" data-embedded={props.embedded || undefined}>
        <Card className="mack-header">
          <IconButton icon={ArrowLeft} label={t("previousPage")} onClick={onPreviousPage} />
          <div className="mack-heading">
            <Brand logo={state.siteLogo} name={state.siteName} />
            <h1 className="mack-title">{screen.title}</h1>
          </div>
          <div className="mack-toolbar" role="toolbar" aria-label={t("controls")}>
            <ThemeToggle mode={mode} onToggle={onToggleMode} />
            <Button type="button" variant="outline" className={cn(CONTROL, "border-2")} onClick={onShowOriginal}>{t("originalPage")}</Button>
            <Button type="button" variant="outline" className={cn(CONTROL, "border-2")} onClick={onExit}>{t("exitMack")}</Button>
          </div>
        </Card>

        <Guidance {...props} />

        {screen.search && <SearchBox search={screen.search} disabled={state.busy} highlighted={highlightedActionId === screen.search.actionId} onSearch={props.onSearch} key={screen.snapshotVersion} />}

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
            <Collapsible open={moreOpen} onOpenChange={setShowMore} className="mack-more">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className={cn(CONTROL, "mack-more-toggle h-14 self-start px-3 text-[20px] font-bold text-primary hover:text-primary")}>
                  <span className="mack-chevron" data-open={moreOpen || undefined}>
                    <ChevronRight strokeWidth={2.6} aria-hidden="true" />
                  </span>
                  {moreOpen ? t("fewerOptions") : t("moreOptions", { n: moreCount })}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mack-more-list">
                {moreSections.map((section, index) => (
                  <SectionView key={section.id} section={section} index={index + 1} idPrefix={badgeId} variant="more" {...sectionProps} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          {buttonCount === 0 && !state.busy && (
            <p className="mack-empty">{props.embedded ? t("noActions") : t("noActionsBelow")}</p>
          )}
          {buttonCount === 0 && state.busy && <LoadingCards />}
        </div>

        {!props.embedded && <RequestBar {...props} />}
      </div>
    </section>
  );
}

// The site's own search, front and centre when searching is what people come to do (e.g. a store).
function SearchBox(props: { search: SiteSearch; disabled: boolean; highlighted: boolean; onSearch(actionId: string, text: string): void }) {
  const { t } = useTranslator();
  const { search, disabled, highlighted, onSearch } = props;
  const inputId = useId();
  const [text, setText] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  // When Mack points here, the box is ready to type in.
  useEffect(() => {
    if (!highlighted) return;
    cardRef.current?.scrollIntoView?.({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    cardRef.current?.querySelector("input")?.focus({ preventScroll: true });
  }, [highlighted]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) onSearch(search.actionId, text.trim());
  };
  return (
    <Card ref={cardRef} className="mack-search" role="search" aria-labelledby={`${inputId}-label`} data-highlighted={highlighted || undefined}>
      <form onSubmit={submit} className="mack-search-form">
        <span className="mack-search-head">
          <label id={`${inputId}-label`} htmlFor={inputId}>{search.label}</label>
          {highlighted && (
            <Badge className="mack-badge h-auto rounded-full px-3 py-1 text-[17px] font-extrabold">{t("typeHere")}</Badge>
          )}
        </span>
        <div className="mack-search-row">
          <span className="mack-search-field">
            <Search className="mack-search-icon size-[26px]" strokeWidth={2.4} aria-hidden="true" />
            <Input
              id={inputId}
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className={cn(FIELD, "h-16 pl-14 text-2xl md:text-2xl")}
            />
          </span>
          <Button type="submit" className="h-16 rounded-xl px-7 text-[22px] font-bold" disabled={disabled || !text.trim()}>
            {t("search")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Placeholder shapes in the final layout make the wait feel shorter; screen readers get the "Working…" status instead.
function LoadingCards() {
  return (
    <div className="mack-loading" aria-hidden="true" data-testid="mack-loading">
      <span className="mack-skeleton mack-skeleton--primary" />
      <div className="mack-grid">
        <span className="mack-skeleton" />
        <span className="mack-skeleton" />
        <span className="mack-skeleton" />
        <span className="mack-skeleton" />
      </div>
    </div>
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
  const { t } = useTranslator();
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
        index > 0 && <h2 className="mack-visually-hidden">{t("moreActions")}</h2>
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

// Three tiers on shadcn's Button: the filled primary next step, outlined cards, and quiet ghost rows.
const TASK_STYLE: Record<Variant, { variant: "default" | "outline" | "ghost"; className: string }> = {
  primary: {
    variant: "default",
    className: "min-h-[88px] gap-4 rounded-2xl px-6 py-4 text-[26px] font-bold shadow-lg hover:bg-primary hover:brightness-95",
  },
  card: {
    variant: "outline",
    className: "min-h-[72px] gap-3.5 rounded-2xl border-2 bg-card px-5 py-3.5 text-2xl font-semibold shadow-sm hover:border-primary hover:bg-card hover:shadow-md",
  },
  row: {
    variant: "ghost",
    className: "min-h-16 gap-3.5 rounded-none px-5 py-2.5 text-[22px] font-semibold hover:bg-accent hover:text-foreground",
  },
};

function TaskButtonView(props: {
  button: TaskButton;
  variant: Variant;
  order: number;
  highlighted: boolean;
  badgeId: string;
  onAction(id: string): void;
}) {
  const { t } = useTranslator();
  const { button, variant, order, highlighted, badgeId, onAction } = props;
  const Glyph = taskIcon(button.label);
  const Trail = variant === "row" ? ChevronRight : ArrowRight;
  const look = TASK_STYLE[variant];
  return (
    <Button
      type="button"
      variant={look.variant}
      className={cn("mack-task h-auto w-full justify-start text-left whitespace-normal", look.className)}
      data-variant={variant}
      data-action-id={button.actionId}
      data-highlighted={highlighted || undefined}
      aria-describedby={highlighted ? badgeId : undefined}
      style={{ "--order": order } as CSSProperties}
      onClick={() => onAction(button.actionId)}
    >
      <span className="mack-task-icon" aria-hidden="true">
        <Glyph className={variant === "primary" ? "size-[30px]" : "size-[26px]"} strokeWidth={2.2} />
      </span>
      <span className="mack-task-label">{button.label}</span>
      {highlighted ? (
        <Badge id={badgeId} className="mack-badge h-auto rounded-full px-3 py-1 text-[17px] font-extrabold">{t("nextStep")}</Badge>
      ) : (
        variant !== "card" && <Trail className="mack-task-trail size-[26px]" strokeWidth={2.4} aria-hidden="true" />
      )}
    </Button>
  );
}

function OriginalPanel(props: ViewProps) {
  const { t } = useTranslator();
  const { state, onBack, onPreviousPage, onExit, mode, onToggleMode } = props;
  const [dock, setDock] = useState<Dock>("bottom-right");
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();
  const nextDock = DOCK_ORDER[(DOCK_ORDER.indexOf(dock) + 1) % DOCK_ORDER.length];

  // New guidance or an error must never stay hidden behind the collapsed bar.
  useEffect(() => setCollapsed(false), [state.instruction, state.error, state.clarificationOptions]);

  return (
    <Card className="mack-panel" data-dock={dock} data-collapsed={collapsed || undefined} role="complementary" aria-label={t("mackGuide")}>
      <header className="mack-panel-header">
        <IconButton icon={ArrowLeft} label={t("previousPage")} onClick={onPreviousPage} />
        <div className="mack-heading">
          <Brand logo={state.siteLogo} name={state.siteName} />
          <h1 className="mack-title">{state.screen.title}</h1>
        </div>
        <div className="mack-panel-tools">
          <IconButton
            icon={collapsed ? ChevronUp : ChevronDown}
            label={collapsed ? t("expand") : t("minimize")}
            expanded={!collapsed}
            controls={bodyId}
            onClick={() => setCollapsed(!collapsed)}
          />
          <IconButton icon={Maximize2} label={t("fullScreen")} onClick={onBack} />
          <IconButton icon={X} label={t("exitMack")} onClick={onExit} />
        </div>
      </header>
      {!collapsed && (
        <div id={bodyId} className="mack-panel-body">
          <Guidance {...props} />
          {!props.embedded && <RequestBar {...props} compact />}
          <footer className="mack-panel-footer">
            <ThemeToggle mode={mode} onToggle={onToggleMode} />
            <Button
              type="button"
              variant="outline"
              className={cn(CONTROL, "border-2")}
              onClick={() => setDock(nextDock)}
              aria-label={t("movePanelLabel")}
            >
              {t("movePanel")}
            </Button>
          </footer>
        </div>
      )}
    </Card>
  );
}

function Guidance(props: MackAppProps) {
  const { t } = useTranslator();
  const { state, onRetry, onRequest } = props;
  // Mack's bar already shows whether it is listening or speaking.
  const statusKey = VOICE_STATUS[state.voiceState];
  const voiceStatus = props.embedded || !statusKey ? "" : t(statusKey);
  return (
    <>
      <p className="mack-instruction" aria-live="polite" aria-atomic="true">{state.instruction}</p>
      <div role="status" aria-live="polite">
        {state.busy && (
          <p className="mack-status"><span className="mack-spinner" aria-hidden="true" />{t("busy")}</p>
        )}
        {voiceStatus && <p className="mack-status">{voiceStatus}</p>}
      </div>
      {state.error && <ErrorBanner error={state.error} onRetry={onRetry} />}
      {state.clarificationOptions && state.clarificationOptions.length > 0 && (
        <div className="mack-choices">
          <h2>{t("didYouMean")}</h2>
          <ul>
            {state.clarificationOptions.map((option) => (
              <li key={option}>
                <Button type="button" variant="outline" className={cn(CONTROL, "border-2")} onClick={() => onRequest(option)}>{option}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ErrorBanner(props: { error: NonNullable<LensUIState["error"]>; onRetry(): void }) {
  const { t } = useTranslator();
  return (
    <div className="mack-error" role="alert">
      <p>{props.error.message}</p>
      {props.error.retryable && (
        <Button type="button" variant="outline" className={cn(CONTROL, "border-2")} onClick={props.onRetry}>{t("tryAgain")}</Button>
      )}
    </div>
  );
}

function RequestBar(props: LensAppProps & { compact?: boolean }) {
  const { t } = useTranslator();
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
      <label htmlFor={inputId}>{props.compact ? t("askMack") : t("whatToDo")}</label>
      <div className="mack-request-row">
        <Input
          id={inputId}
          type="text"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("typeOrSpeak")}
          className={cn(FIELD, "flex-[1_1_240px]")}
        />
        <Button type="submit" className="h-14 rounded-xl px-6 text-[20px] font-bold" disabled={!draft.trim()}>{t("send")}</Button>
      </div>
      <div className="mack-request-row">
        <Button
          type="button"
          variant={listening ? "destructive" : "outline"}
          className={cn(CONTROL, !listening && "border-2")}
          aria-pressed={listening}
          disabled={state.voiceState === "processing"}
          onClick={listening ? onMicStop : onMicStart}
        >
          <Mic strokeWidth={2.4} aria-hidden="true" />
          {listening ? t("stop") : t("speak")}
        </Button>
        <Button type="button" variant="outline" className={cn(CONTROL, "border-2")} onClick={onReplay} disabled={!state.instruction}>
          <RotateCcw strokeWidth={2.4} aria-hidden="true" />
          {t("repeat")}
        </Button>
      </div>
    </form>
  );
}
