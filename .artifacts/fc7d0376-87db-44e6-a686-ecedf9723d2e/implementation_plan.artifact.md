# Implementation Plan - Internal Reporter Monitoring & Messaging System

Implement an automated system to monitor reporter activity, issue progressive warnings for inactivity via a dedicated persistent messaging system, and eventually downgrade irregular reporters to subscribers.

## User Review Required

> [!IMPORTANT]
> **Revised Inactivity Thresholds**:
> - **Milestone 1 (Warning 1)**: 3 days of inactivity.
> - **Milestone 2 (Show Cause)**: 5 days of inactivity.
> - **Milestone 3 (Final Warning)**: 7 days of inactivity.
> - **Milestone 4 (Downgrade)**: 10 days of inactivity.

> [!CAUTION]
> **Probation Logic (Repeat Offenders)**:
> If a reporter posts *after* receiving a warning but then stops again:
> - **Final Warning**: Triggered after only **3 days** of new inactivity.
> - **Downgrade**: Triggered after **3 more days** (Total 6 days of new inactivity).
> This ensures reporters who only post once to "reset the timer" are handled strictly.

> [!NOTE]
> **Persistent Messages**: A new "Messages" page will be created in the app. Messages sent to this page will never expire ("eppatiki vundaali").

> [!IMPORTANT]
> **Admin Oversight**: Final warnings and automatic downgrades will be carbon-copied to the `ADMIN` users to keep them informed of reporter management actions.

## Proposed Changes

### Data Models & Schema

#### [MODIFY] [types.ts](file:///C:/AlfaKotlin/functions/src/types.ts)
- Update `User` interface:
    - `warningLevel`: number (0 to 3)
    - `lastWarningDate`: Timestamp
    - `inProbation`: boolean
    - `lastPostTimestamp`: Timestamp (Optimized monitoring field)

#### [MODIFY] [User.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/models/User.kt)
- Add matching fields: `warningLevel`, `lastWarningDate`, `inProbation`, `lastPostTimestamp`.

#### [NEW] [AppMessage.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/models/AppMessage.kt)
- Define a persistent message model (similar to `AppNotification` but stored in a different collection).

### Backend (Cloud Functions)

#### [MODIFY] [reporter_handler.ts](file:///C:/AlfaKotlin/functions/src/reporter_handler.ts)
- Add `onNewsPostApproved` trigger:
    - Watches `news/{postId}`.
    - If `after.approved == true` and `before.approved != true`:
        - Update the reporter's `lastPostTimestamp` in the `users` collection.
- Update `backfillReporterPoints` to also backfill `lastPostTimestamp`.

#### [NEW] [reporter_monitor.ts](file:///C:/AlfaKotlin/functions/src/reporter_monitor.ts)
- Implement optimized `monitorReporterActivity` (Scheduled Function).
- Logic for inactivity check:
    1. Calculate threshold date (e.g., 3 days ago).
    2. Query reporters where `role == REPORTER` AND `lastPostTimestamp < threshold`.
    3. This reduces reads from **O(N*2)** to **O(Inactive_Reporters)**.
- Handle warnings and downgrades as per the progressive thresholds.
- Helper `sendInternalMessage`: Writes to `users/{userId}/messages` AND sends FCM.

#### [MODIFY] [index.ts](file:///C:/AlfaKotlin/functions/src/index.ts)
- Export `monitorReporterActivity`.

### Mobile App (Android)

#### [NEW] [MessagesPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MessagesPageView.kt)
- A dedicated view to display persistent messages from `users/{userId}/messages`.
- Unlike notifications, these will not have a "Clear All" that deletes them from the server (or perhaps just archives them).

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Add "Messages" to the navigation drawer or profile section.
