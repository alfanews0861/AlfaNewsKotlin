package com.alfanews.telugu

import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.utils.NewsFeedBlender
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NewsFeedBlendingTest {

    private val now = 1_760_000_000_000L
    private val min = 60_000L
    private val hr = 60 * min

    private fun post(
        id: String,
        categories: List<String> = listOf("General"),
        category: String = categories.first(),
        district: String = "General",
        timestamp: Long = now,
        qualityScore: Double = 6.0
    ): NewsPost = NewsPost(
        id = id,
        headline = Headline(telugu = "వార్త $id", english = "News $id"),
        categories = categories,
        category = category,
        district = district,
        timestamp = timestamp,
        qualityScore = qualityScore,
        approved = true
    )

    @Test
    fun testScraperBurstDefeatedAndFastPath3AnchoredWithUserInterestBlending() {
        // Exact user-reported scenario: 6 Sports + 5 National scraped consecutively at top of DB
        val scrapedSports = (1..6).map { i ->
            post(id = "sports_$i", categories = listOf("క్రీడలు"), timestamp = now - i * min)
        }
        val scrapedNational = (1..5).map { i ->
            post(id = "national_$i", categories = listOf("జాతీయం"), timestamp = now - (6 + i) * min)
        }

        // User's preferred categories (Cinema + Technology) & Local District (గుంటూరు)
        val cinemaPosts = (1..5).map { i ->
            post(id = "cinema_$i", categories = listOf("Cinema"), category = "వినోదం", timestamp = now - (1 * hr) - i * 10 * min)
        }
        val techPosts = (1..4).map { i ->
            post(id = "tech_$i", categories = listOf("టెక్నాలజీ"), timestamp = now - (1 * hr) - i * 15 * min)
        }
        val localPosts = (1..6).map { i ->
            // District post without literal "జిల్లా వార్త" tag
            post(id = "local_$i", categories = listOf("రాజకీయం"), district = "గుంటూరు", timestamp = now - (45 * min) - i * 15 * min)
        }
        val otherDiscovery = listOf(
            post(id = "biz_1", categories = listOf("వ్యాపారం"), timestamp = now - 2 * hr),
            post(id = "health_1", categories = listOf("ఆరోగ్యం"), timestamp = now - 2 * hr - 5 * min),
            post(id = "crime_1", categories = listOf("క్రైమ్"), timestamp = now - 2 * hr - 10 * min),
            post(id = "politics_1", categories = listOf("రాజకీయం"), timestamp = now - 2 * hr - 15 * min)
        )

        val userDistrict = "గుంటూరు"
        val profile = NewsFeedBlender.buildInterestProfile(mapOf("సినిమా" to 18, "టెక్నాలజీ" to 14))

        val userInterestScorer: (NewsPost) -> Double = { p ->
            NewsFeedBlender.extractCanonicalTopics(p).sumOf { topic ->
                val v = profile.canonicalCategoryScores[topic] ?: 0.0
                if (v > 0.0) kotlin.math.ln(1.0 + v) * 14.0 else 0.0
            }
        }
        val relevanceScorer: (NewsPost) -> Double = { p ->
            userInterestScorer(p) + (p.qualityScore - 5.0) * 3.5
        }

        val fastCandidates = (scrapedSports + scrapedNational).take(10)
        val fastTop3 = NewsFeedBlender.pickFastPathTop3(
            candidates = fastCandidates,
            userDistrict = userDistrict,
            relevanceScorer = relevanceScorer,
            count = 3
        )
        assertEquals(3, fastTop3.size)
        assertNotEquals(
            NewsFeedBlender.getPostCategoryTag(fastTop3[0], userDistrict),
            NewsFeedBlender.getPostCategoryTag(fastTop3[1], userDistrict)
        )

        val allNormal = scrapedSports + scrapedNational + cinemaPosts + techPosts + localPosts + otherDiscovery
        val blended = NewsFeedBlender.blendNormalNews(
            normalNews = allNormal,
            fastPathAnchors = fastTop3,
            userDistrict = userDistrict,
            interestProfile = profile,
            relevanceScorer = relevanceScorer,
            userInterestScorer = userInterestScorer,
            nowMs = now
        )

        // 1. Fast Path 3 strictly anchored at [0, 1, 2]
        assertEquals(fastTop3.map { it.id }, blended.take(3).map { it.id })

        // 2. Blended slots [3..12] are NOT hijacked by Sports/National scraper burst
        val windowCats = blended.subList(3, 13).map { NewsFeedBlender.getPostCategoryTag(it, userDistrict) }
        val sportsOrNat = windowCats.count { it == "sports" || it == "national" }
        assertTrue("Expected <= 2 sports/national in [3..12], got $sportsOrNat ($windowCats)", sportsOrNat <= 2)

        // 3. User interest categories (cinema + technology) are strongly represented
        val interestCount = windowCats.count { it == "cinema" || it == "technology" }
        assertTrue("Expected >= 3 user interest posts in [3..12], got $interestCount ($windowCats)", interestCount >= 3)

        // 4. Local district posts are cleanly mixed into [3..12]
        val localCount = windowCats.count { it == "local_district" }
        assertTrue("Expected >= 2 local district posts in [3..12], got $localCount ($windowCats)", localCount >= 2)

        // 5. No back-to-back duplicate categories across [2..12]
        for (i in 3 until 13) {
            val prevCat = NewsFeedBlender.getPostCategoryTag(blended[i - 1], userDistrict)
            val currCat = NewsFeedBlender.getPostCategoryTag(blended[i], userDistrict)
            assertNotEquals("Back-to-back duplicate '$currCat' at index $i", prevCat, currCat)
        }

        // 6. Zero duplicate IDs
        assertEquals(blended.size, blended.map { it.id }.toSet().size)
    }

    @Test
    fun testBilingualFirestoreCategoryExpansionRespectsLimit() {
        val expanded = NewsFeedBlender.expandCategoriesForFirestoreQuery(
            listOf("సినిమా", "Technology", "క్రీడలు", "Politics"),
            maxLimit = 10
        )
        assertTrue(expanded.size <= 10)
        assertTrue(expanded.contains("సినిమా"))
        assertTrue(expanded.contains("Cinema"))
        assertTrue(expanded.contains("టెక్నాలజీ"))
        assertTrue(expanded.contains("Technology"))
    }
}
