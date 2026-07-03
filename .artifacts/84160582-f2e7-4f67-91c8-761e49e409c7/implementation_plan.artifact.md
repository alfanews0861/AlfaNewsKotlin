# In-App News Notifications Plan

This plan implements a silent in-app notification system that alerts users when new news is posted while they are reading other news.

## Proposed Changes

### [Component Name] Backend Logic & State

#### [MODIFY] [MainViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt)
- Add `_newNewsNotification` StateFlow to hold the latest relevant `NewsPost`.
- Implement a real-time Firestore listener on the `news` collection.
- The listener will:
    - Ignore the initial baseline snapshot.
    - Check subsequent additions/updates for `approved == true`.
    - Compare the post's `timestamp` with the app's `startTime`.
    - Filter by district:
        - If the post's `district` is a specific Telugu district (e.g., "గుంటూరు"), only show it if it matches the current user's district.
        - If the post is global/state-level, show it to everyone.
- Add `dismissInAppNotification()` to clear the state.

### [Component Name] UI Layer

#### [NEW] [InAppNotificationView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/InAppNotificationView.kt)
- Create a modern, animated Composable for the in-app notification.
- Design features:
    - Slide-down animation from the top.
    - Glassmorphism effect (using existing utility).
    - Display news headline (Telugu), small image preview, and a "New" tag.
    - Click handler to navigate to the post.
    - Auto-dismiss logic (5 seconds).

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Observe `newNewsNotification` from `MainViewModel`.
- Place the `InAppNotificationView` at the top of the main `Box` layout.
- Implement the click action:
    - Set `sharedPostId` in `NewsFeedViewModel`.
    - Switch to "home" tab.
    - Reload news with `initialPostId`.

## Verification Plan

### Manual Verification
1. Open the app and stay on the Home or Local feed.
2. Manually add/approve a new news post in Firestore (via Firebase Console).
3. Verify that the in-app notification appears at the top.
4. Verify that clicking the notification opens the correct news post.
5. Verify that district-specific news only shows for users in that district.
6. Verify that global news shows for all users.
7. Verify that the notification auto-dismisses after 5 seconds.
