# 🧪 News Feed Testing and Verification Guide

**Date:** April 23, 2026  
**Document:** News Feed Quality Assurance Plan

---

## Executive Summary

This document provides step-by-step testing procedures to verify that the user interest-based news feed is working correctly with all special posts (Festival greeting, Quote, History, Cartoons) positioned at their designated locations.

---

## Pre-Requisites

### Required Setup
1. **Fresh APK Build:** Follow your standard build process
   - Clean build: `./gradlew clean build`
   - Generate signed APK for testing
   
2. **Test Device/Emulator:**
   - Android device/emulator with recent Google Play Services
   - Location services enabled for geolocation testing
   - Internet connectivity
   
3. **Firebase Console Access:**
   - Verify special posts are being generated daily
   - Check `firestore -> news` collection for post types
   - Monitor Firebase Cloud Functions logs

4. **Test Data:**
   - Ensure special posts exist in the news collection:
     - At least 1 festival greeting (type: "greeting", likes: 0)
     - At least 1 quote of the day (type: "greeting", likes: 1)
     - At least 1 history of the day (type: "history")
     - At least 2 cartoons (one for AP, one for Telangana)

---

## Test Cases

### Test Case 1: Home Feed - Festival Greeting Display

**Objective:** Verify Festival greeting appears at 1st position in home feed

**Setup:**
1. Launch app
2. Navigate to Home/News Feed
3. Ensure at least 20 news items loaded

**Steps:**
1. Scroll to top of feed
2. Check 1st card in feed

**Expected Result:**
✅ Position 1: Festival greeting card visible
- Displays festival name in Telugu
- Shows festival greeting image (9:16 vertical format)
- No headlines/content text overlaid on image

**Actual Result:**
- [ ] PASS
- [ ] FAIL (Specify issue): _________________

**Notes:** _____________________________________

---

### Test Case 2: Home Feed - Quote of the Day Display

**Objective:** Verify Quote of the Day appears around 6th position

**Setup:**
1. Feed loaded with 15+ items
2. Home feed view active

**Steps:**
1. Scroll to position 6-7 (count from top: 1st, 2nd, 3rd, 4th, 5th, 6th)
2. Verify card type

**Expected Result:**
✅ Position 6: Quote of the Day card visible
- Headline: "నేటి మంచి మాట" (or similar)
- Displays inspiring quote/image
- Shows author name

**Actual Result:**
- [ ] PASS
- [ ] FAIL (Specify issue): _________________

**Notes:** _____________________________________

---

### Test Case 3: Home Feed - History of the Day Display

**Objective:** Verify History of the Day appears around 9th position

**Setup:**
1. Feed loaded with 20+ items
2. Home feed view active
3. Scroll visible to position 9

**Steps:**
1. Scroll to position 9 (count: 1, 2, 3, 4, 5, 6, 7, 8, 9)
2. Verify card displays history content

**Expected Result:**
✅ Position 9: History of the Day card visible
- Contains historical event from today's date
- Telugu headline about history
- Relevant historical image
- Posted by system/bot account

**Actual Result:**
- [ ] PASS
- [ ] FAIL (Specify issue): _________________

**Notes:** _____________________________________

---

### Test Case 4: Home Feed - Cartoon with State Matching

**Objective:** Verify correct state-specific cartoon at position 12

**Setup:**
1. App running on test device with location enabled
2. Device location: Hyderabad (Telangana)
3. Feed loaded with 20+ items

**Steps:**
1. Scroll to position 12
2. Verify cartoon card
3. Note the state name in cartoon

**Expected Result:**
✅ Position 12: Cartoon card visible
- If user from Telangana: "తెలంగాణ కార్టూన్" title
- Political/satirical cartoon content
- Telugu caption present
- Posted by "@Cartoonist" or similar

**Actual Result:**
- [ ] PASS
- [ ] FAIL (Specify issue): _________________

**Notes:** _____________________________________

---

### Test Case 5: Cartoon State-Specific Test (Andhra Pradesh User)

