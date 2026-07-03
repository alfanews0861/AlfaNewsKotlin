# Implementation Plan - Local Reporter Assignment & Point Logic Refinement

The goal is to ensure that while a Mandalam's assigned reporter gets the display credit for all news in their area, the **incentive points** are awarded to the **original submitter** (the user who actually posted the news).

## User Review Required

> [!IMPORTANT]
> **Points Logic**: Points will now go to the actual submitter (original poster), even if the news is displayed under the assigned Mandalam reporter's name. This ensures fairness for reporters or citizens who find news first.

> [!NOTE]
> **System News**: News from scrapers (bots) will show the Mandalam reporter's name, but no points will be awarded since there is no "actual user" submitter.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Capture the `originalSubmitterId` from the initial document data (`data.reporter?.id`).
- Perform the Mandalam reporter reassignment (overriding the `reporter` field for UI display).
- Update the point awarding logic to use `originalSubmitterId` instead of the display reporter ID.

#### [MODIFY] [reporter_handler.ts](file:///C:/AlfaKotlin/functions/src/reporter_handler.ts)
- Update `awardPointsToReporter` to explicitly skip IDs starting with `BOT_` or `SYSTEM_` to prevent any accidental point logs for automated accounts.

## Verification Plan

### Automated Tests
- Update `functions/scratch/verify_assignment_logic.js` to:
    1. Create two reporters (A and B). Reporter B is assigned to Mandalam "Kavali".
    2. Simulate Reporter A submitting news for "Kavali".
    3. Verify the news document shows Reporter B (Display).
    4. Verify Reporter A receives the points (Incentive).

### Manual Verification
- Deploy updated Cloud Functions.
- Submit a news post as a test reporter for a mandalam assigned to another reporter.
- Check Firestore to confirm:
    - `news` document `reporter` field = Assigned Reporter.
    - `users` document (Original Reporter) `points` = Increased.
    - `users` document (Assigned Reporter) `points` = Unchanged.
