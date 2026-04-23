# 📋 News Feed Audit Report - User Interest Based Feed Verification

**Date:** April 23, 2026  
**Status:** ⚠️ **CRITICAL ISSUES FOUND**

---

## Executive Summary

The user interest-based news feed has **significant implementation gaps**. While user interests are being tracked and some special posts (Festival greeting, Quote of the Day) are partially implemented, **major functionality is missing or broken**:

- ❌ History of the Day (9th post) - **NOT POSITIONED**
- ❌ Cartoons (12th post) - **NOT POSITIONED**
- ❌ State-specific cartoon selection - **NOT IMPLEMENTED**
- ⚠️ Special posts excluded from local/district feeds - **CRITICAL BUG**
- ⚠️ User interest mixing not fully optimized - **PARTIAL**

---

## Detailed Issues

### 🔴 CRITICAL ISSUE #1: Special Posts Excluded from Local Feeds

**File:** `LocalNewsFeedViewModel.kt` (Line 341-342)

```kotlin
if (type == "greeting" || type == "history") {
    return null // Exclude greeting and history cards from the main news feed
}
```

**Problem:**
- Festival greetings, quotes of the day, and history posts are **completely filtered out** from local/district-specific feeds
- This means these special posts **NEVER appear** in district news feeds
- Only the general/home feed shows these posts (and even there, partially)

**Impact:**
- Users viewing district-specific news don't see any special posts
- Inconsistent experience between home and local feeds

**Fix Needed:**
- Include these special posts in local feeds with proper positioning
- Add state/district filtering logic for cartoons

---

### 🔴 CRITICAL ISSUE #2: History of the Day Not Positioned (9th Post)

