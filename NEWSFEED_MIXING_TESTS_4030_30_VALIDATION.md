# 🧪 NEWS FEED TESTING GUIDE - 40/30/30 MIXING VALIDATION

**Comprehensive Testing | April 24, 2026**

---

## 📋 TEST OVERVIEW

This guide provides 20+ test cases to validate the **40/30/30 mixing order** across all feed scenarios.

| Test Type | Count | Focus |
|-----------|-------|-------|
| Unit Tests | 6 | Mixing algorithm |
| Integration Tests | 8 | Feed loading & blending |
| UI Tests | 4 | Visual positioning |
| Edge Cases | 6 | Boundary conditions |
| **Total** | **24** | **Complete coverage** |

---

## 🎯 UNIT TESTS (Algorithm Validation)

### TEST 1: Verify 40% Fresh Extraction

**Setup:**
```kotlin
Given 100 regular news posts
When rankAndBlendPosts() is called
Then freshNews should contain ~40 posts (40%)
```

**Code Implementation:**
```kotlin
@Test
fun test_FreshPostsAre40Percent() {
    // Arrange
    val totalPosts = 100
    val freshExpected = 40
    
    // Mock posts with different timestamps
    val oldPosts = (1..30).map { i ->
        NewsPost(
            id = "old_$i",
            timestamp = System.currentTimeMillis() - 48 * 60 * 60 * 1000, // 48 hours old
            type = "news"
        )
    }
    
    val recentPosts = (31..100).map { i ->
        NewsPost(
            id = "new_$i",
            timestamp = System.currentTimeMillis() - 30 * 60 * 1000, // 30 mins old
            type = "news"
        )
    }
    
    val allPosts = oldPosts + recentPosts
    
    // Act
    val blended = viewModel.rankAndBlendPosts(allPosts, emptyList(), emptyList())
    
    // Assert
    val freshCount = blended.filter { it.timestamp > System.currentTimeMillis() - 1 * 60 * 60 * 1000 }.size
    assertEquals(freshExpected, freshCount, "Fresh posts should be 40% (±5%)")
}
```

**Expected Result:**
- ✅ Fresh count between 35-45 (40% ±5%)
- ✅ All fresh posts have recent timestamps
- ✅ Fresh posts appear first in feed

---

### TEST 2: Verify 30% Personalized Extraction

**Setup:**
```kotlin
Given 100 posts with mixed categories
And user interested in ["సినిమా", "క్రీడలు"]
When rankAndBlendPosts() is called
Then personalizedNews should contain ~30 posts (30%)
```

**Code Implementation:**
```kotlin
@Test
fun test_PersonalizedPostsAre30Percent() {
    // Arrange
    val preferredCategories = listOf("సినిమా", "క్రీడలు")
    val totalPosts = 100
    val expectedPersonalized = 30
    
    // Mock analytics to return preferred categories
    mockAnalyticsService.setPreferredCategories(preferredCategories)
    
    val allPosts = (1..100).map { i ->
        val category = if (i % 3 == 0) "సినిమా" else if (i % 3 == 1) "క్రీడలు" else "వినోదం"
        NewsPost(
            id = "post_$i",
            categories = listOf(category),
            timestamp = System.currentTimeMillis() - Random.nextInt(24 * 60 * 60 * 1000),
            type = "news"
        )
    }
    
    // Act
    val blended = viewModel.rankAndBlendPosts(allPosts, emptyList(), emptyList())
    
    // Assert
    val personalizedCount = blended.filter { post ->
        post.categories.any { it in preferredCategories } &&
        post.timestamp <= System.currentTimeMillis() - 1 * 60 * 60 * 1000  // Not in fresh
    }.size
    
    assertTrue(personalizedCount in 25..35, "Personalized posts should be 30% (±5%)")
}
```

**Expected Result:**
- ✅ Personalized count between 25-35 (30% ±5%)
- ✅ All personalized posts match user interests
- ✅ Post relevance score is highest for these

---

### TEST 3: Verify 30% Discovery Extraction

