# LogoHeader Redesign & Global Navigation Drawer Implementation

The goal is to update the `LogoHeader` design to match the app's branding (Blue background, Red bottom strip, White text) and add a global navigation drawer accessible from the home and local feeds. The drawer content will be role-based, similar to the existing Admin Panel menu.

## Proposed Changes

### [Component: UI Headers]

#### [MODIFY] [LogoHeader.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LogoHeader.kt)
- Update parameters to include `onMenuClick: () -> Unit`.
- Change `Surface` color to `MaterialTheme.colorScheme.primary` (Blue).
- Add a thin `HorizontalDivider` or a custom `Box` at the bottom with `Color(0xFFF44336)` (Red) to create the red strip.
- Change "alfa news" text color to `Color.White`.
- Add a `Menu` icon to the left of the logo, tinted `White`, which triggers `onMenuClick`.
- Maintain the district selector on the right if `showDistrictSelector` is true.

### [Component: Main Feed Views]

#### [MODIFY] [NewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsFeedView.kt)
- Add `onMenuClick: () -> Unit` parameter.
- Pass `onMenuClick` to the `LogoHeader` call.

#### [MODIFY] [LocalNewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LocalNewsFeedView.kt)
- Add `onMenuClick: () -> Unit` parameter (already has others).
- Pass `onMenuClick` to the `LogoHeader` call.

### [Component: Navigation & Drawer]

#### [NEW] [AppDrawer.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AppDrawer.kt)
- Create a shared `AppDrawerContent` composable.
- Move the role-based menu logic (accessible pages, icons, etc.) from `AdminPanelView` to this new component.
- This will ensure a consistent menu experience across the app.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Initialize `DrawerState` and `CoroutineScope`.
- Wrap the `Scaffold` in a `ModalNavigationDrawer`.
- Use `AppDrawerContent` for the `drawerContent`.
- Provide `onMenuClick = { scope.launch { drawerState.open() } }` to `NewsFeedView` and `LocalNewsFeedView`.
- Handle menu item clicks to navigate between tabs or open specific pages.

#### [MODIFY] [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
- Refactor to use the new `AppDrawerContent` if possible, or remove its internal drawer if it's now redundant (since `MainScreen` will handle it).
- Given `AdminPanelView` is currently a full-screen-ish view inside a tab, we might need to decide if it still needs its own `Scaffold` or if it should integrate with the global one.

## User Review Required

> [!IMPORTANT]
> The "Admin Panel" tab currently has its own drawer. By moving the drawer to `MainScreen`, the menu icon will be available on all main screens (Home, Local). This will make the navigation much more intuitive.
> I will ensure that "Guest" and "Subscriber" roles only see relevant items (like Profile, Settings, etc.) while Staff see the full menu.

## Verification Plan

### Manual Verification
- Deploy the app and verify the `LogoHeader` design:
    - Check Blue background.
    - Check Red bottom strip.
    - Check White text and Menu icon.
- Click the Menu icon on Home and Local feeds and verify the drawer opens.
- Verify that the drawer items change based on the logged-in user's role (Admin vs Guest).
- Verify navigation to different sections (Classifieds, Profile, etc.) from the drawer works correctly.
