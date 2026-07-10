# Research Notes - Reporter Leaderboard Issue

## Problem Statement
The user reported that the reporter leaderboard is not working ("reporter leader board panichestundaa"). The attached screenshot shows the leaderboard screen with the message "ఈ నెల ఇంకా వార్తలు ఏవీ లేవు." (No news yet this month), indicating an empty state.

## Findings

### 1. Missing Firestore Security Rules
The `monthly_leaderboard` collection is completely missing from `firestore.rules`.
- **Impact**: Any client-side request to read the leaderboard will be rejected by Firebase with a `permission-denied` error.
- **Confirmation**: `LeaderboardViewModel.kt` catches exceptions and returns an empty list, which triggers the "No news yet" message in `LeaderboardView.kt`.

### 2. Other Missing Rules
The following collections are also missing from `firestore.rules`:
- `reporter_applications`: Used by admins/regional in-charges to manage reporter applications.
- `anonymous_devices`: Used to store FCM tokens for guest users.

### 3. UI Inconsistency
`LeaderboardView.kt` lacks a standard header with a back button, making it feel disconnected from the app's navigation flow.

### 4. Logic Verification
- **Backend**: `awardPointsToReporter` in `reporter_handler.ts` correctly populates `monthly_leaderboard/{YYYY_MM}/reporters`.
- **Frontend**: `LeaderboardViewModel.kt` correctly calculates the current month ID (`YYYY_MM`) and fetches the top 10 reporters.
- **Monthly ID**: Both backend and frontend use the `${year}_${month}` format (e.g., `2026_07`).

## Root Cause Analysis
The leaderboard appears "not working" primarily because the **Firestore Security Rules** prevent the app from reading the `monthly_leaderboard` collection. Even if data exists in the backend, the mobile app cannot see it.

## Recommendations
1. **Update `firestore.rules`**: Add read/write permissions for `monthly_leaderboard`, `reporter_applications`, and `anonymous_devices`.
2. **Enhance `LeaderboardView.kt`**: Add a proper `TopAppBar` or standard header to match the rest of the app.
3. **Admin Sync**: If data is still missing after the rule change, an admin should use the "Leaderboard Sync" button in the Reporter Management page to backfill historical points.
