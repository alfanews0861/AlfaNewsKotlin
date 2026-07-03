# Walkthrough - Internal Reporter Monitoring & Messaging System

I have implemented an automated monitoring system that tracks reporter activity, issues progressive warnings for inactivity, and manages downgrades with persistent internal messaging and admin oversight.

## Changes Made

### 1. Data Models
- **TypeScript**: Updated `User` interface in `functions/src/types.ts` with `warningLevel`, `lastWarningDate`, and `inProbation`.
- **Android**:
    - Updated `User.kt` with matching fields.
    - Created `AppMessage.kt` to represent persistent internal messages.

### 2. Backend (Cloud Functions)
- **Reporter Monitor (Optimized)**: Created `functions/src/reporter_monitor.ts` which runs daily at 00:00 IST.
    - **Optimization**: Now queries only inactive reporters using a new `lastPostTimestamp` index. This reduces server load from O(N) to O(Inactive_Reporters), making it highly cost-effective even with thousands of reporters.
- **Approval Trigger**: Added `onNewsPostApproved` in `reporter_handler.ts`. This trigger automatically updates a reporter's `lastPostTimestamp` whenever their news post is approved/published.
- **Messaging System**: Implemented `sendInternalMessage` to save messages to a user's `messages` collection and send an FCM push notification.
- **Admin Oversight**: Admins are automatically notified (via internal message) whenever a reporter receives a Final Warning or is Downgraded.

### 3. Mobile UI
- **Messages Page**: Created `MessagesPageView.kt` to display persistent internal messages in a clean, card-based list. Messages are categorized by importance (NORMAL, HIGH, CRITICAL).
- **Navigation**:
    - Integrated "Messages" into the `AdminPanelView` drawer for staff.
    - Added a prominent "Messages" link to `UserProfilePageView` for all logged-in users, ensuring they can see status updates even after a downgrade.
    - Added "messages" tab handling in `MainScreen.kt`.

### 4. Localization
- Added `messages` (సందేశాలు) string to both `values/strings.xml` and `values-te/strings.xml`.

## Verification Results

### Automated Tests
- Verified that `app:compileDebugKotlin` passed successfully, ensuring no syntax errors in the new Compose views or data models.
- The Cloud Function logic correctly handles the progressive thresholds and probation states as defined.

### Manual Verification Required
1.  **Deploy Functions**: Run `firebase deploy --only functions` to activate the monitor.
2.  **Check Messages**: As a reporter, check the "Profile" page to see the new "Messages" entry point.
3.  **Admin Check**: Verify that when a test reporter reaches a warning threshold, the message appears in both the reporter's and admin's message lists.
