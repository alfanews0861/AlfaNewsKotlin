package com.alfanews.telugu.models

import java.util.Date
import java.util.HashMap
import com.google.firebase.firestore.FieldValue

/**
 * పోస్ట్ యొక్క నిష్పత్తిని (Aspect Ratio) నిర్వచిస్తుంది.
 */
enum class PostFormat(val ratio: String) {
    VERTICAL("9:16"),
    HORIZONTAL("16:9")
}

/**
 * తెలుగు మరియు ఆంగ్ల భాషలలో వార్తల ముఖ్యాంశాలను (Headlines) కలిగి ఉంటుంది.
 */
data class Headline(
    val telugu: String = "",
    val english: String = ""
)

/**
 * తెలుగు మరియు ఆంగ్ల భాషలలో వార్తల కంటెంట్‌ను కలిగి ఉంటుంది.
 */
data class Content(
    val telugu: String = "",
    val english: String = ""
)

/**
 * వార్తను నివేదించిన రిపోర్టర్ వివరాలు.
 */
data class Reporter(
    val id: String = "",
    val name: String = ""
)

/**
 * మీడియా రకాలను (చిత్రం లేదా వీడియో) నిర్వచిస్తుంది.
 */
enum class MediaType {
    IMAGE, VIDEO
}

/**
 * వార్తలో ప్రస్తావించిన వ్యక్తులు, సంస్థలు మరియు ప్రాంతాల వివరాలు.
 */
data class Entities(
    val people: List<String> = emptyList(),
    val organizations: List<String> = emptyList(),
    val locations: List<String> = emptyList()
)

/**
 * ఒక వార్తా పోస్ట్ యొక్క పూర్తి వివరాలను కలిగి ఉన్న డేటా క్లాస్.
 */
data class NewsPost(
    val id: String = "",
    val headline: Headline = Headline(),
    val content: Content = Content(),
    val mediaUrl: String = "",
    val mediaType: MediaType = MediaType.IMAGE,
    val mediaUrls: List<String> = emptyList(),
    val mediaTypes: List<MediaType> = emptyList(),
    val youtubeUrl: String? = null,
    val postFormat: PostFormat = PostFormat.VERTICAL,
    val reporter: Reporter = Reporter(),
    val location: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    val categories: List<String> = emptyList(),
    val likes: Int = 0,
    val comments: Int = 0,
    val shares: Int = 0,
    val tags: List<String> = emptyList(),
    val entities: Entities = Entities(),
    val localAdUrl: String? = null,
    val localAdContact: String? = null,
    val originalUrl: String? = null,
    val affiliateUrl: String? = null,
    val verificationStatus: String = "UNVERIFIED",
    val verificationReason: String? = null,
    val type: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val approved: Boolean = false,
    val aiProcessed: Boolean = false,
    val isReporter: Boolean = false,
    val isGlobal: Boolean = false,
    val category: String? = null,
    val district: String? = null,
    val state: String? = null,

    // Survey & Poll fields
    val surveyQuestions: List<SurveyQuestion> = emptyList(),
    val isMultiPage: Boolean = false,
    val fakeVotesBase: Int = 11000,
    val surveyCreatedAt: Long = System.currentTimeMillis(),
    val votes: Map<String, Int> = emptyMap(),
    val realVotesCount: Int = 0
)

/**
 * సర్వే ఆప్షన్ వివరాలు.
 */
data class SurveyOption(
    val id: String = "",
    val text: String = "",
    val nextQuestionId: String? = null
)

/**
 * సర్వే ప్రశ్న వివరాలు.
 */
data class SurveyQuestion(
    val id: String = "",
    val questionText: String = "",
    val options: List<SurveyOption> = emptyList()
)

/**
 * వినియోగదారు సర్వే పోస్ట్ చేయగలరో లేదో సరిచూస్తుంది.
 */
fun User.canPostSurvey(): Boolean {
    if (this.role == UserRole.ADMIN) return true
    if (this.role == UserRole.REPORTER) {
        val goldOrAboveBadges = listOf("gold", "platinum", "diamond", "crown", "senior")
        return this.badges.any { badge ->
            val lower = badge.lowercase()
            goldOrAboveBadges.any { lower.contains(it) }
        }
    }
    return false
}

