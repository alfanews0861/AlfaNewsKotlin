# Robust Time-Based Audio Ducking for Video News

The user reported that the background audio does not return after the voice-over ends. This is likely because the `sidechaincompress` filter hangs or stops processing when the sidechain (voice-over) track reaches EOF. I will switch to a more deterministic approach using a time-based volume envelope.

## User Review Required

> [!IMPORTANT]
> This change replaces the dynamic "sidechain" ducking with a calculated time-based ducking. I will use `ffprobe` to determine the exact length of the voice-over and apply a volume drop for exactly that duration.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Use `ffprobe` (already imported in the project) to get the duration of the generated TTS MP3 file.
- Replace `sidechaincompress` with a `volume` filter on the original audio using a time-based expression: `volume='if(lt(t,TTS_DURATION),0.02,1)':eval=frame`.
- This ensures the background audio is suppressed only during the voice-over and returns to full volume immediately after.
- Keep `amix` with `duration=longest` and `normalize=0` to combine the tracks.

## Verification Plan

### Automated Tests
- Syntax check with `analyze_file`.
- Verify `ffprobe` call logic.

### Manual Verification
- User to process a video news post.
- Verify that:
    1. Background audio is muted during the voice-over.
    2. Background audio returns to full volume the instant the voice-over ends.
