# Reporter Application System Research

## Current Flow

1. **Submission**: `JoinReporterPageView.kt` -> `FirebaseFunctionsService.submitReporterApplication` -> Cloud Function `submitReporterApplication` in `reporter_handler.ts`.
2. **Storage**: Applications are saved in `reporter_applications` collection with `status: "PENDING"`.
3. **Management**: `ReporterManagementPageView.kt` fetches applications from `reporter_applications`.
   - Accessible by: `ADMIN`, `EDITOR`, `REGIONAL_INCHARGE`.
   - Fetching logic uses `orderBy("status", Query.Direction.ASCENDING).orderBy("timestamp", Query.Direction.DESCENDING)`.

## Identified Issues

### 1. Security Rule Mismatch
- **File**: `firestore.rules`
- **Problem**: `match /reporter_applications/{appId}` only allows `ADMIN` and `REGIONAL_INCHARGE` to read/update.
- **Impact**: `EDITOR` role users see an empty list because the query fails silently (permission denied).

### 2. Missing "Reject" Functionality
- **File**: `ReporterManagementPageView.kt`
- **Problem**: Only "Approve" and "Remove" buttons exist.
- **Impact**: No way to officially reject an application. The user specifically asked for "Approve or Disapprove" (అప్ప్రొవె లేదా డిస్ అప్ప్రొవె).

### 3. Missing Index for Regional Incharge
- **File**: `firestore.indexes.json`
- **Problem**: `REGIONAL_INCHARGE` uses `whereIn("district", ...).orderBy("status", ...).orderBy("timestamp", ...)`.
- **Index present**: `status` + `timestamp` OR `district` + `status`.
- **Missing**: `district` + `status` + `timestamp`.

### 4. Limited "Remove" Access
- **File**: `ReporterManagementPageView.kt`
- **Problem**: `Remove` button is only visible to `ADMIN`. `REGIONAL_INCHARGE` and `EDITOR` cannot even clear rejected/old applications.

## Proposed Fixes

1. Update `firestore.rules` to include `EDITOR` for `reporter_applications`.
2. Add a "Reject" button to `ApplicationCard` in `ReporterManagementPageView.kt`.
3. Update `status` to `REJECTED` instead of deleting (or provide both options).
4. Update `firestore.indexes.json` with the required composite index.
5. Improve error handling in `fetchData` to show a Toast on failure.
