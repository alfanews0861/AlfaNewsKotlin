package com.alfanews.telugu

import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.Reporter
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class LocalNewsChronologicalSortingTest {

    @Test
    fun testLocalNewsChronologicalOrder_DoesNotPinOldReporterNewsToTop() {
        val reporterId = "reporter_venkanna_001"
        val venkannaUser = User(
            id = reporterId,
            name = "అముదాల వెంకన్న",
            phone = "+919876543210",
            district = "సూర్యాపేట",
            role = UserRole.REPORTER
        )

        // 7th Date old post authored by Venkanna
        val post7thDate = NewsPost(
            id = "post_7th",
            headline = Headline(telugu = "7వ తేదీ వార్త - వెంకన్న"),
            district = "సూర్యాపేట",
            timestamp = 1000L,
            reporter = Reporter(id = reporterId, name = "అముదాల వెంకన్న"),
            originalReporterId = reporterId
        )

        // 8th Date post by other reporter
        val post8thDate = NewsPost(
            id = "post_8th",
            headline = Headline(telugu = "8వ తేదీ వార్త"),
            district = "సూర్యాపేట",
            timestamp = 2000L,
            reporter = Reporter(id = "other_rep", name = "ఇతర విలేకరి")
        )

        // 9th Date post by desk
        val post9thDate = NewsPost(
            id = "post_9th",
            headline = Headline(telugu = "9వ తేదీ వార్త"),
            district = "సూర్యాపేట",
            timestamp = 3000L,
            reporter = Reporter(id = "desk_01", name = "ఆల్ఫా న్యూస్ డెస్క్")
        )

        // 10th Date (Today's) fresh post
        val post10thDateToday = NewsPost(
            id = "post_10th",
            headline = Headline(telugu = "10వ తేదీ తాజా వార్త"),
            district = "సూర్యాపేట",
            timestamp = 4000L,
            reporter = Reporter(id = "desk_01", name = "ఆల్ఫా న్యూస్ డెస్క్")
        )

        val rawList = listOf(post7thDate, post8thDate, post9thDate, post10thDateToday)

        // Applying the refactored strict chronological sorting:
        val sortedList = rawList.sortedByDescending { it.timestamp }.distinctBy { it.id }

        // Assert that the latest post (10th date) is strictly at index 0
        assertEquals("post_10th", sortedList[0].id)
        assertEquals("post_9th", sortedList[1].id)
        assertEquals("post_8th", sortedList[2].id)
        // Assert that Venkanna's 7th date old post is NOT at the top
        assertNotEquals("post_7th", sortedList[0].id)
        assertEquals("post_7th", sortedList[3].id)
    }

    @Test
    fun testReporterStandardUidMatching() {
        val standardReporterUid = "reporter_venkanna_001"

        val post1 = NewsPost(
            id = "p1",
            originalReporterId = standardReporterUid,
            timestamp = 5000L
        )

        val post2 = NewsPost(
            id = "p2",
            reporter = Reporter(id = standardReporterUid),
            timestamp = 6000L
        )

        val otherReporterPost = NewsPost(
            id = "p3",
            originalReporterId = "other_reporter_999",
            reporter = Reporter(id = "other_reporter_999"),
            timestamp = 7000L
        )

        val allPosts = listOf(post1, post2, otherReporterPost)

        // Matching only by standard reporter UID:
        val myPosts = allPosts.filter { post ->
            post.originalReporterId == standardReporterUid || post.reporter.id == standardReporterUid
        }

        assertEquals(2, myPosts.size)
        assertEquals(true, myPosts.any { it.id == "p1" })
        assertEquals(true, myPosts.any { it.id == "p2" })
        assertEquals(false, myPosts.any { it.id == "p3" })
    }

    @Test
    fun testStandardReporterManagePosts_LoadsFreshNewsInDescendingOrder() {
        val standardReporterUid = "reporter_ravi_456"

        val oldPost = NewsPost(
            id = "post_old",
            headline = Headline(telugu = "గత వారం వార్త"),
            timestamp = 1700000000000L,
            originalReporterId = standardReporterUid,
            reporter = Reporter(id = standardReporterUid)
        )

        val freshPostToday = NewsPost(
            id = "post_fresh_today",
            headline = Headline(telugu = "ఈ రోజు తాజా వార్త"),
            timestamp = 1700086400000L, // Latest timestamp
            originalReporterId = standardReporterUid,
            reporter = Reporter(id = standardReporterUid)
        )

        val otherReporterPost = NewsPost(
            id = "post_other",
            headline = Headline(telugu = "వేరే రిపోర్టర్ వార్త"),
            timestamp = 1700090000000L,
            originalReporterId = "other_rep_999",
            reporter = Reporter(id = "other_rep_999")
        )

        val rawIncomingList = listOf(oldPost, freshPostToday, otherReporterPost)

        // 🛡️ Filter strictly by standard reporter UID
        val reporterPosts = rawIncomingList.filter { 
            it.originalReporterId == standardReporterUid || it.reporter.id == standardReporterUid
        }

        // 🚀 Sort descending by timestamp (తాజా వార్తలు మొదట)
        val sortedPosts = reporterPosts.sortedByDescending { it.timestamp }

        // Assertions:
        assertEquals(2, sortedPosts.size)
        // Verify fresh post is at index 0 (First)
        assertEquals("post_fresh_today", sortedPosts[0].id)
        assertEquals(1700086400000L, sortedPosts[0].timestamp)
        // Verify old post is after fresh post
        assertEquals("post_old", sortedPosts[1].id)
        // Verify other reporter post is excluded
        assertEquals(false, sortedPosts.any { it.id == "post_other" })
    }
}
