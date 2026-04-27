# 🧪 APP LINKS - COMPLETE TESTING & VERIFICATION GUIDE

**Last Updated:** April 27, 2026  
**Version:** Sree_5.1.1  
**Build:** 573

---

## 📋 Pre-Build Verification

### ✅ Check 1: Dependencies Added
```powershell
# Verify Firebase Dynamic Links is in build.gradle.kts
Select-String -Path "app/build.gradle.kts" -Pattern "firebase-dynamiclinks"

# Should show:
# implementation("com.google.firebase:firebase-dynamiclinks")
```

### ✅ Check 2: Manifest Updated
```powershell
# Check App Links configuration
Select-String -Path "app/src/main/AndroidManifest.xml" -Pattern "alfanews.app"

# Should show HTTPS-only (no HTTP)
# Should have autoVerify="true"
# Should have Firebase DL metadata
```

### ✅ Check 3: MainActivity Updated
```powershell
# Check Firebase DL import
Select-String -Path "app/src/main/java/com/alfanews/telugu/MainActivity.kt" -Pattern "FirebaseDynamicLinks"

# Should show:
# import com.google.firebase.dynamiclinks.FirebaseDynamicLinks
```

### ✅ Check 4: ShareUtil Created
```powershell
# Verify ShareUtil exists
Test-Path "app/src/main/java/com/alfanews/telugu/utils/ShareUtil.kt"

# Should return: True
```

---

## 🔨 Build Phase

### Step 1: Clean Build
```powershell
cd C:\AlfaKotlin

# Remove old builds
./gradlew clean

# Wait for completion (should see "BUILD SUCCESSFUL")
```

### Step 2: Compile Check
```powershell
# Just compile, don't assemble
./gradlew compileReleaseKotlin

# Look for:
# BUILD SUCCESSFUL (green text)
# No Kotlin errors
```

### Step 3: Build APK
```powershell
# Build debug APK for testing
./gradlew assembleDebug

# Output should be:
# app/build/outputs/apk/debug/app-debug.apk

# Verify file exists
Test-Path "app/build/outputs/apk/debug/app-debug.apk"
```

---

## 📲 Device Setup

### Prepare Test Device
```powershell
# Connect Android device or start emulator
adb devices

# Should show your device listed

# Install the debug APK
adb uninstall com.alfanews.telugu  # Remove if already installed
adb install app/build/outputs/apk/debug/app-debug.apk

# Wait for: Success message
```

### Verify App Installation
```powershell
# Check app is installed
adb shell pm list packages | Select-String "alfanews"

# Should show: package:com.alfanews.telugu
```

---

## 🧪 Test Suite 1: Custom Scheme Deeplinks

### Test 1.1: Valid Post ID - Custom Scheme
```powershell
# First, get a valid post ID from Firebase
# Firebase Console → Firestore → news collection
# Copy any document ID

$postId = "PASTE_VALID_POST_ID_HERE"

# Clear logs
adb logcat -c

# Send deeplink
adb shell am start -W -a android.intent.action.VIEW `
  -d "alfanews://news/$postId" `
  -n com.alfanews.telugu/.MainActivity

# Check behavior:
# ✅ Should: App opens, shows news feed
# ✅ Should: App scrolls to the specific post
# ✅ Should: Post is highlighted/visible

# Check logs
adb logcat | Select-String -Pattern "setSharedPostId|handleDeepLink" -First 5
```

**Expected Logs:**
```
D/MainActivity: Deeplink received: alfanews://news/POST_ID
D/NewsFeedViewModel: setSharedPostId called with: POST_ID
D/NewsFeedView: LaunchedEffect triggered for sharedPostId
```

### Test 1.2: Invalid Post ID - Custom Scheme
```powershell
# Test with invalid post ID
adb shell am start -W -a android.intent.action.VIEW `
  -d "alfanews://news/invalid_post_12345" `
  -n com.alfanews.telugu/.MainActivity

# Check behavior:
# ✅ Should: App opens without crashing
# ✅ Should: Shows normal news feed (no post found handled gracefully)
# ❌ Should NOT: App crashes
# ❌ Should NOT: Show error screen

# Check logs for error handling
adb logcat | Select-String -Pattern "Exception|Error" -First 3
```

