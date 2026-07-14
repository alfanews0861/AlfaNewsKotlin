# Implementation Plan - Fix Reporter Applications Management

Fix the issue where reporter applications are not appearing for certain roles and add the requested "Reject" (Disapprove) functionality.

## User Review Required

> [!IMPORTANT]
> - I am adding the `EDITOR` role to the Firestore permissions for reporter applications. Please confirm if editors should have full management rights (Approve/Reject).
> - I will add a "Reject" button which sets the status to `REJECTED`. Rejected applications will remain in the list (ordered by status) unless manually "Removed" (deleted).

## Proposed Changes

### 1. Firestore Security Rules

#### [MODIFY] [firestore.rules](file:///C:/AlfaKotlin/firestore.rules)
- Update `match /reporter_applications/{appId}` to include `EDITOR` in the allowed roles for `read`, `update`, and `delete`.

### 2. Firestore Indexes

#### [MODIFY] [firestore.indexes.json](file:///C:/AlfaKotlin/firestore.indexes.json)
- Add a composite index for `reporter_applications` on `district` (ASC), `status` (ASC), and `timestamp` (DESC) to support Regional Incharge queries.

### 3. Android App UI

#### [MODIFY] [ReporterManagementPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReporterManagementPageView.kt)
- **Error Handling**: Update `fetchData` to show a Toast if the query fails, instead of failing silently.
- **Reject Button**: Add a "Reject" button next to "Approve" in `ApplicationCard`.
- **Status Update**: Implement a `processReject` function similar to `processJoin` to update the application status to `REJECTED`.
- **UI Tweaks**: Improve the "Remove" button visibility or functionality if needed.

### 4. Backend Cloud Functions (Optional/Self-correction)

- The existing `submitReporterApplication` in `reporter_handler.ts` already sets `status: "PENDING"`.
- I'll check if a rejection notification is needed in the future, but for now, the user just wants the UI fixed.

## Verification Plan

### Automated Tests
- N/A (Manual verification on device is preferred for Firestore rule/index fixes).

### Manual Verification
1. **Login as Editor**: Verify that "Applications" (దరఖాస్తులు) tab now shows data.
2. **Submit Application**: Use the "+ Join as Reporter" flow and verify it appears in the list.
3. **Approve Application**: Verify that a "PENDING" application can be approved and the user's role changes to `REPORTER`.
4. **Reject Application**: Verify that a "PENDING" application can be rejected and its status changes to `REJECTED`.
5. **Regional Incharge**: (If possible) Verify that a Regional Incharge only sees applications from their assigned districts and the query doesn't crash.