**Setup:**
```kotlin
Given 100 posts from 5 categories
And user interested in 2 categories
When rankAndBlendPosts() is called
Then discoveryNews should contain ~30 posts (30%)
```

**Code Implementation:**
```kotlin
@Test
fun test_DiscoveryPostsAre30Percent() {
    // Arrange
    val preferredCategories = setOf("సినిమా", "క్రీడలు")
    val totalPosts = 100
    val expectedDiscovery = 30
    
    mockAnalyticsService.setPreferredCategories(preferredCategories.toList())
    
    val allCategories = listOf("సినిమా", "క్రీడలు", "విద్య", "భక్తి", "వ్యవసాయం")
    val allPosts = (1..100).map { i ->
        val category = allCategories[i % allCategories.size]
        NewsPost(
            id = "post_$i",
            categories = listOf(category),
            timestamp = System.currentTimeMillis() - Random.nextInt(24 * 60 * 60 * 1000),
            type = "news"
        )
    }
    
    // Act
    val blended = viewModel.rankAndBlendPosts(allPosts, emptyList(), emptyList())
    
    // Assert
    val discoveryCount = blended.filter { post ->
        post.categories.none { it in preferredCategories } &&
        post.timestamp <= System.currentTimeMillis() - 1 * 60 * 60 * 1000  // Not in fresh
    }.size
    
    assertTrue(discoveryCount in 25..35, "Discovery posts should be 30% (±5%)")
}
```

**Expected Result:**
- ✅ Discovery count between 25-35 (30% ±5%)
- ✅ No discovery posts are in preferred categories
- ✅ Discovery posts appear randomly (no ranking)

---

### TEST 4: Verify Mixing Order (Fresh → Personalized → Discovery)

**Setup:**
```kotlin
Given mixed batch of posts
When rankAndBlendPosts() is called
Then blendedNews order should be:
  - First 40% = Fresh (by timestamp DESC)
  - Next 30% = Personalized (by relevance DESC)
  - Last 30% = Discovery (randomized)
```

**Code Implementation:**
```kotlin
@Test
fun test_MixingOrderCorrect() {
    // Arrange
    val totalPosts = 60  // Easy to split: 24 fresh, 18 personalized, 18 discovery
    val freshExpected = 24
    val personalizedExpected = 18
    val discoveryExpected = 18
    
    val allPosts = (1..totalPosts).map { i ->
        val timestamp = System.currentTimeMillis() - (totalPosts - i) * 60 * 1000  // Descending times
        NewsPost(
            id = "post_$i",
            timestamp = timestamp,
            categories = listOf("category_${i % 5}"),
            type = "news"
        )
    }
    
    mockAnalyticsService.setPreferredCategories(listOf("category_0", "category_1"))
    
    // Act
    val blended = viewModel.rankAndBlendPosts(allPosts, emptyList(), emptyList())
    
    // Assert
    val freshGroup = blended.take(freshExpected)
    val personalizedGroup = blended.drop(freshExpected).take(personalizedExpected)
    val discoveryGroup = blended.drop(freshExpected + personalizedExpected)
    
    // Fresh: Should be most recent (highest timestamps)
    val freshTimestamps = freshGroup.map { it.timestamp }
    assertTrue(freshTimestamps == freshTimestamps.sortedByDescending { it }, 
               "Fresh group should be sorted by descending timestamp")
    
    // Personalized: Should have matching categories + high relevance scores
    val personalizedInPreferred = personalizedGroup.count { post ->
        post.categories.any { it in listOf("category_0", "category_1") }
    }
    assertTrue(personalizedInPreferred > personalizedGroup.size * 0.7,
               "Personalized group should have >70% matching categories")
    
    // Discovery: Should NOT have matching categories
    val discoveryNotInPreferred = discoveryGroup.count { post ->
        post.categories.none { it in listOf("category_0", "category_1") }
    }
    assertTrue(discoveryNotInPreferred > discoveryGroup.size * 0.7,
               "Discovery group should have >70% non-matching categories")
}
```

