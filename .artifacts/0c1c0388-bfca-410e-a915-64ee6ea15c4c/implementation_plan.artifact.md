# Implementation Plan - Unified Header System

Standardize the app's header system to fix inconsistencies (double headers, different colors, and redundant scaffolds) and provide a polished, branded look across all screens.

## User Review Required

> [!IMPORTANT]
> - I will remove the black top bar from the Profile/Admin screens and replace it with a single, unified header.
> - `LogoHeader` will be the primary header for "Main" tabs (Home, Local).
> - Other screens will use a standardized `TopAppBar` that matches the `LogoHeader` color (`BrandDarkBlue`) and style (Red Strip).

## Proposed Changes

### 1. `MainScreen.kt` - Centralizing Header Logic

- Define a single `TopAppBar` (or `LogoHeader`) in the `Scaffold`'s `topBar` parameter.
- Move header rendering logic out of individual views and into `MainScreen`.
- Support different modes: `BRAND` (Logo + Red Strip) and `FUNCTIONAL` (Back Arrow + Title + Red Strip).

### 2. `LogoHeader.kt` - Enhancement

- Refactor `LogoHeader` to be more flexible, potentially supporting a "Title" mode or making it easy to use as a standard `TopAppBar`.
- Ensure consistent height and alignment.

### 3. Individual Views - Cleanup

- **[MODIFY] [NewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsFeedView.kt)**: Remove internal `LogoHeader`.
- **[MODIFY] [LocalNewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LocalNewsFeedView.kt)**: Remove internal `LogoHeader`.
- **[MODIFY] [UserProfilePageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/UserProfilePageView.kt)**: Remove internal `LogoHeader`.
- **[MODIFY] [ReportersView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReportersView.kt)**: Remove internal `Scaffold` and `TopAppBar`.
- **[MODIFY] [LeaderboardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LeaderboardView.kt)**: Remove internal `Scaffold` and `TopAppBar`.
- **[MODIFY] [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)**: Remove internal `Scaffold` and `TopAppBar`. It will now be a simple `Column` or `Box`.

### 4. Color & Style Standardization

- Use `BrandDarkBlue` (`0xFF0D204C`) as the container color for ALL top bars to maintain brand identity.
- Add the distinctive red strip (`0xFFF44336`, 4dp height) to the standard `TopAppBar` style so it matches `LogoHeader`.

## Verification Plan

### Manual Verification
- Verify `Home` and `Local` tabs show the `LogoHeader`.
- Verify `Profile` tab shows a single header (Brand Blue) with "ప్రొఫైల్" or "అడ్మిన్ ప్యానెల్" title.
- Verify sub-pages like `Reporters` and `Leaderboard` show a single header with a back button and the red strip.
- Verify `Post News` page uses the same header style.
- Check both Light and Dark modes for legibility.
