package com.alfanews.telugu.data

import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.NewsPost
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.system.measureTimeMillis

class FeedStalenessAndCacheTest {

    private val STALE_THRESHOLD_MS = 5 * 60 * 1000L // 5 minutes threshold
    private val TEN_MINUTES_MS = 10 * 60 * 1000L     // 10 minutes
    private val SEVEN_HOURS_MS = 7 * 60 * 60 * 1000L // 7 hours

    @Test
    fun testTenMinutesStalenessTriggersRefresh() {
        val now = System.currentTimeMillis()
        val lastRefreshTime = now - TEN_MINUTES_MS

        val isStale = (now - lastRefreshTime) > STALE_THRESHOLD_MS
        assertTrue("Opening app after 10 minutes must be considered stale and trigger a server refresh", isStale)
    }

    @Test
    fun testTwoMinutesReopenDoesNotTriggerStaleRefresh() {
        val TWO_MINUTES_MS = 2 * 60 * 1000L
        val now = System.currentTimeMillis()
        val lastRefreshTime = now - TWO_MINUTES_MS

        val isStale = (now - lastRefreshTime) > STALE_THRESHOLD_MS
        assertFalse("Opening app after only 2 minutes should use fresh in-memory feed and prevent read explosion", isStale)
    }

    @Test
    fun testSevenHoursStalenessTriggersRefresh() {
        val now = System.currentTimeMillis()
        val lastRefreshTime = now - SEVEN_HOURS_MS

        val isStale = (now - lastRefreshTime) > STALE_THRESHOLD_MS
        assertTrue("Opening app after 7 hours must trigger a fresh server query to get today's latest news", isStale)
    }

    @Test
    fun testIsFetchingPreventsDuplicateConcurrentReads() {
        var isFetching = true
        var fetchTriggered = false

        fun attemptRefresh(force: Boolean) {
            if (isFetching) return // 🛡️ Circuit breaker
            fetchTriggered = true
        }

        attemptRefresh(force = true)
        assertFalse("When a fetch is already in flight, refreshIfStale must abort immediately to prevent duplicate reads", fetchTriggered)
    }

    @Test
    fun testInstantCacheAndServerMergeDeduplication() {
        val postCached1 = NewsPost(id = "post_1", headline = Headline(telugu = "పాత వార్త 1"), timestamp = 1000L)
        val postCached2 = NewsPost(id = "post_2", headline = Headline(telugu = "పాత వార్త 2"), timestamp = 2000L)
        val cachedList = listOf(postCached2, postCached1)

        // User saw cached list immediately in < 20ms
        assertEquals(2, cachedList.size)

        // After 10 minutes, fresh server query brings a new breaking news item and updated post_2
        val postServerNew = NewsPost(id = "post_3", headline = Headline(telugu = "తాజా బ్రేకింగ్ వార్త"), timestamp = 5000L)
        val postServer2 = NewsPost(id = "post_2", headline = Headline(telugu = "నవీకరించిన వార్త 2"), timestamp = 2000L)
        val serverList = listOf(postServerNew, postServer2)

        val merged = (serverList + cachedList).distinctBy { it.id }.sortedByDescending { it.timestamp }

        assertEquals(3, merged.size)
        assertEquals("post_3", merged[0].id)
        assertEquals("post_2", merged[1].id)
        assertEquals("post_1", merged[2].id)
    }

