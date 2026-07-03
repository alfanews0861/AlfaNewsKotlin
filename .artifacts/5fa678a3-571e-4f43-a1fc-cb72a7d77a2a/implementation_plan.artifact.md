# Implementation Plan - Remove Web Scraping and GNews Dashboard

The user wants to remove the "Web Scraping" and "GNews Dashboard" features from the admin menu and delete their corresponding source files.

## User Review Required

> [!WARNING]
> This will permanently delete the following files:
> - [WebScrapingPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/WebScrapingPageView.kt)
> - [GNewsDashboardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/GNewsDashboardView.kt)

## Proposed Changes

### 1. Update UI Menus
#### [MODIFY] [AppDrawer.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AppDrawer.kt)
- Remove `scraping` and `gnews_dashboard` from the `allPages` list.
- Remove their corresponding icon mapping logic.

#### [MODIFY] [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
- Remove `scraping` and `gnews_dashboard` from the `allPages` list.
- Remove their entries from the `when (activePage)` block.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Remove `scraping` and `gnews_dashboard` from the `onPageSelected` navigation handler.

### 2. File Cleanup
#### [DELETE] [WebScrapingPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/WebScrapingPageView.kt)
#### [DELETE] [GNewsDashboardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/GNewsDashboardView.kt)

## Verification Plan

### Automated Tests
- Build the project (`assembleDebug`) to ensure no dangling references or compilation errors remain.

### Manual Verification
1.  Log in as an Admin.
2.  Open the App Drawer: Verify "Web Scraping" and "GNews Dashboard" are gone.
3.  Navigate through other Admin Panel pages to ensure everything else works correctly.
