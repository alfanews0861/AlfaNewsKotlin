# Walkthrough - Enhancing Survey Post Accessibility

I have improved the accessibility of the "Post Survey" feature by adding missing links and entry points across the application. Previously, the survey feature was only accessible via the "Create" menu, which made it hard to find for staff members.

## Changes Made

### 1. Localized Strings
- Added `post_survey` and `nav_survey` to `strings.xml` for both English and Telugu.
- Replaced hardcoded Telugu strings in `CreateMenuView.kt` and `MainScreen.kt` with these resources.

### 2. Side Navigation Drawer
- Added a "Survey" item to the `AppDrawerContent`.
- This link is visible only to users with `REPORTER` or `ADMIN` roles who meet the badge requirements (Gold+).

### 3. Admin / Management Panel
- Added "Post Survey" to the list of accessible pages in `AdminPanelView`.
- Integrated `PostSurveyPageView` directly into the panel's rendering logic, allowing staff to publish surveys from their dashboard.

### 4. Navigation Logic
- Updated `MainScreen.kt` to handle the "survey" action from the side drawer and admin panel correctly.
- Ensured the "Back" button and Page Title update appropriately when navigating to the survey creation screen.

## Verification Results

### Manual Verification
- **Admin Access**: Verified that "Post Survey" appears in the Side Drawer and Admin Panel.
- **Reporter Access**: Verified that a Gold-badge reporter can see the links, while a Bronze-badge reporter cannot.
- **Localization**: Verified that strings switch correctly between English and Telugu.

> [!NOTE]
> The permissions still strictly follow the `canPostSurvey()` logic: Admins and Gold/Platinum/Diamond/Crown/Senior Reporters only.

render_diffs(file:///C:/AlfaKotlin/app/src/main/res/values/strings.xml)
render_diffs(file:///C:/AlfaKotlin/app/src/main/res/values-te/strings.xml)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AppDrawer.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/CreateMenuView.kt)
