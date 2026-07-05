# Implementation Plan - Local Ad Priority, Persistent Queue, and Local Caching

The goal is to prioritize Local Ads in the news feed, ensure users see all available local ads in a cycle before seeing duplicates, and cache both ad metadata and media on the device to reduce Firebase egress costs and improve performance.

## User Review Required

> [!IMPORTANT]
> - **Priority Slots**: The first two ad slots (at news items 6 and 12) will now strictly show Local Ads if available. AdMob ads will start appearing from the 3rd slot onwards.
> - **Persistent Queue**: We are implementing a "seen" list for Local Ads on the user's device. Users won't see the same local ad twice until they've seen all other active local ads in their district.
> - **Local Caching & Egress Reduction**:
>   - **Metadata Caching**: Local ad details from Firestore will be cached locally for 30 minutes. This avoids redundant Firestore read operations on every app launch.
>   - **Media Preloading & Caching**: We will pre-fetch images/videos for upcoming local ads and store them in the phone's persistent disk cache using Coil.

## Proposed Changes

### Core Logic & Storage

#### [MODIFY] [PreferenceManager.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/utils/PreferenceManager.kt)
- Add `markLocalAdSeen(adId: String)` to store seen ad IDs in a persistent set.
- Add `getSeenLocalAdIds(): Set<String>` to retrieve them.
- Add `clearSeenLocalAds()` to reset the cycle once all ads are seen.
- Add `saveLocalAdsCache(district: String, adsJson: String)` and `getLocalAdsCache(district: String): String?` to store/retrieve the ads list.
- Add `saveLocalAdsTimestamp(district: String, timestamp: Long)` and `getLocalAdsTimestamp(district: String): Long` to track cache age.

### ViewModels (Data Handling)

#### [MODIFY] [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt)
- Update `loadLocalAds(district: String)`:
    1. Check `PreferenceManager` for cached ads for this district.
    2. If cache exists and is < 30 minutes old, use it.
    3. Otherwise, fetch from Firestore, serialize to JSON (using Gson), and save to cache.
    4. Retrieve `seenIds` from `PreferenceManager`.
    5. Separate ads into `unseen` and `seen`.
    6. If `unseen` is empty (and total ads > 0), clear `seenIds` and treat all as `unseen`.
    7. Expose `localAds` as `unseen.shuffled() + seen.shuffled()`.

#### [MODIFY] [LocalNewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/LocalNewsFeedViewModel.kt)
- Apply the same logic as `NewsFeedViewModel` to ensure consistency in the local news feed.

### UI Layer (Display & Interaction)

#### [MODIFY] [LocalAdCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LocalAdCardView.kt)
- When a local ad is displayed (in `LaunchedEffect`), call `PreferenceManager.markLocalAdSeen(ad.id)` to register the view locally for the queue logic.

#### [MODIFY] [NewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsFeedView.kt)
- Update the `isAdPage` logic in `VerticalPager`:
    - Slot 1 (`adIndex == 0`): Show Local Ad (fallback to AdMob if no local ads exist).
    - Slot 2 (`adIndex == 1`): Show Local Ad (fallback to AdMob if no local ads exist).
    - Slot 3+ (`adIndex >= 2`): Alternate between AdMob and Local Ads.
- Add preloading logic for Local Ads:
    - In the `LaunchedEffect` tracking `pagerState.currentPage`, identify upcoming local ad slots.
    - Use `SingletonImageLoader` to enqueue `ImageRequest` for the `bannerUrl` of local ads that will appear in those slots.

#### [MODIFY] [LocalNewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LocalNewsFeedView.kt)
- Apply the same slot prioritization and local ad media preloading logic as `NewsFeedView`.

## Verification Plan

### Automated Tests
- N/A (UI and Firebase integration tests preferred manually for this flow).

### Manual Verification
1. **Priority Test**: Open the app and scroll to the first and second ad slots. Verify they show Local Ads.
2. **Queue Test**: Verify different local ads appear until all are seen, then the cycle restarts.
3. **Caching Test (Egress Reduction)**:
    - Use a network monitor or logs to verify that Firestore queries for `local_ads` only happen once every 30 minutes for a district.
    - Kill and reopen the app within 5 minutes; verify `local_ads` are loaded instantly from the local cache without a network hit.
4. **Preloading Test**: Verify `bannerUrl` requests are fired for upcoming ads before they appear on screen.
5. **Logcat Verification**: Check "Unseen ads: X, Seen ads: Y" logs to confirm queue logic.
