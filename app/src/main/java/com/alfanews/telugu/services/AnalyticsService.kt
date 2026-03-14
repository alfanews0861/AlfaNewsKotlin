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

/**
 * అప్లికేషన్ యొక్క అనలిటిక్స్ మరియు వినియోగదారు ఆసక్తులను (Interests) ట్రాక్ చేసే సర్వీస్.
 */
object AnalyticsService {
    private var firebaseAnalytics: FirebaseAnalytics? = null
    private lateinit var appContext: Context
    private val scope = CoroutineScope(Dispatchers.IO)

    private val categoryScores = mutableMapOf<String, Int>()
    private val reporterScores = mutableMapOf<String, Int>()
    private val tagScores = mutableMapOf<String, Int>()
    private val peopleScores = mutableMapOf<String, Int>()
    private val organizationScores = mutableMapOf<String, Int>()
    private val locationScores = mutableMapOf<String, Int>()

    private const val PREFS_NAME = "analytics_prefs_v2"
    private const val KEY_CATEGORY_SCORES = "category_scores"
    private const val KEY_REPORTER_SCORES = "reporter_scores"
    private const val KEY_TAG_SCORES = "tag_scores"
    private const val KEY_PEOPLE_SCORES = "people_scores"
    private const val KEY_ORGANIZATION_SCORES = "organization_scores"
    private const val KEY_LOCATION_SCORES = "location_scores"

    private var currentUserId: String? = null

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
        // ఒకవేళ లోకల్ స్కోర్లు ఖాళీగా ఉంటే, డేటాబేస్ నుండి తీసుకోవాలి
        if (categoryScores.isEmpty() && reporterScores.isEmpty() && tagScores.isEmpty() && peopleScores.isEmpty() && organizationScores.isEmpty() && locationScores.isEmpty()) {
            categoryScores.putAll(user.categoryScores)
            reporterScores.putAll(user.reporterScores)
            tagScores.putAll(user.tagScores)
            peopleScores.putAll(user.peopleScores)
            organizationScores.putAll(user.organizationScores)
            locationScores.putAll(user.locationScores)
            saveToPrefs()
        } else {
            // లేదంటే రెండింటినీ కలపాలి (Merge)
            user.categoryScores.forEach { (k, v) -> categoryScores[k] = (categoryScores[k] ?: 0) + v }
            user.reporterScores.forEach { (k, v) -> reporterScores[k] = (reporterScores[k] ?: 0) + v }
            user.tagScores.forEach { (k, v) -> tagScores[k] = (tagScores[k] ?: 0) + v }
            user.peopleScores.forEach { (k, v) -> peopleScores[k] = (peopleScores[k] ?: 0) + v }
            user.organizationScores.forEach { (k, v) -> organizationScores[k] = (organizationScores[k] ?: 0) + v }
            user.locationScores.forEach { (k, v) -> locationScores[k] = (locationScores[k] ?: 0) + v }
            
            saveToPrefs()
            syncToFirestore()
        }
    }

    fun onUserLogout() {
        currentUserId = null
        categoryScores.clear()
        reporterScores.clear()
        tagScores.clear()
        peopleScores.clear()
        organizationScores.clear()
        locationScores.clear()
        saveToPrefs()
    }

    private fun syncToFirestore() {
        val uid = currentUserId ?: return
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
        categories.forEach { category ->
            if (category.isNotBlank()) {
                categoryScores[category] = (categoryScores[category] ?: 0) + weight
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

    fun getUserPreferredCategories(): List<String> {
        return categoryScores.entries
            .sortedByDescending { it.value }
            .take(15)
            .map { it.key }
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
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(KEY_CATEGORY_SCORES, Gson().toJson(categoryScores))
            putString(KEY_REPORTER_SCORES, Gson().toJson(reporterScores))
            putString(KEY_TAG_SCORES, Gson().toJson(tagScores))
            putString(KEY_PEOPLE_SCORES, Gson().toJson(peopleScores))
            putString(KEY_ORGANIZATION_SCORES, Gson().toJson(organizationScores))
            putString(KEY_LOCATION_SCORES, Gson().toJson(locationScores))
            apply()
        }
    }

    private fun loadFromPrefs() {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val gson = Gson()
        
        fun loadMap(key: String, targetMap: MutableMap<String, Int>) {
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
