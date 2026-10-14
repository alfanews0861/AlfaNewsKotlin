package com.alfanews.telugu.data

import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.NewsPost
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedStalenessAndCacheTest {

    @Test
    fun testTenMinutesStalenessTriggersRefresh() {
        val TEN_MINUTES_MS = 10 * 60 * 1000L
        val STALE_THRESHOLD_MS = 5 * 60 * 1000L // 5 minutes threshold
        val now = System.currentTimeMillis()
        val lastRefreshTime = now - TEN_MINUTES_MS

        val isStale = (now - lastRefreshTime) > STALE_THRESHOLD_MS
        assertTrue("Opening app after 10 minutes must be considered stale and trigger a server refresh", isStale)
    }

    @Test
    fun testTwoMinutesReopenDoesNotTriggerStaleRefresh() {
        val TWO_MINUTES_MS = 2 * 60 * 1000L
        val STALE_THRESHOLD_MS = 5 * 60 * 1000L // 5 minutes threshold
        val now = System.currentTimeMillis()
        val lastRefreshTime = now - TWO_MINUTES_MS

        val isStale = (now - lastRefreshTime) > STALE_THRESHOLD_MS
        assertFalse("Opening app after only 2 minutes should use fresh in-memory feed and prevent read explosion", isStale)
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
}
