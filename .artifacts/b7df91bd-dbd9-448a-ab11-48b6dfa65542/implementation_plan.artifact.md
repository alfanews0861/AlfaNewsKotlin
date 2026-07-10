# Fix Reporter ID Card QR Code and Implement Deep Link (Revised)

The goal is to make the QR code on the reporter ID card functional. Scanning it should open the reporter's profile in the app, or show a verification page in the browser if the app is not installed.

## Proposed Changes

### [Component Name]

#### [MODIFY] [IdCardPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/IdCardPageView.kt)
- Update the QR code generation URL to `https://alfanews.app/verify/${user.id}`. This matches the existing backend infrastructure in `firebase.json` and `verifyReporter` Cloud Function.

#### [MODIFY] [AndroidManifest.xml](file:///C:/AlfaKotlin/app/src/main/AndroidManifest.xml)
- Add/Update `intent-filter` for `MainActivity` to handle deep links with the path prefix `/verify/` for both `https://alfanews.app` and `alfanews://verify` scheme.

#### [MODIFY] [MainActivity.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/MainActivity.kt)
- Update `handleDeepLink` to parse the `reporter` ID from the `/verify/` or `/reporter/` path in the deep link URL.

## Verification Plan

### Manual Verification
- **QR Code Check**: Scan the QR code. If the app is installed, it should open the reporter's profile.
- **Browser Fallback Check**: Scan the QR code on a device without the app. It should open the browser to a verification page showing the reporter's official details (powered by the `verifyReporter` Cloud Function).
- **ADB Deep Link Test**:
  ```bash
  adb shell am start -W -a android.intent.action.VIEW -d "https://alfanews.app/verify/TEST_REPORTER_ID" com.alfanews.telugu
  ```
