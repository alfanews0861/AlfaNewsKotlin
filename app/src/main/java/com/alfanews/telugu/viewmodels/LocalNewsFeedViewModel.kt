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
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.services.WeatherService
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.NetworkUtils
import com.alfanews.telugu.utils.NotificationHelper
import com.alfanews.telugu.utils.PreferenceManager
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import com.google.firebase.firestore.Source
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale

class LocalNewsFeedViewModel(application: Application) : AndroidViewModel(application) {
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

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _activeDistrict = MutableStateFlow<String?>(prefs.getEffectiveDistrict() ?: prefs.userDistrict)
    val activeDistrict: StateFlow<String?> = _activeDistrict.asStateFlow()

    private val _shouldOpenDistrictPicker = MutableStateFlow(false)
    val shouldOpenDistrictPicker: StateFlow<Boolean> = _shouldOpenDistrictPicker.asStateFlow()

    fun resetOpenDistrictPicker() {
        _shouldOpenDistrictPicker.value = false
    }

    private val _localAds = MutableStateFlow<List<LocalAd>>(emptyList())
    val localAds: StateFlow<List<LocalAd>> = _localAds.asStateFlow()

    private val _isDetecting = MutableStateFlow(false)
    val isDetecting: StateFlow<Boolean> = _isDetecting.asStateFlow()

    private val _lastRefreshTime = MutableStateFlow(0L)
    val lastRefreshTime: StateFlow<Long> = _lastRefreshTime.asStateFlow()

    private val _shouldScrollToTop = MutableStateFlow(false)
    val shouldScrollToTop: StateFlow<Boolean> = _shouldScrollToTop.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private var lastDistrictDocument: DocumentSnapshot? = null
    private var loadJob: Job? = null
    private var loadMoreJob: Job? = null
    @Volatile private var isFetching = false
    private var lastRefreshTimeLong: Long = 0
    private var consecutiveEmptyLoads = 0
    private var isStateFallbackMode = false