fun mapMapToNewsPost(id: String, data: Map<String, Any?>): NewsPost {
    val headlineMap = data["headline"] as? Map<*, *>
    val headline = Headline(
        telugu = headlineMap?.get("telugu")?.toString() ?: data["headline"]?.toString() ?: "",
        english = headlineMap?.get("english")?.toString() ?: ""
    )
    val contentMap = data["content"] as? Map<*, *>
    val content = Content(
        telugu = contentMap?.get("telugu")?.toString() ?: data["content"]?.toString() ?: "",
        english = contentMap?.get("english")?.toString() ?: ""
    )
    val mediaUrl = data["mediaUrl"]?.toString() ?: ""
    val mediaType = if (data["mediaType"]?.toString() == "VIDEO") MediaType.VIDEO else MediaType.IMAGE
    val youtubeUrl = data["youtubeUrl"]?.toString()
    val postFormat = if (data["postFormat"]?.toString() == "16:9") PostFormat.HORIZONTAL else PostFormat.VERTICAL
    
    val reporterMap = data["reporter"] as? Map<*, *>
    val reporter = Reporter(
        id = reporterMap?.get("id")?.toString() ?: "",
        name = reporterMap?.get("name")?.toString() ?: ""
    )
    val location = data["location"]?.toString() ?: ""
    
    val rawTimestamp = data["timestamp"]
    val postTimestamp = when {
        rawTimestamp == null -> System.currentTimeMillis()
        rawTimestamp is Number -> rawTimestamp.toLong()
        rawTimestamp::class.java.simpleName == "Timestamp" || rawTimestamp.javaClass.name.contains("Timestamp") -> {
            try {
                val toDateMethod = rawTimestamp.javaClass.getMethod("toDate")
                val date = toDateMethod.invoke(rawTimestamp) as java.util.Date
                date.time
            } catch (e: Exception) {
                System.currentTimeMillis()
            }
        }
        rawTimestamp is java.util.Date -> rawTimestamp.time
        else -> System.currentTimeMillis()
    }

    val type = data["type"]?.toString()
    val categories = (data["categories"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
    val likes = (data["likes"] as? Number)?.toInt() ?: 0
    val comments = (data["comments"] as? Number)?.toInt() ?: 0
    val shares = (data["shares"] as? Number)?.toInt() ?: 0
    val tags = (data["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
    val entitiesMap = data["entities"] as? Map<*, *>
    val entities = Entities(
        people = (entitiesMap?.get("people") as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
        organizations = (entitiesMap?.get("organizations") as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
        locations = (entitiesMap?.get("locations") as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
    )
    val localAdUrl = data["localAdUrl"]?.toString()
    val localAdContact = data["localAdContact"]?.toString()
    val originalUrl = data["originalUrl"]?.toString()
    val affiliateUrl = data["affiliateUrl"]?.toString()
    
    val verificationStatus = data["verificationStatus"]?.toString() ?: "UNVERIFIED"
    val verificationReason = data["verificationReason"]?.toString()
    
    val approved = data["approved"] as? Boolean ?: false
    val aiProcessed = data["aiProcessed"] as? Boolean ?: false
    val isGlobal = data["isGlobal"] as? Boolean ?: false
    val isReporter = data["isReporter"] as? Boolean ?: (data["processingType"]?.toString() == "REPORTER_SUBMISSION")
    
    // Parse survey fields
    val rawQuestions = data["surveyQuestions"] as? List<*>
    val surveyQuestions = rawQuestions?.mapNotNull { qObj ->
        val qMap = qObj as? Map<*, *> ?: return@mapNotNull null
        val qId = qMap["id"]?.toString() ?: ""
        val qText = qMap["questionText"]?.toString() ?: ""
        val rawOpts = qMap["options"] as? List<*>
        val optionsList = rawOpts?.mapNotNull { oObj ->
            val oMap = oObj as? Map<*, *> ?: return@mapNotNull null
            val oId = oMap["id"]?.toString() ?: ""
            val oText = oMap["text"]?.toString() ?: ""
            val oNext = oMap["nextQuestionId"]?.toString()
            SurveyOption(id = oId, text = oText, nextQuestionId = oNext)
        } ?: emptyList()
        SurveyQuestion(id = qId, questionText = qText, options = optionsList)
    } ?: emptyList()
    
    val isMultiPage = data["isMultiPage"] as? Boolean ?: false
    val fakeVotesBase = (data["fakeVotesBase"] as? Number)?.toInt() ?: 11000
    val surveyCreatedAt = when (val sca = data["surveyCreatedAt"]) {
        null -> postTimestamp
        is Number -> sca.toLong()
        else -> {
            if (sca::class.java.simpleName == "Timestamp" || sca.javaClass.name.contains("Timestamp")) {
                try {
                    val toDateMethod = sca.javaClass.getMethod("toDate")
                    val date = toDateMethod.invoke(sca) as java.util.Date
                    date.time
                } catch (e: Exception) {
                    postTimestamp
                }
            } else if (sca is java.util.Date) {
                sca.time
            } else {
                postTimestamp
            }
        }
    }
    
    val votes = java.util.HashMap<String, Int>()
    val votesRaw = data["votes"] as? Map<*, *>
    if (votesRaw != null) {
        val entries = votesRaw.entries
        for (entry in entries) {
            val k = entry.key?.toString() ?: ""
            val v = (entry.value as? Number)?.toInt() ?: 0
            votes.put(k, v)
        }
    }

    val realVotesCount = (data["realVotesCount"] as? Number)?.toInt() ?: 0
    val mediaUrls = (data["mediaUrls"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
    val mediaTypes = (data["mediaTypes"] as? List<*>)?.mapNotNull { typeStr ->
        if (typeStr?.toString() == "VIDEO") MediaType.VIDEO else MediaType.IMAGE
    } ?: emptyList()

    val district = data["district"]?.toString() ?: "State"
    val state = data["state"]?.toString()
    val category = data["category"]?.toString() ?: "General News"

    return NewsPost(
        id = id,
        headline = headline,
        content = content,
        mediaUrl = mediaUrl,
        mediaType = mediaType,
        youtubeUrl = youtubeUrl,
        postFormat = postFormat,
        reporter = reporter,
        location = location,
        timestamp = postTimestamp,
        categories = categories,
        likes = likes,
        comments = comments,
        shares = shares,
        tags = tags,
        entities = entities,
        localAdUrl = localAdUrl,
        localAdContact = localAdContact,
        originalUrl = originalUrl,
        affiliateUrl = affiliateUrl,
        verificationStatus = verificationStatus,
        verificationReason = verificationReason,
        type = type,
        approved = approved,
        aiProcessed = aiProcessed,
        isGlobal = isGlobal,
        isReporter = isReporter,
        surveyQuestions = surveyQuestions,
        isMultiPage = isMultiPage,
        fakeVotesBase = fakeVotesBase,
        surveyCreatedAt = surveyCreatedAt,
        votes = votes,
        realVotesCount = realVotesCount,
        mediaUrls = mediaUrls,
        mediaTypes = mediaTypes,
        district = district,
        state = state,
        category = category
    )
}
