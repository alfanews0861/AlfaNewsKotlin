# AdMob Ads Loading Issue - Implementation Plan

The user reported that AdMob ads are not loading correctly: only the first ad appears, and subsequent ones stay in a "loading" state. The user wants to implement robust pre-loading and fix any defects.

## User Review Required

> [!IMPORTANT]
> The current AdMob Native Ad Unit ID is `ca-app-pub-5787901991150360/1972465675`. If this is a test ID or if there are account-level restrictions (like limited ad serving), ads might not load consistently regardless of code changes.

## Proposed Changes

### AdMob Service Refactoring

#### [MODIFY] [AdMobService.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/services/AdMobService.kt)
- Add a `isPreloading` atomic boolean to prevent multiple simultaneous background preload requests.
- Implement a more robust `preloadNativeAds` that ensures the queue is filled without flooding the system.
- Add logging to track queue size and load failures more clearly.
- Improve `loadNativeAd` to handle edge cases where multiple UI components might request an ad at the exact same time when the queue is empty.

### UI Improvements

#### [MODIFY] [AdMobNativeAdCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdMobNativeAdCardView.kt)
- Complete the implementation of this view to properly bind `NativeAd` fields (headline, body, media, etc.) to a layout. This provides a backup/alternative to `AdMobCardView`.

#### [MODIFY] [NewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsFeedView.kt)
- Optimize the `loadAdForPage` function to better handle the transition from "loading" (null) to "loaded" (NativeAd).
- Ensure that if an ad fails to load for a specific slot, it can be retried if the user scrolls away and back (though the current map approach is generally efficient).

## Verification Plan

### Automated Tests
- I will verify the code compiles by running `./gradlew app:assembleDebug`.

### Manual Verification
- Deploy the app and scroll through the news feed.
- Observe the "Ad Slot" (every 6th item).
- Check logs for "AdMobService" tags to verify:
    - Queue being filled.
    - On-demand loads happening only when necessary.
    - Preloading triggered correctly.
- Verify that multiple ads load successfully as the user scrolls.
