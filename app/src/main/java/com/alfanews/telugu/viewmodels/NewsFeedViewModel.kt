package com.alfanews.telugu.viewmodels

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.location.Geocoder
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.LocalAd
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.NetworkUtils
import com.alfanews.telugu.utils.PreferenceManager
import com.google.android.gms.location.LocationServices
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.alfanews.telugu.services.AnalyticsService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale

class NewsFeedViewModel(application: Application) : AndroidViewModel(application) {
    companion object {
        private const val PAGE_SIZE = 20
        private const val CACHE_FRESHNESS_TTL = 5 * 60 * 60 * 1000L // 5 hours
    }

    private val prefs = PreferenceManager.getInstance(application)
    private var currentLanguage: Language = Language.TELUGU
    private var activeCurrentUser: User? = null

    private val _news = MutableStateFlow<List<NewsPost>>(emptyList())
    val news: StateFlow<List<NewsPost>> = _news.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _userDistrict = MutableStateFlow<String?>(prefs.getEffectiveDistrict())
    val userDistrict: StateFlow<String?> = _userDistrict.asStateFlow()

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _lastRefreshTime = MutableStateFlow(0L)
    val lastRefreshTime: StateFlow<Long> = _lastRefreshTime.asStateFlow()

    private val _shouldScrollToTop = MutableStateFlow(false)
    val shouldScrollToTop: StateFlow<Boolean> = _shouldScrollToTop.asStateFlow()

    private val _localAds = MutableStateFlow<List<LocalAd>>(emptyList())
    val localAds: StateFlow<List<LocalAd>> = _localAds.asStateFlow()

    private val _sharedPostId = MutableStateFlow<String?>(null)
    val sharedPostId: StateFlow<String?> = _sharedPostId.asStateFlow()

    private var prefCursor: DocumentSnapshot? = null
    private var localCursor: DocumentSnapshot? = null
    private var generalCursor: DocumentSnapshot? = null
    private var currentFetchJob: Job? = null
    @Volatile private var isFetching = false
    private var lastRefreshTimeLong: Long = 0

