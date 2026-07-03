# Comprehensive App Audit & Optimization Plan

This plan outlines the findings from a full-system audit (Android + Cloud Functions) and proposes fixes for identified risks, including logical loops, billing spikes, and potential crashes.

## User Review Required

> [!IMPORTANT]
> **Gemini API Billing**: The current backend fallback logic automatically switches to a **PAID key** if free keys are exhausted. This could lead to unexpected costs. I recommend adding a "Soft Limit" or a switch to disable paid fallback unless explicitly enabled.

> [!WARNING]
> **Video Processing Limits**: Processing large videos in Cloud Functions (FFmpeg + YouTube) is risky due to memory (2GB) and timeout (9min) limits. If users upload 100MB+ videos, the function will likely fail.

## Audit Findings Summary

### 1. Billing & Cost Risks (High Priority)
*   **[BACKEND] Race Condition in `onNewsPostCreated`**: Using `onDocumentWritten` with internal updates can trigger redundant AI processing (expensive Gemini calls) if two writes happen quickly.
*   **[BACKEND] Paid API Fallback**: Automatic switch to paid Gemini keys without a budget cap.
*   **[MOBILE] Infinite Pagination Loop**: `LocalNewsFeedViewModel.kt` lacks a safety mechanism to stop `loadMore` if it keeps receiving data that it filters out locally (e.g., already seen posts).

### 2. Logical Flaws & UX
*   **[BACKEND] Video Memory/Timeout**: Processing videos > 1 minute might crash the function or hit the Google Cloud Function timeout.
*   **[MOBILE] Local News Consistency**: The fallback search (field-based vs. category-based) in `LocalNewsFeedViewModel` might lead to duplicate posts if a post matches both criteria during pagination.
*   **[BACKEND] Weather Alert Throttling**: The 500-user limit in `checkSevereWeatherAlerts` means most users won't get alerts if the user base grows.

### 3. Crash Risks
*   **[MOBILE] Null Document Handling**: Some mapping functions assume certain fields exist. Older news documents missing new fields (like `qualitySignals`) might cause UI issues or crashes if defaults aren't robust.
*   **[MOBILE] Background State Transitions**: Rapidly switching districts in `LocalNewsFeedViewModel` might lead to overlapping `loadNews` jobs if not cancelled correctly.

## Proposed Changes

### Billing & Performance Fixes

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
*   Add a `PAID_FALLBACK_ENABLED` flag (defaulting to false or checking a Firestore setting).
*   Add better logging for key exhaustion.

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
*   Use a Firestore **Transaction** or a status check against the database (not just the event snapshot) to ensure AI processing only happens once.

#### [MODIFY] [LocalNewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/LocalNewsFeedViewModel.kt)
*   Implement `consecutiveEmptyLoads` logic similar to `NewsFeedViewModel.kt` to prevent infinite pagination loops.

### Robustness & Scalability Fixes

#### [MODIFY] [notification_engine.ts](file:///C:/AlfaKotlin/functions/src/notification_engine.ts)
*   Optimize the district notification loop to use batching for FCM sends if the user count exceeds 500.

#### [MODIFY] [auto_content_handler.ts](file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)
*   Increase memory/timeout specifically for functions involving image/video generation if not already maxed.

## Verification Plan

### Automated Tests
*   Run existing `functions/src/processReporterSubmission.test.ts` to ensure core flows still work.
*   Simulate concurrent writes to a news post to verify the AI locking mechanism.

### Manual Verification
*   Test `loadMore` in `LocalNewsFeedViewModel` by reaching the end of a small district's feed.
*   Verify Gemini AI logs to ensure key fallback behavior is as expected.
