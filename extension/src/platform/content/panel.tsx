// Mack's bar on the website: a small action bar with the two things people do
// most (talk to Mack, make the simple view), the conversation in a card above
// it, and a short settings card. Built with shadcn/ui components.

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUp,
  LayoutGrid,
  LoaderCircle,
  MessageSquare,
  Mic,
  Moon,
  RefreshCw,
  Settings2,
  Square,
  Sun,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { shadowStyleText } from "../../ui/mount";
import { debug } from "../debug";
import {
  IDLE_SESSION,
  LANGUAGES,
  readLanguage,
  STORAGE,
  type MackSession,
  type RuntimeMessage,
  type SessionState,
  type TranscriptLine,
  type VoiceOption,
} from "../messages";
import { createSimpleView, simpleViewState, subscribeSimpleView } from "./simple-view";
import { followTheme, resolveTheme, type Theme } from "./theme";

/** Where the user dragged the bar: its centre, and its distance from the bottom. */
interface BarPosition {
  x: number;
  bottom: number;
}

const VISIBLE_LINES = 30;
const ERROR_SECONDS = 10;
const EDGE = 12;
const NO_LINES: TranscriptLine[] = [];
const NO_VOICES: VoiceOption[] = [];

const STATE_TEXT: Record<SessionState, string> = {
  idle: "",
  ready: "Ready",
  listening: "Listening",
  hearing: "Hearing you",
  thinking: "Thinking",
  working: "Working",
  speaking: "Speaking",
};

// The orb in the middle of the bar: its colour in each state, and how the sound
// wave inside it moves (how fast the bars rise and fall, 0 being still, and how
// far down they shrink between peaks).
const STATE_ORB: Record<SessionState, { color: string; beatMs: number; low: number }> = {
  idle: { color: "bg-muted text-muted-foreground", beatMs: 0, low: 0.35 },
  ready: { color: "bg-muted text-muted-foreground", beatMs: 0, low: 0.35 },
  listening: { color: "bg-green-600 text-white", beatMs: 1800, low: 0.4 },
  hearing: { color: "bg-green-600 text-white", beatMs: 520, low: 0.3 },
  thinking: { color: "bg-amber-500 text-white", beatMs: 1100, low: 0.35 },
  working: { color: "bg-amber-500 text-white", beatMs: 1100, low: 0.35 },
  speaking: { color: "bg-primary text-primary-foreground", beatMs: 640, low: 0.3 },
};

// Uneven on purpose, so the bars look like a voice and not a loading spinner.
const BAR_HEIGHTS = [10, 18, 24, 14, 20];
const BAR_DELAYS = [0, 0.35, 0.15, 0.5, 0.25];

function StateWave({ state }: { state: SessionState }) {
  const wave = STATE_ORB[state];
  // While thinking the bars rise one after another; otherwise they move like speech.
  const inTurn = state === "thinking" || state === "working";
  return (
    <span className="flex h-7 items-center justify-center gap-[3px]" aria-hidden="true">
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className="w-[3px] rounded-full bg-current"
          style={{
            height: inTurn ? 16 : height,
            transform: `scaleY(${wave.low})`,
            ["--mack-low" as string]: wave.low,
            animation: wave.beatMs
              ? `mack-wave ${wave.beatMs}ms ease-in-out ${
                  (inTurn ? index * 0.14 : BAR_DELAYS[index]!) * wave.beatMs
                }ms infinite`
              : undefined,
          }}
        />
      ))}
    </span>
  );
}

const PANEL_STYLES = `
@keyframes mack-wave {
  0%, 100% { transform: scaleY(var(--mack-low)); }
  50% { transform: scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="mack-wave"] { animation: none !important; transform: scaleY(0.6) !important; }
}
@media (prefers-color-scheme: dark) {
  :host {
    --background: #1c1c20; --foreground: #f4f4f5; --card: #1c1c20; --card-foreground: #f4f4f5;
    --primary: #f4f4f5; --primary-foreground: #18181b; --secondary: #29292f; --secondary-foreground: #f4f4f5;
    --muted: #29292f; --muted-foreground: #a5a5b0; --accent: #29292f; --accent-foreground: #f4f4f5;
    --input: #3a3a42; --border: #303037; --ring: #8b8b96; --destructive: #f87171;
  }
}
`;

