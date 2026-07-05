# Implementation Plan - Fix Leaderboard Sync NOT_FOUND Error

The user reported a `NOT_FOUND` error when attempting to sync leaderboard data using the "లీడర్ బోర్డ్ డేటా సింక్ (Admin)" button. This error occurs because the app is attempting to call the `backfillReporterPoints` Firebase Function in the default `us-central1` region, while the function is actually deployed in the `asia-south1` region.

## User Review Required

> [!IMPORTANT]
> The fix involves ensuring all Firebase Function calls from the Android app use the `asia-south1` region. This is the region where the backend is currently deployed.

## Proposed Changes

### Mobile App (Services & Views)

#### [MODIFY] [FirebaseService.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/services/FirebaseService.kt)
- Update the `functions` property to initialize with the `"asia-south1"` region by default. This ensures any direct calls to `FirebaseService.functions` use the correct backend region.

#### [MODIFY] [FirebaseFunctionsService.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/services/FirebaseFunctionsService.kt)
- Add a new wrapper function `backfillReporterPoints()` to standardise how this administrative task is triggered and ensure it benefits from the service's error handling.

#### [MODIFY] [ReporterManagementPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReporterManagementPageView.kt)
- Replace the direct call to `FirebaseService.functions` with a call to `FirebaseFunctionsService.backfillReporterPoints()`.

## Verification Plan

### Automated Tests
- I will verify the code changes compile and follow the established MVVM/Service patterns.

### Manual Verification
1. Open the Admin Panel.
2. Navigate to the **Reporters** (రిపోర్టర్లు) tab.
3. Click the **లీడర్ బోర్డ్ డేటా సింక్ (Admin)** button.
4. Verify that the toast message shows "డేటా విజయవంతంగా అప్‌డేట్ చేయబడింది!" (Data updated successfully) instead of "Error: NOT_FOUND".
5. Verify that reporter points are updated (no longer showing 0 if they have approved posts).
