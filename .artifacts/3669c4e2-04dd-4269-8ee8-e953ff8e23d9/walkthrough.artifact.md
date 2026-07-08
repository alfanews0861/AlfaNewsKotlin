# Walkthrough - Fixed Double Header in Reporter Profile

I have fixed the issue where two headers were appearing when viewing news stories from a reporter's profile.

## Changes Made

### [UI Components]

#### [ReporterProfileView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReporterProfileView.kt)
- Modified the `NewsCardView` call to set `showTopHeader = false`. This prevents the news card from drawing its own header, as `MainScreen` already provides the global app header.

#### [SinglePostView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/SinglePostView.kt)
- Applied the same fix (`showTopHeader = false`) to ensure consistency and prevent similar issues if this view is used via deep links.

## Verification

The changes were applied following the same pattern used in the main news feeds. By disabling the internal header of `NewsCardView` within these context-aware views, the UI now correctly shows only the primary app header.

> [!TIP]
> This pattern ensures that `NewsCardView` remains flexible: it can show a header when used in isolation but hides it when nested within a screen that already has a header.
