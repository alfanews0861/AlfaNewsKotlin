# Reporter Management and Navigation Improvements

This plan covers updates to the Reporter Management UI, fixing the Reporter Board on the profile page, and correcting the redirection after posting news.

## User Review Required

> [!IMPORTANT]
> The redirection after posting news will now go to the "Manage News" page instead of the Home page for reporters.

## Proposed Changes

### [Component] Reporter Management

#### [MODIFY] [ReportersViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/ReportersViewModel.kt)
- Add `ReporterStats` data class.
- Add `_reporterStats` StateFlow to store post counts for each reporter.
- Implement `fetchStatsForReporters(reporterIds: List<String>)` to query the `news` collection for "Today" and "Last Week" post counts.
- Update `fetchReporters` to automatically fetch stats after reporters are loaded.

#### [MODIFY] [ReporterManagementPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReporterManagementPageView.kt)
- Update `ReporterListCard` to:
    - Show the reporter's phone number.
    - Add a click listener to the phone number to initiate a phone call using `Intent.ACTION_DIAL`.
    - Display "Today's Posts" and "Last Week's Posts" fetched from the ViewModel.
    - Apply a "Black and Grey" theme style for better visibility.

### [Component] Profile Page & Navigation

#### [MODIFY] [LeaderboardViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/LeaderboardViewModel.kt)
- Improve `fetchLeaderboard` to handle empty monthly results by potentially falling back to the previous month or a general leaderboard if appropriate (to be determined during implementation).
- Add logging to help diagnose why the board might be empty.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Update the `onActionComplete` callback for `PostNewsPageView`.
- For reporters/staff, set `mainViewModel.setAdminActivePage("manage")` and `mainViewModel.setActiveTab("profile")` to ensure they land on the "Manage News" page after a successful post.

## Verification Plan

### Automated Tests
- I will verify the logic changes in the ViewModels by inspecting the flow of data.
- Since I cannot run the full app with Firebase connection in this environment, I will rely on code analysis and structure verification.

### Manual Verification
- Deploy the app and verify:
    1. After posting a news item, the app redirects to the "Manage News" page.
    2. The Reporter Management page shows phone numbers and post counts (Today/Last Week).
    3. Clicking a phone number opens the dialer.
    4. The Reporter Board on the profile page shows data if available.