**Objective:** Verify AP users see Andhra Pradesh cartoons

**Setup:**
1. Change device location to Visakhapatnam (AP)
2. Or manually select AP district in app settings
3. Refresh feed

**Steps:**
1. Wait for feed to reload
2. Scroll to position 12
3. Check cartoon title

**Expected Result:**
✅ Position 12: Cartoon card with "ఆంధ్రప్రదేశ్ కార్టూన్" title
- Different political/social content vs Telangana cartoon
- Relevant to AP current events
- Telugu caption present

**Actual Result:**
- [ ] PASS
- [ ] FAIL (Specify issue): _________________

**Notes:** _____________________________________

---

### Test Case 6: Local District Feed - Special Posts Visibility

**Objective:** Verify special posts appear in district-specific feed

**Setup:**
1. Navigate to Local/District News feed
2. Select specific district (e.g., Hyderabad)
3. Wait for feed to load

**Steps:**
1. Check first 15 posts
2. Count special posts: Festival, Quote, History, Cartoon
3. Verify positioning

**Expected Result:**
✅ Special posts visible in district feed:
- Position 1: Festival greeting (if today is festival)
- Position 6: Quote of the day
- Position 9: History of the day
- Position 12: Cartoon (state-specific)
- Other posts: Regular district news

**Actual Result:**
- [ ] PASS
- [ ] FAIL (Specify issue): _________________

**Notes:** _____________________________________

---

### Test Case 7: User Interest Mixing

**Objective:** Verify feed includes mix of user interests + discovery + fresh

**Setup:**
1. Log in as test user with defined interests
2. Set interests to specific categories (e.g., Politics, Sports)
3. Wait for preference tracking to register

**Steps:**
1. Scroll through feed (20+ items)
2. Categorize posts as:
   - User Interest (e.g., Politics, Sports)
   - Discovery (unrelated to interests)
   - Fresh (recent by timestamp)
3. Count distribution

**Expected Result:**
✅ Feed contains mixture of:
- ~40% recent news (Fresh)
- ~30% unexpected categories (Discovery)
- ~30% user preference categories (Personalized)
- Note: Percentages may vary due to special posts

**Actual Result:**
- [ ] Approximately correct distribution
- [ ] Skewed toward interests (bad)
- [ ] Too much discovery (bad)
- [ ] Mostly recent (bad)

**Notes:** _____________________________________

---

### Test Case 8: No Duplicate Posts

**Objective:** Verify same post doesn't appear twice in feed

**Setup:**
1. Feed loaded with 50+ posts
2. Home feed active

**Steps:**
1. Note post IDs/headlines as you scroll
2. Look for repeats
3. Continue scrolling to "Load More"
4. Check again for duplicates

**Expected Result:**
✅ No duplicate posts visible
- Each post appears exactly once
- "Load More" brings new posts only
- Special posts appear once

**Actual Result:**
- [ ] PASS - No duplicates
- [ ] FAIL - Found duplicates: _________

**Notes:** _____________________________________

---

### Test Case 9: Load More Functionality

**Objective:** Verify "Load More" maintains post positioning

**Setup:**
1. Feed with 15 items visible
2. Home feed view

**Steps:**
1. Scroll to bottom
2. Tap "Load More"
3. Wait for new posts to load
4. Scroll back up
5. Check positioning of special posts

**Expected Result:**
✅ After loading more:
- Original posts: positions unchanged
- New posts appended below
- Special posts still at correct positions
- No duplicates introduced

**Actual Result:**
- [ ] PASS - Correct behavior
- [ ] FAIL - Issue: _________________

**Notes:** _____________________________________

---

### Test Case 10: Feed Refresh

**Objective:** Verify refresh updates posts without corruption

**Setup:**
1. Feed loaded with posts visible
2. Note current top posts
3. Home feed active

**Steps:**
1. Pull-to-refresh (or use refresh button)
2. Wait for feed to reload
3. Verify top posts updated
4. Check special posts positioning

