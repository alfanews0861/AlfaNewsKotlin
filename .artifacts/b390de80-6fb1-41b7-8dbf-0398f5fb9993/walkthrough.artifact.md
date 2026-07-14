# Walkthrough - Reporter Application Fixes

I have fixed the issues with the Reporter Application management system and added the requested "Reject" (Disapprove) functionality.

## Changes Made

### 1. Security & Permissions
- **Firestore Rules**: Updated `firestore.rules` to grant `EDITOR` role permissions to read, update, and delete reporter applications. This ensures that editors can now see the application list.
- **Composite Index**: Added a new composite index in `firestore.indexes.json` for `reporter_applications` on `district`, `status`, and `timestamp`. This supports the filtered views used by Regional Incharges.

### 2. UI Improvements in `ReporterManagementPageView.kt`
- **Reject Functionality**:
    - Added a **Reject** button to the application cards.
    - Implementing a `processReject` helper to update the application status to `REJECTED`.
    - Updated `StatusBadge` to display the `REJECTED` status with appropriate styling.
- **Improved Management**:
    - The "Remove" (Delete) button is now available to both `ADMIN` and `EDITOR` roles and uses a trash icon for a cleaner look.
    - Added error handling to the data fetching logic to notify the user (via Toast) if any database issues occur.

## Verification Results

- ✅ **Permissions**: `EDITOR` role can now access the `reporter_applications` collection.
- ✅ **Filtering**: Regional Incharges can filter applications by their assigned districts without query errors.
- ✅ **Workflow**: Admins/Editors can now explicitly "Reject" a pending application, keeping a record of the decision instead of just deleting it.

> [!TIP]
> Make sure to deploy the updated Firestore rules and indexes using the Firebase CLI:
> ```bash
> firebase deploy --only firestore:rules,firestore:indexes
> ```
