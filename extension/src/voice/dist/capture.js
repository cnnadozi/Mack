// Runs in a top-level extension document. Service workers have no microphone,
// and Chrome will not show the permission prompt from an offscreen document.
export class MicrophoneCaptureError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "MicrophoneCaptureError";
        this.code = code;
    }
}
export function microphoneContextIssue() {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return "Microphone capture needs an extension document. A service worker cannot record audio.";
    }
    if (window.top !== window) {
        return "Microphone capture needs a top-level extension document so Chrome can grant microphone permission.";
    }
    if (window.location.protocol !== "chrome-extension:") {
        return "Microphone capture must run in the extension origin, not in a web page or content script.";
    }
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
        return "This extension document does not support microphone capture.";
    }
    return null;
}
export function createMicrophoneCapture(callbacks = {}) {
    let state = "idle";
    let generation = 0;
    let starting = false;
    let active = null;
    const onPageHide = () => {
        dispose();
    };
    window.addEventListener("pagehide", onPageHide);
    function setState(next) {
        state = next;
        callbacks.onState?.(next);
    }
    function publish(error) {
        setState("error");
        callbacks.onError?.(error);
        return error;
    }
    async function start(options = {}) {
        if (starting || state === "listening" || state === "processing") {
            throw new MicrophoneCaptureError("already-listening", "Microphone capture is already running.");
        }
        const issue = microphoneContextIssue();
        if (issue) {
            throw publish(new MicrophoneCaptureError("unsupported-context", issue));
        }
        starting = true;
        const current = generation;
        let stream;
        let context;
        let meter = 0;
        try {
            const audio = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            };
            if (options.deviceId) {
                audio.deviceId = { exact: options.deviceId };
            }
            stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
            if (current !== generation) {
                throw new MicrophoneCaptureError("capture-failed", "Microphone capture was stopped before it started.");
            }
            const track = stream.getAudioTracks()[0];
            if (!track) {
                throw new MicrophoneCaptureError("no-device", "No microphone track was returned.");
            }
            const mimeType = preferredMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            context = new AudioContext();
            if (context.state === "suspended") {
                await context.resume();
            }
            const source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            const chunks = [];
            recorder.addEventListener("dataavailable", (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            });
            const session = {
                stream,
                recorder,
                context,
                chunks,
                startedAt: performance.now(),
                deviceLabel: track.label,
                sampleRate: track.getSettings().sampleRate ?? null,
                peak: 0,
                sumSquares: 0,
                windows: 0,
                meter: 0,
                mimeType: recorder.mimeType,
                released: false,
                stopGate: deferred(),
            };
            recorder.addEventListener("stop", () => session.stopGate.resolve(), { once: true });
            recorder.addEventListener("error", () => {
                session.stopGate.reject(new DOMException("MediaRecorder failed.", "InvalidStateError"));
            }, { once: true });
            const samples = new Float32Array(analyser.fftSize);
            meter = window.setInterval(() => {
                analyser.getFloatTimeDomainData(samples);
                let peak = 0;
                let sum = 0;
                for (const value of samples) {
                    const amplitude = Math.abs(value);
                    if (amplitude > peak)
                        peak = amplitude;
                    sum += value * value;
                }
                if (peak > session.peak)
                    session.peak = peak;
                session.sumSquares += sum / samples.length;
                session.windows += 1;
            }, 50);
            session.meter = meter;
            recorder.start(100);
            if (current !== generation) {
                release(session);
                stream = undefined;
                context = undefined;
                meter = 0;
                throw new MicrophoneCaptureError("capture-failed", "Microphone capture was stopped before it started.");
            }
            active = session;
            stream = undefined;
            context = undefined;
            meter = 0;
            setState("listening");
        }
        catch (error) {
            window.clearInterval(meter);
            stream?.getTracks().forEach((track) => track.stop());
            if (context)
                void context.close();
            if (current !== generation) {
                throw error instanceof MicrophoneCaptureError
                    ? error
                    : new MicrophoneCaptureError("capture-failed", "Microphone capture was stopped before it started.");
            }
            if (error instanceof MicrophoneCaptureError) {
                throw publish(error);
            }
            throw publish(mapCaptureError(error));
        }
        finally {
            starting = false;
        }
    }
    async function stop() {
        if (!active || state !== "listening") {
            throw publish(new MicrophoneCaptureError("not-listening", "Microphone capture is not listening."));
        }
        const session = active;
        const current = generation;
        setState("processing");
        window.clearInterval(session.meter);
        try {
            if (session.recorder.state === "recording") {
                session.recorder.stop();
            }
            await session.stopGate.promise;
            if (current !== generation) {
                throw new MicrophoneCaptureError("capture-failed", "Microphone capture was stopped before the recording finished.");
            }
            const blob = new Blob(session.chunks, {
                type: session.mimeType || "audio/webm",
            });
            release(session);
            const recording = {
                blob,
                mimeType: blob.type,
                durationMs: Math.round(performance.now() - session.startedAt),
                byteLength: blob.size,
                peak: session.peak,
                rms: session.windows > 0 ? Math.sqrt(session.sumSquares / session.windows) : 0,
                deviceLabel: session.deviceLabel,
                sampleRate: session.sampleRate,
                deviceReleased: session.stream.getAudioTracks().every((track) => track.readyState === "ended"),
            };
            setState("idle");
            return recording;
        }
        catch (error) {
            if (current !== generation) {
                throw error instanceof MicrophoneCaptureError
                    ? error
                    : new MicrophoneCaptureError("capture-failed", "Microphone capture was stopped before the recording finished.");
            }
            if (error instanceof MicrophoneCaptureError)
                throw publish(error);
            throw publish(mapCaptureError(error));
        }
        finally {
            release(session);
            if (active === session)
                active = null;
        }
    }
    function dispose() {
        generation += 1;
        if (active) {
            const session = active;
            active = null;
            session.stopGate.reject(new MicrophoneCaptureError("capture-failed", "Microphone capture was disposed."));
            release(session);
        }
        window.removeEventListener("pagehide", onPageHide);
        if (state !== "idle")
            setState("idle");
    }
    return {
        get state() {
            return state;
        },
        start,
        stop,
        dispose,
    };
}
export async function measureRecording(blob) {
    const context = new AudioContext();
    try {
        const bytes = await blob.arrayBuffer();
        const buffer = await context.decodeAudioData(bytes.slice(0));
        const channel = buffer.getChannelData(0);
        let peak = 0;
        let sum = 0;
        let nonZeroSamples = 0;
        for (const value of channel) {
            const amplitude = Math.abs(value);
            if (amplitude > peak)
                peak = amplitude;
            if (amplitude > 0)
                nonZeroSamples += 1;
            sum += value * value;
        }
        return {
            durationMs: Math.round(buffer.duration * 1000),
            peak,
            rms: channel.length > 0 ? Math.sqrt(sum / channel.length) : 0,
            sampleRate: buffer.sampleRate,
            sampleCount: channel.length,
            nonZeroSamples,
        };
    }
    finally {
        await context.close();
    }
}
function preferredMimeType() {
    if (typeof MediaRecorder === "undefined")
        return null;
    const candidates = ["audio/webm;codecs=opus", "audio/webm"];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}
function mapCaptureError(error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        name === "SecurityError") {
        return new MicrophoneCaptureError("permission-denied", "Microphone permission was denied. Typed requests stay available.");
    }
    if (name === "NotFoundError" ||
        name === "DevicesNotFoundError" ||
        name === "OverconstrainedError") {
        return new MicrophoneCaptureError("no-device", "No microphone is available.");
    }
    const message = error instanceof Error ? error.message : "Microphone capture failed.";
    return new MicrophoneCaptureError("capture-failed", message);
}
function release(session) {
    if (session.released)
        return;
    session.released = true;
    window.clearInterval(session.meter);
    for (const track of session.stream.getTracks())
        track.stop();
    void session.context.close().catch(() => undefined);
}
function deferred() {
    let settled = false;
    let resolvePromise = () => undefined;
    let rejectPromise = () => undefined;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return {
        promise,
        resolve: (value) => {
            if (settled)
                return;
            settled = true;
            resolvePromise(value);
        },
        reject: (error) => {
            if (settled)
                return;
            settled = true;
            rejectPromise(error);
        },
    };
}
