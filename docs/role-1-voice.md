# Role 1 — ElevenLabs and voice input

Read PRD.md and the shared integration contract in CONTEXT.md before implementing. The combined CONTEXT.md includes the PRD, the contract, and every role.

You own extension/src/voice/. Your output is voice transport: microphone → transcript, and accepted instruction → ElevenLabs speech. You do not decide page actions or build a parallel conversation agent.

## Deliverables

- VoiceController and VoiceCallbacks exactly as the shared contract.
- Push-to-talk start/stop, correct microphone permissions in a supported extension document/context, transcript events, listening/processing/speaking/error states.
- ElevenLabs spoken output using the text from SpeechJob. Select a working transcription path with the team; verify its authentication before building advanced audio UX.
- Playback cancellation, replay support through Role 4's current instruction, and disposal of microphone/audio resources on exit.
- A concise provider/setup note with credential placeholders and the tested audio context. Never commit actual secrets.

## Current speech path

The loaded-extension speech check is `extension/src/voice/speech-check.html`, opened from the toolbar popup. It is an extension page, not a service worker and not a website. It speaks one fixed sentence through ElevenLabs and plays the audio in that page.

The operator supplies an API key at runtime. The page stores it in `chrome.storage.session` only. The default voice id is the public premade id `JBFqnCBsd6RMkjVDRZzb`, and it can be changed at runtime. The request uses `eleven_flash_v2_5`. See `extension/src/voice/PROVIDER.md`. This check does not record the microphone.

## Sequence

1. With Role 4, verify a real microphone recording and a real ElevenLabs utterance inside the loaded extension. Resolve provider credentials immediately; a normal webpage test alone is insufficient.
2. Implement controller callbacks with local development input if needed, then real transcription.
3. Send completed transcript to Role 4; do not call the guidance model yourself. Avoid duplicate submissions of partial/final segments.
4. Receive SpeechJob only after the UI has committed. Stop old playback before another job. Suppress late audio from canceled jobs, even if its network request completes.
5. Integrate microphone controls supplied by Role 3; do not create competing floating controls.

## Boundaries and dependencies

Role 4 supplies extension execution context, message transport, credential access, and job lifecycle. Role 3 owns buttons/states visible to the user. Role 2 supplies the accepted text through Role 4. If ElevenLabs conversational tooling is used, disable independent task reasoning; it must not give instructions that bypass Roles 2/4.

Do not assume a service worker has a microphone, DOM, or persistent audio lifetime. Select and test the appropriate extension context with Role 4 using current Chrome documentation. Never bundle a shared key or add a server to work around auth without a new team decision.

## Acceptance

Actual speech becomes a single request; exact accepted guidance is spoken by ElevenLabs; assistant audio is not transcribed as user input; permission denial allows typing; navigation/new requests stop stale speech; stop/exit releases devices; transcript can be corrected through the UI. A pre-recorded clip is not completion.

## Microphone context

Push-to-talk capture runs in a top-level extension document. The development fixture is `extension/src/voice/mic-check.html`, opened as a `chrome-extension://` tab. Chrome can show the microphone permission prompt there. A service worker cannot record. An offscreen document can call `getUserMedia` only after that permission already exists, and creating one needs the `offscreen` manifest permission owned by Role 4.

This phase records microphone audio only. It does not transcribe speech or call ElevenLabs. No credentials are stored. The extension loads the compiled JavaScript from `extension/src/voice/dist/`. Recompile with `npx --yes typescript@5.9.2 tsc -p extension/src/voice` after editing the TypeScript.

## Agent kickoff prompt

> Read docs/CONTEXT.md in full. I own Role 1. Implement only my assigned responsibility, follow shared contracts, coordinate changes outside my owned paths, and integrate through Role 4. Work on an existing real website with no application backend. Report working behavior, verification, and specific dependencies.
