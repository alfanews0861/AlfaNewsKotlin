# Implementation Plan: Fix Excessive Storage and API Costs

The user reports a significant increase in storage costs (₹1,723) and Gemini API costs (₹1,930). Analysis of the billing reports and codebase reveals several critical issues:

1.  **Redundant Client-Side Workers**: Existing installs of the app are likely still running `FestivalGreetingWorker` and `NewsNotificationWorker`. These workers perform expensive operations (Gemini calls, image generation, Firestore polling, and redundant image downloads) that bypass caching.
2.  **Lack of Caching Headers**: Media files (images/videos) uploaded to Firebase Storage do not have `Cache-Control` headers, leading to high bandwidth (egress) costs as clients re-download them frequently.
3.  **Inefficient Image Downloads**: `NewsNotificationWorker` downloads images twice per run to calculate dimensions, using raw HTTP streams that bypass the app's image cache.
4.  **Redundant Notification Logic**: Both the app and the backend are attempting to manage personalized notifications, leading to duplicate work and high data transfer.

## User Review Required

> [!IMPORTANT]
> I am proposing to **cancel all existing background workers** in the Android app. This is necessary to stop the high-cost "ghost workers" on old installs. This will not affect FCM notifications, which are handled by the backend.

> [!WARNING]
> I will add a `Cache-Control` header of 1 year to all new media uploads. This is standard for static news assets but means once an image is uploaded with a specific URL, its content should not change (which matches the current usage).

## Proposed Changes

### Android App

#### [MODIFY] [AlfaNewsApplication.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/AlfaNewsApplication.kt)
- Add `cancelRedundantWorkers()` method to explicitly stop `WorkManager` tasks.
- Call this method in `onCreate()`.

#### [DELETE] [FestivalGreetingWorker.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/workers/FestivalGreetingWorker.kt)
#### [DELETE] [NewsNotificationWorker.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/workers/NewsNotificationWorker.kt)
- Remove these redundant classes to clean up the codebase and prevent re-activation.

---

### Cloud Functions

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- Update `saveBufferToStorage` to set `Cache-Control: public, max-age=31536000` in the file metadata.
- This will significantly reduce bandwidth costs by allowing CDNs and client caches to handle repeat requests.

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Refine the `onNewsPostCreated` guard logic to be more robust against race conditions and redundant triggers.
- Ensure that `deleteOriginalFile` is reliable and that temp files are always cleaned up.

## Verification Plan

### Automated Tests
- Run `cd functions && npm run build` to ensure backend changes are valid.
- Build the Android app to ensure it compiles without the deleted workers.

### Manual Verification
- Deploy functions: `firebase deploy --only functions`.
- Monitor Firebase Storage logs (if available) to verify `Cache-Control` headers on new uploads.
- The billing impact will be visible in the GCP console after 24-48 hours.
