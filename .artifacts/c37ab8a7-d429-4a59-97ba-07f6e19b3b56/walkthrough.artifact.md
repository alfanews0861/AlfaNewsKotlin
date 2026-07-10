# Walkthrough - Reporter Management & Navigation Updates

I have implemented the requested changes for reporter management, profile leaderboard fixes, and post-submission redirection.

## Changes Made

### 1. Reporter Management Enhancements
- **Statistics**: Added "Today" and "Last Week" post counts for each reporter.
- **Click-to-Call**: Integrated the phone number into the reporter card with a direct calling feature.
- **UI Theme**: Updated the Reporter Management page with a professional **Black and Grey** theme for better contrast and visibility.
- **Stats Logic**: Implemented `fetchReportersForStats` in `ReportersViewModel` to calculate post counts directly from Firestore.

### 2. Reporter Board (Leaderboard) Fix
- **Fallback Logic**: Updated `LeaderboardViewModel` to check the previous month's data if the current month's leaderboard is not yet available (common at the start of a month).

### 3. Post-Submission Redirection
- **Manage News Redirect**: Updated `MainScreen.kt` so that when a Reporter or Staff member posts news, they are now automatically redirected to the **"Manage News"** page instead of the Home feed. This allows them to immediately see the status of their post.

## Verification Results

### UI Comparison
````carousel
```kotlin
// ReporterListCard (New Theme & Features)
Card(
    containerColor = Color(0xFF1E1E1E),
    contentColor = Color.White
) {
    // Phone with clickable dialer
    // Stats: Today, Last Week, Points
}
```
<!-- slide -->
```kotlin
// Redirection Logic
if (isStaff) {
    mainViewModel.setAdminActivePage("manage")
    mainViewModel.setActiveTab("profile")
}
```
````

### Key Files Modified
- [ReportersViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/ReportersViewModel.kt)
- [ReporterManagementPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReporterManagementPageView.kt)
- [LeaderboardViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/LeaderboardViewModel.kt)
- [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)

> [!NOTE]
> The post counts are calculated in real-time when the reporter list is loaded for a specific district/mandal.
