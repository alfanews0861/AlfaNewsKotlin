# Implementation Plan - News Feed Refinement & Backend Stability

This plan addresses deployment failures in Firebase Cloud Functions due to CPU quota limitations in the `asia-south1` region and refines the Android app's news feed blending logic.

## User Review Required

> [!IMPORTANT]
> The Cloud Functions deployment is failing because the project has exceeded its CPU quota for Cloud Run (Gen 2 functions) in `asia-south1`. I propose reducing resource allocations and instance counts to fit within the existing quota.

> [!WARNING]
> `onNewsPostCreated` performs heavy tasks like video processing with FFmpeg. Reducing its memory/CPU too much might lead to OOM errors or slow processing. I will set it to `1GiB` and `maxInstances: 1` as a first step.

## Proposed Changes

### [Component] Firebase Cloud Functions

#### [MODIFY] [index.ts](file:///C:/AlfaKotlin/functions/src/index.ts)
- Reduce global `maxInstances` from `3` to `2`.
- Reduce global `memory` from `1GiB` to `512MiB` to save quota (individual functions can still override if needed).

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- Ensure all models use stable `gemini-1.5-flash` and `imagen-3.0`.

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Optimize `onNewsPostCreated` resources:
    - Set `maxInstances: 1` (to prevent multiple parallel heavy video tasks consuming CPU quota).
    - Maintain `memory: "2GiB"` for FFmpeg stability, but we'll monitor if this still hits quota.

#### [MODIFY] [auto_content_handler.ts](file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)
- Reduce resource usage for scheduled tasks.
- Example: `checkSevereWeatherAlerts` runs every 30 mins; we'll ensure it stays at `512MiB`.

---

### [Component] Android App (News Feed)

#### [MODIFY] [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt)
- Refine `rankAndBlendPosts` to strictly follow the 40/30/30 rule while maintaining the "District News" filter.
- Ensure the top 5 "Fresh" items are correctly prioritized by user interest (if available).

## Verification Plan

### Automated Tests
- `cd functions && npm run build` to ensure TypeScript compilation passes.
- No unit tests available for backend logic currently, will rely on manual deployment check.

### Manual Verification
1. **Cloud Functions**: Deploy updated functions and check `firebase functions:log` for successful start and health checks.
2. **News Feed**: Run the app and verify:
    - Top news is fresh and general.
    - Weather card appears at index 8.
    - District news only shows if it matches the selected district.
    - News from preferred categories appears higher in the feed.
