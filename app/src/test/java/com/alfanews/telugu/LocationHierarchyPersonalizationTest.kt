package com.alfanews.telugu

import com.alfanews.telugu.models.Content
import com.alfanews.telugu.models.Entities
import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.LocationHierarchyManager
import org.junit.Assert.*
import org.junit.Test

class LocationHierarchyPersonalizationTest {

    @Test
    fun testConstituencyLookupKarimnagar() {
        val district = "కరీంనగర్"
        
        // Test Huzurabad Constituency
        val huzurabadConst = LocationHierarchyManager.getConstituencyForMandal(district, "హుజూరాబాద్")
        assertEquals("హుజూరాబాద్", huzurabadConst)

        val jammikuntaConst = LocationHierarchyManager.getConstituencyForMandal(district, "జమ్మికుంట")
        assertEquals("హుజూరాబాద్", jammikuntaConst)

        val veenavankaConst = LocationHierarchyManager.getConstituencyForMandal(district, "వీణవంక")
        assertEquals("హుజూరాబాద్", veenavankaConst)

        // Test Choppadandi Constituency
        val choppadandiConst = LocationHierarchyManager.getConstituencyForMandal(district, "చొప్పదండి")
        assertEquals("చొప్పదండి", choppadandiConst)

        val gangadharaConst = LocationHierarchyManager.getConstituencyForMandal(district, "గంగాధర")
        assertEquals("చొప్పదండి", gangadharaConst)

        // Test Karimnagar Constituency
        val karimnagarConst = LocationHierarchyManager.getConstituencyForMandal(district, "కరీంనగర్")
        assertEquals("కరీంనగర్", karimnagarConst)
    }

    @Test
    fun testConstituencyLookupYadadri() {
        val district = "యాదాద్రి భువనగిరి"

        val bhongirConst = LocationHierarchyManager.getConstituencyForMandal(district, "భువనగిరి")
        assertEquals("భువనగిరి", bhongirConst)

        val valigondaConst = LocationHierarchyManager.getConstituencyForMandal(district, "వలిగొండ")
        assertEquals("భువనగిరి", valigondaConst)

        val alerConst = LocationHierarchyManager.getConstituencyForMandal(district, "ఆలేరు")
        assertEquals("ఆలేరు", alerConst)

        val yadagiriguttaConst = LocationHierarchyManager.getConstituencyForMandal(district, "యాదగిరిగుట్ట")
        assertEquals("ఆలేరు", yadagiriguttaConst)

        val mothkurConst = LocationHierarchyManager.getConstituencyForMandal(district, "మోత్కూరు")
        assertEquals("తుంగతుర్తి", mothkurConst)
    }

    @Test
    fun testConstituencyLookupKurnool() {
        val district = "కర్నూలు"

        val adoniConst = LocationHierarchyManager.getConstituencyForMandal(district, "ఆదోని")
        assertEquals("ఆదోని", adoniConst)

        val yemmiganurConst = LocationHierarchyManager.getConstituencyForMandal(district, "ఎమ్మిగనూరు")
        assertEquals("ఎమ్మిగనూరు", yemmiganurConst)

        val gonegandlaConst = LocationHierarchyManager.getConstituencyForMandal(district, "గోనెగండ్ల")
        assertEquals("ఎమ్మిగనూరు", gonegandlaConst)

        val mantralayamConst = LocationHierarchyManager.getConstituencyForMandal(district, "మంత్రాలయం")
        assertEquals("మంత్రాలయం", mantralayamConst)
    }

    @Test
    fun testMandalsForConstituency() {
        val mandals = LocationHierarchyManager.getMandalsForConstituency("కరీంనగర్", "హుజూరాబాద్")
        assertTrue(mandals.contains("హుజూరాబాద్"))
        assertTrue(mandals.contains("జమ్మికుంట"))
        assertTrue(mandals.contains("వీణవంక"))
    }

    @Test
    fun testExtractMandalFromPost() {
        val district = "కరీంనగర్"

        // Case 1: post.location has explicit mandal
        val post1 = NewsPost(
            id = "p1",
            location = "హుజూరాబాద్",
            district = district,
            headline = Headline(telugu = "రోడ్డు ప్రమాదం జరిగింది")
        )
        assertEquals("హుజూరాబాద్", LocationHierarchyManager.extractMandalFromPost(post1, district))

        // Case 2: post.entities.locations has mandal
        val post2 = NewsPost(
            id = "p2",
            location = "",
            district = district,
            entities = Entities(locations = listOf("జమ్మికుంట")),
            headline = Headline(telugu = "రైతులకు సాయం")
        )
        assertEquals("జమ్మికుంట", LocationHierarchyManager.extractMandalFromPost(post2, district))

        // Case 3: headline has mandal name
        val post3 = NewsPost(
            id = "p3",
            location = "",
            district = district,
            headline = Headline(telugu = "చొప్పదండి పరిధిలో భారీ వర్షం")
        )
        assertEquals("చొప్పదండి", LocationHierarchyManager.extractMandalFromPost(post3, district))
    }

