# 🔗 DEEPLINKS FIX - DEPLOYMENT & TESTING GUIDE

## What Was Fixed

### ✅ Fix Applied
Changed `MainActivity.kt` deeplink handler to call `setSharedPostId()` before `loadNews()`:

```kotlin
// BEFORE (Broken)
mainViewModel.setActiveTab("home")
newsFeedViewModel.loadNews(..., initialPostId = id)

// AFTER (Fixed)
newsFeedViewModel.setSharedPostId(id)  // ← NEW: Signals UI to scroll to post
mainViewModel.setActiveTab("home")
newsFeedViewModel.loadNews(..., initialPostId = id)
```

**Why this matters:**
- `NewsFeedView` listens to `sharedPostId` flow
- When `sharedPostId` is set, it automatically scrolls to that post
- Without this, post gets added to list but UI never scrolls to show it

### Additional Improvements
- Added error handling so app doesn't crash on bad deeplinks
- Added try-catch for Firestore fetch failures
- Enhanced deeplink parsing with better documentation

---

## How to Build & Deploy

### Step 1: Build the APK

```powershell
cd C:\AlfaKotlin

# Clean build
./gradlew clean

# Build debug APK
./gradlew assembleDebug

# Or build release APK
./gradlew assembleRelease
```

**Output files:**
- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk`

### Step 2: Install on Device/Emulator

```powershell
# Install debug APK
adb install app/build/outputs/apk/debug/app-debug.apk

# Or uninstall first if already installed
adb uninstall com.alfanews.telugu
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## Testing Deeplinks Locally

### Method 1: Android Studio (Easiest)

1. **Get a valid Post ID from Firestore**
   - Go to Firebase Console
   - Navigate to: Firestore → news collection
   - Copy any document ID (e.g., `abc123def456`)

2. **In Android Studio, use Run Configuration**
   ```
   Run → Edit Configurations
   → Intent URL: alfanews://news/abc123def456
   → Apply & Run
   ```

### Method 2: ADB Commands

#### Test 1: Custom Scheme (alfanews://)
```powershell
$postId = "PASTE_VALID_POST_ID_HERE"
adb shell am start -a android.intent.action.VIEW `
  -d "alfanews://news/$postId" `
  com.alfanews.telugu
```

#### Test 2: HTTP URL (alfanews.app)
```powershell
$postId = "PASTE_VALID_POST_ID_HERE"
adb shell am start -a android.intent.action.VIEW `
  -d "http://alfanews.app/news/$postId" `
  com.alfanews.telugu
```

#### Test 3: HTTPS URL (alfanews.app)
```powershell
$postId = "PASTE_VALID_POST_ID_HERE"
adb shell am start -a android.intent.action.VIEW `
  -d "https://alfanews.app/news/$postId" `
  com.alfanews.telugu
```

#### Test 4: HTTPS URL (www.alfanews.app)
```powershell
$postId = "PASTE_VALID_POST_ID_HERE"
adb shell am start -a android.intent.action.VIEW `
  -d "https://www.alfanews.app/news/$postId" `
  com.alfanews.telugu
```

### Method 3: Broadcast Intent

```powershell
# Example with a valid post ID
adb shell am broadcast -a android.intent.action.VIEW \
  -d "alfanews://news/YOUR_POST_ID" \
  com.alfanews.telugu
```

---

## Test Cases & Validation

### ✅ Test Case 1: Valid Post - Custom Scheme
```
Input:  alfanews://news/{VALID_POST_ID}
Expected: App opens, scrolls to post, shows post details
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 2: Valid Post - HTTP URL
```
Input:  http://alfanews.app/news/{VALID_POST_ID}
Expected: App opens, scrolls to post, shows post details
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 3: Valid Post - HTTPS URL
```
Input:  https://alfanews.app/news/{VALID_POST_ID}
Expected: App opens, scrolls to post, shows post details
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 4: Valid Post - HTTPS with www
```
Input:  https://www.alfanews.app/news/{VALID_POST_ID}
Expected: App opens, scrolls to post, shows post details
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 5: Invalid Post ID
```
Input:  alfanews://news/invalid_id_12345
Expected: App opens, shows normal news feed (post not found handled gracefully)
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 6: Cold Start (App Not Running)
```
Steps:
1. Force stop app: adb shell am force-stop com.alfanews.telugu
2. Send deeplink: alfanews://news/{VALID_POST_ID}
Expected: App cold starts, splash screen shows, scrolls to post
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 7: Hot Start (App Already Running)
```
Steps:
1. App is running in background
2. Send deeplink: alfanews://news/{VALID_POST_ID}
Expected: App comes to foreground, scrolls to post
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 8: Background Resume
```
Steps:
1. App is running in background
2. Device is locked
3. Click deeplink from notification/message
Expected: Unlock screen, app shows post
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 9: Rapid Deeplinks
```
Steps:
1. Send 3 deeplinks quickly: alfanews://news/POST_ID_1
                              alfanews://news/POST_ID_2
                              alfanews://news/POST_ID_3
Expected: App handles gracefully, shows latest post (POST_ID_3)
Result:  [ ] PASS  [ ] FAIL
```

