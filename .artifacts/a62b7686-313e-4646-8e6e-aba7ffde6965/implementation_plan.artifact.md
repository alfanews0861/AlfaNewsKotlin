# Implementation Plan - Firestore Cost Optimization

High Firestore reads are being caused by inefficient background tasks and unoptimized queries. This plan addresses the specific areas identified as "read sinks" to stay within the 50,000 free daily reads quota.

## User Review Required

> [!IMPORTANT]
> The primary cause of high reads is the `checkSevereWeatherAlerts` Cloud Function, which scans the user database every 30 minutes. I propose switching this to **Topic-based messaging**, which will reduce the Firestore read cost for this function to **zero**.

> [!WARNING]
> I will also optimize the Ad loading logic in the mobile app. This will filter ads at the database level instead of in-memory, significantly reducing reads for every user session.

## Proposed Changes

### 1. Cloud Functions (Backend)
#### [MODIFY] [auto_content_handler.ts](file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)
- Replace the expensive `db.collection('users').get()` and `db.collection('anonymous_devices').get()` calls in `checkSevereWeatherAlerts` with topic-based messaging.
- Since users already subscribe to `district_NAME` topics in the app, we can send alerts directly to these topics.
- This eliminates up to 15,000 reads per run (every 30 mins).

### 2. Android App (Mobile)
#### [MODIFY] [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt)
- Update `loadLocalAds` to include a `whereIn("targetDistrict", listOf("ALL", district))` filter.
- This prevents fetching every active ad in the system for every user refresh.
- Review the `loadNews` refresh logic to ensure it doesn't trigger too frequently.

#### [MODIFY] [GNewsDashboardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/GNewsDashboardView.kt)
- Replace `.get().await().size()` with the Firestore `count()` aggregation.
- This reduces the cost from 1 read per document to 1 read per 1000 documents.

### 3. General Optimizations
- Check for any other `get().size()` patterns.
- Ensure `onSnapshot` listeners are properly managed (already seems okay in `MainViewModel`).

## Verification Plan

### Automated Tests
- I will check the Cloud Function code for logic errors.
- I will verify the Firestore queries in the ViewModel are syntactically correct.

### Manual Verification
- Deploy optimized Cloud Functions: `cd functions && npm run deploy --only functions:checkSevereWeatherAlerts`
- Monitor Firestore usage in the Google Cloud Console over the next 24 hours to confirm the read count drops.
- Test the "Local Ads" loading in the app to ensure ads for the correct district still appear.
