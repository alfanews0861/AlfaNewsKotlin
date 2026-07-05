# Implementation Plan - Unify Logo Header and Standardize Page Titles

Standardize the app header to only show the "alfa news" logo and menu/back icons across all pages. Move existing titles from the top app bar to the main page content area to improve consistency and branding.

## User Review Required

> [!IMPORTANT]
> - All pages will now show the **alfa news** logo in the top bar.
> - Page titles (e.g., "నిర్వహణ ప్యానెల్", "రిపోర్టర్లు") will be moved down to the top of the content area.
> - This affects almost all screens in the application for visual consistency.

## Proposed Changes

### [Component] UI Standard Header

#### [MODIFY] [LogoHeader.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LogoHeader.kt)
- Remove the `title` logic that replaces the logo.
- Always display the "alfa news" logo next to the navigation icon (Menu or Back).
- Ensure consistent height and styling for the top bar.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Remove all `title` arguments passed to `LogoHeader` instances in the `Scaffold`'s `topBar`.
- Standardize the `topBar` configuration for all app tabs.

### [Component] Individual Views (Adding Page Titles)

Move titles to the content area of these views:

#### [MODIFY] [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
- Add "నిర్వహణ ప్యానెల్" (Admin Panel) as a header text at the top of the content.

#### [MODIFY] [ReportersView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReportersView.kt)
- Add "రిపోర్టర్లు" (Reporters) header at the top.

#### [MODIFY] [LeaderboardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LeaderboardView.kt)
- Add Monthly Leaderboard title at the top (it already has a header section, verify styling).

#### [MODIFY] [PostNewsPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/PostNewsPageView.kt)
- Add "వార్తను పోస్ట్ చేయండి" (Post News) header.

#### [MODIFY] [JoinReporterPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/JoinReporterPageView.kt)
- Add "రిపోర్టర్ గా చేరండి" (Join Reporter) header.

#### [MODIFY] [EditProfilePageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/EditProfilePageView.kt)
- Add "ప్రొఫైల్ సవరించండి" (Edit Profile) header.

#### [MODIFY] [MessagesPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MessagesPageView.kt)
- Add "సందేశాలు" (Messages) header.

#### [MODIFY] [ClassifiedsView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ClassifiedsView.kt)
- Ensure the existing title styling matches the new standard.

## Verification Plan

### Automated Tests
- Build the project to ensure no compilation errors after refactoring `LogoHeader` and `MainScreen`.

### Manual Verification
- Deploy to an emulator/device.
- Navigate through all tabs (Home, Local, Post, Classifieds, Profile).
- Verify that the "alfa news" logo is visible at the top of every screen.
- Verify that page-specific titles are correctly displayed as sub-headers in the content area.
- Check both Light and Dark modes for title visibility.
