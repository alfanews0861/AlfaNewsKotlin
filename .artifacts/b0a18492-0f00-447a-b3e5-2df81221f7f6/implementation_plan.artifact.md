# Implementation Plan - Fix Reporter Video Submission Flow

The reporter video submission is currently getting stuck after the text AI processing. While the AI models and voice names are correct for the 2026 environment, the logic for transitioning from text processing to video processing has flaws, and the SSML format is invalid.

## User Review Required

> [!NOTE]
> I have confirmed that `gemini-3.5-flash` and `te-IN-Chirp3-HD-Achernar` are the correct state-of-the-art models for June 2026. The issue is purely in the flow logic and SSML formatting.

## Proposed Changes

### Cloud Functions (Backend)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **Loop Prevention Logic**:
    - The current loop prevention skips the function if `aiProcessed` is true. However, when text processing completes, it sets `aiProcessed` to true, which causes the subsequent trigger (intended for video processing) to exit prematurely.
    - I will refine this to allow processing if `videoProcessed` is false and a video exists, even if `aiProcessed` is true.
- **SSML Formatting**:
    - The TTS synthesis currently sends raw text to the `ssml` field. Google Cloud TTS requires SSML to be wrapped in `<speak>` tags.
    - I will update the SSML payload: `<speak>${newsText}</speak>`.
- **Resource Allocation**:
    - Increase the memory to `2GiB` for the `onNewsPostCreated` trigger to handle FFMPEG processing of high-quality videos.

## Verification Plan

### Automated Tests
- Deploy the updated functions: `cd functions && npm run deploy`.
- Monitor logs for the `[VIDEO_START]` and `[FFMPEG_CMD]` tags.

### Manual Verification
1. **Submit Reporter Video**: Use the Android app to submit a news story with a video.
2. **Observe Firestore**:
    - Status should move from `PENDING` to `REVIEWING_CONTENT`.
    - Once AI text is generated, status should move to `PROCESSING_VIDEO`.
    - After FFMPEG and YouTube upload, status should move to `published`.
3. **Verify Outcome**: Ensure the post appears in the feed with a working YouTube link and AI-enhanced text.
