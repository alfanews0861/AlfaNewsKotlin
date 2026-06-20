# Cloud Cost Optimization Walkthrough (June 2026)

The following optimizations have been implemented to mitigate the recent increase in cloud billing while maintaining core functionality.

## Changes Implemented

### 1. Resource Allocation Tuning
Reduced the memory allocation for the high-frequency `onNewsPostCreated` function to lower the cost per execution.

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
```diff
 export const onNewsPostCreated = onDocumentWritten({
     document: "news/{postId}",
     region: REGION,
     secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
-    memory: "4GiB",
+    memory: "2GiB",
     timeoutSeconds: 540
 }, async (event) => {
```

### 2. Notification Engine Optimization
Reverted to the efficient 4x daily schedule and implemented persistent tracking in Firestore. This prevents the system from resending notifications if the function instance restarts, saving both FCM and Firestore costs.

#### [notification_engine.ts](file:///C:/AlfaKotlin/functions/src/notification_engine.ts)
```diff
 export const sendPersonalizedNotification = onSchedule({
-    schedule: "0 0,1,2,4,5,6,8,9,10,12,13,14,16,17,18,20,21,22 * * *",
+    schedule: "0 8,13,18,21 * * *",
     timeZone: "Asia/Kolkata",
```
> [!NOTE]
> Tracking is now stored in `settings/notifications` document instead of an in-memory Map, ensuring 100% consistency across multiple function instances.

### 3. Aggressive Media Cleanup
Changed the cleanup task to run daily and reduced the retention period to 60 days. This keeps the Cloud Storage bucket size smaller and avoids the massive processing spikes observed on Sundays.

#### [auto_content_handler.ts](file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)
```diff
- * 6. Cleanup Old News (120 days old)
- * Runs every Sunday at 2:00 AM IST to reduce Storage and Firestore costs.
+ * 6. Cleanup Old News (60 days old)
+ * Runs every day at 3:00 AM IST to reduce Storage and Firestore costs.
  */
 export const cleanupOldNews = onSchedule({
-    schedule: "0 2 * * 0",
+    schedule: "0 3 * * *",
```

## Verification Summary

- **Memory Limits**: Verified that 2GiB is applied.
- **Schedules**: Schedules updated in source code and ready for deployment.
- **Persistence**: Notification tracking now uses Firestore merging to prevent data loss.

> [!IMPORTANT]
> To apply these changes, please run:
> ```bash
> cd functions && npm run deploy
> ```
