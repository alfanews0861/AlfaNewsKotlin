package com.alfanews.telugu.services

import android.content.Context
import android.os.Bundle
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap
import java.util.HashMap

/**
 * అప్లికేషన్ యొక్క అనలిటిక్స్ మరియు వినియోగదారు ఆసక్తులను (Interests) ట్రాక్ చేసే సర్వీస్.
 */
object AnalyticsService {
    private var firebaseAnalytics: FirebaseAnalytics? = null
    private lateinit var appContext: Context
    private val scope = CoroutineScope(Dispatchers.IO)

    private val categoryScores = ConcurrentHashMap<String, Int>()
    private val reporterScores = ConcurrentHashMap<String, Int>()
    private val tagScores = ConcurrentHashMap<String, Int>()
    private val peopleScores = ConcurrentHashMap<String, Int>()
    private val organizationScores = ConcurrentHashMap<String, Int>()
    private val locationScores = ConcurrentHashMap<String, Int>()

    // ✅ Pending Long Views (Batching)
    private val pendingLongViews = ConcurrentHashMap<String, Int>()

    // ✅ Throttle: disk write max once per 30s, Firestore sync max once per 60s
    private var lastSaveToPrefsTime = 0L
    private var lastFirestoreSyncTime = 0L
    private var lastLongViewSyncTime = 0L
    private const val PREFS_THROTTLE_MS = 30_000L
    private const val FIRESTORE_THROTTLE_MS = 60_000L
    private const val LONG_VIEW_SYNC_MS = 300_000L // 5 minutes

    private const val PREFS_NAME = "analytics_prefs_v2"
    private const val KEY_CATEGORY_SCORES = "category_scores"
    private const val KEY_REPORTER_SCORES = "reporter_scores"
    private const val KEY_TAG_SCORES = "tag_scores"
    private const val KEY_PEOPLE_SCORES = "people_scores"
    private const val KEY_ORGANIZATION_SCORES = "organization_scores"
    private const val KEY_LOCATION_SCORES = "location_scores"

