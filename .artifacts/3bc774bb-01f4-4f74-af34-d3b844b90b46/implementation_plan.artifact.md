# Audio Mixing Fix for Video News

The user reported that in video news, the original audio stops completely once the voice-over (TTS) ends. Additionally, the original audio should continue at the same volume level as the voice-over was.

## User Review Required

> [!IMPORTANT]
> The fix involves changing the audio mixing logic in the backend Cloud Functions. This will affect all future video news processing. Existing videos won't be changed unless re-processed.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Update the `ffmpeg` audio filter chain to fix the "stopping" issue and stabilize volume levels.
- Change `amix` duration from `first` to `longest` to ensure the audio track doesn't terminate prematurely.
- Set `normalize=0` in `amix` to prevent the automatic volume reduction that occurs when multiple streams are active, which causes a volume jump when the voice-over ends.
- Reduce `dropout_transition` from `3` to `0.5` seconds for more responsive volume management.
- Add a `highpass` filter to the TTS audio to improve clarity and remove low-end rumble.

## Verification Plan

### Automated Tests
- I will check the syntax of the modified `news_handler.ts` using `analyze_file`.
- Since I cannot run the full Cloud Function environment with real TTS and Video inputs easily here without credentials, I will rely on code analysis and the correctness of the FFmpeg filter syntax.

### Manual Verification
- The user should process a new video news post and verify:
  1. The original audio continues after the voice-over ends.
  2. The volume level of the original audio after the voice-over ends matches the volume level of the voice-over itself.
