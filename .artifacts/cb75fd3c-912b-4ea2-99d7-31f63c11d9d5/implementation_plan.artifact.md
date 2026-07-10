# Implementation Plan - AlfaNews Fixes & Improvements

This plan addresses several UI issues, time formatting inconsistencies, and improvements to reporter management and application processes.

## User Review Required

> [!IMPORTANT]
> - **IST Time**: All timestamps displayed in the app will now be forced to IST (Asia/Kolkata) to ensure consistency regardless of server or device settings.
> - **Reporter Application**: The submission still triggers the same Cloud Function, preserving the email-sending behavior mentioned.
> - **Header Changes**: Redundant headers in sub-pages will be removed to rely on the main scaffold's header, fixing the double-header issue.

## Proposed Changes

### 1. Core Utilities & Time Formatting
Set all date displays to IST.

#### [NEW] [DateTimeUtils.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/utils/DateTimeUtils.kt)
- Create utility functions to get `SimpleDateFormat` with `Asia/Kolkata` timezone.

#### [MODIFY] [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
- Use IST for post timestamp display.

#### [MODIFY] [ManagePostsPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ManagePostsPageView.kt)
- Use IST for post timestamp display.

---

### 2. UI Layout & Scaffolding
Fix double headers and strip ordering.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Reorder `topBar` content: Move the Red strip immediately below the Blue `LogoHeader`.
- Ensure sub-header appears below the red strip for better visual hierarchy.

#### [MODIFY] [PostNewsPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/PostNewsPageView.kt)
- Remove redundant header `Row`.

#### [MODIFY] [JoinReporterPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/JoinReporterPageView.kt)
- Remove redundant header `Row`.
- Implement per-field validation with auto-scroll to error.

#### [MODIFY] [EditProfilePageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/EditProfilePageView.kt)
- Remove redundant header `Row`.

---

### 3. Reporter Management Enhancements
Fix stats, add search, and sorting.

#### [MODIFY] [ReportersViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/ReportersViewModel.kt)
- Update `fetchReportersForStats` to handle both `Long` and `Timestamp` field types for `timestamp`.
- Centralize reporter fetching to support `REGIONAL_INCHARGE` (multiple districts) and `ADMIN` (all).
- Add `searchQuery` and `sortOrder` logic.

#### [MODIFY] [ReporterManagementPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReporterManagementPageView.kt)
- Integrate `ReportersViewModel` for data loading.
- Add Search bar at the top of the "Reporters" tab.
- Add Sort options (Recent, Points, Today Posts, Name).

## Verification Plan

### Automated Tests
- N/A (UI and data fetching focused changes).

### Manual Verification
- **Time Check**: Verify news post times are in IST.
- **UI Check**: Verify no double headers in Publish News, Join Reporter, and Edit Profile pages.
- **UI Check**: Verify Red strip is below Blue header.
- **Reporter Stats**: Verify "Today" and "Last Week" posts are correctly counted.
- **Search & Sort**: Test searching by name/phone and sorting by points/posts.
- **Validation**: Try submitting a reporter application with missing fields and verify it scrolls to the missing field.
