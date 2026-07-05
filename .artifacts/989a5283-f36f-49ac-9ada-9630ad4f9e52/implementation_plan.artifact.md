# Implementation Plan - Fix AdMob Preloading Issue

The user reported that AdMob ads are not preloading as expected. Investigation revealed a logic error in `AdMobService` where the `isPreloading` flag can get stuck in the `true` state, preventing subsequent preloading attempts.

## User Review Required

> [!IMPORTANT]
> The fix involves changing how the `isPreloading` flag is reset. It will now be reset whenever an ad request completes (successfully or with failure), ensuring that the preloading process can resume if the cache is not full.

## Proposed Changes

### AdMob Service

#### [MODIFY] [AdMobService.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/services/AdMobService.kt)

- Replace `isPreloading: Boolean` with `AtomicBoolean`.
- Update `preloadNativeAds` to reset `isPreloading` correctly in both `onAdLoaded` and `onAdFailedToLoad`.
- Remove the conditional check `if (nativeAds.size >= MAX_NATIVE_ADS)` inside `onAdLoaded`, as the request is finished at that point regardless of the count.
- Add more descriptive logging for debugging preloading cycles.

## Verification Plan

### Automated Tests
- Since this involves third-party SDK (AdMob) and UI/network state, automated unit tests are difficult. Manual verification is preferred.

### Manual Verification
1. Launch the app and check logcat for "Preloading X native ads" messages.
2. Verify that `Native ad preloaded successfully` messages appear.
3. Scroll through the news feed (ad slots appear every 6th page).
4. Verify that ads are displayed immediately (preloaded) instead of showing the loading indicator.
5. Check logs to ensure `isPreloading` is set back to `false` after each batch.
