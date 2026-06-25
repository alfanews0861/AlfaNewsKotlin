# Implementation Plan - News Processing Audit & Loop Prevention

This plan addresses potential recursive loops, redundant processing, and data transfer inefficiencies in the `onNewsPostCreated` Cloud Function, specifically for reporter submissions.

## User Review Required

> [!IMPORTANT]
> - **Race Condition Fix**: I will implement a "Status Transition" check to ensure that processing only starts if the status *just changed* to the target state.
> - **Memory Optimization**: I will switch video downloads from `arrayBuffer` to a streaming approach to prevent OOM (Out of Memory) crashes with large reporter videos.
> - **AI Model Alignment**: I will verify and set the AI model to `gemini-1.5-flash` (or current stable) as `3.5-flash` may cause failures.

## Proposed Changes

### 1. news_handler.ts Optimization
- **[MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)**
    - Refine the `GUARD` logic to check `event.data.before` and `event.data.after`.
    - Ensure AI block only triggers on `PENDING` -> `REVIEWING_CONTENT` transition.
    - Ensure Video block only triggers on `PROCESSING_VIDEO` -> `PROCESSING_VIDEO_IN_PROGRESS` transition.
    - Replace `fetch().arrayBuffer()` with a streaming implementation using `fs.createWriteStream`.
    - Add explicit cleanup of temp files in all error paths.

### 2. utils.ts Configuration
- **[MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)**
    - Update `FLASH_MODEL` to `gemini-1.5-flash` for stability.

### 3. reporter_handler.ts Check
- **[MODIFY] [reporter_handler.ts](file:///C:/AlfaKotlin/functions/src/reporter_handler.ts)**
    - Ensure `processReporterSubmission` sets initial states that correctly trigger the refined `onNewsPostCreated`.

## Verification Plan

### Automated Tests
- Run `npm run build` in `functions` directory to ensure no regression.
- Simulate status transitions to verify that only one processing run occurs per state change.

### Manual Verification
- Monitor logs for "Skipping due to status transition" messages.
- Verify that a large video (e.g., 200MB) can be processed without hitting memory limits.
- Confirm reporter posts are published correctly with and without video.
