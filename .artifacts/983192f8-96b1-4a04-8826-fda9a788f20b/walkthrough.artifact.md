# Walkthrough - Universal Header and Standardized Navigation

I have overhauled the application's header and navigation system to ensure a consistent look and feel across all pages. The `LogoHeader` is now constant, and sub-pages feature a standardized sub-header with a back button and title.

## Changes Made

### 1. Simplified Universal Logo Header
- **[LogoHeader.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LogoHeader.kt)**:
    - Simplified to always show the **Menu** button and **alfa news** logo on the left.
    - The district selector logic was moved out to ensure the logo remains constant.

### 2. Standardized Sub-Headers in Main Screen
- **[MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)**:
    - Standardized the `Scaffold`'s `topBar` to follow a multi-row pattern:
        1. **Row 1 (LogoHeader)**: Logo + Menu always visible. Home/Local feeds still show the District selector on the right as requested.
        2. **Row 2 (Contextual Sub-Header)**: Automatically appears for all sub-pages (Reporters, Messages, Leaderboard, Post News, Profile Editing, etc.) with a **Back Button** and **Plain Title**.
        3. **Row 3 (Red Strip)**: A constant divider at the bottom of the header area.
    - Centrally managed navigation logic to ensure the back button always returns to the correct parent screen.

### 3. Cleaned Sub-Page Views
- Removed redundant internal header logic from:
    - `LeaderboardView.kt`
    - `ReportersView.kt`
    - `MessagesPageView.kt`
    - `PostNewsPageView.kt`
    - `EditProfilePageView.kt`
    - `JoinReporterPageView.kt`
    - `ReporterProfileView.kt`
- These pages now focus purely on their specific content, relying on the `MainScreen` to provide the top-level navigation.

### 4. News Card Improvements
- **[NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)**: Removed the internal `LogoHeader` rendering. News cards are now focused entirely on the post content, with the global header staying sticky at the top during scrolling.

## Verification Results

- **Header Consistency**: Verified that the Logo and Menu are always visible at the same position across all app states.
- **District Selector**: Confirmed it still appears on the right in Home and Local feeds and correctly triggers the district picker.
- **Back Button Functionality**: Verified that all sub-pages (including deep profile and management screens) now have a working back button that returns to the previous context.
- **UI Logic**: Fixed type inference and warning issues in `ReportersView` and other modified files.

> [!TIP]
> This standardized approach makes the app feel more robust and predictable. No matter where the user navigates, the brand logo remains visible, and the way back is always in the same spot.
