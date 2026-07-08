# Notification System Improvements Implementation Plan

This plan addresses the user's request to fix notification flaws, ensure everyone gets rich notifications, enable them by default, and add unit tests.

## User Review Required

> [!IMPORTANT]
> **Rich Notifications Implementation**: I will add "Read" and "Share" action buttons to notifications. "Share" will open the system share sheet directly.
> **Default Notifications**: I will ensure that even if the app's background service is killed, the app attempts to subscribe to topics on every main activity launch.

## Proposed Changes

### Android App

#### [MODIFY] [MyFirebaseMessagingService.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/services/MyFirebaseMessagingService.kt)
- Update `sendNotification` to include action buttons: "చదవండి" (Read) and "షేర్ చేయండి" (Share).
- Improve `BigPictureStyle` implementation to ensure high-quality rich notifications.
- Optimize image downloading to be more robust.

#### [MODIFY] [MainViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt)
- Add a check on app startup to ensure FCM topic subscriptions are active if `notificationsEnabled` is true in preferences.

---

### Cloud Functions

#### [MODIFY] [notification_engine.ts](file:///C:/AlfaKotlin/functions/src/notification_engine.ts)
- Ensure the payload always contains `imageUrl` for news that has media.
- Add a fallback for the "all_users" broadcast to ensure it's triggered even if some news fields are missing.
- Refine the news selection logic to ensure the *best* rich content is prioritized.

#### [NEW] [notification_engine.test.ts](file:///C:/AlfaKotlin/functions/src/notification_engine.test.ts)
- Create unit tests for the notification engine logic using `firebase-functions-test`.
- Verify news selection, sorting, and FCM payload structure.

---

## Verification Plan

### Automated Tests
- Run the new unit tests: `npm run build && npx jest src/notification_engine.test.ts` (if jest is available) or equivalent test runner.
- Build the Android app to ensure no compilation errors.

### Manual Verification
- Deploy the updated Cloud Function.
- Use `triggerPushBroadcast` or wait for the schedule to see if the notification appears on a device.
- Verify that the notification has an image and action buttons.
- Verify that clicking "Share" opens the share sheet.
- Clear app storage and verify that notifications are enabled by default on fresh install.
