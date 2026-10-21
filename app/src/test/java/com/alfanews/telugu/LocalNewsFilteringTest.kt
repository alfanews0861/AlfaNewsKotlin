package com.alfanews.telugu

import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.utils.Constants
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalNewsFilteringTest {

    private fun isNormalLocalNews(post: NewsPost): Boolean {
        if (post.type == "cartoon" || post.type == "greeting" || post.type == "history" || post.type == "survey") return false
        if (post.category.equals("కార్టూన్", ignoreCase = true) || post.categories.any { it.equals("కార్టూన్", ignoreCase = true) }) return false
        return true
    }

    private fun isStateMatch(post: NewsPost, targetDistrict: String?): Boolean {
        if (targetDistrict.isNullOrBlank()) return true
        val isTargetAp = Constants.isApDistrict(targetDistrict)
        
        // 1. పోస్ట్ లోని స్పష్టమైన జిల్లా ఉంటే, అది ప్రస్తుత జిల్లా యొక్క రాష్ట్రానికే చెంది ఉండాలి
        val postDist = post.district
        if (!postDist.isNullOrBlank() && postDist != "State" && postDist != "General" && postDist != "రాష్ట్రం") {
            val isPostAp = Constants.isApDistrict(postDist)
            if (isTargetAp != isPostAp) return false
        }
        
        // 2. పోస్ట్ యొక్క లొకేషన్ (ఉదా: "విశాఖపట్నం" vs తెలంగాణ జిల్లా)
        if (post.location.isNotBlank()) {
            val isLocAp = Constants.isApDistrict(post.location)
            val isLocTs = Constants.TS_DISTRICTS.any { it.equals(post.location, ignoreCase = true) } || post.location.contains("తెలంగాణ") || post.location.contains("హైదరాబాద్")
            if (isTargetAp && isLocTs) return false
            if (!isTargetAp && isLocAp) return false
        }
        
        // 3. పోస్ట్ యొక్క state ఫీల్డ్ తనిఖీ
        val postState = post.state?.trim()
        if (!postState.isNullOrBlank()) {
            val isPostStateAp = postState.equals("AP", ignoreCase = true) || postState.contains("Andhra", ignoreCase = true) || postState.contains("ఆంధ్ర")
            val isPostStateTs = postState.equals("TS", ignoreCase = true) || postState.equals("TG", ignoreCase = true) || postState.contains("Telangana", ignoreCase = true) || postState.contains("తెలంగాణ")
            if (isTargetAp && isPostStateTs) return false
            if (!isTargetAp && isPostStateAp) return false
        }
        
        return true
    }

    @Test
    fun testCartoonPostsAreFilteredOutOfLocalNewsFeed() {
        val cartoonPost1 = NewsPost(
            id = "c1",
            type = "cartoon",
            category = "కార్టూన్",
            headline = Headline(telugu = "తెలంగాణ కార్టూన్: నేటి వ్యంగ్యం"),
            district = "Telangana"
        )
        val cartoonPost2 = NewsPost(
            id = "c2",
            type = "news",
            category = "కార్టూన్",
            headline = Headline(telugu = "రాజకీయ కార్టూన్"),
            district = "Telangana"
        )
        val cartoonPost3 = NewsPost(
            id = "c3",
            type = "cartoon",
            categories = listOf("కార్టూన్"),
            headline = Headline(telugu = "పథకాలేమో గాల్లో దీపంలా ఉన్నాయి"),
            district = "యాదాద్రి భువనగిరి"
        )

        assertFalse(isNormalLocalNews(cartoonPost1))
        assertFalse(isNormalLocalNews(cartoonPost2))
        assertFalse(isNormalLocalNews(cartoonPost3))
    }

    @Test
    fun testSpecialPostsAreFilteredOutOfLocalNewsFeed() {
        val greetingPost = NewsPost(
            id = "g1",
            type = "greeting",
            headline = Headline(telugu = "శుభోదయం"),
            district = "యాదాద్రి భువనగిరి"
        )
        val historyPost = NewsPost(
            id = "h1",
            type = "history",
            headline = Headline(telugu = "నేటి చరిత్ర"),
            district = "యాదాద్రి భువనగిరి"
        )
        val surveyPost = NewsPost(
            id = "s1",
            type = "survey",
            headline = Headline(telugu = "ప్రజాభిప్రాయ సేకరణ"),
            district = "యాదాద్రి భువనగిరి"
        )

        assertFalse(isNormalLocalNews(greetingPost))
        assertFalse(isNormalLocalNews(historyPost))
        assertFalse(isNormalLocalNews(surveyPost))
    }

    @Test
    fun testCrossStatePostsAreFilteredOutOfLocalNewsFeed() {
        val targetDistrict = "యాదాద్రి భువనగిరి" // Telangana

        // Visakhapatnam post with district "State" and location "విశాఖపట్నం" (from user's screenshot 4)
        val visakhaPost = NewsPost(
            id = "v1",
            type = "news",
            headline = Headline(telugu = "దసరా రద్దీ వేళ పోటెత్తిన విశాఖ రైల్వే స్టేషన్"),
            district = "State",
            location = "విశాఖపట్నం",
            state = "AP"
        )

        // Another AP post with district "విశాఖపట్నం"
        val apDistrictPost = NewsPost(
            id = "v2",
            type = "news",
            headline = Headline(telugu = "విశాఖలో భారీ వర్షం"),
            district = "విశాఖపట్నం",
            location = "విశాఖపట్నం"
        )

        // Telangana post
        val bhuvanagiriPost = NewsPost(
            id = "b1",
            type = "news",
            headline = Headline(telugu = "భువనగిరిలో అభివృద్ధి పనులు ప్రారంభం"),
            district = "యాదాద్రి భువనగిరి",
            location = "భువనగిరి",
            state = "TS"
        )

        // Telangana state fallback post
        val tsStatePost = NewsPost(
            id = "t1",
            type = "news",
            headline = Headline(telugu = "తెలంగాణలో రైతులకు శుభవార్త"),
            district = "Telangana",
            location = "హైదరాబాద్",
            state = "TS"
        )

        assertFalse("AP Visakhapatnam post must NOT match Telangana district feed", isStateMatch(visakhaPost, targetDistrict))
        assertFalse("AP district post must NOT match Telangana district feed", isStateMatch(apDistrictPost, targetDistrict))
        assertTrue("Bhuvanagiri post must match Telangana district feed", isStateMatch(bhuvanagiriPost, targetDistrict))
        assertTrue("Telangana state post may match as state fallback", isStateMatch(tsStatePost, targetDistrict))
    }

    @Test
    fun testYadadriBhuvanagiriAliasesMatch() {
        val aliases = Constants.getDistrictAliases("యాదాద్రి భువనగిరి")
        assertTrue(aliases.contains("యాదాద్రి భువనగిరి"))
        assertTrue(aliases.contains("భువనగిరి"))
        assertTrue(aliases.contains("Yadadri"))
        assertTrue(aliases.contains("Bhongir"))
        assertTrue(aliases.contains("Yadadri Bhuvanagiri"))

        val englishAliases = Constants.getDistrictAliases("Yadadri Bhuvanagiri")
        assertTrue(englishAliases.contains("యాదాద్రి భువనగిరి"))
        assertTrue(englishAliases.contains("భువనగిరి"))

        assertTrue(Constants.isDistrictMatch("భువనగిరి", "యాదాద్రి భువనగిరి"))
        assertTrue(Constants.isDistrictMatch("యాదాద్రి భువనగిరి", "Bhongir"))
        assertTrue(Constants.isDistrictMatch("Yadadri", "యాదాద్రి భువనగిరి"))
    }
}
