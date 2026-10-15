package com.alfanews.telugu.views

import com.alfanews.telugu.models.*
import com.alfanews.telugu.utils.ManageNewsHelper
import com.alfanews.telugu.utils.ManagePostStatus
import org.junit.Assert.*
import org.junit.Test

/**
 * ManagePostsPageViewLogicTest
 * వార్తల నిర్వహణ (Manage News) లో విలేకరులందరి వార్తలు సక్రమంగా,
 * అన్ని పరిస్థితులలోనూ కనిపించడాన్ని ధృవీకరించే సమగ్ర యూనిట్ టెస్ట్‌లు.
 */
class ManagePostsPageViewLogicTest {

    private val sampleReporterId = "rep_tirupathi_101"
    private val sampleAuthUid = "auth_tirupathi_101"
    private val samplePhone = "9876543210"
    private val sampleReporterName = "దామెర్ల తిరుపతి"

    private val sampleReporterUser = User(
        id = sampleReporterId,
        name = sampleReporterName,
        phone = "+91$samplePhone",
        district = "సూర్యాపేట",
        assignedMandal = "చివ్వెంల",
        role = UserRole.REPORTER
    )

    @Test
    fun testReporterIdentificationAndMatching_ByOriginalReporterId() {
        val post = NewsPost(
            id = "post_orig_01",
            headline = Headline(telugu = "చివ్వెంల మండలంలో ఘనంగా దసరా వేడుకలు"),
            originalReporterId = sampleReporterId,
            timestamp = 10000L
        )

        val candidateIds = ManageNewsHelper.getCandidateIds(sampleReporterUser, sampleAuthUid)
        val matched = ManageNewsHelper.matchesReporter(post, candidateIds)

        assertTrue("originalReporterId ఆధారంగా విలేకరి వార్త ఖచ్చితంగా సరిపోలాలి", matched)
    }

    @Test
    fun testReporterIdentificationAndMatching_ByNestedReporterId() {
        val post = NewsPost(
            id = "post_rep_nested_02",
            headline = Headline(telugu = "సూర్యాపేట జిల్లా అభివృద్ధిపై కలెక్టర్ సమీక్ష"),
            reporter = Reporter(id = sampleReporterId, name = sampleReporterName),
            timestamp = 10000L
        )

        val candidateIds = ManageNewsHelper.getCandidateIds(sampleReporterUser, sampleAuthUid)
        val matched = ManageNewsHelper.matchesReporter(post, candidateIds)

        assertTrue("reporter.id ఆధారంగా విలేకరి వార్త ఖచ్చితంగా సరిపోలాలి", matched)
    }

    @Test
    fun testReporterIdentificationAndMatching_ByRootReporterId() {
        // Firestore నుండి వచ్చిన రా డాటాలో reporterId రూట్ ఫీల్డ్‌గా ఉంటే mapMapToNewsPost సరిగ్గా గుర్తిస్తుందా?
        val rawData = mapOf<String, Any?>(
            "headline" to mapOf("telugu" to "రూట్ లెవెల్ రిపోర్టర్ ఐడీతో వచ్చిన వార్త"),
            "reporterId" to sampleReporterId,
            "timestamp" to 12000L,
            "approved" to true
        )

        val mappedPost = mapMapToNewsPost("doc_root_01", rawData)
        val candidateIds = ManageNewsHelper.getCandidateIds(sampleReporterUser, sampleAuthUid)
        val matched = ManageNewsHelper.matchesReporter(mappedPost, candidateIds)

        assertEquals("mappedPost లో originalReporterId సరిగ్గా సెట్ కావాలి", sampleReporterId, mappedPost.originalReporterId)
        assertTrue("reporterId ఆధారంగా వచ్చిన వార్త Manage News లో మ్యాచ్ కావాలి", matched)
    }

    @Test
    fun testReporterIdentificationAndMatching_ByUserId() {
        // కేవలం userId ఉన్న పాత పోస్ట్‌లను కూడా mapMapToNewsPost రిపోర్టర్‌కు మ్యాప్ చేస్తుందా?
        val rawData = mapOf<String, Any?>(
            "headline" to mapOf("telugu" to "యూజర్ ఐడీతో స్టోర్ అయిన వార్త"),
            "userId" to sampleReporterId,
            "timestamp" to 15000L,
            "approved" to true
        )

        val mappedPost = mapMapToNewsPost("doc_user_01", rawData)
        val candidateIds = ManageNewsHelper.getCandidateIds(sampleReporterUser, sampleAuthUid)
        val matched = ManageNewsHelper.matchesReporter(mappedPost, candidateIds)

        assertEquals("userId నుండి originalReporterId లేదా reporter.id పాపులేట్ కావాలి", sampleReporterId, mappedPost.reporter.id)
        assertTrue("userId ఆధారంగా పోస్ట్ మ్యాచ్ కావాలి", matched)
    }

