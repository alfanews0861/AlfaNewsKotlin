# Survey System Enhancements Walkthrough

I have improved the survey feature to be more dynamic and user-friendly.

## Changes Made

### Real-time Survey Results
- **File**: [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
- **Implementation**: Replaced the static vote display with a real-time Firestore listener using `addSnapshotListener` within a `DisposableEffect`.
- **Benefit**: Users will see the results update instantly as votes come in from other users, solving the issue where results initially showed zeros or were outdated.

### Fixed Survey Positioning
- **File**: [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt)
- **Implementation**:
    - Added `fetchActiveSurvey()` to retrieve the latest approved survey.
    - Modified `rankAndBlendPosts` to inject this survey specifically at **index 2** (the 3rd position in the feed) on the first page.
    - Shifted other injected items (Weather, History, etc.) accordingly to maintain the desired layout.

### Smart Survey Visibility & Expiration
- **Files**: [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt), [PreferenceManager.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/utils/PreferenceManager.kt), [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
- **Logic**:
    - **5-Day Limit**: The fetching query now only considers surveys created within the last 5 days.
    - **Single Active Survey**: Only the most recent survey is shown in the fixed position.
    - **Filter Answered**: Once a user votes, the survey ID is saved locally in `PreferenceManager`. The ViewModel then filters out this survey from the feed, ensuring it doesn't reappear after being answered.

## Verification
- Code reviewed for correct Firestore query syntax and indexing.
- Verified that shifted indices in `NewsFeedViewModel` correctly accommodate the new survey position.
- Real-time listener correctly unregisters when the card is disposed to prevent memory leaks.

> [!IMPORTANT]
> Since I have modified the feed's mixing logic, please verify that the survey appears at the 3rd position as expected. If it doesn't appear, ensure there is an **approved** survey post in Firestore created within the last 5 days.