    private var currentUserId: String? = null
    private var cachedPreferredCategories: List<String>? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
        firebaseAnalytics = FirebaseAnalytics.getInstance(appContext)
        loadFromPrefs()
    }

    /**
     * యూజర్ లాగిన్ అయినప్పుడు వారి పాత ఆసక్తులను డేటాబేస్ నుండి లోడ్ చేస్తుంది.
     */
    fun onUserLogin(user: User) {
        currentUserId = user.id
        cachedPreferredCategories = null
        // ✅ FIX (Bug 2): పాత కోడ్ local + DB scores కలిపేది (double counting).
        // ఇప్పుడు maxOf(local, db) వాడుతున్నాం — same scores రెట్టింపు కావు.
        if (categoryScores.isEmpty() && reporterScores.isEmpty() && tagScores.isEmpty()
            && peopleScores.isEmpty() && organizationScores.isEmpty() && locationScores.isEmpty()) {
            // లోకల్ స్కోర్లు ఖాళీగా ఉంటే డేటాబేస్ నుండి తీసుకోవాలి
            categoryScores.putAll(user.categoryScores)
            reporterScores.putAll(user.reporterScores)
            tagScores.putAll(user.tagScores)
            peopleScores.putAll(user.peopleScores)
            organizationScores.putAll(user.organizationScores)
            locationScores.putAll(user.locationScores)
            saveToPrefs()
        } else {
            // లోకల్ డేటా ఉంటే: maxOf(local, db) — double count నివారించడం
            user.categoryScores.forEach { (k, v) -> categoryScores[k] = maxOf(categoryScores[k] ?: 0, v) }
            user.reporterScores.forEach { (k, v) -> reporterScores[k] = maxOf(reporterScores[k] ?: 0, v) }
            user.tagScores.forEach { (k, v) -> tagScores[k] = maxOf(tagScores[k] ?: 0, v) }
            user.peopleScores.forEach { (k, v) -> peopleScores[k] = maxOf(peopleScores[k] ?: 0, v) }
            user.organizationScores.forEach { (k, v) -> organizationScores[k] = maxOf(organizationScores[k] ?: 0, v) }
            user.locationScores.forEach { (k, v) -> locationScores[k] = maxOf(locationScores[k] ?: 0, v) }
            saveToPrefs()
            syncToFirestore()
        }
    }

    fun onUserLogout() {
        syncPendingLongViews() // logout అయ్యే ముందు వ్యూస్‌ని సింక్ చేయడం
        currentUserId = null
        cachedPreferredCategories = null
        categoryScores.clear()
        reporterScores.clear()
        tagScores.clear()
        peopleScores.clear()
        organizationScores.clear()
        locationScores.clear()
        saveToPrefs()
    }

    private fun syncToFirestore() {
        syncPendingLongViews() // రెగ్యులర్ సింక్ సమయంలో కూడా పిలవడం
        val uid = currentUserId ?: return
        val now = System.currentTimeMillis()
        if (now - lastFirestoreSyncTime < FIRESTORE_THROTTLE_MS) return // throttled
        lastFirestoreSyncTime = now
        scope.launch {
            try {
                FirebaseService.db.collection("users").document(uid).update(
                    mapOf(
                        "categoryScores" to categoryScores,
                        "reporterScores" to reporterScores,
                        "tagScores" to tagScores,
                        "peopleScores" to peopleScores,
                        "organizationScores" to organizationScores,
                        "locationScores" to locationScores
                    )
                )
            } catch (e: Exception) { }
        }
    }

    fun logAnalyticsEvent(eventName: String, params: Bundle? = null) {
        firebaseAnalytics?.logEvent(eventName, params)
    }

    fun logCategoryViews(categories: List<String>, weight: Int = 1) {
        if (categories.isEmpty()) return
        cachedPreferredCategories = null
        categories.forEach { category ->
            if (category.isNotBlank()) {
                categoryScores[category] = (categoryScores[category] ?: 0) + weight
            }
        }
        saveToPrefs()
        syncToFirestore()
    }

    /**
     * ✅ NEW: Optimized version to log multiple posts' categories at once
     * Reduces disk writes and Firestore sync overhead
     */
    fun logBulkCategoryViews(allCategories: List<List<String>>, weight: Int = 1) {
        if (allCategories.isEmpty()) return
        cachedPreferredCategories = null
        
        allCategories.forEach { categories ->
            categories.forEach { category ->
                if (category.isNotBlank()) {
                    categoryScores[category] = (categoryScores[category] ?: 0) + weight
                }
            }
        }

        saveToPrefs()
        syncToFirestore()
    }

    fun logReporterView(reporterId: String, weight: Int = 1) {
        if (reporterId.isBlank()) return
        reporterScores[reporterId] = (reporterScores[reporterId] ?: 0) + weight
        saveToPrefs()
        syncToFirestore()
    }
    
    fun logNewsScreenView(postId: String, title: String, categories: List<String>) {
        val bundle = Bundle().apply {
            putString(FirebaseAnalytics.Param.ITEM_ID, postId)
            putString(FirebaseAnalytics.Param.ITEM_NAME, title)
            putString("categories", categories.joinToString(","))
        }
        firebaseAnalytics?.logEvent("view_news_item", bundle)
    }

    fun logNewsEngagement(postId: String, title: String) {
        val bundle = Bundle().apply {
            putString(FirebaseAnalytics.Param.ITEM_ID, postId)
            putString(FirebaseAnalytics.Param.ITEM_NAME, title)
        }
        firebaseAnalytics?.logEvent("news_engagement_10s", bundle)
    }

    fun logPostEngagement(post: NewsPost, weight: Int = 1) {
        if (post.categories.isNotEmpty()) cachedPreferredCategories = null
        post.categories.forEach { category ->
            if (category.isNotBlank()) categoryScores[category] = (categoryScores[category] ?: 0) + weight
        }
        if (post.reporter.id.isNotBlank()) {
            reporterScores[post.reporter.id] = (reporterScores[post.reporter.id] ?: 0) + weight
        }
        post.tags.forEach { tag ->
            if (tag.isNotBlank()) tagScores[tag] = (tagScores[tag] ?: 0) + weight
        }
        post.entities.people.forEach { person ->
            if (person.isNotBlank()) peopleScores[person] = (peopleScores[person] ?: 0) + weight
        }
        post.entities.organizations.forEach { org ->
            if (org.isNotBlank()) organizationScores[org] = (organizationScores[org] ?: 0) + weight
        }
        post.entities.locations.forEach { loc ->
            if (loc.isNotBlank()) locationScores[loc] = (locationScores[loc] ?: 0) + weight
        }
        
        saveToPrefs()
        syncToFirestore()
    }

    fun logNegativeSignal(post: NewsPost) {
        if (post.categories.isNotEmpty()) cachedPreferredCategories = null
        post.categories.forEach { category ->
            val current = categoryScores[category] ?: 0
            if (current > -20) categoryScores[category] = current - 1
        }
        if (post.reporter.id.isNotBlank()) {
            val current = reporterScores[post.reporter.id] ?: 0
            if (current > -20) reporterScores[post.reporter.id] = current - 1
        }
        post.tags.forEach { tag ->
            val current = tagScores[tag] ?: 0
            if (current > -20) tagScores[tag] = current - 1
        }
        post.entities.people.forEach { person ->
            val current = peopleScores[person] ?: 0
            if (current > -20) peopleScores[person] = current - 1
        }
        post.entities.organizations.forEach { org ->
            val current = organizationScores[org] ?: 0
            if (current > -20) organizationScores[org] = current - 1
        }
        post.entities.locations.forEach { loc ->
            val current = locationScores[loc] ?: 0
            if (current > -20) locationScores[loc] = current - 1
        }
        
        saveToPrefs()
        syncToFirestore()
        logAnalyticsEvent("negative_signal")
    }

    fun logFullRead(post: NewsPost) {
        logPostEngagement(post, weight = 2)
        logAnalyticsEvent("full_read_bonus")
    }

    /**
     * యూజర్ వార్తను 4 సెకన్ల కంటే ఎక్కువ సేపు చదివితే దీన్ని పిలుస్తాం.
     * బిల్లింగ్ తగ్గించడానికి ఇప్పుడు ఇది వ్యూస్‌ను బ్యాచ్‌లుగా పంపుతుంది.
     */
    fun logLongView(postId: String) {
        if (postId.isBlank()) return
        
        // 1. లోకల్ బఫర్‌లో యాడ్ చేయడం
        pendingLongViews[postId] = (pendingLongViews[postId] ?: 0) + 1
        
        // 2. ఒకవేళ 5 నిమిషాలు దాటితే సింక్ చేయడం
        val now = System.currentTimeMillis()
        if (now - lastLongViewSyncTime > LONG_VIEW_SYNC_MS) {
            syncPendingLongViews()
        }
    }

    /**
     * బఫర్‌లో ఉన్న వ్యూస్‌ను ఫైర్‌బేస్‌కు పంపి క్లియర్ చేస్తుంది.
     */
    fun syncPendingLongViews() {
        if (pendingLongViews.isEmpty()) return
        
        val now = System.currentTimeMillis()
        lastLongViewSyncTime = now
        
        // స్నాప్‌షాట్ తీసుకుని క్లియర్ చేయడం (కొత్త వ్యూస్ మిస్ కాకుండా)
        val snapshot = HashMap(pendingLongViews)
        pendingLongViews.clear()
        
        scope.launch {
            snapshot.forEach { (postId, count) ->
                try {
                    FirebaseService.db.collection("news").document(postId)
                        .update("longViews", com.google.firebase.firestore.FieldValue.increment(count.toLong()))
                } catch (e: Exception) {
                    try {
                        FirebaseService.db.collection("news").document(postId)
                            .set(mapOf("longViews" to count), com.google.firebase.firestore.SetOptions.merge())
                    } catch (e2: Exception) {}
                }
            }
        }
    }

    /**
     * నోటిఫికేషన్ పర్మిషన్ స్టేటస్ ని లాగ్ చేస్తుంది.
     * దీనివల్ల ఎంతమంది వద్దన్నారో మనం రిపోర్ట్ చూడవచ్చు.
     */
    fun logNotificationPermissionStatus(granted: Boolean) {
        val bundle = android.os.Bundle().apply {
            putString("status", if (granted) "granted" else "denied")
        }
        logAnalyticsEvent("notif_perm_status", bundle)
    }

    fun getUserPreferredCategories(): List<String> {
        return cachedPreferredCategories ?: synchronized(categoryScores) {
            cachedPreferredCategories ?: if (categoryScores.isEmpty()) emptyList<String>() else {
                categoryScores.entries
                    .sortedByDescending { it.value }
                    .take(15)
                    .map { it.key }
                    .also { cachedPreferredCategories = it }
            }
        }
    }

    /**
     * ✅ NEW (Bug 4): Hyderabad users కోసం — TS vs AP engagement ratio calculate చేస్తుంది.
     * TS లేదా AP district/state related categories engagement track చేసి:
     * - "Telangana"  → user ఎక్కువగా TS వార్తలు చూస్తే
     * - "Andhra Pradesh" → user ఎక్కువగా AP వార్తలు చూస్తే
     * - "BOTH"       → ratio 60/40 కంటే తక్కువ (balanced) అయితే
     *
     * Threshold: 60% engagement ఒక రాష్ట్రంలో ఉంటే దాన్ని prefer చేస్తాం.
     */
    fun getStateEngagementRatio(): String {
        val tsKeywords = setOf(
            "తెలంగాణ", "Telangana", "TS", "తెలంగాణ వార్తలు", "Telangana News",
            "Telangana State", "హైదరాబాద్"
        )
        val apKeywords = setOf(
            "ఆంధ్రప్రదేశ్", "Andhra Pradesh", "AP", "ఆంధ్ర వార్తలు", "AP News",
            "AndhraPradesh", "Andhra"
        )

        var tsScore = 0
        var apScore = 0

        // Category scores లో TS/AP keywords వెతకడం
        categoryScores.forEach { (cat, score) ->
            when {
                tsKeywords.any { cat.contains(it, ignoreCase = true) } -> tsScore += score
                apKeywords.any { cat.contains(it, ignoreCase = true) } -> apScore += score
            }
        }

        // Location scores లో TS/AP keywords వెతకడం
        locationScores.forEach { (loc, score) ->
            when {
                tsKeywords.any { loc.contains(it, ignoreCase = true) } -> tsScore += score
                apKeywords.any { loc.contains(it, ignoreCase = true) } -> apScore += score
            }
        }

        val total = tsScore + apScore
        if (total == 0) return "BOTH" // engagement data లేకుంటే రెండూ చూపించు

        val tsRatio = tsScore.toDouble() / total
        val apRatio = apScore.toDouble() / total

        return when {
            tsRatio >= 0.60 -> "Telangana"      // 60%+ TS engagement
            apRatio >= 0.60 -> "Andhra Pradesh" // 60%+ AP engagement
            else            -> "BOTH"           // Balanced — రెండూ చూపించు
        }
    }

    /**
     * ఒక వార్తా పోస్ట్ యొక్క యూజర్ ఆసక్తిని (Relevance Score) లెక్కిస్తుంది.
     */
    fun calculateRelevanceScore(post: NewsPost): Double {
        var score = 0.0

        // 1. కేటగిరీల ఆధారంగా స్కోర్
        post.categories.forEach { cat ->
            score += (categoryScores[cat] ?: 0) * 1.0
        }

        // 2. రిపోర్టర్ ఆధారంగా స్కోర్
        if (post.reporter.id.isNotBlank()) {
            score += (reporterScores[post.reporter.id] ?: 0) * 1.5
        }

        // 3. కీవర్డ్స్ (Tags) ఆధారంగా స్కోర్
        post.tags.forEach { tag ->
            score += (tagScores[tag] ?: 0) * 2.0
        }

        // 4. వ్యక్తులు (People) ఆధారంగా స్కోర్
        post.entities.people.forEach { person ->
            score += (peopleScores[person] ?: 0) * 2.5
        }

        // 5. సంస్థలు (Organizations) ఆధారంగా స్కోర్
        post.entities.organizations.forEach { org ->
            score += (organizationScores[org] ?: 0) * 2.0
        }

        // 6. ప్రాంతం (Location) ఆధారంగా స్కోర్
        post.entities.locations.forEach { loc ->
            score += (locationScores[loc] ?: 0) * 1.2
        }

        // తాజా వార్తలకు ప్రాధాన్యత (Recency Decay)
        val hoursOld = (System.currentTimeMillis() - post.timestamp) / (1000.0 * 60 * 60)
        val recencyMultiplier = Math.exp(-hoursOld / 48.0) // 48 గంటల తర్వాత ప్రాధాన్యత తగ్గుతుంది

        return score * recencyMultiplier
    }

    private fun saveToPrefs() {
        val now = System.currentTimeMillis()
        if (now - lastSaveToPrefsTime < PREFS_THROTTLE_MS) return // throttled
        lastSaveToPrefsTime = now
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        // Use local copies for JSON serialization to prevent ConcurrentModificationException 
        // if the maps are updated while Gson is iterating over them.
        val categoryCopy = HashMap(categoryScores)
        val reporterCopy = HashMap(reporterScores)
        val tagCopy = HashMap(tagScores)
        val peopleCopy = HashMap(peopleScores)
        val organizationCopy = HashMap(organizationScores)
        val locationCopy = HashMap(locationScores)

        val editor = prefs.edit()
        editor.putString(KEY_CATEGORY_SCORES, Gson().toJson(categoryCopy))
        editor.putString(KEY_REPORTER_SCORES, Gson().toJson(reporterCopy))
        editor.putString(KEY_TAG_SCORES, Gson().toJson(tagCopy))
        editor.putString(KEY_PEOPLE_SCORES, Gson().toJson(peopleCopy))
        editor.putString(KEY_ORGANIZATION_SCORES, Gson().toJson(organizationCopy))
        editor.putString(KEY_LOCATION_SCORES, Gson().toJson(locationCopy))
        editor.apply()
    }

    private fun loadFromPrefs() {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val gson = Gson()
        
        fun loadMap(key: String, targetMap: ConcurrentHashMap<String, Int>) {
            try {
                val json = prefs.getString(key, null)
                if (json != null) {
                    val type = object : TypeToken<MutableMap<String, Int>>() {}.type
                    val savedMap: MutableMap<String, Int> = gson.fromJson(json, type)
                    targetMap.putAll(savedMap)
                }
            } catch (e: Exception) { }
        }

        loadMap(KEY_CATEGORY_SCORES, categoryScores)
        loadMap(KEY_REPORTER_SCORES, reporterScores)
        loadMap(KEY_TAG_SCORES, tagScores)
        loadMap(KEY_PEOPLE_SCORES, peopleScores)
        loadMap(KEY_ORGANIZATION_SCORES, organizationScores)
        loadMap(KEY_LOCATION_SCORES, locationScores)
    }
}
