# Navigation Fix for AlfaNews

Fixes the issue where the navigation menu items do not work when clicked from specific pages (Post News, Join Reporter, Reporter Profile, etc.).

## User Review Required

> [!IMPORTANT]
> The fix involves resetting local UI state flags in `MainScreen.kt` whenever a navigation item is selected from the drawer. This ensures that "overlay" pages are dismissed when the user chooses to go to a different top-level section.

## Proposed Changes

### Mobile App

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Update `onPageSelected` in the `ModalNavigationDrawer` to reset the following state variables:
    - `showPostNewsPage`
    - `showJoinReporterPage`
    - `showEditProfilePage`
    - `reporterIdToShow`
    - `editingNewsPost`
- This ensures that if the user is on one of these sub-pages and uses the drawer to navigate elsewhere, the sub-page is dismissed.

#### [MODIFY] [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
- Ensure that the internal `activePage` state correctly reacts to changes in `initialPage` by using `LaunchedEffect` or ensuring `remember(initialPage)` is working as expected.

## Verification Plan

### Manual Verification
1.  **Post News Page**:
    - Navigate to "Post News" from the drawer or "Create" menu.
    - Open the drawer and click "Home".
    - **Expected**: The app should navigate to the Home feed and the Post News screen should be gone.
2.  **Reporter Profile**:
    - Open a reporter's profile from any news card.
    - Open the drawer and click "Local News".
    - **Expected**: The app should navigate to the Local News feed.
3.  **Admin Pages**:
    - If logged in as Editor/Admin, navigate to "Manage News".
    - Open the drawer and click "Admin Notifications".
    - **Expected**: The app should switch to the Admin Notifications page within the admin panel.
4.  **Edit Profile**:
    - Go to Profile -> Edit Profile.
    - Open the drawer and click "Classifieds".
    - **Expected**: The app should navigate to the Classifieds section.
