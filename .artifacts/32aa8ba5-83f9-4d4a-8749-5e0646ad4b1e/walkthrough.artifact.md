# Walkthrough - AI Processing and Publication Flow Fix

I have fixed the issue where news posts were being published before the AI processing was complete. The background trigger logic has been refactored to ensure a strict sequence of events and a robust locking mechanism.

## Changes Made

### Cloud Functions Refactor

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
I have completely refactored the `onNewsPostCreated` trigger to implement a two-phase processing pipeline with explicit status-based locks.

1.  **AI Phase (Lock: `REVIEWING_CONTENT`)**:
    -   When a post is created or updated (status is `PENDING` and `aiProcessed` is `false`), the function immediately locks the post by setting its status to `REVIEWING_CONTENT`.
    -   It then calls the Gemini AI enhancement logic (`performAIProcessing`).
    -   Once AI processing is complete, it updates the document with the enhanced content and sets `aiProcessed: true`.
    -   **Crucially**, it only sets `approved: true` if the post does NOT contain a video. If it has a video, it sets the status to `PROCESSING_VIDEO` and keeps `approved: false`.

2.  **Video Phase (Lock: `PROCESSING_VIDEO_START`)**:
    -   The update from the AI phase triggers the function a second time.
    -   This time, the function identifies that AI is done (`aiProcessed: true`) and it needs video processing (status is `PROCESSING_VIDEO`).
    -   It locks the post again by setting the status to `PROCESSING_VIDEO_START`.
    -   It proceeds with video merging (TTS + Video) and YouTube upload.
    -   **Only after successful upload** does it set `videoProcessed: true`, `status: "published"`, and `approved: true`.

> [!NOTE]
> This "double-lock" mechanism prevents race conditions where multiple instances of the function might try to process the same post simultaneously, which was likely causing the premature publication.

## Verification Results

### Build Verification
I verified that the Cloud Functions compile successfully with the new logic.
-   **Command**: `npm run build`
-   **Result**: Compiled successfully without errors.

### Logic Review
-   **Reporter Posts**: Now strictly wait for AI enhancement before becoming visible.
-   **Video Posts**: Now strictly wait for the YouTube upload and video merge before becoming visible.
-   **Stuck Posts**: The new guard logic is more predictable and avoids infinite loops by using unique lock statuses for each phase.

## Next Steps

> [!IMPORTANT]
> To apply these fixes, you must deploy the updated Cloud Functions to your Firebase project:
> ```bash
> cd functions
> firebase deploy --only functions
> ```

Once deployed, any new submissions or updates to existing `PENDING` posts will automatically follow the new, safe processing flow.