### ✅ Test Case 10: Malformed URLs
```
Input:  alfanews://invalid/path
        http://wronghost.com/news/postid
        alfanews://news/
Expected: App doesn't crash, shows normal feed
Result:  [ ] PASS  [ ] FAIL
```

---

## Manual Verification Steps

### Step 1: Get a Valid Post ID
```
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to "news" collection
4. Select any document
5. Copy its document ID (e.g., "aB1cD2eF3gH4iJ5kL6")
```

### Step 2: Test in Emulator
```powershell
# Make sure emulator is running
adb devices  # Should show emulator listed

# Install app
adb install app/build/outputs/apk/debug/app-debug.apk

# Test deeplink
$postId = "YOUR_VALID_POST_ID"
adb shell am start -a android.intent.action.VIEW `
  -d "alfanews://news/$postId" `
  com.alfanews.telugu
```

### Step 3: Observe Behavior
```
Expected sequence:
1. ✓ App launches (or comes to foreground)
2. ✓ Splash screen appears briefly
3. ✓ News feed loads
4. ✓ App scrolls to the specific post
5. ✓ That post is visible in full on screen
6. ✓ Post details are fully loaded and readable
```

### Step 4: Document Result
```
Deeplink: alfanews://news/{POST_ID}
Post ID: {COPY_ACTUAL_ID_HERE}
Status: [Working / Not Working]
Notes: [Any observations]
```

---

## Debugging Deeplinks

### View Logs During Deeplink

```powershell
# Clear logs
adb logcat -c

# Send deeplink
$postId = "YOUR_POST_ID"
adb shell am start -a android.intent.action.VIEW `
  -d "alfanews://news/$postId" `
  com.alfanews.telugu

# View logs (Ctrl+C to stop)
adb logcat | Select-String -Pattern "MainActivity|handleDeepLink|sharedPostId|NewsFeedView"
```

### Check Manifest Configuration

```powershell
# Verify deeplinks are configured in manifest
adb shell dumpsys package com.alfanews.telugu | Select-String -Pattern "alfanews|intent-filter"
```

---

## Common Issues & Fixes

### Issue 1: "App Opens But Doesn't Scroll to Post"
**Cause:** `setSharedPostId()` not called  
**Fix:** Applied in this update ✓

### Issue 2: "Post Not Found / Blank Screen"
**Cause:** Invalid post ID or network issue  
**Fix:** Verify post exists in Firestore

### Issue 3: "App Crashes on Deeplink"
**Cause:** Malformed URL or exception not caught  
**Fix:** Error handling added ✓

### Issue 4: "Works on Cold Start, Not on Hot Start"
**Cause:** `onNewIntent()` wasn't called  
**Fix:** Verified in MainActivity - this is handled ✓

---

## Version Information

**Fixed In:** Sree_5.1.1  
**Build Number:** 573  
**Changes:**
- MainActivity.kt: Added `setSharedPostId()` call
- NewsFeedViewModel.kt: Enhanced error handling
- AndroidManifest.xml: No changes needed (already correct)

---

## Deployment Checklist

Before releasing to production:

- [ ] Code compiles without errors
- [ ] All 10 test cases pass on emulator
- [ ] All 10 test cases pass on real device
- [ ] Deeplinks work with custom scheme
- [ ] Deeplinks work with HTTP/HTTPS
- [ ] Invalid post IDs are handled gracefully
- [ ] No crashes reported in test
- [ ] ScrollToPage animation is smooth
- [ ] Battery impact is acceptable
- [ ] Network requests are optimized
- [ ] Analytics events are logged (optional)
- [ ] Release notes updated
- [ ] QA sign-off obtained

---

## Rollout Strategy

### Phase 1: Internal Testing (24 hours)
- [ ] QA team tests all 10 test cases
- [ ] Document any issues
- [ ] Fix critical bugs

### Phase 2: Beta Release (1-3 days)
- [ ] Release to 5% of users via Play Store
- [ ] Monitor for crashes
- [ ] Check crash rates are normal
- [ ] Verify storage permissions working

### Phase 3: Staged Rollout (1-7 days)
- [ ] 10% of users
- [ ] 25% of users  
- [ ] 50% of users
- [ ] Monitor daily

### Phase 4: Full Release
- [ ] 100% of users
- [ ] Continue monitoring for 3-5 days
- [ ] Be ready to rollback if issues occur

---

## Metrics to Monitor

After deployment, track:
- Crash rate (should not increase)
- ANR (Application Not Responding) rate
- Deeplink click-through rate
- User engagement with deeplinked posts
- Scroll-to-post success rate

---

## Notes for Support Team

If users report deeplink issues:

1. Ask them to:
   - Update app to latest version
   - Clear app cache
   - Force stop and restart app
   - Try again

2. If issue persists:
   - Check if post ID is valid
   - Verify post exists in app's news
   - Check internet connection
   - Ask for device model & Android version

3. Technical escalation:
   - Check Firebase Firestore for post
   - Review logs for exceptions
   - Test same post ID on emulator
   - Compare with working version

---

## Additional Resources

- [Android Deep Linking Official Docs](https://developer.android.com/training/app-links)
- [Firebase Dynamic Links](https://firebase.google.com/docs/dynamic-links)
- [Testing App Links](https://developer.android.com/training/app-links/verify-app-links)


