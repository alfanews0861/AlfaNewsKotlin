# Optimization Plan for Reducing Firebase Storage Bandwidth

The user is experiencing high data transfer (9GB+ in 15 minutes), which indicates a "dumping" behavior or highly inefficient media handling. My research has identified several critical issues in the app's worker logic and caching configuration that act as massive traffic multipliers.

## Diagnosis
1.  **Redundant Client-Side Workers**: `FestivalGreetingWorker` and `NewsNotificationWorker` are running on every user device every 24 hours. These workers perform redundant logic that is already handled by backend Cloud Functions.
    - `FestivalGreetingWorker` triggers thousands of Imagen generations and uploads.
    - `NewsNotificationWorker` downloads images twice per device, bypassing all caching.
2.  **Tiny Image Cache**: The app's image cache is effectively limited to **50MB** (half of the 100MB default storage limit). This is extremely small for a news app, causing constant re-downloads of the same news images.
3.  **Profile Page Bug**: `UserProfilePageView` contains a bug that forces the storage limit back to 100MB every time it's viewed, preventing users from increasing their cache.
4.  **Oversized Image Uploads**: `StorageUtils.kt` compresses images to WebP but does not resize them. High-resolution photos from reporters (e.g., 108MP) remain several MBs in size even after compression.

## Proposed Changes

### 1. Remove Redundant Workers [CRITICAL]
- **File**: [AlfaNewsApplication.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/AlfaNewsApplication.kt)
- **Action**: Remove `scheduleNotificationWork()` call and the registration of `NewsNotificationWorker` and `FestivalGreetingWorker`.
- **Reason**: These tasks are already handled by the `notification_engine.ts` and `auto_content_handler.ts` Cloud Functions using FCM topics (`all_users`, `district_*`). Running them on every device is redundant and extremely expensive in terms of bandwidth.

### 2. Optimize Media Caching & Unify ImageLoaders
- **File**: [PreferenceManager.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/utils/PreferenceManager.kt)
- **Action**: Change default `storageLimitMB` from 100 to **500**.
- **File**: [UserProfilePageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/UserProfilePageView.kt)
- **Action**: Remove the `LaunchedEffect` that resets the limit to 100MB.
- **File**: [AlfaNewsApplication.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/AlfaNewsApplication.kt)
- **Action**: Update `newImageLoader` to use 70% of the storage limit for the disk cache and ensure it's the only one used.
- **File**: [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt) and [NewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsFeedView.kt)
- **Action**: Remove `SafeImageLoader.getImageLoader(context)` and use the singleton `ImageLoader` (or let `AsyncImage` use the default).
- **Reason**: 50MB is too small. Also, having two separate ImageLoaders fighting for the same cache directory can cause overhead and cache misses. Unifying them improves efficiency.

### 3. Implement Image Resizing
- **File**: [StorageUtils.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/utils/StorageUtils.kt)
- **Action**: Update `uploadImageToStorage` to resize bitmaps to a maximum dimension of **1280px** before compression. This ensures even 108MP photos are reduced to a reasonable size (approx 200-400KB) before being served to all users.

### 4. Backend Review (Informational)
- The Cloud Function `cleanupOldNews` already handles deleting old media, which is good.
- The `notification_engine.ts` is correctly using topics. No changes needed there.

## Verification Plan

### Automated Tests
- Build the APK and verify that `WorkManager` no longer lists the redundant workers.
- Verify that image uploads result in smaller file sizes in Firebase Storage.

### Manual Verification
- **Bandwidth Monitoring**: Monitor the Firebase Storage usage graph over the next 24-48 hours. The morning "spike" should significantly decrease.
- **Cache Size**: Check the "Storage Management" section in the User Profile to see if the cache size grows beyond 50MB and stabilizes at a higher limit.
- **Image Quality**: Ensure that the resized 1280px images still look good on high-resolution phone screens.

> [!IMPORTANT]
> Removing the `FestivalGreetingWorker` from the app is the most important step. It prevents thousands of concurrent users from "attacking" the storage bucket with redundant uploads every morning.