### Test 1.3: Malformed URL - Custom Scheme
```powershell
# Test malformed deeplinks
adb shell am start -a android.intent.action.VIEW `
  -d "alfanews://invalid/path" `
  -n com.alfanews.telugu/.MainActivity

# Check: App should open normally (no crash)
```

---

## 🧪 Test Suite 2: HTTPS Deeplinks (App Links)

### Test 2.1: HTTPS Link - alfanews.app
```powershell
$postId = "PASTE_VALID_POST_ID_HERE"

# Clear logs and app data
adb shell pm clear com.alfanews.telugu
adb logcat -c

# Send HTTPS deeplink
adb shell am start -W -a android.intent.action.VIEW `
  -d "https://alfanews.app/news/$postId" `
  -n com.alfanews.telugu/.MainActivity

# Check behavior:
# ✅ CRITICAL: App should open (NOT browser)
# ✅ Should see app, not Chrome/browser
# ✅ Should scroll to post
# ✅ Should handle post display

# Confirm it's NOT browser:
adb shell pm list packages | Select-String "com.android.chrome"
adb shell dumpsys activity | Select-String -Pattern "chrome|browser" -First 1
# Should NOT see active browser
```

### Test 2.2: HTTPS Link - www subdomain
```powershell
$postId = "PASTE_VALID_POST_ID_HERE"

adb shell am start -W -a android.intent.action.VIEW `
  -d "https://www.alfanews.app/news/$postId" `
  -n com.alfanews.telugu/.MainActivity

# Check: Same as Test 2.1 - should open app
```

### Test 2.3: HTTP Link - Should NOT Work (Removed for Security)
```powershell
$postId = "PASTE_VALID_POST_ID_HERE"

# Try HTTP (should NOT work anymore)
adb shell am start -a android.intent.action.VIEW `
  -d "http://alfanews.app/news/$postId"

# Check behavior:
# Expected: Browser might open or nothing happens
# (HTTP is NOT in our intent-filter anymore)
```

---

## 🧪 Test Suite 3: Firebase Dynamic Links (Deferred Deeplinks)

### Prerequisites: Setup Firebase Dynamic Links
```
1. Open Firebase Console
2. Select your project
3. Go to: Engage → Dynamic Links
4. Create domain: alfanews.page.link (or use default)
5. Create a test short link pointing to:
   https://alfanews.page.link/test123
   Deeplink: alfanews://news/{TEST_POST_ID}
   Fallback: Play Store link
```

### Test 3.1: Dynamic Link - App Installed
```powershell
$dynamicLink = "https://alfanews.page.link/test123"

# Kill app first
adb shell am force-stop com.alfanews.telugu

# Clear logs
adb logcat -c

# Click dynamic link (simulated)
adb shell am start -W -a android.intent.action.VIEW -d "$dynamicLink"

# Should automatically route to:
# alfanews app (because it's installed)

# Check logs
adb logcat | Select-String "DynamicLinks" -First 5
```

**Expected Logs:**
```
D/DynamicLinks: getDynamicLink:onSuccess
D/MainActivity: Dynamic link received: alfanews://news/POST_ID
```

### Test 3.2: Dynamic Link - App NOT Installed (Manual Test)
```
1. Uninstall app: adb uninstall com.alfanews.telugu
2. On real device: Open browser
3. Visit: https://alfanews.page.link/test123
4. Expected: Automatically redirects to Play Store
5. Install app from Play Store
6. After install: App auto-opens to the post
```

**Expected Flow:**
```
User visits link
    ↓
Firebase DL checks: "Is alfanews installed?"
    ↓
NO (app not installed)
    ↓
Redirects to: https://play.google.com/store/apps/details?id=com.alfanews.telugu
    ↓
User installs
    ↓
User clicks: Open
    ↓
App launches
    ↓
Firebase DL: "This is a deferred deeplink to POST_ID"
    ↓
App scrolls to POST_ID automatically ✅
```

### Test 3.3: Dynamic Link - App Running in Background
```powershell
$dynamicLink = "https://alfanews.page.link/test123"

# Keep app running in background
# Don't close app

# Send dynamic link intent
adb shell am start -a android.intent.action.VIEW -d "$dynamicLink"

