package com.alfanews.telugu.utils

import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User

enum class ManagePostStatus {
    LIVE,
    PENDING,
    PROCESSING,
    REJECTED,
    FAILED
}

/**
 * ManageNewsHelper
 * వార్తల నిర్వహణ (Manage News) స్క్రీన్ కోసం రిపోర్టర్ల గుర్తింపు, పోస్ట్‌ల సరిపోలిక మరియు సార్టింగ్ లాజిక్.
 */
object ManageNewsHelper {

    val GENERIC_REPORTER_NAMES = setOf(
        "Admin", "User", "Guest", "Alfa News Desk", "AlfaNews Admin",
        "విలేకరి", "సిటిజెన్ పోస్ట్", "అజ్ఞాత పౌరుడు"
    )

    /**
     * రిపోర్టర్ యొక్క అన్ని అభ్యర్థిత ఐడీలను (User ID, Auth UID) సంగ్రహిస్తుంది.
     */
    fun getCandidateIds(user: User?, authUid: String?): List<String> {
        val ids = mutableListOf<String>()
        user?.id?.takeIf { it.isNotBlank() }?.let { ids.add(it.trim()) }
        authUid?.takeIf { it.isNotBlank() }?.let { ids.add(it.trim()) }
        return ids.distinct()
    }

    /**
     * రిపోర్టర్ యొక్క ఫోన్ నంబర్లను (+91 లేకుండా శుభ్రపరిచి) సంగ్రహిస్తుంది.
     */
    fun getCandidatePhones(user: User?, authPhone: String?): List<String> {
        val phones = mutableListOf<String>()
        val p1 = user?.phone?.replace("+91", "")?.trim()
        val p2 = authPhone?.replace("+91", "")?.trim()
        if (!p1.isNullOrBlank()) phones.add(p1)
        if (!p2.isNullOrBlank()) phones.add(p2)
        return phones.distinct()
    }

    /**
     * రిపోర్టర్ యొక్క సరైన పేరును సంగ్రహిస్తుంది (జెనెరిక్ పేర్లను మినహాయించి).
     */
    fun getCandidateName(user: User?): String? {
        val name = user?.name?.trim() ?: return null
        if (name.isBlank() || GENERIC_REPORTER_NAMES.contains(name)) return null
        return name
    }

    /**
     * ఒక నిర్దిష్ట పోస్ట్ ఇచ్చిన రిపోర్టర్‌కు చెందినదా కాదా అని ధృవీకరిస్తుంది.
     * cross-mandal posts (Alfa News Desk పేరుతో ఉన్నా), originalReporterId ద్వారా ఖచ్చితంగా సరిపోలుతుంది.
     */
    fun matchesReporter(
        post: NewsPost,
        reporterIds: List<String>,
        phones: List<String> = emptyList(),
        reporterName: String? = null
    ): Boolean {
        // 1. ID Matching: originalReporterId, reporter.id
        for (id in reporterIds) {
            if (id.isBlank()) continue
            if (post.originalReporterId == id) return true
            if (post.reporter.id == id) return true
        }

        // 2. Name Matching (fallback when reporter name is specific)
        if (!reporterName.isNullOrBlank() && post.reporter.name.equals(reporterName, ignoreCase = true)) {
            return true
        }

        return false
    }

    /**
     * పోస్ట్‌లను టైమ్‌స్టాంప్ ఆధారంగా అవరోహణ క్రమంలో (తాజా వార్తలు పైన) అమర్చుతుంది.
     */
    fun sortAndLimitPosts(posts: Collection<NewsPost>, limit: Int = 50): List<NewsPost> {
        return posts.distinctBy { it.id }
            .sortedByDescending { it.timestamp }
            .take(limit)
    }

    /**
     * పోస్ట్ యొక్క తాజా పబ్లిషింగ్ స్థితిని గుర్తిస్తుంది.
     */
    fun resolveStatus(post: NewsPost): ManagePostStatus {
        val statusUpper = post.status?.uppercase() ?: ""
        val isRejected = statusUpper == "REJECTED" || !post.rejectionReason.isNullOrBlank() || post.isDuplicate
        val isFailed = statusUpper == "FAILED" || !post.error.isNullOrBlank()
        val isPublished = post.approved || statusUpper == "PUBLISHED"
        val isProcessing = statusUpper == "REVIEWING_CONTENT" || statusUpper == "PROCESSING_VIDEO" || statusUpper == "PROCESSING_VIDEO_START"

        return when {
            isRejected -> ManagePostStatus.REJECTED
            isFailed -> ManagePostStatus.FAILED
            isPublished -> ManagePostStatus.LIVE
            isProcessing -> ManagePostStatus.PROCESSING
            else -> ManagePostStatus.PENDING
        }
    }
}