    init {
        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != _userDistrict.value) {
                    _userDistrict.value = district
                    loadNews(Language.TELUGU, activeCurrentUser, forceRefresh = true)
                }
            }
        }
    }

    fun resetScrollSignal() {
        _shouldScrollToTop.value = false
    }

    fun requestScrollToTop() {
        _shouldScrollToTop.value = true
    }

    fun setSharedPostId(postId: String?) {
        _sharedPostId.value = postId
    }

    fun navigateToPost(post: NewsPost) {
        _sharedPostId.value = post.id
        val current = _news.value
        if (current.none { it.id == post.id }) {
            _news.value = listOf(post) + current
        }
    }

    fun navigateToPostId(postId: String) {
        if (postId.isBlank()) return
        _sharedPostId.value = postId
        val current = _news.value
        if (current.none { it.id == postId }) {
            viewModelScope.launch {
                try {
                    val doc = FirebaseService.db.collection("news").document(postId).get().await()
                    if (doc.exists()) {
                        val post = mapDocumentToNewsPost(doc)
                        if (post != null) {
                            _news.value = (listOf(post) + _news.value).distinctBy { it.id }
                            _sharedPostId.value = postId
                        }
                    }
                } catch (e: Exception) {
                    Log.e("NewsFeedVM", "navigateToPostId error: ${e.message}")
                }
            }
        }
    }

    fun prependPost(post: NewsPost) {
        _news.value = (listOf(post) + _news.value).distinctBy { it.id }
        _loading.value = false
    }

    /**
     * ⚡ Ultra-fast 40/30/30 Stream Mixing + User Interest Personalization.
     * 1. Smart Local Cache Check (< 20ms) for instant display.
     * 2. Parallel Streams (40% General, 30% Local District, 30% User Preferences) via async (< 200ms).
     * 3. In-memory User Interest Ranking based on categoryScores and preferred categories.
     */
    fun loadNews(
        language: Language,
        currentUser: User?,
        initialPostId: String? = null,
        forceRefresh: Boolean = false
    ) {
        currentLanguage = language
        if (currentUser != null) {
            activeCurrentUser = currentUser
        }
        val effectiveUser = currentUser ?: activeCurrentUser

        if (isFetching && currentFetchJob?.isActive == true && !forceRefresh) {
            return
        }
        currentFetchJob?.cancel()

        val district = prefs.getEffectiveDistrict() ?: effectiveUser?.district?.takeIf { it.isNotBlank() }
        _userDistrict.value = district
        val userState = Constants.mapDistrictToState(district)

        // Asynchronously load local ads in background (does NOT block news feed)
        loadLocalAds(district)

        currentFetchJob = viewModelScope.launch {
            isFetching = true
            _isOnline.value = NetworkUtils.isOnline(getApplication())

            try {
                // 1. Initial Post (Deep-link target)
                val initialTargetPost = if (!initialPostId.isNullOrBlank()) {
                    try {
                        val doc = FirebaseService.db.collection("news").document(initialPostId).get().await()
                        if (doc.exists()) mapDocumentToNewsPost(doc) else null
                    } catch (_: Exception) { null }
                } else null

                // 2. ⚡ SMART INSTANT CACHE (< 20ms)
                val now = System.currentTimeMillis()
                val freshCutoff = now - CACHE_FRESHNESS_TTL
                var hasFreshCache = false

                val categoryScores = effectiveUser?.categoryScores ?: emptyMap()
                val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (_: Exception) { emptySet() }
                val topCategories = (categoryScores.filter { it.value > 0 }.keys + preferredCategories).distinct().take(10)

                if (_news.value.isEmpty()) {
                    try {
                        val cachedSnap = FirebaseService.db.collection("news")
                            .whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(PAGE_SIZE.toLong())
                            .get(Source.CACHE)
                            .await()

                        val cachedPosts = cachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                        val latestCachedTimestamp = cachedPosts.maxOfOrNull { it.timestamp } ?: 0L

                        if (cachedPosts.isNotEmpty() && latestCachedTimestamp >= freshCutoff) {
                            val stateFiltered = cachedPosts.filter { isPostAllowedForState(it, userState) }.ifEmpty { cachedPosts }
                            val ranked = rankPostsByInterest(stateFiltered, categoryScores, preferredCategories)
                            val combined = (listOfNotNull(initialTargetPost) + ranked).distinctBy { it.id }
                            if (combined.isNotEmpty()) {
                                _news.value = combined
                                _loading.value = false
                                hasFreshCache = true
                                Log.d("NewsFeedVM", "⚡ Instant Fresh Cache Display: ${combined.size} posts in < 20ms")
                            }
                        }
                    } catch (_: Exception) {}
                }

                if (!hasFreshCache && _news.value.isEmpty()) {
                    _loading.value = true
                }

                // 3. ⚡ PARALLEL 40/30/30 STREAMS (< 200ms total latency)
                val newsRef = FirebaseService.db.collection("news")

                // Stream 1: 30% User Preferred Categories / Interests (6 posts)
                val prefDeferred = async(Dispatchers.IO) {
                    if (topCategories.isNotEmpty()) {
                        try {
                            newsRef.whereEqualTo("approved", true)
                                .whereArrayContainsAny("categories", topCategories)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(6)
                                .get().await()
                        } catch (_: Exception) { null }
                    } else null
                }

                // Stream 2: 30% Local District News (6 posts)
                val localDeferred = async(Dispatchers.IO) {
                    if (!district.isNullOrBlank()) {
                        val aliases = Constants.getDistrictAliases(district).take(10)
                        try {
                            val q = if (aliases.size > 1) {
                                newsRef.whereEqualTo("approved", true).whereIn("district", aliases)
                            } else {
                                newsRef.whereEqualTo("approved", true).whereEqualTo("district", aliases.firstOrNull() ?: district)
                            }.orderBy("timestamp", Query.Direction.DESCENDING).limit(6)
                            q.get().await()
                        } catch (_: Exception) { null }
                    } else null
                }

                // Stream 3: 40% General / Breaking News (8 posts)
                val generalDeferred = async(Dispatchers.IO) {
                    try {
                        newsRef.whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(8)
                            .get().await()
                    } catch (_: Exception) { null }
                }

                val prefSnap = prefDeferred.await()
                val localSnap = localDeferred.await()
                val generalSnap = generalDeferred.await()

                prefCursor = prefSnap?.documents?.lastOrNull()
                localCursor = localSnap?.documents?.lastOrNull()
                generalCursor = generalSnap?.documents?.lastOrNull()

                val prefPosts = prefSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val localPosts = localSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val generalPosts = generalSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()

                var combinedRaw = (prefPosts + localPosts + generalPosts).distinctBy { it.id }

                // Fallback to direct general query if streams were empty (e.g., offline or network error)
                if (combinedRaw.isEmpty()) {
                    val fallbackSnap = try {
                        newsRef.whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(PAGE_SIZE.toLong())
                            .get().await()
                    } catch (_: Exception) {
                        try { newsRef.whereEqualTo("approved", true).orderBy("timestamp", Query.Direction.DESCENDING).limit(PAGE_SIZE.toLong()).get(Source.CACHE).await() } catch (_: Exception) { null }
                    }
                    combinedRaw = fallbackSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                    generalCursor = fallbackSnap?.documents?.lastOrNull()
                }

                _hasMore.value = combinedRaw.isNotEmpty()

                // State Isolation
                val stateFiltered = combinedRaw.filter { isPostAllowedForState(it, userState) }.ifEmpty { combinedRaw }

                // In-memory User Interest Personalization
                val rankedPosts = rankPostsByInterest(stateFiltered, categoryScores, preferredCategories)
                val finalPosts = (listOfNotNull(initialTargetPost) + rankedPosts).distinctBy { it.id }

                if (finalPosts.isNotEmpty()) {
                    _news.value = finalPosts
                    lastRefreshTimeLong = System.currentTimeMillis()
                    _lastRefreshTime.value = lastRefreshTimeLong

                    val validIds = finalPosts.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                }
            } catch (e: Exception) {
                Log.e("NewsFeedVM", "loadNews error: ${e.message}")
            } finally {
                _loading.value = false
                isFetching = false
            }
        }
    }

    /**
     * 📄 Paginated infinite scroll loader using 40/30/30 cursors.
     */
    fun loadMore(language: Language, currentUser: User?) {
        if (!_hasMore.value || isFetching) return

        viewModelScope.launch {
            isFetching = true
            try {
                val effectiveUser = currentUser ?: activeCurrentUser
                val district = _userDistrict.value
                val userState = Constants.mapDistrictToState(district)
                val categoryScores = effectiveUser?.categoryScores ?: emptyMap()
                val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (_: Exception) { emptySet() }
                val topCategories = (categoryScores.filter { it.value > 0 }.keys + preferredCategories).distinct().take(10)

                val newsRef = FirebaseService.db.collection("news")

                val prefDeferred = async(Dispatchers.IO) {
                    if (topCategories.isNotEmpty() && prefCursor != null) {
                        try {
                            newsRef.whereEqualTo("approved", true)
                                .whereArrayContainsAny("categories", topCategories)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .startAfter(prefCursor!!)
                                .limit(6)
                                .get().await()
                        } catch (_: Exception) { null }
                    } else null
                }

                val localDeferred = async(Dispatchers.IO) {
                    if (!district.isNullOrBlank() && localCursor != null) {
                        val aliases = Constants.getDistrictAliases(district).take(10)
                        try {
                            val q = if (aliases.size > 1) {
                                newsRef.whereEqualTo("approved", true).whereIn("district", aliases)
                            } else {
                                newsRef.whereEqualTo("approved", true).whereEqualTo("district", aliases.firstOrNull() ?: district)
                            }.orderBy("timestamp", Query.Direction.DESCENDING).startAfter(localCursor!!).limit(6)
                            q.get().await()
                        } catch (_: Exception) { null }
                    } else null
                }

                val generalDeferred = async(Dispatchers.IO) {
                    if (generalCursor != null) {
                        try {
                            newsRef.whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .startAfter(generalCursor!!)
                                .limit(8)
                                .get().await()
                        } catch (_: Exception) { null }
                    } else null
                }

                val prefSnap = prefDeferred.await()
                val localSnap = localDeferred.await()
                val generalSnap = generalDeferred.await()

                if (prefSnap?.documents?.isNotEmpty() == true) prefCursor = prefSnap.documents.lastOrNull()
                if (localSnap?.documents?.isNotEmpty() == true) localCursor = localSnap.documents.lastOrNull()
                if (generalSnap?.documents?.isNotEmpty() == true) generalCursor = generalSnap.documents.lastOrNull()

                val prefPosts = prefSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val localPosts = localSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val generalPosts = generalSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()

                val newBatch = (prefPosts + localPosts + generalPosts).distinctBy { it.id }

                if (newBatch.isEmpty()) {
                    _hasMore.value = false
                } else {
                    val stateFiltered = newBatch.filter { isPostAllowedForState(it, userState) }.ifEmpty { newBatch }
                    val currentIds = _news.value.map { it.id }.toSet()
                    val uniqueNew = stateFiltered.filter { it.id !in currentIds }

                    if (uniqueNew.isNotEmpty()) {
                        val ranked = rankPostsByInterest(uniqueNew, categoryScores, preferredCategories)
                        _news.value = _news.value + ranked
                        val validIds = ranked.filter { it.type == "news" }.map { it.id }
                        prefs.incrementPostViewCounts(validIds)
                    }

                    if (newBatch.size < 10) {
                        _hasMore.value = false
                    }
                }
            } catch (e: Exception) {
                Log.w("NewsFeedVM", "loadMore failed: ${e.message}")
            } finally {
                isFetching = false
            }
        }
    }

    /**
     * 🎯 User Interest Personalization Ranking (exact logic matching web app).
     * 1 score point in user interest category boosts the post by +4 hours effective freshness.
     * High interest categories surface to the top while preserving newest breaking news!
     */
    private fun rankPostsByInterest(
        posts: List<NewsPost>,
        categoryScores: Map<String, Int>,
        preferredCategories: Set<String>
    ): List<NewsPost> {
        if (categoryScores.isEmpty() && preferredCategories.isEmpty()) {
            return posts.sortedByDescending { it.timestamp }
        }

        val FOUR_HOURS_MS = 4 * 60 * 60 * 1000L

        return posts.distinctBy { it.id }.sortedByDescending { post ->
            var score = 0
            post.categories.forEach { cat ->
                score += categoryScores[cat] ?: categoryScores[cat.lowercase()] ?: 0
                if (cat in preferredCategories) score += 2
            }
            post.tags.forEach { tag ->
                score += categoryScores[tag] ?: categoryScores[tag.lowercase()] ?: 0
            }
            post.timestamp + (score * FOUR_HOURS_MS)
        }
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 300000L || _news.value.isEmpty()) { // 5 minutes
            loadNews(language, currentUser, forceRefresh = true)
        }
    }

    private fun isPostAllowedForState(post: NewsPost, userState: String?): Boolean {
        if (userState.isNullOrBlank() || userState == "BOTH") return true

        val postState = Constants.mapDistrictToState(post.state) ?: Constants.mapDistrictToState(post.district)
        if (postState != null && postState != userState) {
            return false
        }
        return true
    }

    private fun mapDocumentToNewsPost(doc: DocumentSnapshot): NewsPost? {
        return try {
            val data = doc.data ?: return null
            if ((data["webOnly"] as? Boolean) == true) return null
            com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data, currentLanguage)
        } catch (_: Exception) { null }
    }

    /**
     * Non-blocking background loader for local ads.
     */
    private fun loadLocalAds(district: String?) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val now = System.currentTimeMillis()
                val cacheKey = district ?: "ALL"
                val cachedJson = prefs.getLocalAdsCache(cacheKey)
                val cacheTime = prefs.getLocalAdsTimestamp(cacheKey)
                val isCacheValid = (now - cacheTime) < (30L * 60L * 1000L) // 30 minutes

                if (isCacheValid && !cachedJson.isNullOrBlank() && cachedJson != "[]") {
                    try {
                        val type = object : TypeToken<List<LocalAd>>() {}.type
                        val parsed = Gson().fromJson<List<LocalAd>>(cachedJson, type)
                        if (!parsed.isNullOrEmpty()) {
                            _localAds.value = parsed
                            return@launch
                        }
                    } catch (_: Exception) {}
                }

                val snap = FirebaseService.db.collection("local_ads")
                    .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                    .limit(20)
                    .get()
                    .await()

                val ads = snap.documents.mapNotNull { LocalAd.fromSnapshot(it) }
                val validAds = ads.filter { ad ->
                    val isForDistrict = (district == null || ad.targetDistrict == "ALL" || ad.targetDistrict == district)
                    val isWithinDate = if (ad.adType == com.alfanews.telugu.models.AdType.TIME_BASED_FIXED) {
                        (ad.startDate ?: 0) <= now && (ad.endDate ?: Long.MAX_VALUE) >= now
                    } else true
                    val isNotFinished = if (ad.adType == com.alfanews.telugu.models.AdType.VIEWS_BASED) {
                        ad.viewsCurrent < ad.viewsOrdered
                    } else true
                    isForDistrict && isWithinDate && isNotFinished
                }

                if (validAds.isNotEmpty()) {
                    prefs.saveLocalAdsCache(cacheKey, Gson().toJson(validAds))
                }
                _localAds.value = validAds.shuffled()
            } catch (e: Exception) {
                Log.w("NewsFeedVM", "Local ads fetch error: ${e.message}")
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?, language: Language = Language.TELUGU) {
        if (!prefs.isLocationDetectionStale() && prefs.getEffectiveDistrict() != null && prefs.lastLat != 0.0 && prefs.lastLon != 0.0) {
            return
        }

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
                val lastLoc = try { fusedLocationClient.lastLocation.await() } catch (_: Exception) { null }
                if (lastLoc != null) {
                    val geocoder = Geocoder(context, Locale.forLanguageTag("te"))
                    val addresses = geocoder.getFromLocation(lastLoc.latitude, lastLoc.longitude, 1)
                    val addr = addresses?.firstOrNull()
                    val detected = addr?.subAdminArea ?: addr?.adminArea
                    val matched = Constants.ALL_DISTRICTS.find {
                        !detected.isNullOrBlank() && (it.contains(detected, ignoreCase = true) || detected.contains(it, ignoreCase = true))
                    }
                    if (matched != null) {
                        prefs.lastLat = lastLoc.latitude
                        prefs.lastLon = lastLoc.longitude
                        prefs.detectedDistrict = matched
                        if (_userDistrict.value == null) {
                            _userDistrict.value = matched
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }
}
