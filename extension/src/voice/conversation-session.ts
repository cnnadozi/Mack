// One live conversation: microphone audio streams to ElevenLabs over a WebSocket and
// the agent's audio plays back. Runs in a top-level extension page, like capture.ts,
// because that is where Chrome can show the microphone permission prompt.

import { decodePcm16, encodePcm16, parseServerEvent, type ServerEvent } from "./conversation-api.js";

export type ConversationState = "connecting" | "listening" | "speaking";

export interface ConversationCallbacks {
  onState(state: ConversationState): void;
  onUserText(text: string): void;
  onAgentText(text: string): void;
  onAgentCorrection(text: string): void;
  /** Called exactly once. `error` is set when the conversation did not end on purpose. */
  onEnd(error?: string): void;
}

export interface ConversationSession {
  stop(): void;
}

export interface ConversationOptions {
  signedUrl: string;
  workletUrl: string;
}

export async function startConversation(
  options: ConversationOptions,
  callbacks: ConversationCallbacks,
): Promise<ConversationSession> {
  // Echo cancellation keeps Mack's own voice from being heard as the user speaking.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });

  const socket = new WebSocket(options.signedUrl);
  const playing = new Set<AudioBufferSourceNode>();
  let context: AudioContext | null = null;
  let outputRate = 16000;
  let nextStart = 0;
  let lastInterruption = 0;
  let ready = false;
  let ended = false;

  function end(error?: string): void {
    if (ended) return;
    ended = true;
    stopPlayback();
    for (const track of stream.getTracks()) track.stop();
    if (context) void context.close().catch(() => undefined);
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
    callbacks.onEnd(error);
  }

  function stopPlayback(): void {
    for (const source of playing) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already finished.
      }
    }
    playing.clear();
    nextStart = 0;
  }

  async function startMicrophone(inputRate: number): Promise<void> {
    // Running the context at the agent's input rate lets Chrome do the resampling.
    const audio = new AudioContext({ sampleRate: inputRate });
    context = audio;
    await audio.audioWorklet.addModule(options.workletUrl);
    if (ended) return;
    if (audio.state === "suspended") await audio.resume();

    const microphone = audio.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(audio, "mack-mic");
    worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ user_audio_chunk: encodePcm16(event.data) }));
      }
    };
    // The worklet only runs while connected to the output; the zero gain keeps
    // the user's own voice out of the speakers.
    const silent = audio.createGain();
    silent.gain.value = 0;
    microphone.connect(worklet).connect(silent).connect(audio.destination);
    callbacks.onState("listening");
  }

  function play(base64: string): void {
    if (!context) return;
    const samples = decodePcm16(base64);
    if (samples.length === 0) return;
    const buffer = context.createBuffer(1, samples.length, outputRate);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    // Chunks are queued end to end so speech plays without gaps or overlap.
    const startAt = Math.max(context.currentTime + 0.02, nextStart);
    source.start(startAt);
    nextStart = startAt + buffer.duration;
    playing.add(source);
    source.onended = () => {
      playing.delete(source);
      if (playing.size === 0 && !ended) callbacks.onState("listening");
    };
    callbacks.onState("speaking");
  }

  function handle(event: ServerEvent): void {
    switch (event.kind) {
      case "ready":
        ready = true;
        outputRate = event.outputRate;
        startMicrophone(event.inputRate).catch(() => {
          end("The microphone audio could not be started.");
        });
        break;
      case "audio":
        // Audio from before the user interrupted must not play late.
        if (event.eventId > lastInterruption) play(event.base64);
        break;
      case "interruption":
        lastInterruption = event.eventId;
        stopPlayback();
        callbacks.onState("listening");
        break;
      case "ping":
        socket.send(JSON.stringify({ type: "pong", event_id: event.eventId }));
        break;
      case "user_text":
        callbacks.onUserText(event.text);
        break;
      case "agent_text":
        callbacks.onAgentText(event.text);
        break;
      case "agent_correction":
        callbacks.onAgentCorrection(event.text);
        break;
      case "error":
        end(event.message);
        break;
      case "ignored":
        break;
    }
  }

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
  });
  socket.addEventListener("message", (message) => {
    if (typeof message.data === "string" && !ended) handle(parseServerEvent(message.data));
  });
  socket.addEventListener("error", () => {
    end("The connection to ElevenLabs failed.");
  });
  socket.addEventListener("close", () => {
    end(ready ? "ElevenLabs ended the conversation." : "ElevenLabs closed the connection before the conversation started.");
  });

  callbacks.onState("connecting");
  return { stop: () => end() };
}