function send(message: RuntimeMessage): void {
  try {
    void chrome.runtime.sendMessage(message).catch((error: unknown) => {
      debug("content", `could not send "${message.type}"`, error);
    });
  } catch (error) {
    // Thrown when the extension was reloaded but this page was not refreshed.
    debug("content", `could not send "${message.type}": refresh this page`, error);
  }
}

function IconButton(props: {
  label: string;
  pressed?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-9 rounded-full text-muted-foreground",
        props.pressed && "bg-accent text-foreground",
      )}
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  );
}

// The round indicator in the middle of the bar. With push to talk on it is also
// the talk button: Mack records while it is held.
function Orb({ state, holdToTalk }: { state: SessionState; holdToTalk: boolean }) {
  const [recording, setRecording] = useState(false);
  const current = useRef(false);
  const record = (next: boolean): void => {
    if (next === current.current) return;
    current.current = next;
    setRecording(next);
    send({ type: "mack:talk", held: next });
  };
  // If holding stops being possible mid-recording, the microphone must not keep recording.
  useEffect(() => () => record(false), [holdToTalk]);

  const lively = state === "hearing" || state === "speaking";
  const look = cn(
    "relative -my-2 grid size-14 shrink-0 place-items-center rounded-full shadow-md ring-4 ring-background transition-colors duration-300",
    STATE_ORB[state].color,
  );
  const inside = (
    <>
      {lively && (
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-20 motion-reduce:hidden" />
      )}
      {holdToTalk && !recording && state === "ready" ? (
        <Mic className="size-6" />
      ) : (
        <StateWave state={state} />
      )}
    </>
  );

  if (!holdToTalk) {
    return (
      <div className={look} role="img" aria-label={STATE_TEXT[state]} title={STATE_TEXT[state]}>
        {inside}
      </div>
    );
  }
  const isPressKey = (event: KeyboardEvent): boolean => event.key === " " || event.key === "Enter";
  return (
    <Button
      type="button"
      className={cn(look, "touch-none p-0 select-none hover:brightness-110")}
      aria-label="Hold to talk"
      title="Hold to talk"
      aria-pressed={recording}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        // Capture keeps the release coming here even if the pointer slides off the button.
        event.currentTarget.setPointerCapture(event.pointerId);
        record(true);
      }}
      onPointerUp={() => record(false)}
      onPointerCancel={() => record(false)}
      onBlur={() => record(false)}
      onKeyDown={(event) => {
        if (!isPressKey(event)) return;
        event.preventDefault();
        if (!event.repeat) record(true);
      }}
      onKeyUp={(event) => {
        if (isPressKey(event)) record(false);
      }}
    >
      {inside}
    </Button>
  );
}

function AskBox() {
  const [draft, setDraft] = useState("");
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    send({ type: "mack:typed", text });
  };
  return (
    <form
      className="flex w-[min(420px,calc(100vw-24px))] items-center gap-1.5 rounded-full border bg-background p-1.5 shadow-lg"
      onSubmit={submit}
    >
      <Input
        type="text"
        autoComplete="off"
        className="h-10 flex-1 rounded-full border-0 px-4 text-[15px] shadow-none focus-visible:ring-0"
        placeholder="Ask Mack, or tell it what to do"
        aria-label="Type a question or a task for Mack"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="submit"
        size="icon"
        className="size-10 rounded-full"
        aria-label="Send"
        title="Send"
      >
        <ArrowUp />
      </Button>
    </form>
  );
}