    @Test
    fun testCrossMandalNewsAttribution_ShowsToOriginalReporter() {
        // ⚠️ CRITICAL: విలేకరి తన స్వంత మండలం కాకుండా ఇతర మండలానికి వార్త పంపినప్పుడు,
        // పబ్లిక్ క్రెడిట్ "Alfa News Desk" గా ఉంటుంది, కానీ Manage News లో ఆ విలేకరికి కనిపించాలి!
        val crossMandalPost = NewsPost(
            id = "post_cross_mandal_99",
            headline = Headline(telugu = "కోదాడ లో భారీ వర్షపాతం - అప్రమత్తంగా ఉండాలి"),
            reporter = Reporter(id = sampleReporterId, name = "Alfa News Desk"),
            originalReporterId = sampleReporterId,
            timestamp = 20000L
        )

        val candidateIds = ManageNewsHelper.getCandidateIds(sampleReporterUser, sampleAuthUid)
        val matched = ManageNewsHelper.matchesReporter(crossMandalPost, candidateIds)

        assertEquals("క్రాస్ మండల పోస్ట్ పబ్లిక్ ఆథర్ Alfa News Desk ఉండాలి", "Alfa News Desk", crossMandalPost.reporter.name)
        assertTrue("క్రాస్ మండల పోస్ట్ అసలు రిపోర్టర్ Manage News లో తప్పనిసరిగా కనిపించాలి", matched)
    }

    @Test
    fun testReporterMatching_ByReporterNameFallback() {
        // UID మారినా లేదా సరిపోలకపోయినా, సరైన రిపోర్టర్ పేరుతో పోస్ట్‌లు సరిపోలాలి
        val post = NewsPost(
            id = "post_name_match",
            headline = Headline(telugu = "సూర్యాపేట వ్యవసాయ మార్కెట్‌లో నేటి ధరలు"),
            reporter = Reporter(id = "different_uid", name = sampleReporterName),
            timestamp = 11000L
        )

        val repName = ManageNewsHelper.getCandidateName(sampleReporterUser)
        val matched = ManageNewsHelper.matchesReporter(post, reporterIds = emptyList(), reporterName = repName)

        assertEquals(sampleReporterName, repName)
        assertTrue("పేరు ఆధారంగా రిపోర్టర్ పోస్ట్ సరిపోలాలి", matched)
    }

    @Test
    fun testGenericReporterNames_AreNeverUsedForNameMatching() {
        // Alfa News Desk, Admin, విలేకరి వంటి జెనెరిక్ పేర్లతో వేరే వారి వార్తలు రాకుండా నిరోధించాలి
        val adminUser = User(id = "adm_1", name = "Alfa News Desk", role = UserRole.ADMIN)
        val guestUser = User(id = "guest_1", name = "విలేకరి", role = UserRole.REPORTER)
        val citizenUser = User(id = "cit_1", name = "సిటిజెన్ పోస్ట్", role = UserRole.SUBSCRIBER)

        assertNull("Alfa News Desk పేరు ఫాల్‌బ్యాక్ క్వెరీలో వాడకూడదు", ManageNewsHelper.getCandidateName(adminUser))
        assertNull("విలేకరి అనే సాధారణ పదం ఫాల్‌బ్యాక్ క్వెరీలో వాడకూడదు", ManageNewsHelper.getCandidateName(guestUser))
        assertNull("సిటిజెన్ పోస్ట్ పేరు ఫాల్‌బ్యాక్ క్వెరీలో వాడకూడదు", ManageNewsHelper.getCandidateName(citizenUser))
    }

