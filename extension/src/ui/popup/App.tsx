import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Mic, Settings, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStored } from "@/lib/storage";
import { debug } from "../../platform/debug";
import {
  DEFAULT_OVERLAY,
  IDLE_SESSION,
  STORAGE,
  type MackSession,
  type OverlayPrefs,
  type RuntimeMessage,
  type VoiceOption,
} from "../../platform/messages";

const STATE_LABEL: Record<MackSession["state"], string> = {
  idle: "Off",
  ready: "Ready",
  listening: "Listening",
  hearing: "Hearing you",
  thinking: "Thinking",
  working: "Working",
  speaking: "Speaking",
};

function send(message: RuntimeMessage): void {
  debug("popup", "sending", message);
  void chrome.runtime.sendMessage(message).catch((error: unknown) => {
    debug("popup", `could not send "${message.type}" to the background worker`, error);
  });
}

function SettingRow({
  label,
  checked,
  disabled,
  indented,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  indented?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={`flex min-h-12 items-center justify-between gap-3 ${indented ? "pl-4" : ""}`}>
      <Label htmlFor={id} className={`text-base ${indented ? "font-normal" : ""}`}>
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="h-6 w-11 [&_[data-slot=switch-thumb]]:size-5"
      />
    </div>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="flex flex-col divide-y rounded-2xl border bg-card px-4 shadow-sm">
        {children}
      </div>
    </section>
  );
}

const NO_VOICES: VoiceOption[] = [];

function VoiceRow({
  voice,
  voices,
  onChange,
}: {
  voice: string;
  voices: VoiceOption[];
  onChange: (voice: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5 py-3">
      <Label htmlFor={id} className="text-base">
        Mack's voice
      </Label>
      <div className="relative">
        <select
          id={id}
          value={voices.some((option) => option.id === voice) ? voice : ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-input bg-background pr-10 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Default voice</option>
          {voices.map((option) => (
            <option key={option.id} value={option.id}>
              {option.description ? `${option.name} (${option.description})` : option.name}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {voices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Start Mack once to load the voices from your ElevenLabs account.
        </p>
      ) : null}
    </div>
  );
}

export function App() {
  const [session] = useStored<MackSession>(STORAGE.session, IDLE_SESSION);
  const [pushToTalk, setPushToTalk] = useStored<boolean>(STORAGE.pushToTalk, false);
  const [voice, setVoice] = useStored<string>(STORAGE.voice, "");
  const [voices] = useStored<VoiceOption[]>(STORAGE.voices, NO_VOICES);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const [storedOverlay, setOverlay] = useStored<Partial<OverlayPrefs>>(STORAGE.overlay, {});
  const overlay: OverlayPrefs = { ...DEFAULT_OVERLAY, ...storedOverlay };

  // The voice document can die without telling anyone (browser restart, crash).
  useEffect(() => send({ type: "mack:sync" }), []);

  async function toggleTalking(): Promise<void> {
    if (session.active) {
      send({ type: "mack:stop" });
      return;
    }
    // Chrome can only show the microphone prompt in a full tab, so the first
    // start goes through a one-time permission page. A blocked microphone still
    // starts Mack, for typed questions.
    const permission = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    debug("popup", "microphone permission is", permission.state);
    if (permission.state === "prompt") {
      void chrome.tabs.create({
        url: chrome.runtime.getURL("permission.html"),
      });
    } else {
      send({ type: "mack:start" });
    }
  }

  return (
    <main className="flex w-[360px] flex-col gap-4 bg-muted/60 p-4">
      <header className="flex items-center gap-3">
        <img src="/icons/icon48.png" alt="" className="size-10" />
        <div className="flex flex-col">
          <h1 className="text-xl leading-tight font-semibold tracking-tight">Mack</h1>
          <p className="text-sm text-muted-foreground">Your guide for this page</p>
        </div>
        <Badge
          variant={session.active ? "default" : "secondary"}
          className="ml-auto gap-1.5 px-3 py-1 text-sm"
        >
          <span
            className={`size-2 rounded-full ${session.active ? "bg-primary-foreground" : "bg-muted-foreground"}`}
          />
          {STATE_LABEL[session.state]}
        </Badge>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <Button
          variant={session.active ? "outline" : "default"}
          className="h-11 w-full rounded-lg text-base [&_svg:not([class*='size-'])]:size-5"
          aria-pressed={session.active}
          onClick={() => void toggleTalking()}
        >
          {session.active ? <Square /> : <Mic />}
          {session.active ? "Stop Mack" : "Start Mack"}
        </Button>

        {session.error ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-base text-destructive"
          >
            {session.error}
          </p>
        ) : null}
      </section>

      <Button
        variant="ghost"
        className="h-11 w-full justify-start gap-2 rounded-lg px-2 text-base"
        aria-expanded={settingsOpen}
        aria-controls={settingsId}
        onClick={() => setSettingsOpen(!settingsOpen)}
      >
        <Settings />
        Settings
        <ChevronDown
          className={`ml-auto transition-transform ${settingsOpen ? "rotate-180" : ""}`}
        />
      </Button>

      <div id={settingsId} hidden={!settingsOpen} className="flex flex-col gap-4">
        <SettingGroup title="Voice">
          <VoiceRow voice={voice} voices={voices} onChange={setVoice} />
          <SettingRow label="Push to talk" checked={pushToTalk} onChange={setPushToTalk} />
        </SettingGroup>

        <SettingGroup title="On the page">
          <SettingRow
            label="Show conversation"
            checked={overlay.enabled}
            onChange={(enabled) => setOverlay({ ...overlay, enabled })}
          />
          <SettingRow
            indented
            label="My words"
            checked={overlay.showUser}
            disabled={!overlay.enabled}
            onChange={(showUser) => setOverlay({ ...overlay, showUser })}
          />
          <SettingRow
            indented
            label="Mack's replies"
            checked={overlay.showMack}
            disabled={!overlay.enabled}
            onChange={(showMack) => setOverlay({ ...overlay, showMack })}
          />
        </SettingGroup>
      </div>
    </main>
  );
}
