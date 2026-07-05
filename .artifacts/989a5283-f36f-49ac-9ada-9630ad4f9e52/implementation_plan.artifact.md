# Fix Manual Push Broadcast Error

The user is reporting an error when sending manual push broadcast messages: `android.notification.imageUrl must be a valid URL string`. This occurs because the Cloud Function defaults the `imageUrl` field to an empty string when it's not provided, which FCM rejects as an invalid URL.

## User Review Required

> [!IMPORTANT]
> This change involves modifying a Cloud Function. After applying the changes, you will need to deploy the functions using:
> `cd functions && firebase deploy --only functions:triggerPushBroadcast`

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [index.ts](file:///C:/AlfaKotlin/functions/src/index.ts)
- Fix `triggerPushBroadcast` to only include `imageUrl` in the FCM payload if it is a valid, non-empty string.
- This prevents the validation error when no image is provided.

### Mobile App (Android)

#### [MODIFY] [FirebaseFunctionsService.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/services/FirebaseFunctionsService.kt)
- Update `triggerPushBroadcast` to accept an optional `imageUrl` parameter.
- Pass this parameter to the Cloud Function.

#### [MODIFY] [AdminNotificationsPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminNotificationsPageView.kt)
- In `handleSend`, extract `mediaUrl` from the selected news post.
- Pass the image URL to the service call.

## Verification Plan

### Automated Tests
- Since this involves Cloud Functions and FCM, manual verification is most reliable.
- I will check the code for syntax errors.

### Manual Verification
1. Deploy the updated Cloud Function.
2. Open the Admin Panel -> Push Notifications in the app.
3. Select a news post and click "SEND BROADCAST".
4. Verify the notification is sent successfully (no error toast).
5. (Optional) Verify the notification on a device includes the image.
