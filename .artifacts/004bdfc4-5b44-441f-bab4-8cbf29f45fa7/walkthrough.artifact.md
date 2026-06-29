# Walkthrough - Cloud Storage & Gemini Cost Optimization

I have implemented the fixes to address the rising storage costs and redundant processing issues.

## Changes Made

### 1. Storage Cleanup (Fixing the "Leak")
- **Cloud Functions**: Updated `functions/src/news_handler.ts` to automatically delete the original high-resolution video file from Firebase Storage once it has been successfully processed and uploaded to YouTube. This will stop the steady rise in **Bytes Stored** and **Object Count**.

### 2. Redundancy Fix (Fixing the "Request Spike")
- **Atomic Locking**: Implemented a "Double Check" mechanism in `onNewsPostCreated`. Before starting heavy AI or Video processing, the function now re-reads the latest document state from Firestore to ensure no other instance has already started or finished the job. This prevents the June 24th spike in **Requests** and reduces Gemini API costs.

### 3. App Egress Optimization (Fixing "Data Usage")
- **Delayed Buffering**: Modified `VideoPlayerView.kt` to disable pre-buffering. The `ExoPlayer.prepare()` call is now delayed until the card is actually active in the news feed.
- **Smart Visibility**: Updated `NewsCardView.kt`, `NewsFeedView.kt`, and `LocalNewsFeedView.kt` to pass an `isActive` signal. Videos now only start downloading and playing when they are visible to the user.
- **Preloading reduction**: Reduced the background image preloading from 15 items down to 10 (as requested), which cuts down on "hidden" data egress while maintaining smooth scrolling.

### 4. Cleanup Function Fix (Backlog clearing)
- **Problem**: The `cleanupOldNews` function was failing because of a missing Firestore index and was skipping very old documents that didn't have the `mediaDeleted` field.
- **Fix**: Removed the complex Firestore-side filter and moved the logic into the function code. It now sorts from oldest to newest (`orderBy('timestamp', 'asc')`) and manually filters already cleaned docs. This ensures it will dig through your entire backlog of news and delete those 200+ images per day that were being missed.

## Verification Results

- **Build Status**: ✅ `app:assembleDebug` passed successfully.
- **Logic Verification**: The state machine in `news_handler.ts` now correctly identifies `REVIEWING_CONTENT` and `PROCESSING_VIDEO_START` as exclusive states.

> [!TIP]
> **Deployment Steps**:
> 1. Deploy the functions: `firebase deploy --only functions`
> 2. Release the Android update: This is crucial as the app changes will save the most money on "Bandwidth Sent".

render_diffs(file:///C:/AlfaKotlin/functions/src/news_handler.ts)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/VideoPlayerView.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsFeedView.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LocalNewsFeedView.kt)
render_diffs(file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)