    @Test
    fun testActiveReporter_WithMoreThanTwentyPosts_ChronologicalSortingRetainsLatestPosts() {
        // ⚠️ CRITICAL: విలేకరి 40 కి పైగా వార్తలు రాసినప్పుడు,
        // క్రోనోలాజికల్ సార్టింగ్ ద్వారా తాజా వార్తలు (Newest Posts) అగ్రస్థానంలో ఉండాలి!
        val postsList = mutableListOf<NewsPost>()

        // 40 వార్తలను సృష్టిద్దాం (Doc IDs ఆల్ఫాబెటికల్ క్రమంలో టైమ్‌స్టాంప్‌కు విరుద్ధంగా ఉంటాయి)
        for (i in 1..40) {
            val fakeDocId = "doc_id_%03d".format(41 - i) // doc_id_040 to doc_id_001
            val timestamp = 1000L * i // 1000L (oldest) to 40000L (newest)
            postsList.add(
                NewsPost(
                    id = fakeDocId,
                    headline = Headline(telugu = "వార్త $i"),
                    originalReporterId = sampleReporterId,
                    timestamp = timestamp
                )
            )
        }

        val sortedAndLimited = ManageNewsHelper.sortAndLimitPosts(postsList, limit = 50)

        // మొత్తం 40 పోస్ట్‌లు ఉండాలి (10 దగ్గర కట్ కాకూడదు)
        assertEquals(40, sortedAndLimited.size)

        // అత్యంత తాజా వార్త (timestamp 40000L) ఇండెక్స్ 0 లో ఉండాలి
        assertEquals("అత్యంత తాజా వార్త మొదటి స్థానంలో ఉండాలి", 40000L, sortedAndLimited.first().timestamp)
        assertEquals("వార్త 40", sortedAndLimited.first().headline.telugu)

        // అత్యంత పాత వార్త (timestamp 1000L) ఆఖరి స్థానంలో ఉండాలి
        assertEquals("అత్యంత పాత వార్త ఆఖరి స్థానంలో ఉండాలి", 1000L, sortedAndLimited.last().timestamp)
    }

    @Test
    fun testStatusMapping_AllPostStatuses_CorrectlyIdentified() {
        // 1. LIVE / Approved
        val livePost = NewsPost(id = "p1", approved = true, status = "PUBLISHED")
        assertEquals(ManagePostStatus.LIVE, ManageNewsHelper.resolveStatus(livePost))

        // 2. REJECTED with rejection reason
        val rejectedPost1 = NewsPost(id = "p2", approved = false, status = "REJECTED", rejectionReason = "తప్పుడు సమాచారం")
        assertEquals(ManagePostStatus.REJECTED, ManageNewsHelper.resolveStatus(rejectedPost1))

        // 3. REJECTED via duplicate detection
        val duplicatePost = NewsPost(id = "p3", approved = false, isDuplicate = true)
        assertEquals(ManagePostStatus.REJECTED, ManageNewsHelper.resolveStatus(duplicatePost))

        // 4. FAILED with error
        val failedPost = NewsPost(id = "p4", approved = false, status = "FAILED", error = "వీడియో ప్రాసెసింగ్ లోపం")
        assertEquals(ManagePostStatus.FAILED, ManageNewsHelper.resolveStatus(failedPost))

        // 5. PROCESSING (AI / Video generation)
        val processingPost1 = NewsPost(id = "p5", approved = false, status = "REVIEWING_CONTENT")
        assertEquals(ManagePostStatus.PROCESSING, ManageNewsHelper.resolveStatus(processingPost1))

        val processingPost2 = NewsPost(id = "p6", approved = false, status = "PROCESSING_VIDEO")
        assertEquals(ManagePostStatus.PROCESSING, ManageNewsHelper.resolveStatus(processingPost2))

        // 6. PENDING
        val pendingPost = NewsPost(id = "p7", approved = false, status = "PENDING")
        assertEquals(ManagePostStatus.PENDING, ManageNewsHelper.resolveStatus(pendingPost))
    }

    @Test
    fun testCandidateIdsAndPhones_DeduplicationAndCleaning() {
        val userWithPhone = User(
            id = "user_abc",
            name = "రాము",
            phone = "+919876543210"
        )
        val authUid = "user_abc" // same as user.id
        val authPhone = "+919876543210" // same phone

        val candidateIds = ManageNewsHelper.getCandidateIds(userWithPhone, authUid)
        assertEquals("ఒకే ఐడీ ఉన్నప్పుడు డూప్లికేట్ కాకూడదు", listOf("user_abc"), candidateIds)

        val candidatePhones = ManageNewsHelper.getCandidatePhones(userWithPhone, authPhone)
        assertEquals("+91 తొలగించి శుభ్రమైన ఫోన్ నంబర్ రావాలి", listOf("9876543210"), candidatePhones)

        // Auth UID భిన్నంగా ఉన్న సందర్భం
        val diffAuthUid = "auth_different_uid"
        val candidateIdsDiff = ManageNewsHelper.getCandidateIds(userWithPhone, diffAuthUid)
        assertEquals("భిన్నమైన ఐడీలు రెండూ రావాలి", listOf("user_abc", "auth_different_uid"), candidateIdsDiff)
    }
}
