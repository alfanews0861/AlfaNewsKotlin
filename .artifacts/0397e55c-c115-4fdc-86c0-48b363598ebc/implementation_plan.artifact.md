# Implementation Plan - Monthly Reporter Leaderboard

Implement a "Monthly Leaderboard" feature for reporters to encourage competition and provide recognition for top performers of the current month. This feature will be restricted to internal staff (Reporters, Editors, Admins, Regional Incharges).

## User Review Required

> [!IMPORTANT]
> - The leaderboard will reset every month (e.g., July 2026, August 2026).
> - Ranking is based purely on points earned in the **current month**.
> - Historical badges (Bronze, Silver, etc.) will **not** be used for ranking to ensure fair competition between new and veteran reporters.
> - Rankings will update automatically whenever news is approved or view milestones are reached.

## Proposed Changes

### [Component] Backend (Cloud Functions)

#### [MODIFY] [reporter_handler.ts](file:///C:/AlfaKotlin/functions/src/reporter_handler.ts)
- Update `awardPointsToReporter` to also update a monthly leaderboard document.
- Path: `monthly_leaderboard/{YYYY_MM}/reporters/{userId}`
- Data: `points` (incremented), `name`, `photoUrl`, `district`, `mandal`, `lastUpdated`.
- Logic: When cumulative points are awarded, calculate current year/month and increment the points in this specific document.

### [Component] Mobile App (Android/Compose)

#### [NEW] [LeaderboardViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/LeaderboardViewModel.kt)
- Fetch the top 10 reporters for the **current month** from `monthly_leaderboard/{current_YYYY_MM}/reporters` ordered by `points` DESC.
- Expose a `StateFlow` of the leaderboard list.

#### [NEW] [LeaderboardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LeaderboardView.kt)
- Create a new Composable screen to display the monthly leaderboard.
- UI elements:
    - Title: "ఈ నెల టాప్ రిపోర్టర్లు (Top Reporters of this Month)"
    - List items showing Rank (1-10), Photo, Name, District/Mandal, and Monthly Points.
    - Navigation back to the profile.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Add "leaderboard" to the navigation state management.
- Update the `when` block in `MainScreen` to render `LeaderboardView` when the active tab is "leaderboard".

#### [MODIFY] [UserProfilePageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/UserProfilePageView.kt)
- Add a "లీడర్ బోర్డ్ (Monthly)" button in the profile section, visible only to users with `isStaff = true`.

## Verification Plan

### Automated Tests
- N/A (UI and Cloud Function integration verification).

### Manual Verification
1. Log in as a **Reporter**.
2. Navigate to the Profile tab.
3. Verify the "లీడర్ బోర్డ్" button is visible.
4. Click the button and verify the leaderboard shows reporters and their monthly points.
5. Log in as a **Subscriber** (Normal User) and verify the button is hidden.
6. (Optional) Approve a new post in the backend and verify the monthly points increment in the leaderboard.
