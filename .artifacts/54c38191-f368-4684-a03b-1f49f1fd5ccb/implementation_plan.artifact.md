# Survey System Enhancements Plan

The goal is to improve the survey feature in the AlfaNews app by making results real-time, placing the survey at a fixed position in the feed, and ensuring it expires after 5 days or when a new survey is available. Additionally, answered surveys should not be shown to the user again.

## Proposed Changes

### [Mobile App]

#### [MODIFY] [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
- **Real-time Updates**: Implement a Firestore `addSnapshotListener` in `SurveyCardContent`.
- This listener will watch the specific survey document and update a local state for `votes` and `realVotesCount` whenever a change occurs (e.g., another user votes).
- This ensures that results are updated in real-time as requested.

#### [MODIFY] [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt)
- **Active Survey Fetching**: Add a method to fetch the latest approved survey created within the last 5 days.
- **Survey Injection**: Modify `loadNews` and `loadMore` to inject this active survey at index 40 (start of the 3rd page, assuming 20 items per page).
- **Filtering Answered Surveys**:
    - Maintain a local set of `answeredSurveyIds` in the ViewModel.
    - Before injecting the active survey, check if the user has already answered it.
    - If a user votes successfully, add the survey ID to the set and remove it from the active news list to make it disappear instantly.
- **Natural Survey Removal**: Ensure that surveys appearing naturally in the regular news query are filtered out so that only the specifically injected survey remains in the fixed position.

#### [MODIFY] [NewsPost.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/models/NewsPost.kt)
- No major changes expected, but ensure the model supports real-time updates from the listener.

## Verification Plan

### Manual Verification
1. **Real-time Results**:
   - Open a survey in the app.
   - Vote on the same survey from another device or the Firebase Console.
   - Observe that the results in the app update immediately without a refresh.
2. **Fixed Position**:
   - Scroll down to the 3rd page (around 40 items).
   - Verify that the survey post appears at the expected location.
3. **Persistence & Expiration**:
   - Verify that a survey older than 5 days does not appear.
   - Verify that if a new survey is posted, it replaces the old one.
4. **Answered Filtering**:
   - Answer the survey.
   - Verify it disappears from the feed immediately and doesn't reappear on subsequent loads.