# Expected:
# ✅ App brings itself to foreground
# ✅ Shows the post from the dynamic link
# ✅ No duplicate of app opens

# Check logs
adb logcat | Select-String "onNewIntent|DynamicLinks" -First 5
```

---

## 🧪 Test Suite 4: Share Functionality

### Test 4.1: Share Button Integration (If Implemented)
```
Assuming you've added ShareUtil button to News Card:

1. Open app
2. Tap Share button on any news
3. System share dialog opens
4. Choose WhatsApp (or another app)
5. Verify link appears in share text
6. Check link looks like: https://alfanews.page.link/xyz123
```

### Test 4.2: Receiving Shared Link
```
Scenario: Friend shared a post via WhatsApp

1. On receiving device, click the link
2. Browser tries to open it
3. Expected: App catches it
   IF app installed: Opens directly to post
   IF app not installed: Redirects to Play Store
```

### Test 4.3: From Share to Install to Post
```
Full flow test:

Device A (has app):
1. Opens AlfaNews
2. Taps Share on a post
3. SMS to friend

Device B (doesn't have app):
1. Receives SMS with link
2. Clicks link
3. Browser → Firebase DL → Play Store
4. Installs app
5. Opens app
6. 🎉 Sees exact post from Device A

Verify: Both devices show same post ID
```

---

## 📊 Logging & Debugging

### View All Deeplink-Related Logs
```powershell
# Real-time log stream (Ctrl+C to stop)
adb logcat `
  | Select-String -Pattern `
  "DynamicLinks|MainActivity|handleDeepLink|setSharedPostId|FirebaseLinks" `
  -TextPattern ".*" -AllMatches

# Or save to file
adb logcat | Tee-Object -FilePath deeplink_logs.txt

# Then search
Select-String -Path deeplink_logs.txt -Pattern "DynamicLinks"
```

### Check Firebase Dynamic Links Handling
```powershell
# Detailed logs for Firebase
adb logcat *:V | Select-String "firebase"
```

### Verify Intent Handling
```powershell
# Dump current app info
adb shell dumpsys package com.alfanews.telugu | Select-String -Pattern "intent-filter|alfanews"

# Should show:
# - alfanews.app
# - https scheme
# - news path
# - Custom scheme alfanews
```

### Check Which App Handles Links
```powershell
# For https://alfanews.app link
adb shell pm get-app-links com.alfanews.telugu

# Expected output:
# alfanews.app: 200000001 (verified - fully handled by app)
# www.alfanews.app: 200000001

# Numbers mean:
# 200000001 = Always open in app (verified)
# 0 = Not set up
```

---

## ✅ Verification Checklist

### Pre-Release Checks
- [ ] Clean build completes successfully
- [ ] No compilation errors
- [ ] APK generated without warnings

### Functionality Tests
- [ ] Test 1.1: Custom scheme, valid post → Opens post ✅
- [ ] Test 1.2: Custom scheme, invalid post → No crash ✅
- [ ] Test 1.3: Malformed URL → No crash ✅
- [ ] Test 2.1: HTTPS alfanews.app → Opens app (NOT browser) ✅
- [ ] Test 2.2: HTTPS www.alfanews.app → Opens app ✅
- [ ] Test 2.3: HTTP → Not handled (as expected) ✅
- [ ] Test 3.1: Dynamic link (app installed) → Opens post ✅
- [ ] Test 3.2: Dynamic link (app not installed) → Play Store ✅
- [ ] Test 3.3: Dynamic link (app running) → Brings to foreground ✅

### Integration Tests
- [ ] Share button generates valid link
- [ ] Share dialog opens
- [ ] Shared link works when clicked
- [ ] Works across multiple click-through

### Security Tests
- [ ] HTTPS links never open in browser
- [ ] Custom scheme works as fallback
- [ ] No data leaks in deeplinks
- [ ] Invalid inputs handled gracefully

### Cross-Device Tests
- [ ] Works on emulator
- [ ] Works on real phone (API 24+)
- [ ] Works on different Android versions
- [ ] Works with different browsers installed

### Analytics (Optional)
- [ ] Firebase console shows dynamic link clicks
- [ ] Install attribution working
- [ ] Event tracking for shares

---

## 🚀 Final Deployment

### Before Play Store Release
```powershell
# 1. Ensure all tests pass
# (See checklist above)

# 2. Build release APK
./gradlew clean assembleRelease

# 3. Generate signed APK ready for Play Store
./build_release_apk.ps1

# 4. Output location
# app/build/outputs/apk/release/app-release.apk

# 5. Size check (should be reasonable)
(Get-Item "app/build/outputs/apk/release/app-release.apk").Length / 1MB
```

### Server Setup (Before Release)
```
1. Get SHA256 hash of release key:
   keytool -list -v -keystore alfanews-release-key.jks | Select-String SHA256

2. Create assetlinks.json on alfanews.app:
   https://alfanews.app/.well-known/assetlinks.json
   
3. Content:
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "com.alfanews.telugu",
         "sha256_cert_fingerprints": [
           "XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX"
         ]
       }
     }
   ]

4. Verify it's accessible:
   Curl https://alfanews.app/.well-known/assetlinks.json
   Should return valid JSON (not 404)

5. Wait 24-48 hours for Android verification
```

---

## 📞 Troubleshooting Test Failures

### Symptom: "Link opens in Chrome instead of app"

**Causes & Fixes:**
1. assetlinks.json not deployed
   → Deploy assetlinks.json to alfanews.app/.well-known/
   
2. SHA256 hash mismatch
   → Verify hash matches app signing key
   → Regenerate if needed

3. Device cache
   → Clear app data: `adb shell pm clear com.alfanews.telugu`
   → Uninstall and reinstall

4. Android verification not done yet
   → Wait 24-48 hours or test with custom scheme instead

### Symptom: "Deeplink works sometimes, fails sometimes"

**Causes & Fixes:**
1. Post ID doesn't exist
   → Verify post ID in Firestore
   → Use different valid post ID for testing

2. Network issue while fetching news
   → Check internet connection
   → Retry the test

3. Race condition in UI
   → News might be loading after scroll attempted
   → Already handled by LaunchedEffect retry logic

### Symptom: "Share button doesn't work"

**Causes & Fixes:**
1. ShareUtil not implemented in UI yet
   → Follow integration example in quick-reference

2. Firebase not initialized
   → Should initialize automatically, check logs

3. Internet permission missing
   → Already in manifest, but verify

---

## 🎯 Success Indicators

You'll know everything is working when:

1. ✅ Clicking `alfanews://news/POST_ID` opens app to post
2. ✅ Clicking `https://alfanews.app/news/POST_ID` opens app (NOT browser)
3. ✅ Firebase console shows dynamic link clicks
4. ✅ Without app: Dynamic links redirect to Play Store
5. ✅ After install from dynamic link: Opens to correct post
6. ✅ Share button generates links for WhatsApp/Facebook/Email
7. ✅ No crashes on invalid inputs
8. ✅ Works on Android 24+
9. ✅ All logs show proper Firebase DL handling
10. ✅ `adb shell pm get-app-links com.alfanews.telugu` shows verified

---

## 📝 Test Report Template

```
=== APP LINKS TEST REPORT ===
Date: [DATE]
Tester: [NAME]
Device: [MODEL/EMULATOR]
Android Version: [VERSION]
App Version: Sree_5.1.1 (Build 573)

TEST RESULTS:
[ ] Test 1.1 - Custom scheme, valid post: ___
[ ] Test 1.2 - Custom scheme, invalid post: ___
[ ] Test 1.3 - Malformed URL: ___
[ ] Test 2.1 - HTTPS alfanews.app: ___
[ ] Test 2.2 - HTTPS www: ___
[ ] Test 2.3 - HTTP (should not work): ___
[ ] Test 3.1 - Dynamic link (app installed): ___
[ ] Test 3.2 - Dynamic link (app not installed): ___
[ ] Test 3.3 - Dynamic link (app running): ___

OVERALL STATUS: [ ] PASS  [ ] FAIL

ISSUES FOUND:
[List any issues]

RECOMMENDED ACTIONS:
[List recommendations]
```

---

**Last Updated:** April 27, 2026  
**Version:** Sree_5.1.1, Build 573  
**Status:** ✅ COMPREHENSIVE TESTING GUIDE READY

Use this guide to verify all App Links and Dynamic App Links functionality before deploying to production.