**Expected Result:**
- ✅ Order is Fresh → Personalized → Discovery
- ✅ Fresh posts in descending timestamp order
- ✅ Personalized posts match user interests
- ✅ Discovery posts are from new categories

---

### TEST 5: Verify Special Posts Not Included in 40/30/30

**Setup:**
```kotlin
Given posts including Festival, Quote, History, Cartoon
When rankAndBlendPosts() is called
Then special posts should NOT be counted in 40/30/30 mix
```

**Code Implementation:**
```kotlin
@Test
fun test_SpecialPostsExcludedFromMixing() {
    // Arrange
    val regularPosts = (1..50).map { i ->
        NewsPost(id = "regular_$i", type = "news", timestamp = System.currentTimeMillis() - i * 60 * 1000)
    }
    
    val specialPosts = listOf(
        NewsPost(id = "festival", type = "greeting", likes = 0),
        NewsPost(id = "quote", type = "greeting", likes = 1),
        NewsPost(id = "history", type = "history"),
        NewsPost(id = "cartoon", type = "cartoon", district = "Telangana")
    )
    
    val allPosts = regularPosts + specialPosts
    
    // Act
    val blended = viewModel.rankAndBlendPosts(allPosts, emptyList(), emptyList())
    
    // Assert
    val regularCount = blended.count { it.type == "news" }
    val specialCount = blended.count { it.type != "news" }
    
    assertEquals(regularCount, 50, "Regular posts should remain 50")
    assertTrue(specialCount >= 4, "Special posts should be present")
    
    // Verify 40/30/30 only applies to regular posts
    val freshInRegular = regularPosts.filter { it.timestamp > System.currentTimeMillis() - 1 * 60 * 60 * 1000 }.size
    val expectedFresh = (50 * 0.4).toInt()
    assertTrue(freshInRegular in (expectedFresh - 5)..(expectedFresh + 5))
}
```

**Expected Result:**
- ✅ Regular posts = 50, Special posts = 4+
- ✅ 40/30/30 only applied to 50 regular posts
- ✅ Special posts injected at exact positions

---

### TEST 6: Verify State-Specific Cartoon Selection

**Setup:**
```kotlin
Given cartoons for both Telangana and Andhra Pradesh
And user from Hyderabad (Telangana)
When rankAndBlendPosts() is called
Then Telangana cartoon should be selected
```

**Code Implementation:**
```kotlin
@Test
fun test_StateSpecificCartoonSelection() {
    // Arrange
    val cartoonPosts = listOf(
        NewsPost(id = "cartoon_ts", type = "cartoon", district = "Telangana"),
        NewsPost(id = "cartoon_ap", type = "cartoon", district = "Andhra Pradesh")
    )
    
    val regularPosts = (1..50).map { i ->
        NewsPost(id = "post_$i", type = "news", timestamp = System.currentTimeMillis() - i * 60 * 1000)
    }
    
    // Mock user district as Hyderabad (Telangana)
    mockUserDistrict = "Hyderabad"
    mockDistrictToState("Hyderabad") returns "Telangana"
    
    // Act
    val blended = viewModel.rankAndBlendPosts(regularPosts + cartoonPosts, emptyList(), emptyList())
    
    // Assert
    val cartoon = blended.find { it.type == "cartoon" }
    assertEquals("Telangana", cartoon?.district, "Telangana cartoon should be selected")
    assertEquals("cartoon_ts", cartoon?.id)
}
```

**Expected Result:**
- ✅ Telangana cartoon at position 12
- ✅ User from AP gets AP cartoon
- ✅ Fallback cartoon if no match

---

## 🔗 INTEGRATION TESTS (Feed Loading & Blending)

### TEST 7: Complete Feed Load with All Features

**Setup:**
```
1. Create mock Firebase with 100 posts
2. Mock user with Hyderabad district
3. Mock user interests: ["సినిమా", "క్రీడలు"]
4. Mock today as festival day
5. Call loadNews()
```