function SimpleViewButton() {
  const view = useSyncExternalStore(subscribeSimpleView, simpleViewState);
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 rounded-full px-4 text-[15px]"
      disabled={!view.available}
      title={
        view.available
          ? "Turn this page into a few large buttons"
          : "The simple view only works on https websites."
      }
      onClick={createSimpleView}
    >
      {view.creating ? (
        <LoaderCircle className="animate-spin motion-reduce:animate-none" />
      ) : view.showing ? (
        <RefreshCw />
      ) : (
        <LayoutGrid />
      )}
      {view.creating ? "Creating…" : view.showing ? "Recreate" : "Simple view"}
    </Button>
  );
}

function Conversation({ session, lines }: { session: MackSession; lines: TranscriptLine[] }) {
  const end = useRef<HTMLLIElement>(null);
  const busy = session.state === "thinking" || session.state === "working";
  useEffect(() => {
    // In braces on purpose: newer Chrome returns a Promise here, and React would
    // take a returned value for the effect's cleanup function.
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [lines.length, busy]);
  if (lines.length === 0 && !busy && !session.error) return null;

  return (
    <Card className="max-h-[min(40vh,300px)] w-[min(420px,calc(100vw-24px))] gap-0 overflow-y-auto p-3 shadow-lg">
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {lines.slice(-VISIBLE_LINES).map((line) => (
          <li
            key={line.id}
            // The words come from a model and a website, so they are only ever text.
            className={cn(
              "max-w-[88%] rounded-2xl px-3 py-1.5 text-[15px] leading-snug [overflow-wrap:anywhere]",
              line.step
                ? "max-w-full rounded-none border-l-2 py-0 pl-2.5 text-[13px] text-muted-foreground"
                : line.speaker === "user"
                  ? "self-end rounded-br-md bg-primary text-primary-foreground"
                  : "self-start rounded-bl-md bg-muted",
            )}
          >
            {line.text}
          </li>
        ))}
        {busy && (
          <li className="flex gap-1 self-start rounded-2xl bg-muted px-3 py-2.5" aria-hidden="true">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </li>
        )}
        <li ref={end} />
      </ol>
      {session.error && (
        <p
          role="alert"
          className="m-0 mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
        >
          {session.error}
        </p>
      )}
    </Card>
  );
}

// Shown while Mack is carrying out a task: what it is doing right now, and a way
// to stop it. The glowing frame around the page is drawn by Panel.
function WorkingNote({ lines }: { lines: TranscriptLine[] }) {
  // The steps of the current task are the step lines after the user's last words.
  const lastAsk = lines.map((line) => line.speaker).lastIndexOf("user");
  const steps = lines.slice(lastAsk + 1).filter((line) => line.step);
  const latest = steps[steps.length - 1];
  return (
    <div
      role="status"
      className="flex max-w-[min(460px,calc(100vw-24px))] items-center gap-2.5 rounded-full border border-amber-500/60 bg-background py-1.5 pr-1.5 pl-4 shadow-lg"
    >
      <LoaderCircle className="size-4 shrink-0 animate-spin text-amber-500 motion-reduce:animate-none" />
      <span className="min-w-0 truncate text-[14px]">
        <span className="font-semibold">
          Mack is working{steps.length > 0 ? ` · step ${steps.length}` : ""}
        </span>
        {latest && <span className="text-muted-foreground"> · {latest.text}</span>}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 rounded-full px-3 text-[13px]"
        onClick={() => send({ type: "mack:halt" })}
      >
        <Square className="size-3 fill-current" />
        Stop
      </Button>
    </div>
  );
}

function SettingSwitch(props: {
  label: string;
  hint: string;
  checked: boolean;
  onChange(on: boolean): void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm">
          {props.label}
        </Label>
        <span className="text-xs text-muted-foreground">{props.hint}</span>
      </div>
      <Switch
        id={id}
        className="h-5 w-9"
        checked={props.checked}
        onCheckedChange={props.onChange}
      />
    </div>
  );
}

function Settings() {
  const [pushToTalk, setPushToTalk] = useStored<boolean>(STORAGE.pushToTalk, false);
  const [textInput, setTextInput] = useStored<boolean>(STORAGE.textInput, false);
  const [voice, setVoice] = useStored<string>(STORAGE.voice, "");
  const [voices] = useStored<VoiceOption[]>(STORAGE.voices, NO_VOICES);
  const [language, setLanguage] = useStored<string>(STORAGE.language, "");
  const voiceId = useId();
  const languageId = useId();
  return (
    <Card
      className="w-[min(320px,calc(100vw-24px))] gap-4 p-4 shadow-lg"
      aria-label="Mack settings"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={voiceId} className="text-sm">
          Mack's voice
        </Label>
        <NativeSelect
          id={voiceId}
          value={voices.some((option) => option.id === voice) ? voice : ""}
          onChange={(event) => setVoice(event.target.value)}
        >
          <option value="">Default voice</option>
          {voices.map((option) => (
            <option key={option.id} value={option.id}>
              {option.description ? `${option.name} (${option.description})` : option.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={languageId} className="text-sm">
          Language
        </Label>
        <NativeSelect
          id={languageId}
          value={readLanguage(language) || "English"}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {LANGUAGES.map((option) => (
            <option key={option.name} value={option.name}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">
          For Mack's answers and the simple view.
        </span>
      </div>
      <SettingSwitch
        label="Push to talk"
        hint="Mack only listens while you hold the round button."
        checked={pushToTalk}
        onChange={setPushToTalk}
      />
      <SettingSwitch
        label="Text input"
        hint="Type to Mack instead of talking."
        checked={textInput}
        onChange={setTextInput}
      />
    </Card>
  );
}

function clamp(position: BarPosition): BarPosition {
  return {
    x: Math.min(Math.max(position.x, EDGE), window.innerWidth - EDGE),
    bottom: Math.min(Math.max(position.bottom, EDGE), window.innerHeight - 60),
  };
}

export function Panel() {
  const [session] = useStored<MackSession>(STORAGE.session, IDLE_SESSION);
  const [transcript] = useStored<TranscriptLine[]>(STORAGE.transcript, NO_LINES);
  const [pushToTalk] = useStored<boolean>(STORAGE.pushToTalk, false);
  const [textInput] = useStored<boolean>(STORAGE.textInput, false);
  const [chatHidden, setChatHidden] = useStored<boolean>(STORAGE.collapsed, false);
  const [stored, setStored] = useStored<BarPosition | null>(STORAGE.barPosition, null);
  const [dragged, setDragged] = useState<BarPosition | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storedTheme, setTheme] = useStored<Theme | null>(STORAGE.theme, null);
  const dark = resolveTheme(storedTheme) === "dark";

  // A problem that stopped Mack is shown for a while, since the bar itself is gone.
  // Only one that happens while this page is open: not one left over from earlier.
  const openedAt = useRef(Date.now());
  const [stopError, setStopError] = useState("");
  useEffect(() => {
    if (session.active || !session.error || Date.now() - openedAt.current < 1000) {
      setStopError("");
      return;
    }
    setStopError(session.error);
    const timer = window.setTimeout(() => setStopError(""), ERROR_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [session.active, session.error]);

  if (!session.active && !stopError) return null;
  // "working" lasts for a whole task: it is set at the first step and stays
  // until Mack speaks the result.
  const working = session.active && session.state === "working";

  const position = dragged ?? stored;
  const place = position
    ? { left: clamp(position).x, bottom: clamp(position).bottom }
    : { left: "50%", bottom: 16 };

  // The bar is moved by dragging its logo and status.
  const startDrag = (down: PointerEvent<HTMLDivElement>): void => {
    if (down.button !== 0) return;
    const handle = down.currentTarget;
    const bar = handle.closest("[role=toolbar]")!.getBoundingClientRect();
    const start = { x: bar.left + bar.width / 2, bottom: window.innerHeight - bar.bottom };
    let latest = start;
    handle.setPointerCapture(down.pointerId);
    const move = (event: globalThis.PointerEvent): void => {
      latest = clamp({
        x: start.x + event.clientX - down.clientX,
        bottom: start.bottom - (event.clientY - down.clientY),
      });
      setDragged(latest);
    };
    const end = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      // Stored so the bar stays where it was put on the next page too.
      if (latest !== start) setStored(latest);
      setDragged(null);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  // Keys typed in the bar must not also trigger the website's own keyboard shortcuts.
  const keepFromPage = (event: KeyboardEvent): void => event.stopPropagation();

  return (
    <>
      {working && (
        // Not inside the bar's container: that one is moved with a transform,
        // and "fixed" inside a transformed element is no longer the whole window.
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[2147483647] animate-pulse border-4 border-amber-500 shadow-[inset_0_0_36px_rgba(245,158,11,0.55)] motion-reduce:animate-none"
        />
      )}
      <div
        className="pointer-events-none fixed z-[2147483647] flex -translate-x-1/2 flex-col items-center gap-2 font-sans text-sm text-foreground antialiased"
        style={place}
        onKeyDown={keepFromPage}
        onKeyUp={keepFromPage}
        onKeyPress={keepFromPage}
      >
        {!session.active ? (
          <Card
            role="alert"
            className="pointer-events-auto max-w-[min(420px,calc(100vw-24px))] px-4 py-3 text-sm text-destructive shadow-lg"
          >
            {stopError}
          </Card>
        ) : (
          <>
            <div className="pointer-events-auto flex flex-col items-center gap-2">
              {settingsOpen ? (
                <Settings />
              ) : (
                !chatHidden && <Conversation session={session} lines={transcript} />
              )}
            </div>
            {working && (
              <div className="pointer-events-auto">
                <WorkingNote lines={transcript} />
              </div>
            )}
            {textInput && (
              <div className="pointer-events-auto">
                <AskBox />
              </div>
            )}
            <div
              role="toolbar"
              aria-label="Mack"
              className="pointer-events-auto grid max-w-[calc(100vw-24px)] grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-3 rounded-full border bg-background p-1.5 shadow-lg"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="flex shrink-0 cursor-grab touch-none items-center px-2 select-none active:cursor-grabbing"
                  title="Drag to move. Double-click to put it back."
                  onPointerDown={startDrag}
                  onDoubleClick={() => setStored(null)}
                >
                  <img
                    src={chrome.runtime.getURL("icons/icon48.png")}
                    alt="Mack"
                    className="size-6 max-w-none shrink-0"
                    draggable={false}
                  />
                </div>
                <SimpleViewButton />
              </div>

              <Orb state={session.state} holdToTalk={pushToTalk && !textInput} />

              <div className="flex items-center justify-end">
                <span role="status" className="sr-only">
                  {STATE_TEXT[session.state]}
                </span>
                <IconButton
                  label={dark ? "Switch to light mode" : "Switch to dark mode"}
                  onClick={() => setTheme(dark ? "light" : "dark")}
                >
                  {dark ? <Sun /> : <Moon />}
                </IconButton>
                <IconButton
                  label={chatHidden ? "Show conversation" : "Hide conversation"}
                  pressed={!chatHidden && !settingsOpen}
                  onClick={() => {
                    // From the settings, this goes back to the conversation.
                    setChatHidden(settingsOpen ? false : !chatHidden);
                    setSettingsOpen(false);
                  }}
                >
                  <MessageSquare />
                </IconButton>
                <IconButton
                  label="Settings"
                  pressed={settingsOpen}
                  onClick={() => setSettingsOpen(!settingsOpen)}
                >
                  <Settings2 />
                </IconButton>
                <IconButton label="Turn Mack off" onClick={() => send({ type: "mack:stop" })}>
                  <X />
                </IconButton>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function mountPanel(shadow: ShadowRoot): void {
  const style = document.createElement("style");
  style.textContent = shadowStyleText() + PANEL_STYLES;
  const container = document.createElement("div");
  shadow.append(style, container);
  followTheme(shadow.host);
  createRoot(container).render(<Panel />);
}