**Expected Result:**
✅ After refresh:
- New posts appear at top
- Special posts positioned correctly
- No crashes or errors
- Feed loads in <3 seconds

**Actual Result:**
- [ ] PASS - Smooth refresh
- [ ] FAIL - Issue: _________________

**Notes:** _____________________________________

---

### Test Case 11: Empty State Handling

**Objective:** Verify graceful handling when no special posts available

**Setup:**
1. Temporarily modify Firebase data:
   - Remove all greeting/history/cartoon posts from "news" collection
2. Refresh app

**Steps:**
1. Open feed
2. Verify it loads
3. Check for error messages
4. Scroll through feed

**Expected Result:**
✅ Feed shows only regular news:
- No crash
- No "missing post" errors
- Smooth scrolling
- Message indicates no special content (if UI has it)

**Actual Result:**
- [ ] PASS - Graceful handling
- [ ] FAIL - Crashes/errors

**Notes:** _____________________________________

---

### Test Case 12: Poor Network Conditions

**Objective:** Verify feed loads even on slow/unreliable network

**Setup:**
1. Enable throttling on device (Settings > Developer Options > Network Throttling)
2. Set to 2G or Slow 3G

**Steps:**
1. Open feed
2. Wait for content to load
3. Monitor loading indicators
4. Try scrolling

**Expected Result:**
✅ Feed eventually loads:
- Loading indicators show progress
- Special posts load (may take longer)
- No indefinite waiting
- Timeout handling works

**Actual Result:**
- [ ] PASS - Loads on slow network
- [ ] FAIL - Issue: _________________

**Notes:** _____________________________________

---

### Test Case 13: MongoDB Index Verification

**Objective:** Verify Firestore queries use proper indexes

**Setup:**
1. Check Firebase Console
2. Navigate to Firestore > Indexes
3. Look for "news" collection indexes

**Steps:**
1. Verify these indexes exist:
   - `news: categories (Asc), timestamp (Desc)`
   - `news: district (Asc), timestamp (Desc)`
   - `news: type (Asc), likes (Asc)`
2. Verify no index errors in logs

**Expected Result:**
✅ All required indexes exist:
- No index errors in logs
- Queries complete in <100ms
- No "missing index" warning

**Actual Result:**
- [ ] PASS - All indexes OK
- [ ] FAIL - Missing indexes: _________________

**Notes:** _____________________________________

---

### Test Case 14: Analytics Tracking

**Objective:** Verify user interest tracking works with special posts

**Setup:**
1. Log in as test user
2. Enable analytics debug mode (if available)
3. Open feed

**Steps:**
1. View various posts
2. Interact with posts (like, share, comment)
3. Log out and check Firebase analytics
4. View user preference scores

**Expected Result:**
✅ Analytics recorded properly:
- User preferences updated
- Category scores increase with engagement
- Special posts don't cause tracking errors
- Score breakdown visible

**Actual Result:**
- [ ] PASS - Analytics working
- [ ] FAIL - Issue: _________________

**Notes:** _____________________________________

---

## Performance Benchmark Targets

Test these metrics during normal operation:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Feed load time (1st time) | <2 seconds | ____ | ✓/✗ |
| Feed load time (refresh) | <1.5 seconds | ____ | ✓/✗ |
| Post rendering time | <500ms | ____ | ✓/✗ |
| Load More time | <1 second | ____ | ✓/✗ |
| Memory usage | <150MB | ____ | ✓/✗ |
| CPU usage (idle) | <5% | ____ | ✓/✗ |
| Battery impact (1 hour) | <5% drain | ____ | ✓/✗ |

---

## Regression Testing

### Check These Still Work
- [ ] User authentication/login
- [ ] District selection
- [ ] Location detection
- [ ] Push notifications
- [ ] Post sharing
- [ ] Post reporting
- [ ] Offline mode
- [ ] App settings
- [ ] Language selection

---

## Logging & Diagnostics

### Key Logs to Monitor

