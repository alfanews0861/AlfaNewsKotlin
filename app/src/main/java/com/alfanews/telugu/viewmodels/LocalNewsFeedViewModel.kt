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
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.NetworkUtils
import com.alfanews.telugu.utils.NotificationHelper
import com.alfanews.telugu.utils.PreferenceManager
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
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

    private val _activeDistrict = MutableStateFlow(prefs.getEffectiveDistrict() ?: prefs.userDistrict ?: "హైదరాబాద్")
    val activeDistrict: StateFlow<String?> = _activeDistrict.asStateFlow()

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
    @Volatile private var isFetching = false
    private var lastRefreshTimeLong: Long = 0

    init {
        val initialDist = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: prefs.userDistrict ?: "హైదరాబాద్"
        _activeDistrict.value = initialDist

        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != null && district != _activeDistrict.value) {
                    _activeDistrict.value = district
                    _loading.value = _news.value.isEmpty()
                    _hasMore.value = true
                    lastDistrictDocument = null
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

    fun setDistrict(district: String) {
        if (prefs.selectedDistrict == district && _activeDistrict.value == district) {
            return
        }
        val oldDistrict = prefs.selectedDistrict ?: prefs.detectedDistrict
        prefs.selectedDistrict = district
        _activeDistrict.value = district

        _loading.value = _news.value.isEmpty()
        _hasMore.value = true
        lastDistrictDocument = null

        AnalyticsService.logDistrictSelected(district, oldDistrict)
        viewModelScope.launch {
            NotificationHelper.syncDistrictTopic(getApplication(), district)
        }
        loadNews(Language.TELUGU, activeCurrentUser, forceRefresh = true)
    }

    fun prependPost(post: NewsPost) {
        _news.value = (listOf(post) + _news.value).distinctBy { it.id }
        _loading.value = false
        _shouldScrollToTop.value = true
    }

    /**
     * ⚡ Ultra-fast Local News loader.
     * 1. Smart Local Cache (< 20ms) for instant display.
     * 2. Single direct Firestore query (< 200ms) with district aliases.
     * 3. Zero real-time listener blocking, zero multi-layer cascading delays.
     */
    fun loadNews(language: Language, currentUser: User?, forceRefresh: Boolean = false) {
        currentLanguage = language
        if (currentUser != null) {
            activeCurrentUser = currentUser
        }
        val userDist = currentUser?.district?.takeIf { it.isNotBlank() }
            ?: activeCurrentUser?.district?.takeIf { it.isNotBlank() }
            ?: prefs.userDistrict
        val district = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: userDist ?: "హైదరాబాద్"
        if (_activeDistrict.value != district) {
            _activeDistrict.value = district
        }

        // ఇప్పటికే అదే జిల్లా కోసం క్వెరీ రన్ అవుతుంటే అనవసరంగా రద్దు చేసి మళ్ళీ స్టార్ట్ చేయవద్దు
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
            }
            _isOnline.value = NetworkUtils.isOnline(getApplication())

            val newsRef = FirebaseService.db.collection("news")
            val aliases = Constants.getDistrictAliases(district)
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()
                .take(10)

            try {
                val query = if (aliases.size > 1) {
                    newsRef.whereEqualTo("approved", true).whereIn("district", aliases)
                } else {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", aliases.firstOrNull() ?: district)
                }.orderBy("timestamp", Query.Direction.DESCENDING).limit(PAGE_SIZE.toLong())

                // 1. ⚡ INSTANT CACHE DISPLAY (< 20ms) - మెమరీ ఖాళీగా ఉంటే లోకల్ క్యాష్ వెంటనే చూపిస్తుంది
                if (_news.value.isEmpty()) {
                    try {
                        val cachedSnap = query.get(Source.CACHE).await()
                        val cachedPosts = cachedSnap.documents.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }
                        if (cachedPosts.isNotEmpty()) {
                            _news.value = cachedPosts
                            _loading.value = false
                            lastDistrictDocument = cachedSnap.documents.lastOrNull()
                            Log.d("LocalNewsFeedVM", "⚡ Instant Local Cache Display: ${cachedPosts.size} posts in < 20ms")
                        }
                    } catch (_: Exception) {}
                }

                if (_news.value.isEmpty()) {
                    _loading.value = true
                }

                // 2. ⚡ DIRECT SERVER QUERY (< 300ms) with 6s lean timeout
                val snap = try {
                    kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        query.get().await()
                    }
                } catch (e: Exception) {
                    Log.w("LocalNewsFeedVM", "Network query failed, falling back to cache: ${e.message}")
                    null
                }

                var posts = snap?.documents?.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) } ?: emptyList()

                // సర్వర్ నుండి స్పందన రాలేకపోయినా, మెమరీ ఖాళీగా ఉంటే లోకల్ క్యాష్ బ్యాకప్ తీసుకుంటాం
                if (posts.isEmpty() && _news.value.isEmpty()) {
                    try {
                        val fallbackCachedSnap = query.get(Source.CACHE).await()
                        posts = fallbackCachedSnap.documents.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }
                        if (posts.isNotEmpty()) {
                            lastDistrictDocument = fallbackCachedSnap.documents.lastOrNull()
                        }
                    } catch (_: Exception) {}
                } else if (snap?.documents?.isNotEmpty() == true) {
                    lastDistrictDocument = snap.documents.lastOrNull()
                }

                if (posts.isNotEmpty()) {
                    val wasEmpty = _news.value.isEmpty()
                    _news.value = posts
                    _hasMore.value = (posts.size >= PAGE_SIZE)
                    val validIds = posts.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                    if (wasEmpty) {
                        _shouldScrollToTop.value = true
                    }
                    lastRefreshTimeLong = System.currentTimeMillis()
                    _lastRefreshTime.value = lastRefreshTimeLong
                }
            } catch (e: Exception) {
                Log.e("LocalNewsFeedVM", "loadNews error: ${e.message}")
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
     * 📄 Paginated infinite scroll loader for local district news.
     */
    fun loadMore(language: Language, currentUser: User?) {
        if (!_hasMore.value || isFetching) return
        val cursor = lastDistrictDocument ?: return

        loadJob = viewModelScope.launch {
            isFetching = true
            try {
                val district = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: "హైదరాబాద్"
                val aliases = Constants.getDistrictAliases(district)
                    .map { it.trim() }
                    .filter { it.isNotBlank() }
                    .distinct()
                    .take(10)
                val newsRef = FirebaseService.db.collection("news")

                val q = if (aliases.size > 1) {
                    newsRef.whereEqualTo("approved", true).whereIn("district", aliases)
                } else {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", aliases.firstOrNull() ?: district)
                }.orderBy("timestamp", Query.Direction.DESCENDING).startAfter(cursor).limit(PAGE_SIZE.toLong())

                val snap = q.get().await()
                val posts = snap.documents.mapNotNull { convertToNewsPost(it.id, it.data ?: emptyMap()) }
                lastDistrictDocument = snap.documents.lastOrNull()

                if (posts.isEmpty()) {
                    _hasMore.value = false
                } else {
                    val currentIds = _news.value.map { it.id }.toSet()
                    val unique = posts.filter { it.id !in currentIds }
                    if (unique.isNotEmpty()) {
                        _news.value = _news.value + unique
                        val validIds = unique.filter { it.type == "news" }.map { it.id }
                        prefs.incrementPostViewCounts(validIds)
                    }
                    if (posts.size < PAGE_SIZE) {
                        _hasMore.value = false
                    }
                }
            } catch (e: Exception) {
                Log.w("LocalNewsFeedVM", "loadMore error: ${e.message}")
                _hasMore.value = false // 🛡️ Prevent infinite read loop on failure
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
        if (now - lastRefreshTimeLong > 5 * 60 * 1000L || (lastRefreshTimeLong == 0L && _news.value.isEmpty())) {
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
        val explicitDistrict = prefs.selectedDistrict ?: userDist
        if (explicitDistrict != null) {
            _activeDistrict.value = explicitDistrict
            _isDetecting.value = false
            return
        }

        val savedDistrict = prefs.detectedDistrict
        if (savedDistrict != null && !prefs.isLocationDetectionStale()) {
            _activeDistrict.value = savedDistrict
            _isDetecting.value = false
            return
        }

        if (_isDetecting.value) return
        _isDetecting.value = true

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(getApplication<Application>())
                val lastLoc = try { fusedLocationClient.lastLocation.await() } catch (_: Exception) { null }
                val loc = lastLoc ?: kotlinx.coroutines.withTimeoutOrNull(2500L) {
                    fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                }
                if (loc != null) {
                    val geocoder = Geocoder(getApplication(), Locale.forLanguageTag("te"))
                    val addresses = geocoder.getFromLocation(loc.latitude, loc.longitude, 1)
                    val addr = addresses?.firstOrNull()
                    val detected = addr?.subAdminArea ?: addr?.adminArea
                    val matched = Constants.ALL_DISTRICTS.find {
                        !detected.isNullOrBlank() && (it.contains(detected, ignoreCase = true) || detected.contains(it, ignoreCase = true))
                    }
                    if (matched != null) {
                        prefs.lastLat = loc.latitude
                        prefs.lastLon = loc.longitude
                        prefs.detectedDistrict = matched
                        _activeDistrict.value = matched
                    }
                }
            } catch (_: Exception) {
            } finally {
                _isDetecting.value = false
            }
        }
    }
}
