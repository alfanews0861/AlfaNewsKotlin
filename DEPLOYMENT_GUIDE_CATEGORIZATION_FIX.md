# 🚀 QUICK DEPLOYMENT GUIDE

**Status:** Ready to Deploy  
**Date:** May 10, 2026

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [x] Backend TypeScript compiles successfully
- [x] All imports added correctly
- [x] Category normalization implemented
- [x] Mobile filtering logic updated  
- [x] Documentation complete
- [ ] Manual testing complete (TODO: Your team)
- [ ] Firebase logs verified (TODO: Your team)

---

## 🔧 STEP 1: Deploy Backend (Cloud Functions)

### 1.1 Build & Verify
```bash
cd C:\AlfaKotlin\functions
npm run build
# Expected: No errors, completes in <30 seconds
```

### 1.2 Deploy to Firebase
```bash
firebase deploy --only functions --project alfa-news-31bf7
# Expected: 12 functions deployed successfully
```

### 1.3 Monitor Logs (Keep running)
```bash
firebase functions:log --follow
# Watch for: [AI_PROCESSING] messages showing category normalization
```

**Expected Log Output:**
```
[NEWS_POST] Quick acceptance for post: abc123
[TRIGGER] Processing new post: abc123
[AI_PROCESSING] Original category: "పలిటిక్‌" → Normalized: "రాజకీయం"
[AI_PROCESSING] Final categories: ["రాజకీయం", "AP"]
```

---

## 📱 STEP 2: Build Android APK

### 2.1 Clean and Build

**Option A: Using PowerShell Script (Recommended)**
```powershell
cd C:\AlfaKotlin
./build_release_apk.ps1
# Runs with auto-retry 10x, handles daemon crashes
```

**Option B: Manual Build**
```bash
cd C:\AlfaKotlin
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
./gradlew.bat clean build assembleRelease --no-daemon --max-workers=1
```

### 2.2 Verify APK Created
```bash
ls app/build/outputs/apk/release/app-release.apk
# Should show file size >50 MB
```

### 2.3 Test on Emulator/Device
```bash
# Install APK
adb install -r app/build/outputs/apk/release/app-release.apk

# Or use Firebase App Distribution
firebase appdistribution:distribute app/build/outputs/apk/release/app-release.apk --release-notes="Categorization fix: 5→50+ posts"
```

---

## ✅ STEP 3: Verification Tests

### Test 1: Home Feed Post Count
1. Open app → Home screen
2. Scroll down → Should show 50+ posts (was 5)
3. ✅ Pass: Shows 50+
4. ❌ Fail: Still showing 5 → Check mobile logs

### Test 2: Category Diversity
1. Home Feed → Tap first post → Note category
2. Scroll down → Tap another post → Should be different category
3. Continue → Verify you see at least 4-5 different categories
4. ✅ Pass: See varied categories
5. ❌ Fail: All same category → Check filtering logic

### Test 3: 40/30/30 Mixing
1. Home Feed → First 15 posts
2. Count by category:
   - "తాజా వార్తలు" (Fresh/Recent) ≈ 6 posts (40%)
   - User interest matches ≈ 4-5 posts (30%)
   - Discovery (different) ≈ 4-5 posts (30%)
3. ✅ Pass: Roughly 40/30/30 distribution
4. ⚠️ Warning: If not 40/30/30, check user preferences

### Test 4: Performance
1. Home Feed → Note load time (should be <2s)
2. Scroll 10 posts → Should scroll smoothly
3. Pull to refresh → Should reload in <3s  
4. ✅ Pass: Smooth, <2s loads
5. ⚠️ Slow: Check network/Firestore

### Test 5: Political News Display
1. Create test post with category: "పలిటిక్‌" (typo)
2. Wait 5 seconds for AI processing
3. Go to Home Feed → Scroll to find post
4. ✅ Pass: Post shows up (normalization worked!)
5. ❌ Fail: Post doesn't show → Check Firebase logs

---

## 🔍 DEBUGGING GUIDE

### Issue: Still only 5 posts showing

**Step 1: Check Mobile App Updated**
```bash
# Clear app cache
adb shell pm clear com.alfanews.telugu
# Reinstall APK
adb install -r app/build/outputs/apk/release/app-release.apk
```

**Step 2: Check Firebase Logs for Categories**
```bash
firebase functions:log | grep "NORMALIZED"
# Should see normalization messages
```

**Step 3: Check Query Returning Data**
```bash
# In Firebase Console → Firestore
db.collection('news')
    .where('approved', '==', true)
    .where('categories', 'array-contains', 'ANY_CATEGORY')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get()
# Should return 100+ posts
```

### Issue: Wrong Categories Shown

**Step 1: Check Category Alias Map**
In `NewsFeedViewModel.kt`, search for `categoryAliases`. Verify it includes the category that's failing.

