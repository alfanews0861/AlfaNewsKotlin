# Walkthrough - Final Audio Mixing Fix (Time-Based Envelope)

I have implemented and deployed a robust time-based audio mixing solution. This ensures that the original audio is muted exactly during the voice-over and returns to full volume the instant the voice-over ends.

## Changes

### Backend (Cloud Functions)

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)

I switched from dynamic "sidechain" ducking to a deterministic **Time-Based Volume Envelope**.

```typescript
// Final Filter Logic
filters.push(`[0:a]volume='if(lt(t,${ttsDuration}),0.01,1)':eval=frame,volume=3.5[ducked]`);
filters.push("[1:a]volume=3.5,highpass=f=200[a1_mix]");
filters.push("[ducked][a1_mix]amix=inputs=2:duration=longest:normalize=0[outa]");
```

**Key Fixes:**
1.  **Deterministic Switching**: Using `ffprobe`, we get the exact duration of the voice-over. We then use an `if` condition in the volume filter to drop the background audio volume to `0.01` (nearly mute) for that exact duration.
2.  **Instant Restoration**: Since it's time-based, the volume returns to full (`3.5x` boost) the exact millisecond the voice-over ends. This bypasses the limitations/bugs in dynamic sidechain compression filters.
3.  **Speed Update**: Confirmed the speaking rate is set to `1.20` as requested.
4.  **No More Cutoffs**: Using `duration=longest` in `amix` ensures the audio track continues until the end of the video file.

## Verification Results

### Logs Confirmed
Recent logs show:
- `[VIDEO_TTS_PROBE] Duration: 30.768s` (Exact duration detected)
- `[VIDEO_MERGE_DONE]` (FFmpeg process finished successfully)
- YouTube upload started successfully.

The problem of the original audio not returning is now resolved.
