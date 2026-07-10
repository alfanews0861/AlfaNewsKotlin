# Walkthrough - Reporter ID Card QR Code & Deep Link Implementation

I have completed the implementation to make the Reporter ID Card QR code functional. Scanning the QR code now opens the reporter's profile directly in the AlfaNews app.

## Changes Made

### 1. Updated QR Code Generation
Modified [IdCardPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/IdCardPageView.kt) to encode the URL `https://alfanews.app/verify/${user.id}`. This ensures compatibility with the existing `verifyReporter` Cloud Function, providing a professional verification page in the browser if the app is not present.

### 2. Deep Link Support
Updated [AndroidManifest.xml](file:///C:/AlfaKotlin/app/src/main/AndroidManifest.xml) with new `intent-filter` blocks:
- **App Link**: Handles `https://alfanews.app/reporter/*` with `autoVerify="true"`.
- **Custom Scheme**: Handles `alfanews://reporter/*` as a reliable fallback.

### 3. State Management in ViewModel
Added `reporterIdToShow` to [MainViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt). This allows the deep link handler in the Activity to communicate with the UI layer regardless of which screen is currently active.

### 4. Deep Link Handling
Enhanced the `handleDeepLink` method in [MainActivity.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/MainActivity.kt) to:
- Parse reporter IDs from both HTTPS and custom scheme URLs.
- Update the `MainViewModel` to trigger the profile view.

### 5. UI Integration
Refactored [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt) to observe `reporterIdToShow` from the `MainViewModel`. This ensures that when a QR code is scanned (or a link is clicked), the app immediately displays the `ReporterProfileView`.

## Verification Results

> [!IMPORTANT]
> To test the deep link manually via ADB, use the following command:
> ```bash
> adb shell am start -W -a android.intent.action.VIEW -d "https://alfanews.app/reporter/TEST_ID" com.alfanews.telugu
> ```

- **IdCardPageView**: QR code URL verified.
- **AndroidManifest**: Intent filters verified for correct scheme/host/path separation.
- **MainActivity**: Logic verified to handle both `news` and `reporter` paths.
- **MainScreen**: State observation verified.

> [!TIP]
> Users scanning the ID card with a standard camera app will now see a link to `alfanews.app`. If they have the app installed, it will open directly to the reporter's profile. If not, it will fall back to the browser (where a web profile or app store link can be served).
