# ElevenLabs speech setup

Audio context: the extension page `speech-check.html`, opened from the Mack toolbar popup. Playback uses that page. The service worker is not used. A normal website tab is not the test.

Credentials: paste your own ElevenLabs API key into the page. Placeholder: `xi-api-key`. The page stores it in `chrome.storage.session` only. That storage is memory, and Chrome clears it when the extension reloads or the browser quits. Do not commit a key, and do not put one in the manifest or the build.

Voice id placeholder: `JBFqnCBsd6RMkjVDRZzb` (the premade voice in the ElevenLabs text-to-speech example). Replace it in the page if you use another voice.

Request: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with `model_id` `eleven_flash_v2_5` and `output_format` `mp3_44100_128`. The check speaks only: `Mack is speaking this sentence.`

This page does not request or record the microphone.

The manifest needs `"storage"` and host permission `https://api.elevenlabs.io/*` so the extension page can call ElevenLabs. Role 4 owns the manifest; those two lines are the integration this check uses.

Regenerate the page script after editing TypeScript:

```bash
npx --yes typescript@5.9.2 tsc -p extension/src/voice
```
