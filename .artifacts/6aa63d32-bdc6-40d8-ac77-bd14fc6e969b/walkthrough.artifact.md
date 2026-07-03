# Walkthrough - Menu Access Across All Pages

The side menu (drawer) is now accessible from all major pages in the app, either via a visible menu button in the header or by swiping from the left edge of the screen.

## Changes Made

### 1. Global Drawer Gestures
- In [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt), the `gesturesEnabled` property of `ModalNavigationDrawer` was set to `true` globally. This allows users to open the menu by swiping from the left on any screen that isn't blocking gestures.

### 2. Header Updates
- **Profile Page**: Added [LogoHeader](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LogoHeader.kt) to [UserProfilePageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/UserProfilePageView.kt). Regular users and staff can now access the menu directly from their profile.
- **Classifieds**: Updated [ClassifiedsView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ClassifiedsView.kt) to show a menu button when at the top-level categories screen.
- **Messages**: Switched to using `LogoHeader` in [MessagesPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MessagesPageView.kt) for a consistent look and menu access.
- **Reporters & Leaderboard**: The `TopAppBar` in [ReportersView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReportersView.kt) and [LeaderboardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LeaderboardView.kt) now displays a Menu icon when accessed as a primary navigation target.

## Verification Results

> [!TIP]
> Try navigating to 'ప్రొఫైల్' (Profile) or 'క్లాసిఫైడ్స్' (Classifieds) and verify that you can see the 'alfa news' header with the menu button. You can also swipe from the left edge to open the menu at any time.

### Automated Tests
- The code was verified for compilation errors during implementation.

### Manual Verification Steps
1. Open the app and go to the Home screen.
2. Tap the Menu button and select 'ప్రొఫైల్' (Profile).
3. Verify the Menu button is visible in the header.
4. Open the Menu again and select 'రిపోర్టర్స్' (Reporters).
5. Verify the Menu button is visible instead of the 'Back' button.
6. Test swiping from the left edge on these pages to ensure the drawer opens smoothly.
