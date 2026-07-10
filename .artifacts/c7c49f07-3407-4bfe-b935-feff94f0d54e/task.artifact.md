# Weather Card & Alerts Task List

- [x] Fix Timezone & Geocoding in `WeatherService.kt`
- [x] Update Telugu Time Formatting in `WeatherService.kt`
- [x] Increase Weather Fetch Timeout in `NewsFeedViewModel.kt`
- [x] Update Fallback Content in `NewsFeedViewModel.kt`
- [x] Verify UI and Data consistency in `WeatherCardView.kt`
- [x] Implement Weather Alerts Integration
    - [x] Update Cloud Functions for detailed alert storage & channel ID
    - [x] Add Weather Alert channel in `MyFirebaseMessagingService.kt`
    - [x] Create `WeatherAlertBanner.kt` UI component
    - [x] Add alert listener in `MainViewModel.kt`
    - [x] Integrate banner in `NewsFeedView.kt` (via `MainScreen.kt`)