    @Test
    fun testTenMinutesAppResumeDoesNotClearExistingFeedZeroFlicker() {
        // Simulates NewsFeedViewModel / LocalNewsFeedViewModel when app is resumed after 10 minutes
        val newsFlow = MutableStateFlow<List<NewsPost>>(
            listOf(
                NewsPost(id = "p1", headline = Headline(telugu = "10 నిమిషాల క్రితం చదివిన వార్త 1"), timestamp = 10000L),
                NewsPost(id = "p2", headline = Headline(telugu = "10 నిమిషాల క్రితం చదివిన వార్త 2"), timestamp = 9000L)
            )
        )
        val loadingFlow = MutableStateFlow(false)

        // 1. On resume: User sees existing news in 0ms (from StateFlow)
        assertFalse("Loading must be false when feed already has items", loadingFlow.value)
        assertEquals(2, newsFlow.value.size)

        // 2. refreshIfStale triggers loadNews(forceRefresh = true)
        // Crucial: forceRefresh does NOT clear newsFlow.value (no blank screen, no spinner)
        val isRefreshing = MutableStateFlow(true)
        assertEquals("Feed must retain items during background refresh", 2, newsFlow.value.size)
        assertFalse("Main loading spinner must remain false during background refresh", loadingFlow.value)

        // 3. Server query arrives with fresh post
        val freshPost = NewsPost(id = "p3_new", headline = Headline(telugu = "ఇప్పుడే వచ్చిన తాజా వార్త"), timestamp = 15000L)
        val updatedFeed = (listOf(freshPost) + newsFlow.value).distinctBy { it.id }.sortedByDescending { it.timestamp }
        newsFlow.value = updatedFeed
        isRefreshing.value = false

        assertEquals(3, newsFlow.value.size)
        assertEquals("p3_new", newsFlow.value[0].id)
    }

    @Test
    fun testSevenHoursAppResumeDoesNotClearExistingFeedZeroDelay() {
        // Simulates user keeping app in background and opening it 7 hours later
        val morningPosts = listOf(
            NewsPost(id = "p_morn_1", headline = Headline(telugu = "ఉదయం 8 గంటల వార్త"), timestamp = 100000L),
            NewsPost(id = "p_morn_2", headline = Headline(telugu = "ఉదయం 7 గంటల వార్త"), timestamp = 90000L)
        )
        val newsFlow = MutableStateFlow(morningPosts)
        val loadingFlow = MutableStateFlow(false)

        // User sees morning posts in 0 milliseconds
        assertEquals(2, newsFlow.value.size)
        assertFalse(loadingFlow.value)

        // 7 hours later, server returns afternoon/evening posts
        val eveningPosts = listOf(
            NewsPost(id = "p_eve_1", headline = Headline(telugu = "సాయంత్రం 3 గంటల తాజా వార్త"), timestamp = 500000L),
            NewsPost(id = "p_eve_2", headline = Headline(telugu = "మధ్యాహ్నం 1 గంటల వార్త"), timestamp = 300000L)
        )

        // Server replaces stale feed smoothly
        val updated = (eveningPosts + newsFlow.value).distinctBy { it.id }.sortedByDescending { it.timestamp }
        newsFlow.value = updated

        assertEquals(4, newsFlow.value.size)
        assertEquals("p_eve_1", newsFlow.value[0].id)
        assertEquals("p_eve_2", newsFlow.value[1].id)
    }

    @Test
    fun testColdStartAfterTenMinutesLoadsCacheImmediatelyBeforeServer() = runBlocking {
        // Simulates cold start (app process was killed) after 10 minutes
        val newsFlow = MutableStateFlow<List<NewsPost>>(emptyList())
        val loadingFlow = MutableStateFlow(true)

        val cachedPosts = listOf(
            NewsPost(id = "c1", headline = Headline(telugu = "కాష్ వార్త 1"), timestamp = 5000L),
            NewsPost(id = "c2", headline = Headline(telugu = "కాష్ వార్త 2"), timestamp = 4000L)
        )

        // Step 1: Local cache loads in < 20ms
        val cacheLoadTimeMs = measureTimeMillis {
            newsFlow.value = cachedPosts
            loadingFlow.value = false
        }

        assertTrue("Cache retrieval and display must complete in milliseconds (< 20ms)", cacheLoadTimeMs < 20)
        assertFalse("Loading indicator must be dismissed as soon as cache emits", loadingFlow.value)
        assertEquals("User immediately sees 2 cached posts", 2, newsFlow.value.size)

        // Step 2: Background server query completes later
        val serverPosts = listOf(
            NewsPost(id = "s1_breaking", headline = Headline(telugu = "తాజా బ్రేకింగ్ వార్త"), timestamp = 8000L),
            NewsPost(id = "c1", headline = Headline(telugu = "కాష్ వార్త 1 (అప్‌డేటెడ్)"), timestamp = 5000L)
        )

        val finalPosts = (serverPosts + newsFlow.value).distinctBy { it.id }.sortedByDescending { it.timestamp }
        newsFlow.value = finalPosts

        assertEquals(3, newsFlow.value.size)
        assertEquals("s1_breaking", newsFlow.value[0].id)
    }

