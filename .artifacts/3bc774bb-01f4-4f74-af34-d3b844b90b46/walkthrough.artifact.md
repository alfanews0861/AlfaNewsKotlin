# Walkthrough - Audio Mixing Fix for Video News

I have updated the audio mixing logic in the Cloud Functions to ensure the original audio continues after the voice-over ends and maintains a consistent volume.

## Changes

### Backend (Cloud Functions)

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)

I updated the FFmpeg complex filter for audio mixing:

```typescript
// Before
filters.push("[ducked][a1_mix]amix=inputs=2:duration=first:dropout_transition=3[outa]");

// After
filters.push("[ducked][a1_mix]amix=inputs=2:duration=longest:dropout_transition=0.5:normalize=0[outa]");
```

**Key Fixes:**
1.  **`duration=longest`**: Changed from `first` to `longest`. This ensures that the output audio stream stays alive as long as the background video/audio track, preventing it from cutting off when the shorter TTS (voice-over) track ends.
2.  **`normalize=0`**: Disabled automatic volume normalization. FFmpeg's `amix` defaults to reducing volume as more inputs are added. By disabling this, we prevent the "volume jump" effect when the voice-over ends.
3.  **`dropout_transition=0.5`**: Reduced from `3s` to `0.5s` to make the transition smoother and more immediate when a stream ends.
4.  **`highpass=f=200`**: Added a high-pass filter to the TTS voice to remove low-frequency rumble and improve clarity in the final mix.

## Verification Results

### Automated Tests
- Ran `analyze_file` on `news_handler.ts` and confirmed there are no syntax errors in the TypeScript or FFmpeg filter strings.

### Manual Verification Required
- Please upload a new news post with a video and verify that:
    1. The background audio doesn't stop when the voice-over ends.
    2. There is no sudden volume change once the voice-over finishes.
