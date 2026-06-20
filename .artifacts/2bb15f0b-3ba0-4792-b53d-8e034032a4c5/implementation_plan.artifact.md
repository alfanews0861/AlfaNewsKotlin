# Cloud Cost Optimization Plan (June 2026)

This plan addresses the recent increase in cloud billing by optimizing resource usage, frequency of background tasks, and implementing persistent tracking to avoid redundant operations.

## User Review Required

> [!IMPORTANT]
> **AI Models Kept**: Per your request, the AI model names in `utils.ts` will **not** be modified.

> [!WARNING]
> **Notification Frequency**: The schedule will be reverted from 18x daily to the original 4x daily (8 AM, 1 PM, 6 PM, 9 PM IST). This is a critical cost-saving measure.

## Proposed Changes

### 1. Resource Optimization (Memory & Compute)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Reduce memory for `onNewsPostCreated` from **4GiB** to **2GiB**.
- 2GiB is sufficient for FFMPEG video processing while cutting memory-second costs by 50%.

---

### 2. Notification Efficiency & Persistent Tracking

#### [MODIFY] [notification_engine.ts](file:///C:/AlfaKotlin/functions/src/notification_engine.ts)
- Update `schedule` to: `0 8,13,18,21 * * *` (8 AM, 1 PM, 6 PM, 9 PM IST).
- Remove the in-memory `lastSentNewsIdMap`.
- Implement a `settings/notifications` document in Firestore to track the `lastSentGeneralNewsId` and `lastSentDistrictNewsIds`. This ensures that even if instances restart, we don't resend notifications for the same news.

---

### 3. Storage & Firestore Operation Optimization

#### [MODIFY] [auto_content_handler.ts](file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)
- **Schedule Change**: Change `cleanupOldNews` from weekly (`0 2 * * 0`) to daily (`0 3 * * *`). Running daily prevents massive spikes in Firestore writes and Storage deletions.
- **Retention Period**: Reduce the cleanup threshold from **120 days** to **60 days**. This will aggressively reduce storage costs for media files.
- **Batching**: Ensure it continues to process in batches to stay within execution limits.

## Verification Plan

### Automated Tests
- Deploy functions and check the `onNewsPostCreated` memory limit in the Firebase/GCP console.
- Run a manual trigger of the notification engine and verify it creates/updates the `settings/notifications` document.

### Manual Verification
- Monitor Firestore `news` collection for the `mediaDeleted` flag on older posts.
- Confirm with the user that notifications are received only at the 4 designated times.