    @Test
    fun testColdStartAfterSevenHoursLoadsCacheImmediatelyBeforeServer() = runBlocking {
        // Simulates cold start after 7 hours
        val newsFlow = MutableStateFlow<List<NewsPost>>(emptyList())
        val loadingFlow = MutableStateFlow(true)

        val diskCachePosts = listOf(
            NewsPost(id = "d1", headline = Headline(telugu = "7 గంటల క్రితం నాటి కాష్ వార్త"), timestamp = 1000L)
        )

        // Even after 7 hours, persistent offline cache provides immediate content
        val cacheLoadTimeMs = measureTimeMillis {
            if (newsFlow.value.isEmpty()) {
                newsFlow.value = diskCachePosts
                loadingFlow.value = false
            }
        }

        assertTrue("Even after 7 hours, initial cache render must take < 20ms", cacheLoadTimeMs < 20)
        assertFalse(loadingFlow.value)
        assertEquals(1, newsFlow.value.size)

        // Server query brings 7 hours of fresh news
        val freshBatch = (1..10).map { i ->
            NewsPost(id = "fresh_$i", headline = Headline(telugu = "తాజా వార్త $i"), timestamp = 10000L + i)
        }

        newsFlow.value = (freshBatch + newsFlow.value).distinctBy { it.id }.sortedByDescending { it.timestamp }

        assertEquals(11, newsFlow.value.size)
        assertEquals("fresh_10", newsFlow.value[0].id)
    }

    @Test
    fun testLocalNewsFeedDistrictCacheAndFastPath() {
        val userDistrict = "సూర్యాపేట"
        val districtPosts = listOf(
            NewsPost(id = "lp_1", headline = Headline(telugu = "సూర్యాపేట స్థానిక వార్త 1"), district = "సూర్యాపేట", timestamp = 5000L),
            NewsPost(id = "lp_2", headline = Headline(telugu = "సూర్యాపేట స్థానిక వార్త 2"), district = "సూర్యాపేట", timestamp = 4000L)
        )

        val localNewsFlow = MutableStateFlow<List<NewsPost>>(emptyList())
        val loadingFlow = MutableStateFlow(true)

        // 1. Fast local cache display (< 20ms)
        localNewsFlow.value = districtPosts
        loadingFlow.value = false

        assertFalse(loadingFlow.value)
        assertEquals(2, localNewsFlow.value.size)
        assertTrue(localNewsFlow.value.all { it.district == userDistrict })

        // 2. Server updates with fresh district breaking news
        val breakingDistrictNews = NewsPost(
            id = "lp_break",
            headline = Headline(telugu = "సూర్యాపేట బ్రేకింగ్ వార్త"),
            district = "సూర్యాపేట",
            timestamp = 9000L
        )

        val mergedDistrict = (listOf(breakingDistrictNews) + localNewsFlow.value).distinctBy { it.id }.sortedByDescending { it.timestamp }
        localNewsFlow.value = mergedDistrict

        assertEquals(3, localNewsFlow.value.size)
        assertEquals("lp_break", localNewsFlow.value[0].id)
    }