    @Test
    fun testFindMatchingMandalFromGps() {
        val district = "కరీంనగర్"

        val match1 = LocationHierarchyManager.findMatchingMandal(district, "Huzurabad")
        assertEquals("హుజూరాబాద్", match1)

        val match2 = LocationHierarchyManager.findMatchingMandal(district, "Karimnagar Urban")
        assertEquals("కరీంనగర్", match2)

        val match3 = LocationHierarchyManager.findMatchingMandal(district, "గంగాధర")
        assertEquals("గంగాధర", match3)
    }

    @Test
    fun test3TierRankingSimulation() {
        val district = "కరీంనగర్"
        val primaryMandal = "హుజూరాబాద్" // In "హుజూరాబాద్" Constituency (includes హుజూరాబాద్, జమ్మికుంట, వీణవంక)
        val constituency = LocationHierarchyManager.getConstituencyForMandal(district, primaryMandal)
        val constituencyMandals = LocationHierarchyManager.getMandalsForConstituency(district, constituency)

        val now = System.currentTimeMillis()

        // Create sample posts
        val post1Mandal = NewsPost(id = "1", location = "హుజూరాబాద్", timestamp = now - 5000, district = district)
        val post2Mandal = NewsPost(id = "2", location = "హుజూరాబాద్", timestamp = now - 1000, district = district)
        val post3SameConst = NewsPost(id = "3", location = "జమ్మికుంట", timestamp = now - 2000, district = district)
        val post4SameConst = NewsPost(id = "4", location = "వీణవంక", timestamp = now - 3000, district = district)
        val post5OtherConst = NewsPost(id = "5", location = "చొప్పదండి", timestamp = now - 500, district = district)
        val post6OtherConst = NewsPost(id = "6", location = "మానాకొండూరు", timestamp = now - 4000, district = district)

        val rawPosts = listOf(post5OtherConst, post1Mandal, post6OtherConst, post3SameConst, post4SameConst, post2Mandal)

        // 3-Tier grouping
        val tier1 = mutableListOf<NewsPost>()
        val tier2 = mutableListOf<NewsPost>()
        val tier3 = mutableListOf<NewsPost>()

        for (post in rawPosts) {
            val mandal = LocationHierarchyManager.extractMandalFromPost(post, district)
            if (mandal == primaryMandal) {
                tier1.add(post)
            } else if (mandal != null && constituencyMandals.contains(mandal)) {
                tier2.add(post)
            } else {
                tier3.add(post)
            }
        }

        tier1.sortByDescending { it.timestamp }
        tier2.sortByDescending { it.timestamp }
        tier3.sortByDescending { it.timestamp }

        val ranked = tier1 + tier2 + tier3

        // Assertions:
        // Tier 1 (Huzurabad) should come first, ordered by timestamp
        assertEquals("2", ranked[0].id)
        assertEquals("1", ranked[1].id)

        // Tier 2 (Jammikunta, Veenavanka in Huzurabad constituency) should come next
        assertEquals("3", ranked[2].id)
        assertEquals("4", ranked[3].id)

        // Tier 3 (Other constituencies like Choppadandi, Manakondur) should come after
        assertEquals("5", ranked[4].id)
        assertEquals("6", ranked[5].id)
    }

    @Test
    fun testColdStartFallback() {
        val district = "కరీంనగర్"
        val primaryMandal: String? = null // Cold start / no history / no GPS

        val now = System.currentTimeMillis()
        val post1 = NewsPost(id = "1", location = "హుజూరాబాద్", timestamp = now - 5000, district = district)
        val post2 = NewsPost(id = "2", location = "చొప్పదండి", timestamp = now - 1000, district = district)
        val post3 = NewsPost(id = "3", location = "కరీంనగర్", timestamp = now - 3000, district = district)

        val rawPosts = listOf(post1, post2, post3)

        val ranked = if (primaryMandal == null) {
            rawPosts.sortedByDescending { it.timestamp }
        } else {
            rawPosts
        }

        // Pure timestamp DESC
        assertEquals("2", ranked[0].id)
        assertEquals("3", ranked[1].id)
        assertEquals("1", ranked[2].id)
    }
}
