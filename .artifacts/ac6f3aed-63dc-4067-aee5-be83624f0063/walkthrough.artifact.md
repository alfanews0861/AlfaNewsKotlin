# Walkthrough - Unified Logo Header and Content Sub-headers

I have standardized the app header to always display the **alfa news** logo and moved page-specific titles to the main content area as sub-headers. This provides a consistent branding experience across all screens.

## Key Changes

### 1. Unified `LogoHeader`
- **Simplified Header**: Modified `LogoHeader.kt` to always show the navigation icon (Menu/Back) and the logo.
- **Removed Title Swapping**: Eliminated the logic that replaced the logo with a text title, ensuring the brand is always visible.

### 2. Standardized `MainScreen`
- **Consistent Top Bar**: Updated `MainScreen.kt` to call `LogoHeader` without title parameters for all tabs and sub-pages.
- **Clean Configuration**: Standardized the `topBar` block for Home, Local, Profile, Reporters, Leaderboard, Messages, and Classifieds.

### 3. New Content Sub-headers
Moved existing titles from the top bar into the top of the content area for the following screens:
- **Admin Panel**: Added "నిర్వహణ ప్యానెల్" title.
- **Reporters**: Added "రిపోర్టర్లు" title.
- **Leaderboard**: Standardized the monthly leaderboard title area.
- **Post News**: Added "వార్తను పోస్ట్ చేయండి" (or Update) title.
- **Join Reporter**: Added "రిపోర్టర్ గా చేరండి" title and removed redundant inner `Scaffold`.
- **Edit Profile**: Added "ప్రొఫైల్ సవరించండి" title.
- **Messages**: Added "సందేశాలు" title and removed redundant inner `LogoHeader`.
- **Classifieds**: Aligned title styling (24.sp, Bold, `Ramabhadra`) and removed redundant Menu icon from the sub-header.
- **User Management**: Removed redundant inner `Scaffold` for better integration into the Admin Panel.

## Visual Consistency
All page titles now use:
- **Font**: `Ramabhadra`
- **Size**: `24.sp`
- **Weight**: `Bold`
- **Color**: `MaterialTheme.colorScheme.onBackground`
- **Padding**: Standardized spacing below the logo header.

## Verification Results
- All screens now show the logo at the top.
- Navigation remains functional with Menu/Back icons correctly positioned.
- Page titles are clearly visible as sub-headers in the content area.
- Build issues related to imports and nesting were resolved.