**NewsFeedViewModel:**
```
D/NewsFeedViewModel: rankAndBlendPosts() called
D/NewsFeedViewModel: Found X festival greetings, Y quotes, Z histories, W cartoons
D/NewsFeedViewModel: Mapping district X to state Y
D/NewsFeedViewModel: Selected cartoon for state Y
```

**LocalNewsFeedViewModel:**
```
D/LocalNewsFeedViewModel: Loading news for district X
D/LocalNewsFeedViewModel: Converted X posts (including special posts)
```

**Firebase:**
```
Firestore Query: news whereArrayContains(categories, X) orderBy(timestamp) -> Status
Firestore Query: news whereEqualTo(type, "greeting") -> Status
```

### Debug Commands

```bash
# Watch logs for special post handling
adb logcat | grep -i "newsfeed\|special\|cartoon\|history"

# Check if queries are fast
adb logcat | grep -i "firestore\|query"

# Monitor memory usage
adb shell dumpsys meminfo | grep -A 10 "com.alfanews"
```

---

## Sign-Off Checklist

### QA Sign-Off
- [ ] All 14 test cases passed
- [ ] No crashes or errors
- [ ] Performance metrics acceptable
- [ ] Special posts positioning verified
- [ ] State-specific cartoons working
- [ ] Regression tests passed
- [ ] Logs clean (no warnings)

### Development Sign-Off
- [ ] Code reviewed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No new technical debt

### Product Sign-Off
- [ ] UX as expected
- [ ] All features working
- [ ] Performance acceptable
- [ ] Ready for production

### Final Approval
- []  Approved for production release

---

## Known Issues & Workarounds

### Issue 1: Cartoon May Not Match State
**Symptom:** User from AP sees Telangana cartoon
**Cause:** District not properly mapped to state
**Workaround:** Manual district selection in settings
**Fix Timeline:** Next sprint

### Issue 2: Slow Feed Load on First Launch
**Symptom:** Takes >5 seconds to load feed
**Cause:** Initial Firebase queries with many results
**Workaround:** Wait for completion, app caches after
**Fix Timeline:** Optimize query further

### Issue 3: Special Posts Not Updating Daily
**Symptom:** Same festival greeting shown for 2+ days
**Cause:** Firebase function not running or duplicate data
**Workaround:** Check Cloud Functions logs, redeploy if needed
**Fix Timeline:** Investigate Cloud Functions

---

## Post-Deployment Monitoring

### Day 1-2
- [ ] Monitor crash reports
- [ ] Check error logs
- [ ] Verify special posts appear
- [ ] Monitor user engagement with new feeds

### Week 1
- [ ] Analyze user engagement metrics
- [ ] Check feed positioning accuracy
- [ ] Monitor Firestore query performance
- [ ] Gather user feedback

### Month 1
- [ ] Full analytics review
- [ ] User retention impact
- [ ] Performance trends
- [ ] Consider optimizations for Phase 2

---

## Appendix: Firebase Query Examples

### Query 1: Check Festival Greeting
```firestore
collection: news
where: type == "greeting"
where: likes == 0
orderBy: timestamp (Descending)
limit: 1
```

### Query 2: Check Quote of the Day
```firestore
collection: news
where: type == "greeting"
where: likes == 1
orderBy: timestamp (Descending)
limit: 1
```

### Query 3: Check History of the Day
```firestore
collection: news
where: type == "history"
orderBy: timestamp (Descending)
limit: 1
```

### Query 4: Check Telangana Cartoon
```firestore
collection: news
where: type == "cartoon"
where: district == "Telangana"
orderBy: timestamp (Descending)
limit: 1
```

### Query 5: Check AP Cartoon
```firestore
collection: news
where: type == "cartoon"
where: district == "Andhra Pradesh"
orderBy: timestamp (Descending)
limit: 1
```

---

## Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-04-23 | Initial testing guide | QA Team |
| | | | |

---

**Last Updated:** April 23, 2026  
**Next Review:** After first production deployment

