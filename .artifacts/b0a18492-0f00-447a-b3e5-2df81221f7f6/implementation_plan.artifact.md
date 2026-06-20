# Implementation Plan - Fix Reporter Video Submission Corruption

The reporter video submission flow is currently broken because of invalid AI model names, incorrect TTS voice configurations, and malformed SSML. The news gets stuck in "PENDING" or "REVIEWING_CONTENT" and never completes the video processing stage (merging audio/video and uploading to YouTube).

## User Review Required

> [!IMPORTANT]
> The AI model names in the codebase were found to be futuristic/fake (`gemini-3.5-flash`, `imagen-4.0`). I will revert them to the current stable versions (`gemini-1.5-flash`). If you intended to use experimental models, please let me know, but currently, they are causing the system to fail.

## Proposed Changes

### Cloud Functions (Backend)

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- Update `FLASH_MODEL`, `PRO_MODEL`, and `SCHEDULED_MODEL` to `gemini-1.5-flash`.
- Update `IMAGEN_MODEL` to `imagen-3.0-generate-001`.

#### [MODIFY] [geminiService.ts](file:///C:/AlfaKotlin/functions/src/geminiService.ts)
- Update `PRIMARY_MODEL` to `gemini-1.5-flash`.

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **AI Processing**: Ensure `performAIProcessing` handles the model response correctly.
- **Video Processing**:
    - Change TTS voice to `te-IN-Standard-B` or `te-IN-Wavenet-B` (valid Google TTS voices).
    - Add required `<speak>` tags to the SSML input for Text-to-Speech.
    - Improve error logging for the FFMPEG and YouTube upload stages.
- **Loop Prevention**: Refine the trigger logic to ensure that if `status` is `PENDING`, processing starts regardless of the `aiProcessed` flag (allowing for re-submissions).

## Verification Plan

### Automated Tests
- Run the build script for functions: `cd functions && npm run build`.
- (Manual) Check Firebase console for any deployment errors.

### Manual Verification
1. **Submit Reporter Video**: Use the Android app as a reporter to submit a video post.
2. **Firestore Monitor**: Watch the document in the `news` collection.
    - Should change from `PENDING` -> `REVIEWING_CONTENT` (AI text processing).
    - Should change to `PROCESSING_VIDEO` (FFMPEG/YouTube).
    - Finally, should be `published` with a `youtubeUrl`.
3. **App Verification**: Verify that the video news appears in the feed with the correct AI-enhanced headline and content.