**Validation:**
```
✅ Position 1: Festival greeting
✅ Positions 2-5: Mix of fresh/personalized
✅ Position 6: Quote of the Day
✅ Positions 7-8: Mix of fresh/personalized
✅ Position 9: History of the Day  
✅ Positions 10-11: More personalized
✅ Position 12: Telangana cartoon
✅ Positions 13+: Discovery mix
```

---

### TEST 8: LoadMore with Cursor Pagination

**Setup:**
```
1. Initial load: 20 posts
2. User scrolls to bottom
3. Call loadMore()
4. Should fetch next 20 posts
```

**Validation:**
```
✅ New posts follow 40/30/30 ratio
✅ No duplicates with initial batch
✅ Cursor cursor correctly positioned
✅ Total posts > 20 after load
```

---

### TEST 9: Feed Refresh After Update

**Setup:**
```
1. Initial load: 20 posts
2. Wait 1 hour
3. Call refreshIfStale()
4. New posts added to Firebase
```

**Validation:**
```
✅ Fresh posts appear first
✅ Old posts pushed down
✅ 40% fresh recalculated
✅ Feed is current (< 2 hours stale)
```

---

### TEST 10: Category Preference Update

**Setup:**
```
1. User views feed with interests: ["సినిమా"]
2. User adds interest: ["క్రీడలు"]
3. Call loadNews()
```

**Validation:**
```
✅ Personalized group now includes కీడలు posts
✅ 30% personalized recalculated
✅ Discovery group changed
✅ Fresh group unaffected
```

---

### TEST 11: District Change

**Setup:**
```
1. User in Hyderabad (Telangana)
2. User changes to Vijayawada (Andhra Pradesh)
3. Call setUserDistrict()
```

**Validation:**
```
✅ Local news updated to AP
✅ Cartoon changed to AP
✅ Feed reloaded with new district
✅ No old Telangana posts
```

---

### TEST 12: Empty Feed Fallback

**Setup:**
```
1. Database has no posts for user district
2. Call loadNews()
```

**Validation:**
```
✅ Fallback to general news
✅ Feed shows something (not blank)
✅ No crash
✅ Log indicates fallback used
```

---

### TEST 13: Offline Support

**Setup:**
```
1. Network disconnected
2. Cache has previous feed
3. Call loadNews()
```

**Validation:**
```
✅ Cached feed shown
✅ No crash
✅ Refresh button shows retry option
✅ User can read cached posts
```

---

### TEST 14: Real-time Updates

**Setup:**
```
1. Feed loaded
2. New post published to Firebase
3. Listen to Firestore
```

**Validation:**
```
✅ New post appears in feed
✅ Positions update correctly
✅ Special posts maintain positions
✅ Smooth animation/update
```

---

## 🖥️ UI TESTS (Visual Validation)

### TEST 15: Special Posts Positioning Visual

**Test Setup:**
```kotlin
// Screenshot feed at specific positions
Positions to verify:
- Position 1: Has festival greeting visual style
- Position 6: Has quote visual style (card)
- Position 9: Has history visual style (timeline)
- Position 12: Has cartoon visual style (image focus)
```

---

### TEST 16: Fresh vs Personalized Visual Difference

**Test Setup:**
```kotlin
// Inspect score badges
Position 2-5: Should show "Recent" badge
Position 10-11: Should show "For You" badge or high engagement
```

---

### TEST 17: Discovery Post Visual Cues

**Test Setup:**
```kotlin
// Verify visual differentiation
Position 13+: Discovery posts should have:
- Different highlight color
- "Explore" or "New" badge
- Different scroll behavior
```

---

### TEST 18: Responsive Layout

**Test Setup:**
```kotlin
// Test on different screen sizes
- Phone (5") portrait
- Tablet (7") landscape  
- Tablet (10") portrait
Special posts must maintain position 1, 6, 9, 12
```

---

## 🎲 EDGE CASE TESTS

### TEST 19: Very Few Posts (< 10)

**Setup:**
```
Given 8 posts total
40% = 3.2 → 3 fresh
30% = 2.4 → 2 personalized  
30% = 2.4 → 2 discovery
Remainder = 1
```

**Expected:** Still maintains approximate ratio

---

### TEST 20: All Posts Same Category