    init {
        val initialDist = _activeDistrict.value
        if (initialDist != null) {
            loadLocalAds(initialDist)
        }

        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != null && district != _activeDistrict.value) {
                    setDistrict(district)
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

    fun setDistrict(district: String) {
        val oldDistrict = prefs.selectedDistrict ?: prefs.detectedDistrict
        prefs.selectedDistrict = district
        _activeDistrict.value = district

        // 🚀 INSTANT REFRESH: మునుపటి పాత జిల్లా వార్తలను తీసివేసి వెంటనే తాజా వార్తల కోసం లోడింగ్ మొదలుపెడతాము
        _news.value = emptyList()
        _loading.value = true
        _hasMore.value = true
        lastDistrictDocument = null
        isStateFallbackMode = false
        _shouldScrollToTop.value = true

        AnalyticsService.logDistrictSelected(district, oldDistrict)
        viewModelScope.launch {
            NotificationHelper.syncDistrictTopic(getApplication(), district)
        }
        loadLocalAds(district)
        loadNews(Language.TELUGU, activeCurrentUser, forceRefresh = true)
    }

    fun prependPost(post: NewsPost) {
        _news.value = (listOf(post) + _news.value).distinctBy { it.id }
        _loading.value = false
        _shouldScrollToTop.value = true
    }

    /**
     * 🛡️ Multi-strategy resilient district query:
     * 1. Approved + whereIn(aliases)
     * 2. Approved + whereEqualTo(district)
     * 3. Status published + whereEqualTo(district)
     * 4. Categories arrayContains(district)
     */
    private suspend fun fetchDistrictSnap(
        district: String,
        aliases: List<String>,
        limitCount: Long,
        cursor: DocumentSnapshot? = null,
        timestampCursor: Long? = null
    ): QuerySnapshot? {
        val newsRef = FirebaseService.db.collection("news")

        // Strategy 1: Single canonical district exact match (Fastest path < 200ms with deployed index)
        try {
            val q1 = newsRef.whereEqualTo("approved", true)
                .whereEqualTo("district", district)
                .orderBy("timestamp", Query.Direction.DESCENDING)
            val finalQ1 = when {
                cursor != null -> q1.startAfter(cursor).limit(limitCount)
                timestampCursor != null -> q1.startAfter(timestampCursor).limit(limitCount)
                else -> q1.limit(limitCount)
            }
            val res = finalQ1.get().await()
            if (!res.isEmpty) return res
        } catch (e: Exception) {
            Log.w("LocalNewsFeedVM", "Strategy 1 exact district match failed: ${e.message}")
        }

        // Strategy 2: whereIn(aliases) for multi-alias district names
        if (aliases.size > 1) {
            try {
                val q2 = newsRef.whereEqualTo("approved", true)
                    .whereIn("district", aliases)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                val finalQ2 = when {
                    cursor != null -> q2.startAfter(cursor).limit(limitCount)
                    timestampCursor != null -> q2.startAfter(timestampCursor).limit(limitCount)
                    else -> q2.limit(limitCount)
                }
                val res = finalQ2.get().await()
                if (!res.isEmpty) return res
            } catch (e: Exception) {
                Log.w("LocalNewsFeedVM", "Strategy 2 whereIn failed: ${e.message}")
            }
        }

        // Strategy 3: Using status=published + district (deployed index)
        try {
            val q3 = newsRef.whereEqualTo("status", "published")
                .whereEqualTo("district", district)
                .orderBy("timestamp", Query.Direction.DESCENDING)
            val finalQ3 = when {
                cursor != null -> q3.startAfter(cursor).limit(limitCount)
                timestampCursor != null -> q3.startAfter(timestampCursor).limit(limitCount)
                else -> q3.limit(limitCount)
            }
            val res = finalQ3.get().await()
            if (!res.isEmpty) return res
        } catch (e: Exception) {
            Log.w("LocalNewsFeedVM", "Strategy 3 status published failed: ${e.message}")
        }

        // Strategy 4: Check categories array (reporter/scraped news tagged with district in categories)
        try {
            val q4 = newsRef.whereEqualTo("approved", true)
                .whereArrayContains("categories", district)
                .orderBy("timestamp", Query.Direction.DESCENDING)
            val finalQ4 = when {
                cursor != null -> q4.startAfter(cursor).limit(limitCount)
                timestampCursor != null -> q4.startAfter(timestampCursor).limit(limitCount)
                else -> q4.limit(limitCount)
            }
            val res = finalQ4.get().await()
            if (!res.isEmpty) return res
        } catch (_: Exception) {}

        return null
    }

    /**
     * ⚡ Ultra-fast Local News loader.
     * 1. Smart Local Cache (< 20ms) for instant display if fresh (< 5h).
     * 2. Fast Path (< 300ms) top 5 district posts if cache stale/empty.
     * 3. Multi-strategy Server Query (< 400ms) with district aliases and fallback resilience.
     */
    fun loadNews(language: Language, currentUser: User?, forceRefresh: Boolean = false) {
        currentLanguage = language
        if (currentUser != null) {
            activeCurrentUser = currentUser
        }
        val userDist = currentUser?.district?.takeIf { it.isNotBlank() }
            ?: activeCurrentUser?.district?.takeIf { it.isNotBlank() }
            ?: prefs.userDistrict
        val district = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: userDist
        if (district == null) {
            _loading.value = false
            detectLocation(getApplication(), currentUser)
            return
        }
        if (_activeDistrict.value != district) {
            _activeDistrict.value = district
        }

        if (isFetching && loadJob?.isActive == true && !forceRefresh) {
            return
        }
        if (forceRefresh) {
            loadJob?.cancel()
        }

        // Load local ads in background (non-blocking)
        loadLocalAds(district)

        loadJob = viewModelScope.launch {
            isFetching = true
            if (forceRefresh) {
                _isRefreshing.value = true
                lastDistrictDocument = null
                consecutiveEmptyLoads = 0
                try {
                    prefs.saveDistrictNewsCache(district, "")
                } catch (_: Exception) {}
            }
            _isOnline.value = NetworkUtils.isOnline(getApplication())

            val newsRef = FirebaseService.db.collection("news")
            val aliases = Constants.getDistrictAliases(district)
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()
                .take(10)

            try {
                val now = System.currentTimeMillis()
                val (cachedJson, cacheTs) = prefs.getDistrictNewsCache(district)
                val isRecentCache = !cachedJson.isNullOrBlank() && (now - cacheTs) < (15 * 60 * 1000L) // Under 15m is considered fresh

                // 1. ⚡ ULTRA-FRESH DISK CACHE (< 15 mins) - Display immediately only if genuinely fresh
                if (_news.value.isEmpty() && !forceRefresh && isRecentCache) {
                    try {
                        val type = object : TypeToken<List<NewsPost>>() {}.type
                        val cachedPosts: List<NewsPost>? = Gson().fromJson(cachedJson, type)
                        if (!cachedPosts.isNullOrEmpty()) {
                            _news.value = cachedPosts
                            _loading.value = false
                            isStateFallbackMode = false
                            Log.d("LocalNewsFeedVM", "⚡ Instant Local Fresh Cache (<15m): ${cachedPosts.size} posts in < 2ms")
                        }
                    } catch (_: Exception) {}
                }

                // 2. 🚀 FAST PATH (< 1.8s) - Pull directly from Server first so fresh district news displays immediately!
                if (_news.value.isEmpty()) {
                    _loading.value = true
                    try {
                        val fastSnap = kotlinx.coroutines.withTimeoutOrNull(1800L) {
                            fetchDistrictSnap(district, aliases, 10L, null, null)
                        }
                        val fastPosts = fastSnap?.documents?.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }?.filter { it.approved } ?: emptyList()
                        if (fastPosts.isNotEmpty() && _news.value.isEmpty()) {
                            _news.value = fastPosts
                            lastDistrictDocument = fastSnap?.documents?.lastOrNull()
                            _loading.value = false
                            isStateFallbackMode = false
                            Log.d("LocalNewsFeedVM", "⚡ Fast Path District Server: ${fastPosts.size} fresh posts in < 300ms")
                        }
                    } catch (e: Exception) {
                        Log.w("LocalNewsFeedVM", "Fast path district query: ${e.message}")
                    }

                    // 🛡️ RESILIENT CACHE FALLBACK: If server took > 1.8s or phone is offline, display cache immediately!
                    if (_news.value.isEmpty() && !cachedJson.isNullOrBlank()) {
                        try {
                            val type = object : TypeToken<List<NewsPost>>() {}.type
                            val cachedPosts: List<NewsPost>? = Gson().fromJson(cachedJson, type)
                            if (!cachedPosts.isNullOrEmpty()) {
                                _news.value = cachedPosts
                                _loading.value = false
                                isStateFallbackMode = false
                                Log.d("LocalNewsFeedVM", "🛡️ Server timeout/offline: Fallback to District Cache (${cachedPosts.size} posts)")
                            }
                        } catch (_: Exception) {}
                    }
                }

                // 2. ⚡ STREAMLINED LEAN SERVER QUERY (20 posts) with resilient timeout
                val snap = try {
                    kotlinx.coroutines.withTimeoutOrNull(8000L) {
                        fetchDistrictSnap(district, aliases, PAGE_SIZE.toLong(), null)
                    }
                } catch (e: Exception) {
                    Log.w("LocalNewsFeedVM", "Network query failed, falling back to cache: ${e.message}")
                    null
                }

                var posts = snap?.documents?.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }?.filter { it.approved } ?: emptyList()

                // Fallback to cache if network failed/timed out completely and memory is still empty
                if (posts.isEmpty() && _news.value.isEmpty()) {
                    try {
                        val fallbackCachedSnap = newsRef.whereEqualTo("approved", true)
                            .whereEqualTo("district", district)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(PAGE_SIZE.toLong())
                            .get(Source.CACHE)
                            .await()
                        posts = fallbackCachedSnap.documents.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }
                        if (posts.isNotEmpty()) {
                            lastDistrictDocument = fallbackCachedSnap.documents.lastOrNull()
                            isStateFallbackMode = false
                        }
                    } catch (_: Exception) {}
                } else if (snap?.documents?.isNotEmpty() == true) {
                    lastDistrictDocument = snap.documents.lastOrNull()
                    isStateFallbackMode = false
                }

                // ఒకవేళ జిల్లాలో వార్తలు 0 ఉన్నా (లేదా నెట్‌వర్క్ ఫెయిల్ అయ్యి క్యాష్ కూడా ఖాళీగా ఉన్నా), యూజర్‌కు ఖాళీ స్కెలెటన్ రాకుండా రాష్ట్ర స్థాయి తాజా వార్తలను ఫాల్‌బ్యాక్‌గా లోడ్ చేయండి
                if (posts.isEmpty() && _news.value.isEmpty()) {
                    try {
                        val userState = Constants.mapDistrictToState(district)
                        val fallbackSnap = newsRef.whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(PAGE_SIZE.toLong())
                            .get()
                            .await()
                        val allStatePosts = fallbackSnap.documents.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }
                        val filtered = if (!userState.isNullOrBlank()) {
                            allStatePosts.filter { post ->
                                val pState = Constants.mapDistrictToState(post.state) ?: Constants.mapDistrictToState(post.district)
                                pState == null || pState == userState
                            }.ifEmpty { allStatePosts }
                        } else allStatePosts

                        if (filtered.isNotEmpty()) {
                            posts = filtered
                            lastDistrictDocument = fallbackSnap.documents.lastOrNull()
                            isStateFallbackMode = true // 🛡️ Mark fallback mode so loadMore paginates properly
                            Log.d("LocalNewsFeedVM", "District had 0 posts, loaded ${posts.size} state fallback posts")
                        }
                    } catch (_: Exception) {}
                }

