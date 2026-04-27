package com.alfanews.telugu.models

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
 * 
 * @property id వార్త యొక్క ప్రత్యేక ID.
 * @property headline వార్త ముఖ్యాంశాలు.
 * @property content వార్త కంటెంట్.
 * @property mediaUrl మీడియా ఫైల్ URL.
 * @property mediaType మీడియా రకం (IMAGE/VIDEO).
 * @property youtubeUrl యూట్యూబ్ వీడియో URL (ఉంటే).
 * @property postFormat పోస్ట్ ఫార్మాట్ (VERTICAL/HORIZONTAL).
 * @property reporter రిపోర్టర్ వివరాలు.
 * @property location వార్త జరిగిన ప్రాంతం.
 * @property timestamp వార్త పోస్ట్ చేయబడిన సమయం.
 * @property categories వార్త ఏ వర్గాలకు చెందుతుంది.
 * @property likes లైక్‌ల సంఖ్య.
 * @property comments కామెంట్‌ల సంఖ్య.
 * @property shares షేర్ల సంఖ్య.
 * @property tags వార్తకు సంబంధించిన కీవర్డ్స్ మరియు హాష్టగ్స్.
 * @property entities వార్తలో ప్రస్తావించిన వ్యక్తులు, సంస్థలు మరియు ప్రాంతాలు.
 * @property localAdUrl లోకల్ అడ్వర్టైజ్‌మెంట్ URL.
 * @property localAdContact అడ్వర్టైజ్‌మెంట్ కాంటాక్ట్ నంబర్.
 * @property originalUrl అసలు వార్త యొక్క లింక్ (ఉంటే).
 * @property verificationStatus వార్త ధృవీకరణ స్థితి (GENUINE, FAKE, etc.).
 * @property verificationReason ధృవీకరణకు గల కారణం.
 * @property type పోస్ట్ యొక్క రకం ('news', 'greeting', 'history', 'cartoon').
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
    val verificationStatus: String = "UNVERIFIED",
    val verificationReason: String? = null,
    val type: String? = null, // ADDED: To store 'news', 'greeting', 'history', 'cartoon'

    // పాత వెర్షన్ల కోసం కేటాయించబడిన ఫీల్డ్స్ (Deprecated)
    val category: String? = null,
    val district: String? = null,
    val state: String? = null
)