**Step 2: Add Missing Alias**
```kotlin
private val categoryAliases = mapOf(
    "రాజకీయం" to listOf(..., "NEW_TYPO_HERE"),  // Add here
    //...
)
```

**Step 3: Rebuild and Deploy**
```bash
./build_release_apk.ps1
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Issue: App Crashes When Loading Feed

**Step 1: Check Logs**
```bash
adb logcat | grep "NewsFeedViewModel"
# Look for exception messages
```

**Step 2: Common Causes**
- `NullPointerException` in `normalizeCategory()` → Check null handling
- `IllegalStateException` in `rankAndBlendPosts()` → Check list operations
- `Timeout` → Firestore query too slow, increase `FETCH_LIMIT` timeout

**Step 3: Fix in Code**
Edit NewsFeedViewModel.kt, rebuild, test

---

## 📊 MONITORING DASHBOARD

### Create Firebase Monitoring Setup

**1. Set up custom metric in Firebase Console:**
```
Analytics → Custom Events
Event: "news_feed_loaded"
Parameter: "post_count" (number of posts returned)
```

**2. In NewsFeedViewModel.kt, add logging:**
```kotlin
private fun trackFeedMetrics(postsCount: Int, generalsCount: Int, districtCount: Int) {
    val bundle = bundleOf(
        "post_count" to postsCount,
        "general_count" to generalsCount,
        "district_count" to districtCount,
        "fetch_time_ms" to (System.currentTimeMillis() - startTime)
    )
    firebaseAnalytics?.logEvent("news_feed_loaded", bundle)
}
```

**3. Monitor in Firebase Console:**
- Dashboard → News Feed Loaded
- Track: avg post_count (should be 50+)
- Track: avg fetch_time (should be <2000ms)

---

## 🎯 ROLLOUT PLAN

### Phase 1: Internal Testing (1 day)
- Build APK
- Test on 3-4 devices
- Verify all tests pass
- Approve for distribution

### Phase 2: Staged Rollout (3 days)
- Release to 10% of users via App Distribution
- Monitor crash rate & metrics
- If <0.1% crash rate, proceed to Phase 3

### Phase 3: Wide Release (1 day)
- Release to 100% of users on Play Store
- Monitor metrics for 24 hours
- Prepare rollback plan

### Phase 4: Post-Release (Ongoing)
- Monitor Firebase logs daily
- Respond to user feedback
- Plan next improvements

---

## 🆘 EMERGENCY ROLLBACK

If critical issues, rollback in order:

### Option 1: Hotfix (Preferred)
1. Identify bug in code
2. Push fix to git
3. Rebuild APK
4. Release new version

### Option 2: Backend Only Rollback
```bash
git revert COMMIT_HASH
cd functions
npm run build
firebase deploy --only functions
```

### Option 3: Full Rollback
```bash
git checkout previous_version_tag
cd functions
npm run build
firebase deploy --only functions
# Release old APK to Play Store
```

---

## ✅ SUCCESS CRITERIA

### Did the fix work?

**Must Have (Blocking):**
- [ ] Home feed shows 50+ posts (was 5) ← CRITICAL
- [ ] No crash spike in Crashlytics
- [ ] Category accuracy >90%
- [ ] Load time <2 seconds

**Should Have (Nice to Have):**
- [ ] 40/30/30 mixing visible
- [ ] User engagement +10%
- [ ] Firebase logs clean (no errors)

**Metrics to Track:**
```
Metric                  Target    Action if Failed
─────────────────────────────────────────────────
Posts shown             50+       Check filters
Category accuracy       >90%      Review aliases
Crash rate              <0.1%     Check null handling
Load time               <2s       Optimize query
Engagement              +10%      Monitor, not blocking
```

---

## 📞 WHO TO CONTACT

**Issue Type** → **Contact**
- Backend errors → DevOps/Backend team
- Mobile crashes → Mobile dev team  
- Categories wrong → Product/Content team
- Performance → DevOps/Performance team
- User feedback → Product/Support team

---

## 📝 FINAL CHECKLIST

Before considering deployment complete:

- [ ] Backend deployed successfully
- [ ] Mobile APK built successfully
- [ ] All 5 verification tests passed
- [ ] No crash reports in Crashlytics
- [ ] Firebase logs show category normalization
- [ ] Home feed shows 50+ posts
- [ ] Documentation updated
- [ ] Team notified of changes
- [ ] Rollback plan confirmed
- [ ] Success metrics tracked

---

## 🎉 YOU'RE READY!

Everything is set. Follow the steps above and verify each test. Good luck! 🚀

**Questions?** Check the related documentation files:
- `NEWS_CATEGORIZATION_FIX_IMPLEMENTATION.md` - Technical details
- `NEWS_CATEGORIZATION_IMPROVEMENTS_RECOMMENDATIONS.md` - Future improvements
- `NEWS_FEED_CATEGORIZATION_ANALYSIS.md` - Root cause analysis

