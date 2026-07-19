# Survey Management & Menu Cleanup Plan

The goal is to create a dedicated page for managing surveys (Approval and Results) and clean up the Admin/Staff drawer menu by removing redundant links already available in the footer.

## Proposed Changes

### [Mobile App]

#### [NEW] [ManageSurveysPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ManageSurveysPageView.kt)
- Create a dedicated page for Admins/Staff to manage surveys.
- **Features**:
    - List of all surveys (most recent first).
    - Status badges (Pending/Approved).
    - **Approve Button**: To approve pending surveys from reporters.
    - **Results Button**: To view real-time aggregate votes for any survey.
    - **Delete Button**: To remove outdated surveys.

#### [MODIFY] [AppDrawer.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AppDrawer.kt)
- **Menu Cleanup**: Remove "Home" and "Local News" (Jilla Vaarthalu) from the drawer menu for all staff roles (Reporter, Editor, Admin, etc.) since they are always accessible via the footer.
- **Add Survey Management**: Add a link to the new "Survey Management" page.

#### [MODIFY] [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
- Register the new `manageSurveys` page.
- Update the UI to render `ManageSurveysPageView` when the active page is `manageSurveys`.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Update the contextual header logic to include a title for "Survey Management".
- Ensure the back button navigation works correctly for the new page.

## Verification Plan

### Manual Verification
1. **Menu Check**:
   - Log in as an Admin/Reporter.
   - Open the sidebar drawer.
   - Verify that "Home" and "Local News" are GONE.
   - Verify that "Survey Management" is PRESENT.
2. **Survey Management Page**:
   - Click "Survey Management".
   - Verify all surveys (reporter & admin) are listed.
   - Approve a pending reporter survey and verify it becomes LIVE.
   - View results for a survey and verify the counts are accurate.
3. **Navigation**:
   - Verify that the footer still works to go Home/Local.
   - Verify that the back button from Survey Management takes you back to the Profile menu.
