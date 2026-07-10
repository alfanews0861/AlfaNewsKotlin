# Walkthrough - Compulsory (Mandatory) App Update Implementation

I have implemented a mandatory app update mechanism that allows Admins to force users to update to a specific version. This is controlled via a remote configuration in Firestore.

## Changes Made

### 1. Mandatory Update Logic in [MainActivity.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/MainActivity.kt)
- Added an observer for `minVersionCode` from the `MainViewModel`.
- Updated `checkAppUpdate()` to support `AppUpdateType.IMMEDIATE`.
- If the current app's `versionCode` is less than the `minVersionCode` set in Firestore, the app will trigger a full-screen mandatory update dialog from the Play Store.
- Added logic in `onActivityResult` to retry the update check if a mandatory update was not completed, effectively blocking access to the app until updated.

### 2. Firestore Integration in [MainViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt)
- Added `minVersionCode` state flow.
- Added a listener to `settings/android_config` document in Firestore to fetch the `min_version_code` field in real-time.

### 3. Admin Configuration UI
- Created [AppConfigPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AppConfigPageView.kt) which allows Admins to see the current app version and set the `min_version_code` for all users.
- Registered the "App Configuration" page in [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt).

## How to use

1.  Log in as an **ADMIN**.
2.  Go to **Profile** -> **App Configuration**.
3.  Enter the **Minimum Required Version Code** (e.g., `590`).
4.  Click **Save Configuration**.
5.  All users on a version lower than the specified code will see a mandatory update screen the next time they open the app (provided the update is published on Play Store).

> [!WARNING]
> Use this feature carefully. Setting `min_version_code` higher than the version available in the Play Store may block all users from using the app.

## Verification
- Code has been updated and integrated into the existing MVVM architecture.
- Real-time Firestore listeners ensure the app reacts immediately to configuration changes.
