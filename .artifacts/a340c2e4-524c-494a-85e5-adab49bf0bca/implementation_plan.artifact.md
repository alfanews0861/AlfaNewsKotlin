# Implementation Plan - Mandatory (Compulsory) App Update

This plan outlines the steps to implement a mandatory app update mechanism in AlfaNews. This will ensure that users are forced to update the app when a minimum required version is set in the backend (Firestore).

## User Review Required

> [!IMPORTANT]
> The mandatory update will block users from using the app until they update it via the Play Store. This should only be used for critical updates.

- We will use the `settings/android_config` document in Firestore to control the minimum version.
- The `AppUpdateManager` (Play Core) will be used to trigger the `IMMEDIATE` update flow.

## Proposed Changes

### [Backend/Config]

#### [MODIFY] Firestore `settings/android_config`
- I will inform you that you should add a `min_version_code` (Number) field to this document in the Firebase Console.
- I can also add a helper in the app for Admins to update this value if needed.

### [Mobile App]

#### [MODIFY] [MainViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt)
- Add `_minVersionCode` StateFlow to track the minimum required version from Firestore.
- In `init`, listen to changes in `settings/android_config` and update `_minVersionCode`.

#### [MODIFY] [MainActivity.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/MainActivity.kt)
- Update `checkAppUpdate()` to handle both `IMMEDIATE` and `FLEXIBLE` updates.
- Compare `BuildConfig.VERSION_CODE` with `mainViewModel.minVersionCode`.
- If `current < min`, trigger `AppUpdateType.IMMEDIATE`.
- Handle `onActivityResult` for the update flow to ensure the app closes or retries if the mandatory update is cancelled.

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- (Optional) Add a "System Configuration" section in the Admin settings to allow changing `min_version_code` directly from the app.

## Verification Plan

### Automated Tests
- I will verify the logic by mocking different `minVersionCode` values in a test environment.

### Manual Verification
1. Set `min_version_code` in Firestore to a value higher than the current app's `versionCode`.
2. Open the app and verify that the Play Store "Update available" full-screen dialog appears.
3. Verify that the user cannot dismiss this dialog to use the app (Immediate flow).
4. Set `min_version_code` back to a lower value and verify the app opens normally (or shows a flexible update if available).
