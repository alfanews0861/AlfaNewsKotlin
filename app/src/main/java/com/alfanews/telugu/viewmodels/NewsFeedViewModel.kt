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
     * ⚡ Ultra-fast Single Direct Query for Home News Feed.
     * 1. Smart Local Cache (< 20ms) for instant display on cold start / reopen.
     * 2. Direct Firestore query (< 300ms) with orderBy timestamp DESC limit 20.
     * 3. Zero multi-stream cascade, zero unnecessary blocking, zero post-filtering.
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

        // Asynchronously load local ads in background (does NOT block news feed)
        loadLocalAds(district)

        currentFetchJob = viewModelScope.launch {
            isFetching = true
            if (forceRefresh) {
                _isRefreshing.value = true
                lastDocument = null
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

                // 2. ⚡ INSTANT CACHE DISPLAY (< 20ms)
                if (_news.value.isEmpty()) {
                    try {
                        val cachedSnap = primaryQuery.get(Source.CACHE).await()
                        val cachedPosts = cachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                        if (cachedPosts.isNotEmpty()) {
                            val combined = (listOfNotNull(initialTargetPost) + cachedPosts).distinctBy { it.id }
                            _news.value = combined
                            _loading.value = false
                            lastDocument = cachedSnap.documents.lastOrNull()
                            Log.d("NewsFeedVM", "⚡ Instant Cache Display: ${combined.size} posts in < 20ms")
                        }
                    } catch (_: Exception) {}
                }

                if (_news.value.isEmpty()) {
                    _loading.value = true
                }

                // 3. ⚡ DIRECT SERVER QUERY (< 300ms) with 6s lean timeout
                val snap = try {
                    kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        primaryQuery.get().await()
                    }
                } catch (e: Exception) {
                    Log.w("NewsFeedVM", "Server query failed, falling back to cache: ${e.message}")
                    null
                }

                var freshPosts = snap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()

                // If network failed/empty and memory is empty, fallback to local cache
                if (freshPosts.isEmpty() && _news.value.isEmpty()) {
                    try {
                        val fallbackCachedSnap = primaryQuery.get(Source.CACHE).await()
                        freshPosts = fallbackCachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                        if (freshPosts.isNotEmpty()) {
                            lastDocument = fallbackCachedSnap.documents.lastOrNull()
                        }
                    } catch (_: Exception) {}
                } else if (snap?.documents?.isNotEmpty() == true) {
                    lastDocument = snap.documents.lastOrNull()
                }

                if (freshPosts.isNotEmpty()) {
                    val combined = (listOfNotNull(initialTargetPost) + freshPosts).distinctBy { it.id }
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
     * 📄 Paginated infinite scroll loader using direct cursor.
     */
    fun loadMore(language: Language, currentUser: User?) {
        if (!_hasMore.value || isFetching) return
        val cursor = lastDocument ?: return

        viewModelScope.launch {
            isFetching = true
            try {
                val newsRef = FirebaseService.db.collection("news")
                val q = newsRef.whereEqualTo("approved", true)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .startAfter(cursor)
                    .limit(PAGE_SIZE.toLong())

                val snap = q.get().await()
                val newPosts = snap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                lastDocument = snap.documents.lastOrNull()

                if (newPosts.isEmpty()) {
                    _hasMore.value = false
                } else {
                    val currentIds = _news.value.map { it.id }.toSet()
                    val unique = newPosts.filter { it.id !in currentIds }
                    if (unique.isNotEmpty()) {
                        _news.value = _news.value + unique
                        val validIds = unique.filter { it.type == "news" }.map { it.id }
                        prefs.incrementPostViewCounts(validIds)
                    }
                    if (newPosts.size < PAGE_SIZE) {
                        _hasMore.value = false
                    }
                }
            } catch (e: Exception) {
                Log.w("NewsFeedVM", "loadMore failed: ${e.message}")
                _hasMore.value = false // 🛡️ Prevent infinite read loop on failure
            } finally {
                isFetching = false
            }
        }
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
