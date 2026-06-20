# Cloud Storage Cost Optimization Plan

Investigation into the sudden spike in Cloud Storage costs (108 GB data transfer in a single day) revealed a critical recursive loop in the `onNewsPostCreated` Cloud Function. This loop causes multiple parallel instances of the function to download the same video files repeatedly, leading to massive data egress from Cloud Storage.

## Problem Analysis

The `onNewsPostCreated` function in `news_handler.ts` is triggered on every write to the `news` collection. When a post contains a video, the following sequence occurs:

1.  **AI Phase**: If AI processing is needed, it performs it, updates the status to `PROCESSING_VIDEO`, and returns ("handing over" to the next trigger).
2.  **Video Phase**: The next trigger (started by the status update) enters the video processing block.
3.  **The Recursive Catalyst**: Inside the video block, there is a redundant update:
    `await db.collection('news').doc(postId).update({ status: "PROCESSING_VIDEO" });`
    This update triggers a **third** instance of the function.
4.  **Parallel Downloads**: Because video processing (FFMPEG) takes several minutes, the original instance is still running and downloading the video while the new instance starts, also downloading the same video.
5.  **Infinite Loop**: The new instance hits the same redundant update, triggering a fourth instance, and so on. This continues until the first instance finally completes and sets `videoProcessed: true`, which eventually satisfies the loop prevention logic in subsequent triggers.

With a 50MB-100MB video, hundreds of parallel downloads can easily consume 100GB+ of data transfer in a day.

## Proposed Changes

### [Component] Cloud Functions (`functions/src/news_handler.ts`)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **Robust Loop Prevention**: Implement a strict check using both `before` and `after` snapshots to ensure video processing only starts when the status *changes* to `PROCESSING_VIDEO` or if it's a fresh post requiring video handling.
- **Remove Redundant Update**: Delete the `update({ status: "PROCESSING_VIDEO" })` call inside the video processing block (line 277) to prevent it from triggering itself recursively.
- **Atomic Status Checks**: Ensure that once processing starts, no other instance can enter the same block for that `postId`.

### [Component] Utils (`functions/src/utils.ts`)

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- (Optional) Add a utility for checking if a document was already in a certain state to simplify loop prevention.

## Verification Plan

### Automated Tests
- I will verify the logic by analyzing the `onNewsPostCreated` code paths.
- I will check for other `update` calls that might trigger similar loops.

### Manual Verification
- Deploy the fixed functions and monitor logs for `[LOOP_PREVENT]` messages.
- The user can verify that Cloud Storage costs return to normal levels in the GCP console after the fix is deployed.

> [!IMPORTANT]
> This fix is critical to stop the ongoing financial drain caused by the recursive trigger loop.

> [!WARNING]
> While `maxInstances: 2` or `3` limits the number of *concurrent* executions, the recursive updates still queue up thousands of tasks, each potentially starting a new download as soon as a slot becomes available.