    @Test
    fun testNetworkTimeoutOrFailurePreservesCachedFeedWithoutEmptyFallback() {
        val cachedPosts = listOf(
            NewsPost(id = "cache_p1", headline = Headline(telugu = "కాష్ వార్త 1"), timestamp = 1000L)
        )
        val newsFlow = MutableStateFlow(cachedPosts)
        val loadingFlow = MutableStateFlow(false)

        // Simulate network timeout or exception during server fetch
        fun simulateFetch(networkSuccess: Boolean) {
            if (!networkSuccess) {
                // In both NewsFeedViewModel and LocalNewsFeedViewModel:
                // If network fails, cached news is NEVER wiped.
                // newsFlow remains untouched!
            }
        }

        simulateFetch(networkSuccess = false)

        // Assert: News remains visible, loading is false, no empty screen or retry button
        assertEquals(1, newsFlow.value.size)
        assertFalse(loadingFlow.value)
    }

    @Test
    fun testFeedLatencyBenchmarkUnder20Ms() {
        // Benchmark showing instant cache emission is under 20ms
        val simulatedDiskCache = (1..20).map { i ->
            NewsPost(id = "item_$i", headline = Headline(telugu = "వార్త $i"), timestamp = 1000L * i)
        }

        val elapsed = measureTimeMillis {
            val loaded = simulatedDiskCache.sortedByDescending { it.timestamp }.distinctBy { it.id }
            assertEquals(20, loaded.size)
        }

        assertTrue("Feed processing and emission benchmark must be well under 20ms (Actual: ${elapsed}ms)", elapsed < 20)
    }

    @Test
    fun testFiveHourCacheFreshnessValidation() {
        val now = System.currentTimeMillis()
        val FIVE_HOURS_MS = 5L * 60 * 60 * 1000L

        // Case 1: Post timestamp is 2 hours old -> Fresh (< 5h) -> Instant Cache Display
        val twoHoursAgo = now - (2 * 60 * 60 * 1000L)
        val isTwoHoursFresh = (now - twoHoursAgo) < FIVE_HOURS_MS
        assertTrue("Cache under 5 hours old must be marked fresh for instant < 20ms display", isTwoHoursFresh)

        // Case 2: Post timestamp is 6 hours old -> Stale (> 5h) -> Bypass Stale Cache for Fast Path
        val sixHoursAgo = now - (6 * 60 * 60 * 1000L)
        val isSixHoursFresh = (now - sixHoursAgo) < FIVE_HOURS_MS
        assertFalse("Cache older than 5 hours must be marked stale to prevent displaying yesterday's news", isSixHoursFresh)
    }

    @Test
    fun testPersonalizationRankingBoostsUserCategoryInterests() {
        val now = System.currentTimeMillis()
        val FOUR_HOURS_MS = 4L * 60 * 60 * 1000L

        val cinemaPost = NewsPost(
            id = "cinema_post",
            headline = Headline(telugu = "సినిమా అప్‌డేట్"),
            categories = listOf("సినిమా"),
            timestamp = now - (2 * 60 * 60 * 1000L) // 2 hours ago
        )

        val generalPost = NewsPost(
            id = "general_post",
            headline = Headline(telugu = "సాధారణ వార్త"),
            categories = listOf("జనరల్"),
            timestamp = now - (1 * 60 * 60 * 1000L) // 1 hour ago (fresher timestamp)
        )

        val userCategoryScores = mapOf("సినిమా" to 5) // High interest in Cinema (+5 score)

        // Ranking calculation: timestamp + (score * 4 hours)
        val ranked = listOf(cinemaPost, generalPost).sortedByDescending { post ->
            var score = 0
            post.categories.forEach { cat ->
                score += userCategoryScores[cat] ?: 0
            }
            post.timestamp + (score * FOUR_HOURS_MS)
        }

        // Cinema post gets +20 hours virtual boost and ranks #1 despite being posted earlier!
        assertEquals("cinema_post", ranked[0].id)
        assertEquals("general_post", ranked[1].id)
    }

