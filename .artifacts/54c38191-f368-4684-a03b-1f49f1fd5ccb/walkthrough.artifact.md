# Survey Management & Menu Cleanup Walkthrough

I have implemented a dedicated survey management system and streamlined the staff menu.

## Changes Made

### Dedicated Survey Management Page
- **File**: [ManageSurveysPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ManageSurveysPageView.kt)
- **Features**:
    - **Real-time Listener**: Automatically updates when any survey is approved or deleted.
    - **Approval Workflow**: Admins and Staff can approve pending surveys from reporters.
    - **Results Dashboard**: A dedicated BarChart icon on each survey opens a dialog showing real-time vote distribution, including hidden "Real Votes" vs. "Displayed Votes".
    - **Clean Separation**: Surveys are no longer mixed with thousands of news posts in "Manage News".

### Admin/Staff Menu Cleanup
- **File**: [AppDrawer.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AppDrawer.kt)
- **Changes**:
    - Removed **"Home"** and **"Local News"** (Jilla Vaarthalu) from the drawer for staff roles. Since these are always visible in the bottom footer, they were redundant and cluttering the menu.
    - Added **"సర్వే నిర్వహణ"** (Survey Management) link to the menu for easy access.

### Survey Approval Logic
- **File**: [PostSurveyPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/PostSurveyPageView.kt)
- **Changes**:
    - Surveys posted by **Admin, Editor, or News Desk** are now `LIVE` immediately.
    - Surveys posted by **Reporters** are set to `PENDING` and require approval via the new management page.

### Global Navigation Integration
- **Files**: [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt), [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- **Changes**:
    - Registered the `manageSurveys` page in the Admin Panel.
    - Added proper header titles and back-button navigation for the new page.

## Verification
- Verified staff menu cleanup: Drawer is now much cleaner for Reporters/Admins.
- Verified Survey Management link visibility for staff roles.
- Verified survey approval flow: Staff posts are immediate, Reporter posts are pending.
