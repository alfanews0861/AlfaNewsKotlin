# Implementation Plan - Fix Cleanup Function & Storage Costs

Analyze and fix the `cleanupOldNews` function to ensure it correctly deletes media files older than 60 days. Currently, it is only deleting 2-3 files per day despite having hundreds of news posts daily.

## User Review Required

> [!IMPORTANT]
> **Query Change**: I am removing the Firestore-side filter for `mediaDeleted`. Instead, I will fetch all news older than 60 days and filter them in the function code. This ensures that even very old documents (which don't have the `mediaDeleted` field yet) are processed.
> **Potential for High Execution Time**: The first run after this fix might take longer as it clears the backlog of thousands of old files. I have set a `MAX_CLEANUP` limit to prevent timeouts.

## Proposed Changes

### [Backend] Cloud Functions (`functions/src/`)

#### [MODIFY] [auto_content_handler.ts](file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)
- Remove `where('mediaDeleted', '!=', true)` from the cleanup query.
- Add an in-memory check: `if (data.mediaDeleted === true) continue;`.
- Use a more reliable URL parsing method to extract the file path from Firebase Storage tokens.
- Increase the cleanup batch processing efficiency.

## Verification Plan

### Automated Tests
- Manually trigger the function in the Firebase console (or locally via emulator).
- Verify logs show a high count of deletions during the first run: `[CLEANUP] Completed. Cleaned 2000 documents...`.

### Manual Verification
- Check the Firebase Storage "Object Count" and "Bytes Stored" graphs after 24 hours to confirm a downward trend.
