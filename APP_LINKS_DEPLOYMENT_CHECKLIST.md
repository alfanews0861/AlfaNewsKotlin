# ✅ APP LINKS DEPLOYMENT CHECKLIST

**Project:** AlfaNews  
**Version:** Sree_5.1.1 (Build 573)  
**Date Started:** April 27, 2026  
**Target:** Production Release  

---

## 📋 PRE-DEPLOYMENT (Code/Build)

### Phase 1: Verify Implementation ✅
- [ ] Firebase Dynamic Links dependency added to build.gradle.kts
- [ ] AndroidManifest.xml updated (HTTPS-only, autoVerify, Firebase metadata)
- [ ] MainActivity.kt has Firebase DL handlers (onCreate + onNewIntent)
- [ ] ShareUtil.kt created with sharing utilities
- [ ] All imports are correct
- [ ] No syntax errors detected

### Phase 2: Build Verification
- [ ] Run clean build: `./gradlew clean build`
  - [ ] Result: **BUILD SUCCESSFUL** ✅
  - [ ] No compilation errors
  - [ ] No warnings
  - [ ] APK generated successfully
  
- [ ] Verify APK exists: `Test-Path "app/build/outputs/apk/debug/app-debug.apk"`
  - [ ] Result: **True**

### Phase 3: Local Testing - Custom Schemes
```
[ ] Test 1: Valid Post ID
    Command: adb shell am start -a android.intent.action.VIEW `
              -d "alfanews://news/{VALID_POST_ID}" com.alfanews.telugu
    Expected: App opens, scrolls to post ✅
    Result: _______________
    
[ ] Test 2: Invalid Post ID  
    Command: adb shell am start -a android.intent.action.VIEW `
              -d "alfanews://news/invalid_id_12345" com.alfanews.telugu
    Expected: App opens normally (no crash) ✅
    Result: _______________
    
[ ] Test 3: Malformed URL
    Command: adb shell am start -a android.intent.action.VIEW `
              -d "alfanews://invalid/path" com.alfanews.telugu
    Expected: App opens (handles error gracefully) ✅
    Result: _______________
```

### Phase 4: Local Testing - HTTPS Links
```
[ ] Test 4: HTTPS alfanews.app
    Command: adb shell am start -a android.intent.action.VIEW `
              -d "https://alfanews.app/news/{VALID_POST_ID}" com.alfanews.telugu
    Expected: App opens (NOT Chrome) ✅
    Result: _______________
    Note: This will open browser until assetlinks.json is deployed
    
[ ] Test 5: HTTPS www.alfanews.app
    Command: adb shell am start -a android.intent.action.VIEW `
              -d "https://www.alfanews.app/news/{VALID_POST_ID}" com.alfanews.telugu
    Expected: App opens ✅
    Result: _______________
```

---

## 📋 INFRASTRUCTURE SETUP

### Phase 5: Get Release Key Hash
**Location:** Your keystores / build machine

```
[ ] Step 1: Get SHA256 hash of release signing key
    
    Command (Windows):
    keytool -list -v -keystore alfanews-release-key.jks | Select-String "SHA256:"
    
    Password: [PASTE_KEYSTORE_PASSWORD]
    
    Output should look like:
    SHA256: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
    
    [ ] Hash obtained: ____________________________________
    [ ] Hash copied to clipboard/notes
```

### Phase 6: Deploy assetlinks.json
**Server:** alfanews.app

```
[ ] Step 1: Create JSON file
    Location: .well-known/assetlinks.json
    
    Content:
    [
      {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "com.alfanews.telugu",
          "sha256_cert_fingerprints": [
            "PASTE_SHA256_HASH_HERE"
          ]
        }
      }
    ]
    
    [ ] File created with correct content
    [ ] SHA256 hash is correct (matches keystore)
    [ ] No typos in package name: com.alfanews.telugu ✓

[ ] Step 2: Upload to server
    
    [ ] Upload to: https://alfanews.app/.well-known/assetlinks.json
    [ ] Make file publicly readable (no auth required)
    [ ] Test in browser: 
        URL: https://alfanews.app/.well-known/assetlinks.json
        [ ] Returns JSON (not 404, not auth error)
    [ ] File is valid JSON (use jsonlint.com if unsure)

[ ] Step 3: Verify deployment
    
    Command:
    Invoke-WebRequest "https://alfanews.app/.well-known/assetlinks.json"
    
    [ ] Returns 200 status
    [ ] Content matches what you uploaded
    [ ] JSON is valid
```

### Phase 7: Firebase Console - Dynamic Links Setup
**Platform:** Firebase Console

```
[ ] Step 1: Access Dynamic Links
    1. Open: console.firebase.google.com
    2. Select your AlfaNews project
    3. Left sidebar → Engage → Dynamic Links
    4. [ ] Dynamic Links section visible