**Problem:**
- Backend generates "History of the Day" daily at 4:30 AM IST
- Stored in Firebase with `type: "history"`
- **Frontend has NO logic to position it at the 9th position**
- Actually, LocalNewsFeedViewModel explicitly filters it out (see Issue #1)

**Location:** `NewsFeedViewModel.kt` - Missing logic in `rankAndBlendPosts()` function

**Current Code Flow:**
- Lines 321-328: Only festival greetings (`likes == 0`) and quote greetings (`likes == 1`) are handled
- Lines 315-379: The `rankAndBlendPosts()` function has NO handling for type "history"

**Fix Needed:**
```kotlin
// Missing logic for history posts at position 9
val historyPosts = allPosts.filter { it.type == "history" }
if (historyPosts.isNotEmpty()) {
    val targetIdx = if (9 < blendedNews.size) 9 else if (blendedNews.size > 0) blendedNews.size - 1 else 0
    if (targetIdx >= 0 && targetIdx <= blendedNews.size) {
        blendedNews.add(targetIdx, historyPosts.first())
    } else {
        blendedNews.add(historyPosts.first())
    }
}
```

---

### 🔴 CRITICAL ISSUE #3: Cartoons Not Positioned (12th Post)

**Problem:**
- Backend generates daily cartoons for Andhra Pradesh and Telangana at 6:00 AM IST
- Stored in Firebase with:
  - `type: "cartoon"`
  - `district: state` (either "Andhra Pradesh" or "Telangana")
  - `category: "కార్టూన్"`

**Frontend Issues:**
1. **NO positioning logic** for cartoons in `rankAndBlendPosts()`
2. **NO state/district-based filtering** - can't select AP cartoon if user is from AP
3. **NO handling in `rankAndBlendPosts()`** function at all

**File:** `NewsFeedViewModel.kt`

**Missing Code:** Need to add logic similar to history positions:
```kotlin
// Missing: Cartoon positioning logic at 12th position
val cartoonPosts = allPosts.filter { it.type == "cartoon" }
// Filter by user's state (district -> state mapping)
val userState = mapDistrictToState(district) // Need this function
val relevantCartoon = cartoonPosts.find { 
    it.district?.equals(userState, ignoreCase = true) == true 
}
if (relevantCartoon != null) {
    val targetIdx = if (12 < blendedNews.size) 12 else if (blendedNews.size > 0) blendedNews.size - 1 else 0
    if (targetIdx >= 0 && targetIdx <= blendedNews.size) {
        blendedNews.add(targetIdx, relevantCartoon)
    } else {
        blendedNews.add(relevantCartoon)
    }
}
```

**Required:** District to State mapping function
```kotlin
private fun mapDistrictToState(district: String?): String? {
    if (district == null) return null
    // Andhra Pradesh districts
    if (Constants.ALL_DISTRICTS.filter { /* AP districts */ }.contains(district)) {
        return "Andhra Pradesh"
    }
    // Telangana districts
    if (Constants.ALL_DISTRICTS.filter { /* Telangana districts */ }.contains(district)) {
        return "Telangana"
    }
    return null
}
```

---

### 🟡 ISSUE #4: User Interest Mixing Not Comprehensive

**File:** `NewsFeedViewModel.kt` (Lines 315-379)

**Current Mixing Logic:**
```kotlin
val discoveryCount = if (totalToRank > 10) (totalToRank * 0.3).toInt() else maxOf(1, totalToRank / 3)
val freshCount = if (totalToRank > 10) (totalToRank * 0.4).toInt() else maxOf(1, (totalToRank * 0.4).toInt())
```

**Issues:**
1. **30% Discovery** (news NOT in user preferences) - ✅ Good
2. **40% Fresh** (recent news) - ✅ Good
3. **30% Personalized** (user interest-based) - ✅ Good
4. **BUT:** Special posts (festival, quote, history, cartoon) are added AFTER this blending
5. **Result:** Special posts push out regular news instead of being integrated

**Problem:**
- A user might see: Festival, Quote, History, Cartoon, then only ~16 regular articles (if fetching 20 news items)
- This compresses the user interest mingling

**Fix Approach:**
- Properly account for special posts in the fetch count
- Fetch more base news to accommodate special posts
- Better interleaving of special posts within the feed

---

### 🟡 ISSUE #5: Duplicate Festival Greeting Fetching

**File:** `NewsFeedViewModel.kt`

**Problem:**
1. Line 86-89: Separate `fetchGreetingPost()` call to get greetings
2. Line 321-327: Then in `rankAndBlendPosts()`, ALL posts are filtered for greetings again
3. Line 154-157: The greeting is injected at position 0

**Inefficiency:**
- Festival greeting is fetched redundantly
- Could be unified into a single fetch

---

### 🟡 ISSUE #6: Missing Type Field Handling

**File:** `NewsFeedViewModel.kt` - Line 459

The `type` field is properly mapped:
```kotlin
type = data["type"]?.toString() ?: "news"
```

✅ **This part is correct** - types are preserved, but handling is incomplete

---

## Expected Behavior vs Current Implementation

### Festival Greeting (1st Post) ✅ Partial
| Aspect | Status |
|--------|--------|
| Generated | ✅ Yes (daily at 4:00 AM) |
| Stored | ✅ Yes (type: "greeting", likes: 0) |
| Positioned at 1st | ✅ Yes (NewsFeedViewModel line 374-375) |
| Shown in local feed | ❌ No (filtered out at line 342) |

### Quote of the Day (6th Post) ⚠️ Partial
| Aspect | Status |
|--------|--------|
| Generated | ✅ Yes (daily at 4:00 AM) |
| Stored | ✅ Yes (type: "greeting", likes: 1) |
| Positioned at 6th | ✅ Yes (NewsFeedViewModel line 362-370) |
| Shown in local feed | ❌ No (filtered out at line 342) |

### History of the Day (9th Post) ❌ NOT WORKING
| Aspect | Status |
|--------|--------|
| Generated | ✅ Yes (daily at 4:30 AM) |
| Stored | ✅ Yes (type: "history") |
| Positioned at 9th | ❌ **NO CODE** |
| Shown in local feed | ❌ No (filtered out at line 342) |

### Cartoon (12th Post) ❌ NOT WORKING
| Aspect | Status |
|--------|--------|
| Generated | ✅ Yes (daily at 6:00 AM) |
| Stored | ✅ Yes (type: "cartoon", state-specific) |
| Positioned at 12th | ❌ **NO CODE** |
| State-based filtering | ❌ **NO CODE** |
| Shown in local feed | ❌ No (blocked by issue #1) |

---

## Code Impact Analysis

### Files Needing Changes
1. **NewsFeedViewModel.kt**
   - Add history post positioning logic (lines 315-379)
   - Add cartoon post positioning logic with state filtering
   - Add `mapDistrictToState()` helper function
   - Adjust fetch count to account for special posts

2. **LocalNewsFeedViewModel.kt**
   - Remove filtering of greeting and history posts (line 341-342)
   - Add positioning logic for all special posts
   - Add state-based cartoon filtering

3. **Constants.kt** (if doesn't exist, create)
   - Add district-to-state mapping lookup tables

---

## User Interest Tracking ✅ Status

**Good News:** User interest tracking is well implemented:

- ✅ User preferences tracked via `AnalyticsService.getUserPreferredCategories()`
- ✅ Category scores maintained and weighted
- ✅ Reporter scores tracked
- ✅ Tag scores tracked
- ✅ Relevance scoring implemented (`calculateRelevanceScore()`)
- ✅ 30% fresh + 40% discovery + 30% personalized blending approach sound

**However:**
- ⚠️ Special posts not integrated into this mixing
- ⚠️ No mixing in local/district feeds (news filtering is simplistic)

---

## Recommendations

### Priority 1: CRITICAL (Must Fix)
1. ✅ Add History of the Day positioning at 9th position
2. ✅ Add Cartoon positioning at 12th position with state filtering
3. ✅ Fix LocalNewsFeedViewModel to include special posts

### Priority 2: HIGH
1. ⚠️ Implement district-to-state mapping for cartoon filtering
2. ⚠️ Consolidate special post fetching logic
3. ⚠️ Verify special posts appear correctly in local feeds

### Priority 3: MEDIUM
1. 📊 Optimize fetch count to account for special posts
2. 📊 Track how many special posts displace regular news
3. 📊 A/B test the mixing ratios

---

## Testing Checklist

- [ ] Festival greeting appears at position 0 (1st)
- [ ] Festival greeting appears in home feed
- [ ] Festival greeting appears in local/district feed
- [ ] Quote of the day appears at position 5-6
- [ ] Quote of the day appears in both home and local feeds
- [ ] History of the day appears at position 8-9
- [ ] History of the day appears in both home and local feeds
- [ ] Cartoon appears at position 11-12
- [ ] AP cartoon shown to AP users/affected by AP interests
- [ ] Telangana cartoon shown to Telangana users/affected by Telangana interests
- [ ] User interests mixed with all post types (30% fresh + 40% discovery + 30% personalized)
- [ ] No duplicate posts in feed
- [ ] Feed doesn't crash when loading

---

## Code References

**backend/functions/src/index.ts:**
- Festival Generation: Line 179-216
- Quote Generation: Line 223-284
- History Generation: Line 285-343
- Cartoon Generation: Line 348-408

**app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt:**
- Post blending: Lines 315-379
- Festival handling: Lines 321-327, 374-375
- Quote handling: Lines 321-327, 362-370

**app/src/main/java/com/alfanews/telugu/viewmodels/LocalNewsFeedViewModel.kt:**
- Filtering bug: Lines 341-342

**app/src/main/java/com/alfanews/telugu/services/AnalyticsService.kt:**
- User preferences: Lines 199-219
- Relevance scoring: Lines 220-255

---

## Conclusion

The news feed system has **good foundations** with user interest tracking well-implemented, but **critical gaps** in special post positioning and handling. The system is **partially functional but not complete**. Estimated implementation time: **4-6 hours** for fixes.

**Current Risk Level:** 🔴 **HIGH** - Special posts don't work as designed

