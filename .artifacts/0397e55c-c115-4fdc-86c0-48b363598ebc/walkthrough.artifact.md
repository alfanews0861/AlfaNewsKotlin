# Walkthrough - Monthly Reporter Leaderboard

Implemented a competitive monthly leaderboard for reporters to encourage activity and recognize top performers.

## Changes Made

### 1. Backend: Monthly Points Tracking
Updated the `awardPointsToReporter` Cloud Function in [reporter_handler.ts](file:///C:/AlfaKotlin/functions/src/reporter_handler.ts) to track points on a per-month basis.
- Data is stored in `monthly_leaderboard/{YYYY_MM}/reporters/{userId}`.
- Points are incremented automatically whenever a reporter earns points for a published story or view milestone.

### 2. Mobile: Monthly Leaderboard Screen
- **LeaderboardViewModel**: Fetches the top 10 reporters for the current month, ordered by points.
- **LeaderboardView**: A new screen displaying the rankings (1-10) with special gold/silver/bronze badges for the top 3.

### 3. Mobile: Staff-Only Access
- Added a "లీడర్ బోర్డ్ (Monthly)" button to the User Profile page.
- This button is **only visible** to internal staff (Reporters, Editors, Admins, Regional Incharges) to maintain internal competition.

## How to Test

1. **For Reporters/Staff**:
    - Go to the **Profile** tab.
    - You will see a new **"Reporter Board"** section with a **"Monthly Leaderboard"** button.
    - Click it to see the top 10 performers for the current month.

2. **For Subscribers (Normal Users)**:
    - Go to the **Profile** tab.
    - The "Reporter Board" section will **not** be visible.

3. **Data Reset**:
    - The system automatically starts a new leaderboard at the beginning of each month.

## UI Preview
The leaderboard displays:
- Rank (with Trophy icons for top 3)
- Reporter Profile Picture
- Name & Location
- Points earned **this month**

> [!TIP]
> This ranking resets every month, giving new reporters a fair chance to compete with veterans!