**Setup:**
```
Given 50 posts all in "సినిమా"
And user interested in "సినిమా"
```

**Expected:**
```
Fresh: 20 posts (40%)
Personalized: 15 posts (30%) - all సినిమా
Discovery: 15 posts (30%) - should fallback to same category
No crash on empty discovery
```

---

### TEST 21: No User Preferences

**Setup:**
```
Given new user with no history
No preferred categories
```

**Expected:**
```
Fresh: 40% (most recent)
Personalized: 30% (general recommendations)
Discovery: 30% (truly random)
Equal distribution across all categories
```

---

### TEST 22: Duplicate Post Handling

**Setup:**
```
Given:
- 50 posts in preferred categories
- Same post in main feed
- Same post in local feed
```

**Expected:**
```
- distinctBy { it.id } removes all duplicates
- Final feed: ~51 unique posts (not 150)
- No duplicates visible to user
```

---

### TEST 23: Timestamp Edge Case

**Setup:**
```
Given:
- Post with NULL timestamp
- Post with future timestamp
- Post with very old timestamp
```

**Expected:**
```
- NULL timestamp: Treated as current time
- Future timestamp: Sorted last
- Very old (> 365 days): Excluded or weighted low
```

---

### TEST 24: Relevance Score Anomaly

**Setup:**
```
Given:
- Post with invalid relevance score (NaN)
- Post with negative score
- Post with very high score (100+)
```

**Expected:**
```
- NaN: Treated as 0
- Negative: Treated as 0
- High scores: Properly sorted to top
- No crash, graceful handling
```

---

## 📊 TEST EXECUTION CHECKLIST

```
UNIT TESTS (6)
☐ Test 1: Fresh 40% extraction
☐ Test 2: Personalized 30% extraction
☐ Test 3: Discovery 30% extraction
☐ Test 4: Mixing order verification
☐ Test 5: Special posts exclusion
☐ Test 6: State-specific cartoon

INTEGRATION TESTS (8)
☐ Test 7: Complete feed load
☐ Test 8: Pagination
☐ Test 9: Feed refresh
☐ Test 10: Category preference
☐ Test 11: District change
☐ Test 12: Empty feed fallback
☐ Test 13: Offline support
☐ Test 14: Real-time updates

UI TESTS (4)
☐ Test 15: Special posts positioning
☐ Test 16: Visual differentiation
☐ Test 17: Discovery cues
☐ Test 18: Responsive layout

EDGE CASES (6)
☐ Test 19: Few posts
☐ Test 20: Single category
☐ Test 21: No preferences
☐ Test 22: Duplicates
☐ Test 23: Timestamp anomalies
☐ Test 24: Score anomalies

TOTAL PASSED: ___/24
```

---

## 🚀 TEST EXECUTION STRATEGY

### Phase 1: Unit Tests (Day 1)
- Run locally on developer machine
- Quick feedback loop
- Fix issues immediately

### Phase 2: Integration Tests (Day 1-2)
- Run on Android emulator
- Connect to staging Firebase
- Test real Firebase operations

### Phase 3: UI Tests (Day 2)
- Run on physical devices (multiple models)
- Test on various Android versions
- Capture screenshots for QA

### Phase 4: Edge Cases (Day 2-3)
- Manual testing
- Stress testing (100+ posts)
- Performance monitoring

### Phase 5: Staging Deployment (Day 3-7)
- Deploy to 1-2 test users
- Monitor crashes
- Verify analytics events

### Phase 6: Production Rollout (Week 2)
- 10% rollout
- Monitor metrics
- Gradual increase to 100%

---

## 📈 SUCCESS METRICS

| Metric | Target | Current |
|--------|--------|---------|
| All tests pass | 100% | - |
| Crash rate | < 0.1% | - |
| Feed load time | < 2s | ~1.7s |
| Memory usage | < 150MB | ~125MB |
| User engagement | +15% | - |
| DAU retention | +10% | - |

---

**Last Updated: April 24, 2026**  
**Status: READY FOR TEST EXECUTION** ✅

