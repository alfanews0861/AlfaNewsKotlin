# Implementation Plan - Improve Reporter Upload Experience

Reporters were confused by the long "Publishing" state during video uploads, mistakenly thinking the app was waiting for the entire backend process (YouTube, AI). I am improving the UI feedback to clearly distinguish between the initial upload and the background server tasks.

## User Review Required

> [!NOTE]
> **Real-time Status**: I have added a real-time progress percentage during video uploads. This will show reporters that the app is actively working on the file transfer and hasn't stalled.

## Proposed Changes

### Android App (Mobile)

#### [MODIFY] [NewsPost.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/models/NewsPost.kt)
- **Model Update**: Added `status: String?` field to capture the backend processing state from Firestore.
- **Mapping Fix**: Updated `mapMapToNewsPost` to parse the `status` field.

#### [MODIFY] [ManagePostsPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ManagePostsPageView.kt)
- **Granular Status Labels**: Instead of a generic "PENDING" badge, reporters will now see specific stages like:
    - **AI ప్రాసెసింగ్...** (AI Processing)
    - **వీడియో తయారవుతోంది...** (Generating Video)
    - **YouTube అప్‌లోడ్...** (Uploading to YouTube)

#### [MODIFY] [StorageUtils.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/utils/StorageUtils.kt)
- **Progress Tracking**: Added an optional `onProgress` callback to `uploadVideoToStorage` using Firebase's `addOnProgressListener`.

#### [MODIFY] [PostNewsPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/PostNewsPageView.kt)
- **UI Feedback**: Updated the "Publish" button to show the upload percentage (e.g., "వీడియో సర్వర్‌కు చేరుతోంది: 45%").
- **Success Communication**: Changed the final confirmation message to clarify that the upload is complete and the rest is happening silently on the server.

## Verification Plan

### Manual Verification
1. Open the app as a reporter and post a video news story.
2. Observe the "Publish" button showing the percentage progress.
3. Once the upload finishes, verify the success message clearly states that processing is in the background.
4. Go to "Manage News" and verify that the status badge changes as the server progresses (Pending -> AI Processing -> Video Generating -> Live).
