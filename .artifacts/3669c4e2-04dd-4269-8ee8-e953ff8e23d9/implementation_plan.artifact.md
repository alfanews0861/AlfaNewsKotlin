# Implementation Plan - Fix Double Header in Reporter Profile

The user reported a "double header" issue when clicking a news item from the reporter profile. Research shows that `NewsCardView` defaults to showing a `LogoHeader`, which conflicts with the global header provided by `MainScreen`.

## Proposed Changes

### [UI Components]

#### [MODIFY] [ReporterProfileView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReporterProfileView.kt)
- Update the `NewsCardView` call within the `VerticalPager` to pass `showTopHeader = false`. This will remove the redundant header inside the news card while maintaining the global app header from `MainScreen`.

#### [MODIFY] [SinglePostView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/SinglePostView.kt)
- Update the `NewsCardView` call to pass `showTopHeader = false`. Although this view is not currently active in `MainScreen`'s navigation, correcting it ensures that if it's used in the future or via deep links, it won't exhibit the same double header issue.

## Verification Plan

### Manual Verification
- Deploy the app to a device or emulator.
- Navigate to "Reporters" and select a reporter to view their profile.
- Click on any news item in the reporter's story grid.
- Verify that only one header (the main app header) is visible at the top, and the news card content starts immediately below it.
- Verify that the back button overlay in `ReporterProfileView` still works as expected.
