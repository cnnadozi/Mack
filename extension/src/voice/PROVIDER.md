# ElevenLabs speech setup

Audio context: the extension page `speech-check.html`, opened from the Mack toolbar popup. Playback uses that page. The service worker is not used. A normal website tab is not the test.

Credentials: see **Live conversation** below. Never commit a key.

Voice id placeholder: `JBFqnCBsd6RMkjVDRZzb` (the premade voice in the ElevenLabs text-to-speech example). Replace it in the page if you use another voice.

Request: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with `model_id` `eleven_flash_v2_5` and `output_format` `mp3_44100_128`. The check speaks only: `Mack is speaking this sentence.`

This page does not request or record the microphone.

The manifest needs `"storage"` and host permission `https://api.elevenlabs.io/*` so the extension page can call ElevenLabs. Role 4 owns the manifest; those two lines are the integration this check uses.

Regenerate the page script after editing TypeScript:

```bash
npx --yes -p typescript@5.9.2 tsc -p extension/src/voice
```

## Live conversation

The built extension (`npm run build`, loaded from `dist/`) holds a hands-free voice conversation about the page the user is on. The code is in `extension/src/voice/live/` (microphone listening, sentence detection, WAV encoding) and `extension/src/platform/` (offscreen document, Gemini calls, page extraction, overlay).

Audio context: an offscreen document, `offscreen.html`, created by the background worker with the `USER_MEDIA` reason. The microphone permission is granted once in a visible tab, `permission.html`, because Chrome does not show the prompt in the popup or in an offscreen document.

Flow: microphone at 16 kHz, a loudness-based detector cuts out each sentence, Gemini transcribes it, Gemini answers from a screenshot, the extracted page elements and the whole page's readable text, and `speakText` in `elevenlabs-speech.ts` speaks the answer with `eleven_flash_v2_5` in the voice chosen in the popup (default voice id `JBFqnCBsd6RMkjVDRZzb`). The popup's voice list is fetched from the ElevenLabs voice list endpoint by `live/voices.ts` each time Mack starts. The microphone is ignored while Mack thinks and speaks, so the user cannot interrupt mid-sentence.

Credentials: `ELEVENLABS_API_KEY` and `GEMINI_API_KEY` in `.env.local`. Vite inlines them into the offscreen document's script only. `dist/` therefore contains the keys and is ignored by git.

The older check pages in this folder (`speech-check.html`, `mic-check.html`, `conversation.html`) are not part of the built extension.