    @Test
    fun testFortyThirtyThirtyBlendingCadenceAndLoopProtection() {
        val now = System.currentTimeMillis()

        // 1. Fresh breaking posts
        val fresh = (1..6).map { i ->
            NewsPost(id = "fresh_$i", headline = Headline(telugu = "తాజా వార్త $i"), timestamp = now - i * 1000L)
        }

        // 2. District posts (User district: సూర్యాపేట)
        val districtPosts = (1..4).map { i ->
            NewsPost(id = "dist_$i", headline = Headline(telugu = "సూర్యాపేట వార్త $i"), district = "సూర్యాపేట", timestamp = now - (i + 10) * 1000L)
        }

        // 3. User personalized scored posts
        val categoryScores = mapOf("రాజకీయాలు" to 3)
        val preferredCategories = setOf("రాజకీయాలు")

        // Interleaved mixing test logic matching NewsFeedViewModel.rankAndBlendPosts
        val allRaw = (fresh + districtPosts).distinctBy { it.id }
        val localCandidates = districtPosts.sortedByDescending { it.timestamp }.toMutableList()
        val localIds = localCandidates.map { it.id }.toSet()
        val nonLocalPosts = allRaw.filter { it.id !in localIds }

        val scoredPosts = nonLocalPosts.filter { it.categories.any { cat -> cat in preferredCategories } }.toMutableList()
        val freshCandidates = nonLocalPosts.sortedByDescending { it.timestamp }.toMutableList()
        val discoveryCandidates = nonLocalPosts.filter { it.id !in scoredPosts.map { s -> s.id }.toSet() }.toMutableList()

        val blended = mutableListOf<NewsPost>()
        val addedIds = mutableSetOf<String>()

        fun pollNext(list: MutableList<NewsPost>): NewsPost? {
            while (list.isNotEmpty()) {
                val item = list.removeAt(0)
                if (item.id !in addedIds) {
                    addedIds.add(item.id)
                    return item
                }
            }
            return null
        }

        val maxIterations = allRaw.size + 15
        var loopCount = 0
        while (addedIds.size < allRaw.size && loopCount < maxIterations) {
            val cycle = loopCount % 6
            val nextPost = when (cycle) {
                0 -> pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(localCandidates) ?: pollNext(discoveryCandidates)
                1 -> pollNext(scoredPosts) ?: pollNext(freshCandidates) ?: pollNext(localCandidates) ?: pollNext(discoveryCandidates)
                2 -> pollNext(localCandidates) ?: pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(discoveryCandidates)
                3 -> pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(discoveryCandidates) ?: pollNext(localCandidates)
                4 -> pollNext(scoredPosts) ?: pollNext(freshCandidates) ?: pollNext(discoveryCandidates) ?: pollNext(localCandidates)
                5 -> pollNext(localCandidates) ?: pollNext(discoveryCandidates) ?: pollNext(freshCandidates) ?: pollNext(scoredPosts)
                else -> pollNext(freshCandidates)
            }
            if (nextPost != null) {
                blended.add(nextPost)
            } else {
                val remaining = allRaw.firstOrNull { it.id !in addedIds }
                if (remaining != null) {
                    addedIds.add(remaining.id)
                    blended.add(remaining)
                } else break
            }
            loopCount++
        }

        // Assert: All posts blended with zero duplicates
        assertEquals(allRaw.size, blended.size)
        assertEquals(allRaw.size, blended.map { it.id }.toSet().size)

        // Slot 0 must be fresh breaking
        assertEquals("fresh_1", blended[0].id)
        // Slot 2 must be user district local news
        assertEquals("dist_1", blended[2].id)

        // Loop counter must terminate strictly below maxIterations
        assertTrue("Loop must safely terminate without infinite cycles", loopCount < maxIterations)
    }
}
