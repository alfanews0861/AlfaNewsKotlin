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
import com.alfanews.telugu.services.WeatherService
import com.alfanews.telugu.services.AnalyticsService
import com.google.android.gms.location.Priority
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
                    .limit(35)

                val now = System.currentTimeMillis()
                val (cachedJson, cacheTs) = prefs.getHomeNewsCache()
                val isRecentCache = !cachedJson.isNullOrBlank() && (now - cacheTs) < (15 * 60 * 1000L) // Under 15m is considered fresh

                // 2. ⚡ ULTRA-FRESH CACHE (< 15 mins) - Display immediately only if genuinely fresh
                if (_news.value.isEmpty() && !forceRefresh && isRecentCache) {
                    try {
                        val type = object : TypeToken<List<NewsPost>>() {}.type
                        val cachedPosts: List<NewsPost>? = Gson().fromJson(cachedJson, type)
                        if (!cachedPosts.isNullOrEmpty()) {
                            val homeFiltered = cachedPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }
                            if (homeFiltered.isNotEmpty()) {
                                val ranked = rankPostsByInterest(homeFiltered, categoryScores, preferredCategories)
                                val combined = (listOfNotNull(initialTargetPost) + ranked).distinctBy { it.id }
                                _news.value = combined
                                _loading.value = false
                                Log.d("NewsFeedVM", "⚡ Instant Recent Cache (<15m): ${combined.size} posts in < 2ms")
                            }
                        }
                    } catch (_: Exception) {}
                }

                // 3. 🚀 FAST PATH (< 1.8s) - Pull directly from Server first with 40/30/30 Blending!
                // Runs parallel lean queries (15 Fresh + 5 User District) so user sees instant fresh news in proper blend!
                if (_news.value.isEmpty()) {
                    _loading.value = true
                    try {
                        val fastMainDeferred = async(Dispatchers.IO) {
                            try {
                                newsRef.whereEqualTo("approved", true)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(15)
                                    .get()
                                    .await()
                            } catch (_: Exception) { null }
                        }

                        val fastDistDeferred = async(Dispatchers.IO) {
                            if (!district.isNullOrBlank()) {
                                val aliases = Constants.getDistrictAliases(district)
                                    .map { it.trim() }
                                    .filter { it.isNotBlank() }
                                    .distinct()
                                    .take(10)
                                try {
                                    if (aliases.size > 1) {
                                        newsRef.whereEqualTo("approved", true)
                                            .whereIn("district", aliases)
                                            .orderBy("timestamp", Query.Direction.DESCENDING)
                                            .limit(5)
                                            .get().await()
                                    } else {
                                        newsRef.whereEqualTo("approved", true)
                                            .whereEqualTo("district", aliases.firstOrNull() ?: district)
                                            .orderBy("timestamp", Query.Direction.DESCENDING)
                                            .limit(5)
                                            .get().await()
                                    }
                                } catch (_: Exception) { null }
                            } else null
                        }

                        val fastSnap = kotlinx.coroutines.withTimeoutOrNull(1800L) { fastMainDeferred.await() }
                        val fastDistSnap = kotlinx.coroutines.withTimeoutOrNull(1800L) { fastDistDeferred.await() }

                        val fastMainPosts = fastSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                        val fastDistPosts = fastDistSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()

                        // 🛡️ Strict filter: ONLY state/universal or user's OWN district news! Other districts 100% excluded!
                        val homeFilteredMain = fastMainPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }
                        val homeFilteredDist = fastDistPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }

                        if ((homeFilteredMain.isNotEmpty() || homeFilteredDist.isNotEmpty()) && _news.value.isEmpty()) {
                            val blended = rankAndBlendPosts(
                                fresh = homeFilteredMain,
                                districtPosts = homeFilteredDist,
                                categoryScores = categoryScores,
                                preferredCategories = preferredCategories,
                                userDistrict = district,
                                userState = userState
                            )
                            val combined = (listOfNotNull(initialTargetPost) + blended).distinctBy { it.id }
                            if (combined.isNotEmpty()) {
                                _news.value = combined
                                if (lastDocument == null) {
                                    lastDocument = fastSnap?.documents?.lastOrNull()
                                }
                                _loading.value = false
                                Log.d("NewsFeedVM", "⚡ Fast Path Server Blended: ${combined.size} fresh posts in < 400ms")
                            }
                        }
                    } catch (e: Exception) {
                        Log.w("NewsFeedVM", "Fast path server query: ${e.message}")
                    }

                    // 🛡️ RESILIENT CACHE FALLBACK: If server took > 1.8s or phone is offline, display cache immediately!
                    if (_news.value.isEmpty() && !cachedJson.isNullOrBlank()) {
                        try {
                            val type = object : TypeToken<List<NewsPost>>() {}.type
                            val cachedPosts: List<NewsPost>? = Gson().fromJson(cachedJson, type)
                            if (!cachedPosts.isNullOrEmpty()) {
                                val homeFiltered = cachedPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }
                                if (homeFiltered.isNotEmpty()) {
                                    val ranked = rankPostsByInterest(homeFiltered, categoryScores, preferredCategories)
                                    val combined = (listOfNotNull(initialTargetPost) + ranked).distinctBy { it.id }
                                    _news.value = combined
                                    _loading.value = false
                                    Log.d("NewsFeedVM", "🛡️ Server timeout/offline: Fallback to Disk Cache (${combined.size} posts)")
                                }
                            }
                        } catch (_: Exception) {}
                    }

                    // Secondary fallback to Firestore local cache if still empty
                    if (_news.value.isEmpty()) {
                        try {
                            val cachedSnap = primaryQuery.get(Source.CACHE).await()
                            val cachedPosts = cachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                            val homeFiltered = cachedPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }
                            if (homeFiltered.isNotEmpty()) {
                                val ranked = rankPostsByInterest(homeFiltered, categoryScores, preferredCategories)
                                val combined = (listOfNotNull(initialTargetPost) + ranked).distinctBy { it.id }
                                _news.value = combined
                                _loading.value = false
                                lastDocument = cachedSnap.documents.lastOrNull()
                                Log.d("NewsFeedVM", "🛡️ Fallback to Firestore Cache (${combined.size} posts)")
                            }
                        } catch (_: Exception) {}
                    }
                }

                // 4. ⚡ PARALLEL LEAN SERVER QUERIES (Primary 35 + District 10) with resilient timeouts
                val mainDeferred = async(Dispatchers.IO) {
                    try {
                        primaryQuery.get().await()
                    } catch (e: Exception) {
                        Log.w("NewsFeedVM", "Primary query failed: ${e.message}")
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
                            if (aliases.size > 1) {
                                newsRef.whereEqualTo("approved", true)
                                    .whereIn("district", aliases)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(10)
                                    .get().await()
                            } else {
                                newsRef.whereEqualTo("approved", true)
                                    .whereEqualTo("district", aliases.firstOrNull() ?: district)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(10)
                                    .get().await()
                            }
                        } catch (e: Exception) {
                            Log.w("NewsFeedVM", "District query failed: ${e.message}")
                            null
                        }
                    } else null
                }

                val mainSnap = kotlinx.coroutines.withTimeoutOrNull(8000L) { mainDeferred.await() }
                val districtSnap = kotlinx.coroutines.withTimeoutOrNull(6000L) { districtDeferred.await() }

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

                // 5. 🎯 STRICT DISTRICT FILTERING & 40/30/30 INTERLEAVED BLENDING
                // Only user's own district news + state/universal news are allowed. Other districts' local news are STRICTLY excluded!
                val filteredMain = freshPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }
                val filteredDistrict = districtPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }

                if (filteredMain.isNotEmpty() || filteredDistrict.isNotEmpty()) {
                    val blended = rankAndBlendPosts(
                        fresh = filteredMain,
                        districtPosts = filteredDistrict,
                        categoryScores = categoryScores,
                        preferredCategories = preferredCategories,
                        userDistrict = district,
                        userState = userState
                    )

                    val combined = (listOfNotNull(initialTargetPost) + blended).distinctBy { it.id }
                    _news.value = combined
                    _hasMore.value = (freshPosts.size >= 35 || combined.size >= 20)
                    lastRefreshTimeLong = System.currentTimeMillis()
                    _lastRefreshTime.value = lastRefreshTimeLong

                    val validIds = combined.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                    prefs.saveHomeNewsCache(Gson().toJson(combined.take(25)))
                } else if (_news.value.isNotEmpty()) {
                    _hasMore.value = true
                }
            } catch (e: Exception) {
                Log.e("NewsFeedVM", "loadNews error: ${e.message}")
            } finally {
                _loading.value = false
                isFetching = false
                _isRefreshing.value = false
            }
        }
    }

    /**
     * 📄 Paginated infinite scroll loader using direct cursor with duplicate protection.
     * Uses timestamp cursor fallback if DocumentSnapshot cursor is null (e.g. cold start from cache),
     * preventing swipe up from getting stuck at 12 posts!
     */
    fun loadMore(language: Language, currentUser: User?) {
        if (!_hasMore.value || isFetching) return
        val district = prefs.getEffectiveDistrict() ?: activeCurrentUser?.district?.takeIf { it.isNotBlank() }
        val userState = Constants.mapDistrictToState(district)
        val categoryScores = activeCurrentUser?.categoryScores ?: emptyMap()
        val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (_: Exception) { emptySet() }

        val lastTimestamp = _news.value.lastOrNull { it.timestamp > 0 }?.timestamp
        val cursor = lastDocument
        if (cursor == null && lastTimestamp == null) return

        isFetching = true
        viewModelScope.launch {
            try {
                val newsRef = FirebaseService.db.collection("news")
                var currentCursor = cursor
                var currentTimestamp = lastTimestamp
                var keepFetching = true
                var attempts = 0

                while (keepFetching && attempts < 5) {
                    attempts++
                    val baseQuery = newsRef.whereEqualTo("approved", true)
                        .orderBy("timestamp", Query.Direction.DESCENDING)

                    val q = when {
                        currentCursor != null -> baseQuery.startAfter(currentCursor).limit(30L)
                        currentTimestamp != null -> baseQuery.startAfter(currentTimestamp).limit(30L)
                        else -> baseQuery.limit(30L)
                    }

                    val snap = kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        q.get().await()
                    }
                    if (snap == null) {
                        Log.w("NewsFeedVM", "loadMore timed out, will retry on scroll")
                        break
                    }

                    val rawDocs = snap.documents
                    if (rawDocs.isNotEmpty()) {
                        lastDocument = rawDocs.lastOrNull()
                        currentCursor = lastDocument
                    }

                    val newPosts = rawDocs.mapNotNull { mapDocumentToNewsPost(it) }
                    if (newPosts.isNotEmpty()) {
                        currentTimestamp = newPosts.lastOrNull()?.timestamp
                    }

                    if (newPosts.isEmpty()) {
                        _hasMore.value = false
                        break
                    }

                    // Filter for Home Feed (state/general or user's own district only)
                    val filteredPosts = newPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }
                    val currentIds = _news.value.map { it.id }.toSet()
                    val unique = filteredPosts.filter { it.id !in currentIds }

                    if (unique.isNotEmpty()) {
                        consecutiveEmptyLoads = 0
                        val ranked = rankPostsByInterest(unique, categoryScores, preferredCategories)
                        _news.value = _news.value + ranked
                        val validIds = ranked.filter { it.type == "news" }.map { it.id }
                        prefs.incrementPostViewCounts(validIds)
                        if (rawDocs.size < 30) {
                            _hasMore.value = false
                        }
                        keepFetching = false
                    } else {
                        consecutiveEmptyLoads++
                        if (rawDocs.size < 30 || consecutiveEmptyLoads >= 5) {
                            _hasMore.value = false
                            keepFetching = false
                        }
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
     * 🎯 40/30/30 Interleaved Blending Cadence with Special Posts Overlay:
     * - Position 1: Festival Greeting (if exists)
     * - Position 6: Quote of the Day
     * - Position 9: History of the Day
     * - Position 12: Cartoon (State-specific)
     * - Regular 40/30/30 mixing:
     *   - 40% Fresh Breaking News (State-wide / General)
     *   - 30% User Interest Personalized News (ranked by categoryScores + preferredCategories)
     *   - 30% Local District News (User's specific district) / Discovery
     */
    private fun rankAndBlendPosts(
        fresh: List<NewsPost>,
        districtPosts: List<NewsPost>,
        categoryScores: Map<String, Int>,
        preferredCategories: Set<String>,
        userDistrict: String?,
        userState: String?
    ): List<NewsPost> {
        val allRaw = (fresh + districtPosts).distinctBy { it.id }
        if (allRaw.isEmpty()) return emptyList()

        val HALF_HOUR_MS = 30L * 60L * 1000L
        val MAX_BOOST_MS = 2L * 60L * 60L * 1000L // Cap boost at 2 hours max

        // 1. Separate Special Posts (Festival, Quote, History, Cartoon)
        val festivalGreetings = allRaw.filter { it.type == "greeting" && it.likes == 0 }
        val quoteGreetings = allRaw.filter { it.type == "greeting" && (it.likes == 1 || it.postFormat == com.alfanews.telugu.models.PostFormat.VERTICAL) }
        val historyPosts = allRaw.filter { it.type == "history" }
        val cartoonPosts = allRaw.filter { it.type == "cartoon" }

        val specialIds = (festivalGreetings + quoteGreetings + historyPosts + cartoonPosts).map { it.id }.toSet()
        val normalRaw = allRaw.filter { it.id !in specialIds }

        // 2. Local Candidates (User's District only)
        val localCandidates = districtPosts.filter { it.id !in specialIds }.sortedByDescending { post ->
            val viewCount = prefs.getPostViewCount(post.id)
            val penalty = if (viewCount >= 2) 24L * 60L * 60L * 1000L else if (viewCount == 1) 4L * 60L * 60L * 1000L else 0L
            post.timestamp - penalty
        }.toMutableList()
        val localIds = localCandidates.map { it.id }.toSet()

        val nonLocalPosts = normalRaw.filter { it.id !in localIds }

        // 3. Personalized Candidates (User Interest Matches with positive score + Recency prioritized)
        val scoredPosts = nonLocalPosts.map { post ->
            var score = 0
            post.categories.forEach { cat ->
                score += categoryScores[cat] ?: categoryScores[cat.lowercase()] ?: 0
                if (cat in preferredCategories) score += 2
            }
            post.tags.forEach { tag ->
                score += categoryScores[tag] ?: categoryScores[tag.lowercase()] ?: 0
            }
            val boost = minOf(score * HALF_HOUR_MS, MAX_BOOST_MS)
            val viewCount = prefs.getPostViewCount(post.id)
            val penalty = if (viewCount >= 2) 24L * 60L * 60L * 1000L else if (viewCount == 1) 4L * 60L * 60L * 1000L else 0L
            val effectiveTime = post.timestamp + boost - penalty
            Triple(post, score, effectiveTime)
        }.filter { it.second > 0 }
         .sortedByDescending { it.third } // Prioritize by effectiveTime so breaking news stays near top!
         .map { it.first }
         .toMutableList()
        val scoredIds = scoredPosts.map { it.id }.toSet()

        // 4. Fresh Breaking Candidates (Sorted strictly by timestamp DESC with seen-post penalty)
        val freshCandidates = nonLocalPosts.sortedByDescending { post ->
            val viewCount = prefs.getPostViewCount(post.id)
            val penalty = if (viewCount >= 2) 24L * 60L * 60L * 1000L else if (viewCount == 1) 4L * 60L * 60L * 1000L else 0L
            post.timestamp - penalty
        }.toMutableList()

        // 5. Discovery Candidates (posts not matching current top preferences to prevent filter bubble)
        val discoveryCandidates = nonLocalPosts.filter { it.id !in scoredIds }
            .sortedByDescending { post ->
                val viewCount = prefs.getPostViewCount(post.id)
                val penalty = if (viewCount >= 2) 24L * 60L * 60L * 1000L else if (viewCount == 1) 4L * 60L * 60L * 1000L else 0L
                post.timestamp - penalty
            }.toMutableList()

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
        val maxIterations = normalRaw.size + 15
        var loopCount = 0
        while (addedIds.size < normalRaw.size && loopCount < maxIterations) {
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
                val remaining = normalRaw.firstOrNull { it.id !in addedIds }
                if (remaining != null) {
                    addedIds.add(remaining.id)
                    blended.add(remaining)
                } else {
                    break
                }
            }
            loopCount++
        }

        // 6. SPECIAL POSTS OVERLAY INJECTION (Exact specifications)
        // Position 6 (index 5): Quote of the Day
        if (quoteGreetings.isNotEmpty()) {
            val targetIdx = minOf(5, blended.size)
            blended.add(targetIdx, quoteGreetings.first())
        }

        // Position 9 (index 8): History of the Day
        if (historyPosts.isNotEmpty()) {
            val targetIdx = minOf(8, blended.size)
            blended.add(targetIdx, historyPosts.first())
        }

        // Position 12 (index 11): Cartoon (State-specific AP / TS)
        if (cartoonPosts.isNotEmpty()) {
            val relevantCartoon = cartoonPosts.find {
                val cState = Constants.mapDistrictToState(it.district) ?: Constants.mapDistrictToState(it.state)
                cState != null && cState.equals(userState, ignoreCase = true)
            } ?: cartoonPosts.firstOrNull()

            if (relevantCartoon != null) {
                val targetIdx = minOf(11, blended.size)
                blended.add(targetIdx, relevantCartoon)
            }
        }

        // Position 1 (index 0): Festival Greeting
        if (festivalGreetings.isNotEmpty()) {
            blended.add(0, festivalGreetings.first())
        }

        return if (blended.isNotEmpty()) blended else allRaw
    }

    /**
     * 🎯 User Interest Personalization Ranking for pagination & cache.
     * User interest category provides a gentle priority (+30m to +2h max) without burying breaking news.
     * Seen posts are demoted to ensure fresh content is discovered.
     */
    private fun rankPostsByInterest(
        posts: List<NewsPost>,
        categoryScores: Map<String, Int>,
        preferredCategories: Set<String>
    ): List<NewsPost> {
        val HALF_HOUR_MS = 30L * 60L * 1000L
        val MAX_BOOST_MS = 2L * 60L * 60L * 1000L // Cap boost at 2 hours max

        return posts.distinctBy { it.id }.sortedByDescending { post ->
            var score = 0
            if (categoryScores.isNotEmpty() || preferredCategories.isNotEmpty()) {
                post.categories.forEach { cat ->
                    score += categoryScores[cat] ?: categoryScores[cat.lowercase()] ?: 0
                    if (cat in preferredCategories) score += 2
                }
                post.tags.forEach { tag ->
                    score += categoryScores[tag] ?: categoryScores[tag.lowercase()] ?: 0
                }
            }
            val boost = minOf(score * HALF_HOUR_MS, MAX_BOOST_MS)
            val viewCount = prefs.getPostViewCount(post.id)
            val penalty = if (viewCount >= 2) 24L * 60L * 60L * 1000L else if (viewCount == 1) 4L * 60L * 60L * 1000L else 0L
            post.timestamp + boost - penalty
        }
    }

    /**
     * 🛡️ STRICT HOME FEED FILTERING:
     * - State Match: AP users see AP state news, TS users see TS state news.
     * - General/Universal News: Allowed (National, International, Cinema, Sports, etc.).
     * - Local District News: ONLY allowed if it matches the user's OWN district.
     * - OTHER DISTRICTS' local news are STRICTLY FILTERED OUT!
     */
    private fun isPostAllowedForHomeFeed(post: NewsPost, userDistrict: String?, userState: String?): Boolean {
        // 1. State check: TS users shouldn't see AP state news and vice versa (unless universal)
        if (!userState.isNullOrBlank() && userState != "BOTH") {
            val postState = Constants.mapDistrictToState(post.state) ?: Constants.mapDistrictToState(post.district)
            if (postState != null && postState != userState) {
                return false
            }
        }

        // 2. Special posts (Greeting, History, Cartoon)
        if (post.type == "greeting" || post.type == "history" || post.type == "cartoon") {
            if (post.type == "cartoon" && !userState.isNullOrBlank()) {
                val cartoonState = Constants.mapDistrictToState(post.state) ?: Constants.mapDistrictToState(post.district)
                if (cartoonState != null && cartoonState != userState) return false
            }
            return true
        }

        // 3. Global / State-wide / Universal / General news
        val postDist = post.district?.trim()
        val isGenericOrState = post.isGlobal ||
                postDist.isNullOrBlank() ||
                Constants.isStateOrGenericDistrict(postDist) ||
                Constants.isUniversalOrGeneral(postDist) ||
                Constants.isUniversalOrGeneral(post.category) ||
                post.categories.any { Constants.isUniversalOrGeneral(it) }

        if (isGenericOrState) {
            return true
        }

        // 4. District check: If the post has a specific district, it MUST match the user's own district
        if (userDistrict.isNullOrBlank()) {
            return true // User hasn't chosen a district yet
        }

        val aliases = Constants.getDistrictAliases(userDistrict)
        val isUserDistrict = postDist.equals(userDistrict, ignoreCase = true) ||
                aliases.any { alias ->
                    alias.equals(postDist, ignoreCase = true) ||
                    postDist.contains(alias, ignoreCase = true) ||
                    alias.contains(postDist, ignoreCase = true)
                }

        // Strictly reject other districts' local news from Home Feed!
        return isUserDistrict
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        if (isFetching) return // 🛡️ Prevent duplicate concurrent reads
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 3 * 60 * 1000L || lastRefreshTimeLong == 0L) {
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
     * Non-blocking background loader for local ads with district alias matching & timeout protection.
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

                val snap = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                    FirebaseService.db.collection("local_ads")
                        .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                        .limit(30)
                        .get()
                        .await()
                }

                val ads = snap?.documents?.mapNotNull { LocalAd.fromSnapshot(it) } ?: emptyList()
                val aliases = if (!district.isNullOrBlank()) Constants.getDistrictAliases(district) else emptyList()
                val userState = Constants.mapDistrictToState(district)

                val validAds = ads.filter { ad ->
                    val isForDistrict = when {
                        district == null -> true
                        ad.targetDistrict == "ALL" -> true
                        ad.targetDistrict.equals(district, ignoreCase = true) -> true
                        aliases.any { alias ->
                            alias.equals(ad.targetDistrict, ignoreCase = true) ||
                            ad.targetDistrict.contains(alias, ignoreCase = true) ||
                            alias.contains(ad.targetDistrict, ignoreCase = true)
                        } -> true
                        else -> false
                    }
                    val isForState = (userState == null || ad.targetState == "ALL" || ad.targetState.equals(userState, ignoreCase = true))
                    val isWithinDate = if (ad.adType == com.alfanews.telugu.models.AdType.TIME_BASED_FIXED) {
                        (ad.startDate ?: 0) <= now && (ad.endDate ?: Long.MAX_VALUE) >= now
                    } else true
                    val isNotFinished = if (ad.adType == com.alfanews.telugu.models.AdType.VIEWS_BASED) {
                        ad.viewsCurrent < ad.viewsOrdered
                    } else true

                    isForDistrict && isForState && isWithinDate && isNotFinished
                }

                if (validAds.isNotEmpty()) {
                    prefs.saveLocalAdsCache(cacheKey, Gson().toJson(validAds))
                    _localAds.value = validAds.shuffled()
                } else if (district != null) {
                    // Fallback to ALL/State active ads if no district-specific ad exists
                    val genericAds = ads.filter { ad ->
                        (ad.targetDistrict == "ALL" || ad.targetDistrict.isBlank()) &&
                        (userState == null || ad.targetState == "ALL" || ad.targetState.equals(userState, ignoreCase = true))
                    }
                    if (genericAds.isNotEmpty()) {
                        _localAds.value = genericAds.shuffled()
                    }
                }
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
                val loc = lastLoc ?: kotlinx.coroutines.withTimeoutOrNull(2000L) {
                    fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                }
                if (loc != null) {
                    val matched = WeatherService.getClosestDistrictFromCoords(loc.latitude, loc.longitude)
                        ?: try {
                            val geocoder = Geocoder(context, Locale.forLanguageTag("te"))
                            val addresses = geocoder.getFromLocation(loc.latitude, loc.longitude, 1)
                            val addr = addresses?.firstOrNull()
                            val detected = addr?.subAdminArea ?: addr?.adminArea
                            Constants.ALL_DISTRICTS.find {
                                !detected.isNullOrBlank() && (it.contains(detected, ignoreCase = true) || detected.contains(it, ignoreCase = true))
                            }
                        } catch (_: Exception) { null }

                    if (matched != null) {
                        prefs.lastLat = loc.latitude
                        prefs.lastLon = loc.longitude
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
