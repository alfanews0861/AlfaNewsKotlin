# 📰 Local News Feed & Home Feed Fix Plan

**Date:** May 5, 2026  
**Status:** In Progress  
**Problem:** District news (Guntur, Nizamabad) appearing in home feed; LocalNewsFeed too complex with fallback issues

---

## 🔴 Root Cause Analysis

### Problem 1: LocalNewsFeedViewModel Bad Fallback (Lines 259-266)
```kotlin
// ISSUE: When district query fails, it loads ALL news
if (posts.isEmpty()) {
    val fallbackQuery = FirebaseService.db.collection("news")
        .orderBy("timestamp", Query.Direction.DESCENDING)
        .limit(pageSize.toLong())
    // This loads unfiltered news, breaking district isolation
}
```

### Problem 2: NewsFeedViewModel Aggressive Fallback (Lines 155-183)
```kotlin
// ISSUE: When < 5 normal posts, loads ALL news including districts
if (normalNewsCount < 5) {
    val fallbackSnapshot = FirebaseService.db.collection("news")
        .orderBy("timestamp", Query.Direction.DESCENDING)
        .limit(FETCH_LIMIT.toLong())
    // This can include district-specific posts that should be filtered
}
```

### Problem 3: District Detection Too Lenient (Lines 322-326)
```kotlin
// ISSUE: Global keywords check is incomplete
val strictlyGlobalKeywords = listOf(
    "సినిమా", "స్పోర్ట్స్", "జాతీయం", ...
    // Missing state-level and national categories
)
```

### Problem 4: No User Interest Tracking for New Users
- Analytics only track AFTER user selects district
- New users don't build preferences immediately
- Need to proactively track all views from day 1

---

## ✅ Solution Strategy

### Fix 1: Simplify LocalNewsFeedViewModel
- **Remove generic fallback** - If district query fails, show empty state with retry
- **Keep pagination simple** - Fetch only district-tagged news
- **Better error handling** - Log query errors for debugging

### Fix 2: Strengthen Home Feed Filtering
- **Expand global keywords** - Add all state/national categories
- **Fixed filtering logic** - Don't load ALL news on fallback
- **Better mixed ordering** - Keep 40/30/30 but respect district filtering

### Fix 3: Implement Early Interest Tracking
- **Track all categories viewed** - Even from first load
- **No wait for preferences** - Start building scores immediately
- **Better new user experience** - Personalization kicks in faster

### Fix 4: Clarify Feed Separation
```
LocalNewsFeedView (District Tab)
├── Only news with district in categories
├── All categories OK (politics, development, local news OK here)
└── Simple timestamp ordering

NewsFeedView (Home Feed)
├── General categories only (cinema, sports, health, etc.) - all districts
├── + User's own district news (all categories)
├── 40/30/30 mixing applied
└── NO other district news
```

---

## 📝 Implementation Steps

### Step 1: Fix LocalNewsFeedViewModel
- Remove generic fallback in `loadNews()` (lines 259-266)
- Remove generic fallback in `loadMore()` (lines 325-335)
- Show empty state if no district news found
- Keep retry mechanism

### Step 2: Fix NewsFeedViewModel Filtering
- Expand `strictlyGlobalKeywords` vocabulary
- Improve district detection logic
- Don't override filters in fallback

### Step 3: Add User Interest Tracking
- Track all viewed categories immediately
- Log engagement for new users too
- Sync to analytics service

### Step 4: Test & Validate
- Verify home feed has NO Guntur/Nizamabad news
- Verify local feed shows ONLY selected district
- Verify new users build preferences
- Verify 40/30/30 ordering maintained

---

## 🎯 Expected Results

After fix:
- ✅ Home feed shows only general categories + user's own district
- ✅ Local feed shows only selected district news
- ✅ No spinners - faster loading
- ✅ New users start building preferences immediately
- ✅ Clear separation of concerns

---