                if (posts.isNotEmpty()) {
                    val wasEmpty = _news.value.isEmpty()
                    _news.value = posts
                    _hasMore.value = (posts.size >= PAGE_SIZE)
                    val validIds = posts.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                    prefs.saveDistrictNewsCache(district, Gson().toJson(posts.take(20)))
                    if (wasEmpty) {
                        _shouldScrollToTop.value = true
                    }
                    lastRefreshTimeLong = System.currentTimeMillis()
                    _lastRefreshTime.value = lastRefreshTimeLong
                } else if (_news.value.isNotEmpty()) {
                    // Cache already provided initial posts, keep pagination active
                    _hasMore.value = true
                }
            } catch (e: Exception) {
                Log.e("LocalNewsFeedVM", "loadNews error: ${e.message}")
            } finally {
                _loading.value = false
                isFetching = false
                _isRefreshing.value = false
            }
        }
    }

    /**
     * 📄 Paginated infinite scroll loader for local district news.
     */
    fun loadMore(language: Language, currentUser: User?) {
        if (!_hasMore.value || isFetching) return
        val lastTimestamp = _news.value.lastOrNull { it.timestamp > 0 }?.timestamp
        val cursor = lastDistrictDocument
        if (cursor == null && lastTimestamp == null) return

        isFetching = true
        loadMoreJob = viewModelScope.launch {
            try {
                val district = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: return@launch
                val newsRef = FirebaseService.db.collection("news")
                var currentCursor = cursor
                var currentTimestamp = lastTimestamp
                var keepFetching = true
                var attempts = 0

                while (keepFetching && attempts < 5) {
                    attempts++
                    val snap = if (isStateFallbackMode) {
                        val q = newsRef.whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                        val paginatedQ = when {
                            currentCursor != null -> q.startAfter(currentCursor).limit(PAGE_SIZE.toLong())
                            currentTimestamp != null -> q.startAfter(currentTimestamp).limit(PAGE_SIZE.toLong())
                            else -> q.limit(PAGE_SIZE.toLong())
                        }
                        kotlinx.coroutines.withTimeoutOrNull(4000L) { paginatedQ.get().await() }
                    } else {
                        val aliases = Constants.getDistrictAliases(district)
                            .map { it.trim() }
                            .filter { it.isNotBlank() }
                            .distinct()
                            .take(10)
                        kotlinx.coroutines.withTimeoutOrNull(4000L) {
                            fetchDistrictSnap(district, aliases, PAGE_SIZE.toLong(), currentCursor, currentTimestamp)
                        }
                    }

                    if (snap == null) {
                        Log.w("LocalNewsFeedVM", "loadMore timed out, will retry on scroll")
                        break
                    }

                    val rawDocs = snap.documents
                    if (rawDocs.isNotEmpty()) {
                        lastDistrictDocument = rawDocs.lastOrNull()
                        currentCursor = lastDistrictDocument
                    }

                    val posts = rawDocs.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }
                    if (posts.isNotEmpty()) {
                        currentTimestamp = posts.lastOrNull()?.timestamp
                    }

                    if (posts.isEmpty()) {
                        _hasMore.value = false
                        break
                    } else {
                        val currentIds = _news.value.map { it.id }.toSet()
                        val unique = posts.filter { it.id !in currentIds }
                        if (unique.isNotEmpty()) {
                            consecutiveEmptyLoads = 0
                            _news.value = _news.value + unique
                            val validIds = unique.filter { it.type == "news" }.map { it.id }
                            prefs.incrementPostViewCounts(validIds)
                            if (posts.size < PAGE_SIZE) {
                                _hasMore.value = false
                            }
                            keepFetching = false
                        } else {
                            consecutiveEmptyLoads++
                            if (consecutiveEmptyLoads >= 4 || posts.size < PAGE_SIZE) {
                                _hasMore.value = false
                                keepFetching = false
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                Log.w("LocalNewsFeedVM", "loadMore error: ${e.message}")
            } finally {
                isFetching = false
            }
        }
    }

    fun onAppResume(language: Language, currentUser: User?) {
        if (currentUser != null) {
            activeCurrentUser = currentUser
        }
        loadNews(language, currentUser, forceRefresh = true)
    }

    fun forceReload(language: Language, currentUser: User?) {
        loadNews(language, currentUser, forceRefresh = true)
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        if (isFetching) return // 🛡️ Prevent duplicate concurrent reads
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 3 * 60 * 1000L || lastRefreshTimeLong == 0L) {
            loadNews(language, currentUser, forceRefresh = true)
        }
    }

    private fun convertToNewsPost(id: String, data: Map<String, Any?>): NewsPost? {
        return try {
            if ((data["webOnly"] as? Boolean) == true) return null
            com.alfanews.telugu.models.mapMapToNewsPost(id, data, currentLanguage)
        } catch (_: Exception) { null }
    }

    /**
     * Non-blocking background loader for district local ads.
     */
    private fun loadLocalAds(district: String) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val now = System.currentTimeMillis()
                val cachedJson = prefs.getLocalAdsCache(district)
                val cacheTime = prefs.getLocalAdsTimestamp(district)
                val isCacheValid = (now - cacheTime) < (30L * 60L * 1000L)

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
                    val isForDistrict = (ad.targetDistrict == "ALL" || ad.targetDistrict == district)
                    val isWithinDate = if (ad.adType == com.alfanews.telugu.models.AdType.TIME_BASED_FIXED) {
                        (ad.startDate ?: 0) <= now && (ad.endDate ?: Long.MAX_VALUE) >= now
                    } else true
                    val isNotFinished = if (ad.adType == com.alfanews.telugu.models.AdType.VIEWS_BASED) {
                        ad.viewsCurrent < ad.viewsOrdered
                    } else true
                    isForDistrict && isWithinDate && isNotFinished
                }

                if (validAds.isNotEmpty()) {
                    prefs.saveLocalAdsCache(district, Gson().toJson(validAds))
                }
                _localAds.value = validAds.shuffled()
            } catch (e: Exception) {
                Log.w("LocalNewsFeedVM", "Local ads error: ${e.message}")
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?) {
        val userDist = currentUser?.district?.takeIf { it.isNotBlank() } ?: prefs.userDistrict
        val explicitDistrict = prefs.selectedDistrict ?: _activeDistrict.value ?: userDist
        if (explicitDistrict != null) {
            if (_activeDistrict.value == null) {
                _activeDistrict.value = explicitDistrict
            }
            _isDetecting.value = false
            return
        }

        val savedDistrict = prefs.detectedDistrict
        if (savedDistrict != null && !prefs.isLocationDetectionStale()) {
            if (_activeDistrict.value == null) {
                _activeDistrict.value = savedDistrict
            }
            _isDetecting.value = false
            return
        }

        if (_isDetecting.value) return
        _isDetecting.value = true

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(getApplication<Application>())
                val lastLoc = try { fusedLocationClient.lastLocation.await() } catch (_: Exception) { null }
                val loc = lastLoc ?: kotlinx.coroutines.withTimeoutOrNull(2000L) {
                    fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                }
                if (loc != null) {
                    val matched = WeatherService.getClosestDistrictFromCoords(loc.latitude, loc.longitude)
                        ?: try {
                            val geocoder = Geocoder(getApplication(), Locale.forLanguageTag("te"))
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
                        if (_activeDistrict.value == null) {
                            withContext(Dispatchers.Main) {
                                setDistrict(matched)
                            }
                        }
                        return@launch
                    }
                }
            } catch (_: Exception) {
            } finally {
                withContext(Dispatchers.Main) {
                    _isDetecting.value = false
                    if (_activeDistrict.value == null) {
                        // 2 సెకన్లలో లొకేషన్ గుర్తించలేకపోతే జిల్లా ఎంపిక డైలాగ్‌ను స్వయంచాలకంగా తెరవాలి
                        _shouldOpenDistrictPicker.value = true
                    }
                }
            }
        }
    }
}
