# LogoHeader Redesign & Global Navigation Drawer Implementation

The app's header and navigation have been significantly improved. The `LogoHeader` now features a modern, branded design, and a global navigation drawer is accessible from the main news feeds.

## Changes Made

### 1. LogoHeader Redesign
- **Branding**: The header now uses the app's primary blue color as its background.
- **Logo**: The "alfa news" text is now purely white for better contrast and a cleaner look.
- **Red Strip**: Added a thin red strip at the bottom of the header to match the app's color palette.
- **Menu Icon**: A menu icon has been added to the left side of the logo on the home and local feeds.
- **Functionality**: Maintained the district selector on the right side for the local news feed.

### 2. Global Navigation Drawer
- **Implementation**: A shared `AppDrawerContent` component was created to provide a consistent menu across the app.
- **Integration**: `MainScreen.kt` now hosts a `ModalNavigationDrawer`, making the menu accessible from anywhere in the main feeds.
- **Role-Based**: The drawer items automatically adjust based on the user's role (Guest, Subscriber, Reporter, Admin, etc.), ensuring only relevant features are shown.
- **Refactoring**: Cleaned up `AdminPanelView.kt` to use the global drawer instead of its own internal one, providing a more cohesive user experience.

## Verification Results

### Automated Tests
- `gradlew :app:assembleDebug` passed successfully, confirming no compilation errors.

### Manual Verification
- Verified that `LogoHeader` displays the new design (Blue background, White logo, Red strip).
- Verified that clicking the Menu icon opens the drawer on both Home and Local feeds.
- Verified that drawer items navigate to the correct tabs (Home, Local, Profile, etc.).
- Verified that Staff members can see Admin-specific items in the drawer.

render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LogoHeader.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AppDrawer.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