[ ] Step 2: Create Firebase DL Domain
    
    Option A: Use default domain
    [ ] Domain: alfanews.firebaseapp.com
    
    Option B: Use custom domain (recommended)
    [ ] Domain: alfanews.page.link
    
    If using custom:
    [ ] Add CNAME records to your DNS:
        CNAME: alfanewsbaselink.page.link
        Points to: page.link
        (Firebase will provide exact values)
    [ ] Wait 24-48 hours for DNS propagation
    
    Verification:
    [ ] Firebase shows domain is propagated (green checkmark)

[ ] Step 3: Create Test Dynamic Link
    
    [ ] Click: "Create Short Link"
    [ ] Deep Link Field: alfanews://news/{TEST_POST_ID}
    [ ] Android App: com.alfanews.telugu
    [ ] Android Fallback: https://play.google.com/store/apps/details?id=com.alfanews.telugu
    [ ] Generate short link
    [ ] Copy short link (e.g., https://alfanews.page.link/abc123)
    [ ] Test link: ________________________
```

---

## 🧪 COMPREHENSIVE TESTING

### Phase 8: Custom Scheme Deeplinks (Already Working)
```
[ ] Test Suite 1: Custom Scheme
    
    Device Setup:
    [ ] Android device/emulator connected
    [ ] AlfaNews app installed (debug APK)
    [ ] Firebase Firestore has test news posts
    
    Test 1.1: Valid post ID
    [ ] Command executed successfully
    [ ] App opens to specific post ✅
    [ ] Post is scrolled to and visible ✅
    
    Test 1.2: Invalid post ID
    [ ] No crash ✅
    [ ] Shows normal news feed ✅
    
    Test 1.3: Malformed URL
    [ ] No crash ✅
    [ ] App functions normally ✅

    Result: [ ] PASS  [ ] FAIL
    Notes: ________________________________________
```

### Phase 9: HTTPS App Links (Requires assetlinks.json)
```
[ ] Test Suite 2: HTTPS App Links
    
    Prerequisites:
    [ ] assetlinks.json deployed 24+ hours ago
    [ ] App rebuilt with signing key matching SHA256
    
    Test 2.1: HTTPS alfanews.app
    [ ] Click link or adb command
    [ ] App opens (NOT browser) ✅
    [ ] Shows specific post ✅
    
    Test 2.2: HTTPS www.alfanews.app
    [ ] Link opens in app ✅
    
    Test 2.3: Device verification
    [ ] Run: adb shell pm get-app-links com.alfanews.telugu
    [ ] Should show: "alfanews.app: 200000001" (verified)

    Result: [ ] PASS  [ ] FAIL
    Notes: ________________________________________
```

### Phase 10: Firebase Dynamic Links
```
[ ] Test Suite 3: Dynamic Links
    
    Prerequisites:
    [ ] Firebase DL domain configured and propagated
    [ ] Test dynamic link created: _____________
    
    Test 3.1: App Installed
    [ ] Click your test dynamic link
    [ ] App opens directly to post ✅
    
    Test 3.2: App NOT Installed (Manual)
    [ ] Uninstall app: adb uninstall com.alfanews.telugu
    [ ] Click dynamic link on device
    [ ] Redirected to Play Store ✅
    [ ] Install app from Play Store
    [ ] App opens directly to the post ✅
    
    Test 3.3: App Running in Background
    [ ] App running, click link
    [ ] App brings itself to foreground ✅
    [ ] Shows the post ✅

    Result: [ ] PASS  [ ] FAIL
    Notes: ________________________________________
```

### Phase 11: Share Functionality
```
[ ] Test Suite 4: Share Button
    
    Prerequisites:
    [ ] ShareUtil.kt integration point planned
    [ ] News Card view identified
    
    Test 4.1: Generate Dynamic Link
    [ ] Logic tested in isolation
    [ ] Returns valid link: _______________
    
    Test 4.2: Share Dialog Opens
    [ ] (Once integrated in UI)
    [ ] Share button clicked
    [ ] System dialog shows options ✅
    [ ] Can choose WhatsApp, Email, etc.
    
    Test 4.3: Link Works After Share
    [ ] (Once integrated in UI)
    [ ] Share to WhatsApp simulator
    [ ] Friend clicks link
    [ ] Opens to correct post ✅

    Result: [ ] PASS  [ ] FAIL
    Notes: ________________________________________
```

---

## 🔍 CRITICAL VERIFICATION TESTS

### Phase 12: Security & Safety Tests
```
[ ] Security Test 1: HTTPS Links Never Use Browser
    [ ] Click any https://alfanews.app link
    [ ] App handles it, not Chrome ✅
    [ ] No browser app in recent apps ✅
    
[ ] Security Test 2: Invalid Inputs Don't Crash
    [ ] Try: alfanews://valid/but/too/long/path
    [ ] App doesn't crash ✅
    [ ] Try: https://alfanews.app/nonexistent
    [ ] App handles gracefully ✅
    
[ ] Security Test 3: Post Data Correct
    [ ] Open post via deeplink
    [ ] Verify correct post is shown ✅
    [ ] All post data displayed ✅
    
[ ] Security Test 4: No Data Leaks
    [ ] Check logs for sensitive data: `adb logcat | Select-String "password|token|key"`
    [ ] No secrets in logs ✅
```

### Phase 13: Cross-Device Testing
```
[ ] Device Test 1: Emulator
    [ ] Build APK
    [ ] Install on emulator
    [ ] Test all 4 scenarios above
    [ ] Result: [ ] PASS  [ ] FAIL
    
[ ] Device Test 2: Physical Phone (Android 24+)
    [ ] Install APK
    [ ] Test all 4 scenarios
    [ ] Result: [ ] PASS  [ ] FAIL
    
[ ] Device Test 3: Different Android Version
    [ ] If possible, test on Android 14+
    [ ] Test at least 2 different Android versions
    [ ] Result: All PASS: [ ] ✅
```

---

## 📊 LOGGING & MONITORING

### Phase 14: Enable Logging
```
[ ] Firebase Logging
    [ ] Firebase console setup complete
    [ ] Check: Firestore console loads
    [ ] Check: Authentication working
    [ ] Check: Cloud Functions working

[ ] Deeplink Logging
    [ ] Run: adb logcat -c
    [ ] Trigger deeplink
    [ ] Verify logs appear:
        [ ] "DynamicLinks: Dynamic link received"
        [ ] "MainActivity: Deeplink received"
        [ ] "setSharedPostId called"
    [ ] All expected logs present ✅

[ ] Error Logging
    [ ] Try to crash with bad deeplink
    [ ] Check for graceful errors:
        [ ] "Error processing dynamic link" (logged but not fatal)
        [ ] App stays running ✅
```

---

## 🏗️ RELEASE PREPARATION

### Phase 15: Build Release APK
```
[ ] Clean rebuild
    [ ] ./gradlew clean
    [ ] ./gradlew build
    [ ] Result: BUILD SUCCESSFUL ✅

[ ] Generate Release APK
    [ ] ./build_release_apk.ps1
    [ ] Output: app/build/outputs/apk/release/app-release.apk
    [ ] File size reasonable: ____________ MB

[ ] Sign APK (automatic with env variables)
    [ ] RELEASE_STORE_FILE set ✅
    [ ] RELEASE_STORE_PASSWORD set ✅
    [ ] RELEASE_KEY_ALIAS set ✅
    [ ] RELEASE_KEY_PASSWORD set ✅
    [ ] APK properly signed ✅

[ ] Verify Signing
    [ ] apksigner verify -print-certs app-release.apk
    [ ] Shows correct certificate ✅
    [ ] SHA256 matches assetlinks.json ✅
```

### Phase 16: Final Verification Checklist
```
Pre-Release Sign-Off:

FUNCTIONALITY
[ ] Custom scheme deeplinks work ✅
[ ] HTTPS deeplinks work ✅
[ ] Firebase Dynamic Links work ✅
[ ] App NOT installed → Play Store ✅
[ ] After install → Opens to post ✅
[ ] No crashes on invalid inputs ✅
[ ] Share functionality works ✅

SECURITY
[ ] HTTPS-only (no HTTP) ✅
[ ] assetlinks.json deployed ✅
[ ] SHA256 hash correct ✅
[ ] No sensitive data in logs ✅
[ ] URLs properly validated ✅

QUALITY
[ ] Build successful ✅
[ ] All tests pass ✅
[ ] No new crashes ✅
[ ] Performance normal ✅
[ ] Logging appropriate ✅

DEPLOYMENT
[ ] Release APK built ✅
[ ] APK properly signed ✅
[ ] Firebase console configured ✅
[ ] assetlinks.json in place ✅
[ ] Documentation complete ✅

Overall Status: [ ] APPROVED FOR RELEASE  [ ] HOLD - ISSUES
```

---

## 🚀 RELEASE (TO PLAY STORE)

### Phase 17: Play Store Deployment
```
[ ] Step 1: Upload to Play Console
    [ ] Open: play.google.com/console
    [ ] Select AlfaNews project
    [ ] Go to: Release → Production
    [ ] Upload app-release.apk
    [ ] Review app content
    [ ] Set release notes
    [ ] [ ] Ready to roll out

[ ] Step 2: Create Release
    [ ] If all good, click: "Create Release"
    [ ] Review app store listing
    [ ] Confirm deeplink support in description
    [ ] Submit for review

[ ] Step 3: Phased Rollout (Recommended)
    [ ] Don't release 100% immediately
    [ ] Strategy:
        [ ] 5% rollout first (internal testers)
        [ ] Monitor 24 hours for crashes
        [ ] 10% rollout
        [ ] Monitor 24 hours
        [ ] 25%, 50%, 100% (as comfortable)
    
    [ ] Start with 5%: [DATE/TIME] _______
    [ ] 0-24 hours: Crash rate acceptable? [ ] YES  [ ] NO
    [ ] Proceed to 10%: [DATE/TIME] _______
    [ ] Continue phase rollout...

[ ] Step 4: Monitor Post-Release
    [ ] Set reminder to check daily first week
    [ ] Monitor metrics:
        [ ] Crash rate
        [ ] ANR rate
        [ ] User reviews
        [ ] Deeplink reports
    
    [ ] Check Firebase Analytics
    [ ] Check Play Console Dashboard
    [ ] Check app reviews/ratings
```

---

## 📈 POST-RELEASE (ONGOING)

### Phase 18: Analytics & Monitoring
```
[ ] Day 1-3: Close monitoring
    [ ] Check crash rates daily
    [ ] Read user reviews
    [ ] Monitor Firebase logs
    [ ] Respond to issues
    
[ ] Week 1: Performance metrics
    [ ] Check Firebase Dynamic Links stats
    [ ] Count clicks on links
    [ ] Count installs from links
    [ ] User journey metrics
    [ ] Report: ________________________

[ ] Ongoing: Quarterly review
    [ ] Deeplink success rates
    [ ] Share → install → engagement flow
    [ ] User feedback
    [ ] Update documentation if needed
```

---

## 📝 DOCUMENTATION

### Phase 19: Documentation Status
```
Created Documents:
[ ] APP_LINKS_IMPLEMENTATION_SUMMARY.md - Overview
[ ] APP_LINKS_QUICK_REFERENCE.md - Quick start
[ ] APP_LINKS_COMPLETE_IMPLEMENTATION.md - Deep dive
[ ] APP_LINKS_TESTING_VERIFICATION_GUIDE.md - QA guide
[ ] APP_LINKS_FINAL_STATUS_REPORT.md - Status report

To Share/Archive:
[ ] Place docs in wiki/drive for team
[ ] Share with QA team
[ ] Archive for future reference
[ ] Add to project documentation
```

---

## ✨ COMPLETION SIGN-OFF

```
PROJECT: App Links & Dynamic App Links Implementation
VERSION: Sree_5.1.1 (Build 573)
DATE STARTED: April 27, 2026
DATE COMPLETED: ________________

SIGN-OFF CHECKLIST:

Technical Lead:
[ ] All code reviewed and approved
[ ] Tests executed and passed
[ ] Signature: ______________ Date: ________

QA Lead:
[ ] All test suites executed
[ ] No critical issues found
[ ] Performance acceptable
[ ] Signature: ______________ Date: ________

Product Lead:
[ ] Feature meets requirements
[ ] User experience verified
[ ] Ready for production
[ ] Signature: ______________ Date: ________

Release Manager:
[ ] All checks complete
[ ] Documentation ready
[ ] Deployment plan confirmed
[ ] Approved for release
[ ] Signature: ______________ Date: ________

FINAL STATUS: [ ] ✅ APPROVED FOR PRODUCTION RELEASE
              [ ] ⏸️  HOLD - ISSUES FOUND (List below)

Issues (if any):
_____________________________________________________________
_____________________________________________________________

Expected Release Date: ________________

```

---

## 🎉 SUCCESS METRICS

Once released, track these:

```
MONTHLY METRICS:
[ ] Dynamic link clicks: ________
[ ] Installs from dynamic links: ________
[ ] Share button uses: ________
[ ] Post open success rate: ________% (target: >95%)
[ ] Crash rate from deeplinks: ________% (target: 0%)

USER ENGAGEMENT:
[ ] Users retained from shared posts: ________ %
[ ] Posts opened via deeplink vs main feed: ________ %
[ ] Share platform breakdown:
    - WhatsApp: ________ %
    - Message/SMS: ________ %
    - Facebook: ________ %
    - Email: ________ %
    - Other: ________ %
```

---

## 📋 NOTES & ISSUES LOG

```
ISSUE LOG:

Issue #1: ________________________
Date Found: ________
Status: [ ] Open  [ ] Resolved
Resolution: ________________________

Issue #2: ________________________
Date Found: ________
Status: [ ] Open  [ ] Resolved
Resolution: ________________________

Issue #3: ________________________
Date Found: ________
Status: [ ] Open  [ ] Resolved
Resolution: ________________________
```

---

**Checklist Date:** April 27, 2026  
**Last Updated:** Today  
**Status:** ✅ READY TO EXECUTE

**Print this page and check off each item as you go!** ✅


