# Walkthrough - Local Ad Priority, Queueing, and Caching

I have implemented a comprehensive local ad management system that prioritizes local advertisers, ensures all ads are seen in a cycle, and optimizes performance via caching and preloading.

## Changes Made

### 1. Ad Priority & Slots
- **Priority Slots**: The first two ad slots in the vertical news feed (at items 6 and 12) are now dedicated to Local Ads.
- **Fallback**: If no local ads are available for the user's district, these slots fall back to showing AdMob native ads.
- **Alternating Logic**: From the 3rd slot onwards, the feed alternates between AdMob and Local Ads to maintain a balanced revenue stream.

### 2. Persistent Ad Queue (Seen Logic)
- **Seen Tracking**: Each time a local ad is displayed on the screen, its ID is saved in the user's persistent local storage (`PreferenceManager`).
- **Unseen First**: The app now prioritizes "Unseen" ads, showing them at the top of the feed rotation.
- **Cycle Reset**: Once a user has seen all currently active local ads in their district, the "seen" list is cleared, and the cycle starts over. This ensures every advertiser gets their turn to be seen by every user.

### 3. Caching & Egress Optimization
- **Metadata Cache**: Local ad data fetched from Firestore is cached for **30 minutes**. This significantly reduces Firestore read operations and costs.
- **JSON Serialization**: Used Gson to store the ad list as a JSON string in SharedPreferences.
- **Media Preloading**: Both `NewsFeedView` and `LocalNewsFeedView` now look ahead and preload the `bannerUrl` for upcoming local ads into the disk cache using Coil. This results in instant ad displays without loading delays.

## Verification Results

### Logic Check
- **Unseen Priority**: Confirmed via Logcat (`Ad Queue - Total: X, Unseen: Y, Seen: Z`).
- **Cache Age**: The system correctly checks the timestamp before deciding whether to fetch from Firestore or use the local cache.

### UI Experience
- **Smooth Scrolling**: Preloading ensures that ad cards (images/videos) are ready before the user swiping into them.
- **Slot Consistency**: Verified that slots 1 and 2 prioritize local ads over AdMob.

> [!TIP]
> You can monitor the ad queue logic by searching for `NewsFeedVM` or `LocalNewsFeedVM` in Logcat. It will show how many ads are currently in the seen vs. unseen buckets.
