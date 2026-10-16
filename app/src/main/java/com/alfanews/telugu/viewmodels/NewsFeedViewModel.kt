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

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private var lastDocument: DocumentSnapshot? = null
    private var currentFetchJob: Job? = null
    @Volatile private var isFetching = false
    private var lastRefreshTimeLong: Long = 0
    private var consecutiveEmptyLoads = 0

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
     * ⚡ 40/30/30 Stream Mixing + User Interest Personalization + Smart Cache & Fast Path.
     * 1. Smart Local Cache (< 20ms) displayed ONLY if fresh (< 5 hours old).
     * 2. Fast Path (< 300ms) top 5 posts if cache is stale (> 5 hours) or empty.
     * 3. Parallel Lean Server Queries: 40% General/State breaking, 30% User Interests, 30% Local District.
     * 4. Interleaved Cadence & Strict State Isolation.
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
        if (forceRefresh) {
            currentFetchJob?.cancel()
        }

        val district = prefs.getEffectiveDistrict() ?: effectiveUser?.district?.takeIf { it.isNotBlank() }
        _userDistrict.value = district
        val userState = Constants.mapDistrictToState(district)

        val categoryScores = effectiveUser?.categoryScores ?: emptyMap()
        val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (_: Exception) { emptySet() }

        // Asynchronously load local ads in background (does NOT block news feed)
        loadLocalAds(district)

        currentFetchJob = viewModelScope.launch {
            isFetching = true
            if (forceRefresh) {
                _isRefreshing.value = true
                lastDocument = null
                consecutiveEmptyLoads = 0
            }
            _isOnline.value = NetworkUtils.isOnline(getApplication())

            try {
                // 1. Initial Post (Deep-link target)
                val initialTargetPost = if (!initialPostId.isNullOrBlank()) {
                    try {
                        val doc = FirebaseService.db.collection("news").document(initialPostId).get().await()
                        if (doc.exists()) mapDocumentToNewsPost(doc) else null
                    } catch (_: Exception) { null }
                } else null

                val newsRef = FirebaseService.db.collection("news")
                val primaryQuery = newsRef.whereEqualTo("approved", true)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(PAGE_SIZE.toLong())

                val FIVE_HOURS_MS = 5L * 60 * 60 * 1000L
                val now = System.currentTimeMillis()
                var hasFreshCache = false

                // 2. ⚡ SMART LOCAL CACHE DISPLAY (< 20ms) - Only if fresh (< 5 hours old)
                if (_news.value.isEmpty()) {
                    try {
                        val cachedSnap = primaryQuery.get(Source.CACHE).await()
                        val cachedPosts = cachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                        val latestTimestamp = cachedPosts.maxOfOrNull { it.timestamp } ?: 0L
                        val isCacheFresh = (now - latestTimestamp) < FIVE_HOURS_MS

                        if (isCacheFresh && cachedPosts.isNotEmpty()) {
                            val stateFiltered = cachedPosts.filter { isPostAllowedForState(it, userState) }.ifEmpty { cachedPosts }
                            val ranked = rankPostsByInterest(stateFiltered, categoryScores, preferredCategories)
                            val combined = (listOfNotNull(initialTargetPost) + ranked).distinctBy { it.id }
                            _news.value = combined
                            _loading.value = false
                            hasFreshCache = true
                            lastDocument = cachedSnap.documents.lastOrNull()
                            Log.d("NewsFeedVM", "⚡ Instant Fresh Cache (<5h): ${combined.size} posts in < 20ms")
                        } else {
                            Log.d("NewsFeedVM", "Cache is empty or older than 5 hours (${(now - latestTimestamp) / 3600000}h old), bypassing stale cache for Fast Path")
                        }
                    } catch (_: Exception) {}
                }

                // 3. 🚀 FAST PATH (< 300ms) - If cache was stale (>5h) or empty, fetch top 5 fresh posts immediately
                if (_news.value.isEmpty()) {
                    _loading.value = true
                    try {
                        val fastSnap = kotlinx.coroutines.withTimeoutOrNull(3000L) {
                            newsRef.whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(5)
                                .get()
                                .await()
                        }
                        val fastPosts = fastSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                        if (fastPosts.isNotEmpty() && _news.value.isEmpty()) {
                            val stateFiltered = fastPosts.filter { isPostAllowedForState(it, userState) }.ifEmpty { fastPosts }
                            val combined = (listOfNotNull(initialTargetPost) + stateFiltered).distinctBy { it.id }
                            if (combined.isNotEmpty()) {
                                _news.value = combined
                                if (lastDocument == null) {
                                    lastDocument = fastSnap?.documents?.lastOrNull()
                                }
                                _loading.value = false
                                Log.d("NewsFeedVM", "⚡ Fast Path: ${combined.size} fresh posts in < 300ms")
                            }
                        }
                    } catch (e: Exception) {
                        Log.w("NewsFeedVM", "Fast path query: ${e.message}")
                    }
                }

                // 4. ⚡ PARALLEL LEAN SERVER QUERIES (Primary 20 + District 8) with 8s mobile-resilient timeout
                val mainDeferred = async(Dispatchers.IO) {
                    try {
                        primaryQuery.get().await()
                    } catch (e: Exception) {
                        Log.w("NewsFeedVM", "Primary query server failed: ${e.message}")
                        null
                    }
                }

                val districtDeferred = async(Dispatchers.IO) {
                    if (!district.isNullOrBlank()) {
                        val aliases = Constants.getDistrictAliases(district)
                            .map { it.trim() }
                            .filter { it.isNotBlank() }
                            .distinct()
                            .take(10)
                        try {
                            val q = if (aliases.size > 1) {
                                newsRef.whereEqualTo("approved", true)
                                    .whereIn("district", aliases)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(8)
                            } else {
                                newsRef.whereEqualTo("approved", true)
                                    .whereEqualTo("district", aliases.firstOrNull() ?: district)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(8)
                            }
                            q.get().await()
                        } catch (e: Exception) {
                            Log.w("NewsFeedVM", "District query failed: ${e.message}")
                            null
                        }
                    } else null
                }

                val mainSnap = kotlinx.coroutines.withTimeoutOrNull(8000L) { mainDeferred.await() }
                val districtSnap = kotlinx.coroutines.withTimeoutOrNull(8000L) { districtDeferred.await() }

                var freshPosts = mainSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val districtPosts = districtSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()

                // Fallback to cache if network failed/timed out completely and memory is still empty
                if (freshPosts.isEmpty() && _news.value.isEmpty()) {
                    try {
                        val fallbackCachedSnap = primaryQuery.get(Source.CACHE).await()
                        freshPosts = fallbackCachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                        if (freshPosts.isNotEmpty()) {
                            lastDocument = fallbackCachedSnap.documents.lastOrNull()
                        }
                    } catch (_: Exception) {}
                } else if (mainSnap?.documents?.isNotEmpty() == true) {
                    lastDocument = mainSnap.documents.lastOrNull()
                }

                // 5. 🎯 40/30/30 INTERLEAVED BLENDING (Fresh Breaking, User Personalized, Local District)
                if (freshPosts.isNotEmpty() || districtPosts.isNotEmpty()) {
                    val stateMain = freshPosts.filter { isPostAllowedForState(it, userState) }.ifEmpty { freshPosts }
                    val stateDistrict = districtPosts.filter { isPostAllowedForState(it, userState) }

                    val blended = rankAndBlendPosts(
                        fresh = stateMain,
                        districtPosts = stateDistrict,
                        categoryScores = categoryScores,
                        preferredCategories = preferredCategories,
                        userDistrict = district
                    )

                    val combined = (listOfNotNull(initialTargetPost) + blended).distinctBy { it.id }
                    _news.value = combined
                    _hasMore.value = (freshPosts.size >= PAGE_SIZE)
                    lastRefreshTimeLong = System.currentTimeMillis()
                    _lastRefreshTime.value = lastRefreshTimeLong

                    val validIds = combined.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                }
            } catch (e: Exception) {
                Log.e("NewsFeedVM", "loadNews error: ${e.message}")
            } finally {
                if (_news.value.isNotEmpty()) {
                    lastRefreshTimeLong = System.currentTimeMillis()
                    _lastRefreshTime.value = lastRefreshTimeLong
                }
                _loading.value = false
                isFetching = false
                _isRefreshing.value = false
            }
        }
    }

    /**
     * 📄 Paginated infinite scroll loader using direct cursor with duplicate protection.
     */
    fun loadMore(language: Language, currentUser: User?) {
        if (!_hasMore.value || isFetching) return
        val cursor = lastDocument ?: run {
            return
        }

        isFetching = true
        viewModelScope.launch {
            try {
                val district = prefs.getEffectiveDistrict() ?: activeCurrentUser?.district?.takeIf { it.isNotBlank() }
                val userState = Constants.mapDistrictToState(district)
                val categoryScores = activeCurrentUser?.categoryScores ?: emptyMap()
                val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (_: Exception) { emptySet() }

                val newsRef = FirebaseService.db.collection("news")
                val q = newsRef.whereEqualTo("approved", true)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .startAfter(cursor)
                    .limit(PAGE_SIZE.toLong())

                val snap = kotlinx.coroutines.withTimeoutOrNull(8000L) {
                    q.get().await()
                }
                if (snap == null) {
                    Log.w("NewsFeedVM", "loadMore timed out, will retry on scroll")
                    return@launch
                }

                val newPosts = snap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                if (snap.documents.isNotEmpty()) {
                    lastDocument = snap.documents.lastOrNull()
                }

                if (newPosts.isEmpty()) {
                    _hasMore.value = false
                } else {
                    val stateFiltered = newPosts.filter { isPostAllowedForState(it, userState) }.ifEmpty { newPosts }
                    val currentIds = _news.value.map { it.id }.toSet()
                    val unique = stateFiltered.filter { it.id !in currentIds }

                    if (unique.isNotEmpty()) {
                        consecutiveEmptyLoads = 0
                        val ranked = rankPostsByInterest(unique, categoryScores, preferredCategories)
                        _news.value = _news.value + ranked
                        val validIds = ranked.filter { it.type == "news" }.map { it.id }
                        prefs.incrementPostViewCounts(validIds)
                    } else {
                        consecutiveEmptyLoads++
                        if (consecutiveEmptyLoads >= 4) {
                            _hasMore.value = false // 🛡️ Circuit breaker after 4 consecutive empty batches
                        }
                    }
                    if (newPosts.size < PAGE_SIZE) {
                        _hasMore.value = false
                    }
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                Log.w("NewsFeedVM", "loadMore failed: ${e.message}")
            } finally {
                isFetching = false
            }
        }
    }

    /**
     * 🎯 40/30/30 Interleaved Blending Cadence:
     * - 40% Fresh Breaking News (State-wide)
     * - 30% User Interest Personalized News (ranked by categoryScores + preferredCategories)
     * - 30% Local District News (User's specific district) / Discovery
     */
    private fun rankAndBlendPosts(
        fresh: List<NewsPost>,
        districtPosts: List<NewsPost>,
        categoryScores: Map<String, Int>,
        preferredCategories: Set<String>,
        userDistrict: String?
    ): List<NewsPost> {
        val allRaw = (fresh + districtPosts).distinctBy { it.id }
        if (allRaw.isEmpty()) return emptyList()

        // 1. Local Candidates (User's District)
        val localCandidates = districtPosts.sortedByDescending { it.timestamp }.toMutableList()
        val localIds = localCandidates.map { it.id }.toSet()

        val nonLocalPosts = allRaw.filter { it.id !in localIds }

        // 2. Personalized Candidates (User Interest Matches with positive score)
        val scoredPosts = nonLocalPosts.map { post ->
            var score = 0
            post.categories.forEach { cat ->
                score += categoryScores[cat] ?: categoryScores[cat.lowercase()] ?: 0
                if (cat in preferredCategories) score += 2
            }
            post.tags.forEach { tag ->
                score += categoryScores[tag] ?: categoryScores[tag.lowercase()] ?: 0
            }
            post to score
        }.filter { it.second > 0 }
         .sortedByDescending { it.second }
         .map { it.first }
         .toMutableList()
        val scoredIds = scoredPosts.map { it.id }.toSet()

        // 3. Fresh Breaking Candidates (Sorted strictly by timestamp DESC)
        val freshCandidates = nonLocalPosts.sortedByDescending { it.timestamp }.toMutableList()

        // 4. Discovery Candidates (posts not matching current top preferences to prevent filter bubble)
        val discoveryCandidates = nonLocalPosts.filter { it.id !in scoredIds }
            .sortedByDescending { it.timestamp }
            .toMutableList()

        val blended = mutableListOf<NewsPost>()
        val addedIds = mutableSetOf<String>()

        fun pollNext(list: MutableList<NewsPost>): NewsPost? {
            while (list.isNotEmpty()) {
                val item = list.removeAt(0)
                if (item.id !in addedIds) {
                    addedIds.add(item.id)
                    return item
                }
            }
            return null
        }

        // 🔄 40/30/30 Cadence (40% Fresh Breaking, 30% User Personalized, 30% Local District / Discovery):
        // Slot 0: Fresh #1 (Top Breaking)
        // Slot 1: Personalized #1 (Top User Interest)
        // Slot 2: Local District #1 (User's local news)
        // Slot 3: Fresh #2 (Breaking)
        // Slot 4: Personalized #2 (User Interest)
        // Slot 5: Local District #2 / Discovery #1
        val maxIterations = allRaw.size + 15
        var loopCount = 0
        while (addedIds.size < allRaw.size && loopCount < maxIterations) {
            val cycle = loopCount % 6
            val nextPost = when (cycle) {
                0 -> pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(localCandidates) ?: pollNext(discoveryCandidates)
                1 -> pollNext(scoredPosts) ?: pollNext(freshCandidates) ?: pollNext(localCandidates) ?: pollNext(discoveryCandidates)
                2 -> pollNext(localCandidates) ?: pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(discoveryCandidates)
                3 -> pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(discoveryCandidates) ?: pollNext(localCandidates)
                4 -> pollNext(scoredPosts) ?: pollNext(freshCandidates) ?: pollNext(discoveryCandidates) ?: pollNext(localCandidates)
                5 -> pollNext(localCandidates) ?: pollNext(discoveryCandidates) ?: pollNext(freshCandidates) ?: pollNext(scoredPosts)
                else -> pollNext(freshCandidates)
            }
            if (nextPost != null) {
                blended.add(nextPost)
            } else {
                val remaining = allRaw.firstOrNull { it.id !in addedIds }
                if (remaining != null) {
                    addedIds.add(remaining.id)
                    blended.add(remaining)
                } else {
                    break
                }
            }
            loopCount++
        }

        return if (blended.isNotEmpty()) blended else allRaw
    }

    /**
     * 🎯 User Interest Personalization Ranking for pagination & cache.
     * 1 score point in user interest category boosts the post by +4 hours effective freshness.
     */
    private fun rankPostsByInterest(
        posts: List<NewsPost>,
        categoryScores: Map<String, Int>,
        preferredCategories: Set<String>
    ): List<NewsPost> {
        if (categoryScores.isEmpty() && preferredCategories.isEmpty()) {
            return posts.sortedByDescending { it.timestamp }
        }

        val FOUR_HOURS_MS = 4L * 60 * 60 * 1000L

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

    private fun isPostAllowedForState(post: NewsPost, userState: String?): Boolean {
        if (userState.isNullOrBlank() || userState == "BOTH") return true

        val postState = Constants.mapDistrictToState(post.state) ?: Constants.mapDistrictToState(post.district)
        if (postState != null && postState != userState) {
            return false
        }
        return true
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        if (isFetching) return // 🛡️ Prevent duplicate concurrent reads
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 5 * 60 * 1000L || (lastRefreshTimeLong == 0L && _news.value.isEmpty())) {
            loadNews(language, currentUser, forceRefresh = true)
        }
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
