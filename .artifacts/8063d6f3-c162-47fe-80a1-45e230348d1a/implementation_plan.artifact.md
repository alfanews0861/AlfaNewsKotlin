# Implementation Plan - Studio Quality Voice Over

Improve the audio quality of news videos by enhancing the TTS output and applying professional FFmpeg audio filters to create a stereo "studio" feel.

## User Review Required

> [!IMPORTANT]
> The enhancement will use FFmpeg filters to simulate stereo depth from mono TTS. This is a software-based enhancement since standard TTS APIs typically provide mono streams.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **TTS Configuration**: Ensure `sampleRateHertz` is set to 24000 (if supported) for clearer high-end.
- **FFmpeg Audio Chain**:
    - Convert mono to stereo using `pan=stereo|c0=c0|c1=c0`.
    - Apply `anequalizer` to enhance vocal presence (boost 2-4kHz).
    - Add a very subtle `aecho` (reverb) to remove the "flat" mono feel.
    - Improve the `amix` and `volume` filters for a more balanced mix between news audio and background music.

## Verification Plan

### Automated Tests
- `npm run build` to ensure no syntax errors in the new FFmpeg filter strings.

### Manual Verification
- Deploy only the news post created trigger: `firebase deploy --only functions:onNewsPostCreated`.
- Upload a test video and verify the audio quality is "stereo" and "studio-like".
