# Walkthrough - Firestore Transaction Fix

Fixed a critical bug in the Reporter Incentives system where points were failing to be awarded due to an incorrect Firestore transaction sequence.

## Changes Made

### Backend (Cloud Functions)

#### [reporter_handler.ts](file:///C:/AlfaKotlin/functions/src/reporter_handler.ts)
- **Bug Fix**: Reordered the `awardPointsToReporter` transaction logic.
- **Impact**: Previously, the function attempted to read from the `monthly_leaderboard` collection *after* writing to the `users` collection. Firestore transactions require all reads to be completed before any writes.
- **Resolution**: All `transaction.get()` calls are now grouped at the beginning of the transaction block.

## Verification Results

### Automated Tests
- **Build**: Successfully compiled TypeScript (`npm run build`).
- **Deployment**: Successfully deployed all 22 Cloud Functions to `asia-south1`.
- **Logs**: Verified that post-deployment operations (`onNewsPostApproved`, `onNewsPostCreated`) are running without the `[POINTS_ERR]` transaction error.

> [!TIP]
> Future news posts with videos or milestone view counts will now correctly award points to reporters and update the monthly leaderboard without crashing.
