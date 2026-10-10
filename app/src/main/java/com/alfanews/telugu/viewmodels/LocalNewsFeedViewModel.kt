package com.alfanews.telugu.viewmodels

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.location.Geocoder
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.PreferenceManager
import com.alfanews.telugu.utils.NotificationHelper
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.LocationHierarchyManager
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
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

class LocalNewsFeedViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    private var currentLanguage: Language = Language.TELUGU
    
    private val _news = MutableStateFlow<List<NewsPost>>(emptyList())
    val news: StateFlow<List<NewsPost>> = _news.asStateFlow()
    
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()
    
    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()
    
    private val _activeDistrict = MutableStateFlow(prefs.getEffectiveDistrict() ?: prefs.userDistrict)
    val activeDistrict: StateFlow<String?> = _activeDistrict.asStateFlow()
    
    private val _localAds = MutableStateFlow<List<com.alfanews.telugu.models.LocalAd>>(emptyList())
    val localAds: StateFlow<List<com.alfanews.telugu.models.LocalAd>> = _localAds.asStateFlow()

    private val _isDetecting = MutableStateFlow(false)
    val isDetecting: StateFlow<Boolean> = _isDetecting.asStateFlow()

    private val _lastRefreshTime = MutableStateFlow(0L)
    val lastRefreshTime: StateFlow<Long> = _lastRefreshTime.asStateFlow()

    private val _shouldScrollToTop = MutableStateFlow(false)
    val shouldScrollToTop: StateFlow<Boolean> = _shouldScrollToTop.asStateFlow()

    init {
        val initialDist = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: prefs.userDistrict ?: "హైదరాబాద్"
        _activeDistrict.value = initialDist

        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != null && district != _activeDistrict.value) {
                    _activeDistrict.value = district
                    _hasMore.value = true
                    lastDocument = null
                    loadNews(Language.TELUGU, null, forceRefresh = true)
                }
            }
        }
        loadNews(Language.TELUGU, null)
    }

    fun resetScrollSignal() {
        _shouldScrollToTop.value = false
    }

    private var pendingLoadMore = false
    private var lastDocument: DocumentSnapshot? = null
    private var lastRefreshTimeLong: Long = 0
    private val pageSize = 20
    private var loadJob: Job? = null
    private var isFetching = false
    private var consecutiveEmptyLoads = 0
    
    fun setDistrict(district: String) {
        if (prefs.selectedDistrict == district && _activeDistrict.value == district) return
        val oldDistrict = prefs.selectedDistrict ?: prefs.detectedDistrict
        prefs.selectedDistrict = district
        _activeDistrict.value = district
        
        if (_news.value.isEmpty()) {
            _loading.value = true
        }
        _hasMore.value = true
        lastDocument = null
        AnalyticsService.logDistrictSelected(district, oldDistrict)
        viewModelScope.launch {
            NotificationHelper.syncDistrictTopic(getApplication(), district)
        }
        loadNews(Language.TELUGU, null) 
    }
    
    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?) {
        val userDist = currentUser?.district?.takeIf { it.isNotBlank() } ?: prefs.userDistrict
        val explicitDistrict = prefs.selectedDistrict ?: userDist
        // 🚀 PRIORITY: యూజర్ లేదా రిపోర్టర్ ప్రొఫైల్‌లో ఇప్పటికే జిల్లా ఉంటే నేరుగా ఆ జిల్లాను యాక్టివేట్ చేస్తాం
        if (explicitDistrict != null) {
            _activeDistrict.value = explicitDistrict
            _isDetecting.value = false
            if (_news.value.isEmpty()) {
                loadNews(Language.TELUGU, currentUser)
            }
            return
        }

        val savedDistrict = prefs.detectedDistrict
        // 🛡️ 48-Hour GPS Throttling: గత 48 గంటల్లో లొకేషన్ రికార్డ్ అయి ఉంటే మళ్లీ GPS ఆన్ చేయకుండా క్యాష్ చేసిన లొకేషన్ వాడతాము
        if (savedDistrict != null && !prefs.isLocationDetectionStale()) {
            _activeDistrict.value = savedDistrict
            _isDetecting.value = false
            if (_news.value.isEmpty()) {
                loadNews(Language.TELUGU, currentUser)
            }
            return
        }

        if (_isDetecting.value) return
        _isDetecting.value = true
        
        viewModelScope.launch {
            try {
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(getApplication<Application>())
                val lastLoc = try { fusedLocationClient.lastLocation.await() } catch (e: Exception) { null }
                val loc = lastLoc ?: kotlinx.coroutines.withTimeoutOrNull(2500L) {
                    fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                }
                if (loc != null) {
                    val detectedDistrict = getDistrictFromCoords(loc.latitude, loc.longitude)
                    if (detectedDistrict != null) {
                        updateDetectedDistrict(detectedDistrict, currentUser)
                    } else {
                        finalizeDetection()
                    }
                } else {
                    finalizeDetection()
                }
            } catch (e: Exception) {
                finalizeDetection()
            }
        }
    }

    private fun finalizeDetection() {
        _isDetecting.value = false
        _loading.value = false
    }

    private suspend fun getDistrictFromCoords(lat: Double, lon: Double): String? {
        return withContext(Dispatchers.IO) {
            try {
                prefs.lastLat = lat
                prefs.lastLon = lon
                prefs.lastLocationDetectionTime = System.currentTimeMillis()

                val addresses = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                    try {
                        val geocoder = Geocoder(getApplication(), Locale("te"))
                        @Suppress("DEPRECATION")
                        geocoder.getFromLocation(lat, lon, 1)
                    } catch (e: Exception) { null }
                }
                if (!addresses.isNullOrEmpty()) {
                    val address = addresses[0]
                    val localityPlace = address.locality ?: address.subLocality ?: address.subAdminArea
                    if (localityPlace != null) {
                        prefs.localPlace = localityPlace
                    }
                    val adminArea = address.adminArea ?: ""
                    if (adminArea.contains("Andhra", ignoreCase = true) || adminArea.contains("Telangana", ignoreCase = true)) {
                        val subAdmin = address.subAdminArea
                        val locality = address.locality
                        val detectedName = subAdmin ?: locality ?: adminArea
                        val district = findMatchingDistrict(detectedName)
                        if (district != null) {
                            val placeForMandal = locality ?: address.subLocality ?: address.featureName ?: localityPlace
                            val matchedMandal = LocationHierarchyManager.findMatchingMandal(district, placeForMandal)
                            if (matchedMandal != null) {
                                prefs.detectedMandal = matchedMandal
                            }
                            return@withContext district
                        }
                    }
                }
            } catch (e: Exception) { }
            null
        }
    }

    private fun updateDetectedDistrict(district: String, currentUser: User?) {
        prefs.saveDetectedDistrict(district)
        _activeDistrict.value = district
        _loading.value = false
        _isDetecting.value = false
        viewModelScope.launch {
            NotificationHelper.syncDistrictTopic(getApplication(), prefs.getEffectiveDistrict())
        }
        loadNews(Language.TELUGU, currentUser)
    }

    private fun findMatchingDistrict(name: String?): String? {
        if (name == null) return null
        return Constants.ALL_DISTRICTS.find { 
            it.contains(name, ignoreCase = true) || name.contains(it, ignoreCase = true)
        }
    }

    private fun getDistrictAliases(district: String?): List<String> {
        return Constants.getDistrictAliases(district)
    }

    private fun loadLocalAds(district: String) {
        viewModelScope.launch {
            try {
                val now = System.currentTimeMillis()
                val gson = Gson()
                
                // 1. Check Cache
                val cachedJson = prefs.getLocalAdsCache(district)
                val cacheTime = prefs.getLocalAdsTimestamp(district)
                val isCacheValid = (now - cacheTime) < (30L * 60L * 1000L) // 30 minutes
                
                val allAds = if (isCacheValid && cachedJson != null) {
                    Log.d("LocalNewsFeedVM", "Loading local ads from cache for $district")
                    val type = object : TypeToken<List<com.alfanews.telugu.models.LocalAd>>() {}.type
                    gson.fromJson<List<com.alfanews.telugu.models.LocalAd>>(cachedJson, type)
                } else {
                    Log.d("LocalNewsFeedVM", "Fetching local ads from Firestore for $district")
                    val snapshot = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                        FirebaseService.db.collection("local_ads")
                            .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                            .get().await()
                    }
                    
                    val ads = snapshot?.documents?.mapNotNull { com.alfanews.telugu.models.LocalAd.fromSnapshot(it) } ?: emptyList()
                    
                    // Save to cache
                    if (ads.isNotEmpty()) {
                        prefs.saveLocalAdsCache(district, gson.toJson(ads))
                    }
                    ads
                }

                val validAds = allAds.filter { ad ->
                    val isForDistrict = ad.targetDistrict == "ALL" || ad.targetDistrict == district
                    val isWithinDate = if (ad.adType == com.alfanews.telugu.models.AdType.TIME_BASED_FIXED) {
                        (ad.startDate ?: 0) <= now && (ad.endDate ?: Long.MAX_VALUE) >= now
                    } else true
                    val isNotFinished = if (ad.adType == com.alfanews.telugu.models.AdType.VIEWS_BASED) {
                        ad.viewsCurrent < ad.viewsOrdered
                    } else true
                    isForDistrict && isWithinDate && isNotFinished
                }
                
                // 2. Queue Logic (Seen vs Unseen)
                val seenIds = prefs.getSeenLocalAdIds()
                val unseenAds = validAds.filter { it.id !in seenIds }
                val seenAds = validAds.filter { it.id in seenIds }

                Log.d("LocalNewsFeedVM", "Ad Queue - Total: ${validAds.size}, Unseen: ${unseenAds.size}, Seen: ${seenAds.size}")

                if (unseenAds.isEmpty() && validAds.isNotEmpty()) {
                    Log.d("LocalNewsFeedVM", "All ads seen. Resetting seen list.")
                    prefs.clearSeenLocalAds()
                    _localAds.value = validAds.shuffled()
                } else {
                    _localAds.value = unseenAds.shuffled() + seenAds.shuffled()
                }
            } catch (e: Exception) {
                Log.e("LocalNewsFeedVM", "Error loading local ads: ${e.message}")
                _localAds.value = emptyList()
            }
        }
    }

    fun loadNews(language: Language, currentUser: User?, forceRefresh: Boolean = false) {
        currentLanguage = language
        val userDist = currentUser?.district?.takeIf { it.isNotBlank() } ?: prefs.userDistrict
        val district = _activeDistrict.value ?: prefs.selectedDistrict ?: userDist ?: prefs.detectedDistrict ?: "హైదరాబాద్"
        val districtChanged = (_activeDistrict.value != district)
        if (districtChanged) {
            _activeDistrict.value = district
        }
        
        // 🛡️ DEDUPLICATION GUARD: జిల్లా మారకుండా ఇప్పటికే లోడింగ్ నడుస్తుంటే అనవసరంగా రద్దు చేసి మళ్లీ మొదలుపెట్టవద్దు
        if (isFetching && !districtChanged && !forceRefresh) {
            Log.d("LocalNewsFeedVM", "Fetch already in progress for district: $district, skipping redundant call")
            return
        }

        // 🔄 BACKGROUND LOAD: Only show full-screen loading if we have no news to show.
        if (_news.value.isEmpty()) {
            _loading.value = true 
        }
        loadLocalAds(district) 
        loadJob?.cancel()
        isFetching = true
        
        loadJob = viewModelScope.launch {
            val newsRef = FirebaseService.db.collection("news")
            val cleanAliases = Constants.getDistrictAliases(district)
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()
                .take(10)

            _isOnline.value = com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())
            lastDocument = null
            _hasMore.value = true
            consecutiveEmptyLoads = 0

            try {
                // 🚀 PARALLEL FAST QUERY: జిల్లా ఫీల్డ్ మరియు క్యాటగిరీస్ అరే రెండింటినీ సమాంతరంగా తెస్తాము
                val distQuery = (if (cleanAliases.size > 1) {
                    newsRef.whereEqualTo("approved", true).whereIn("district", cleanAliases)
                } else if (cleanAliases.size == 1) {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", cleanAliases[0])
                } else {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                })
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(pageSize.toLong())

                val catQuery = (if (cleanAliases.size > 1) {
                    newsRef.whereEqualTo("approved", true).whereArrayContainsAny("categories", cleanAliases)
                } else if (cleanAliases.size == 1) {
                    newsRef.whereEqualTo("approved", true).whereArrayContainsAny("categories", listOf(cleanAliases[0]))
                } else {
                    newsRef.whereEqualTo("approved", true).whereArrayContainsAny("categories", listOf(district))
                })
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(pageSize.toLong())

                val distDeferred = async(Dispatchers.IO) {
                    kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        try { distQuery.get(Source.SERVER).await() } catch (e: Exception) {
                            Log.e("LocalNewsFeedVM", "distQuery error: ${e.message}")
                            null
                        }
                    }
                }
                val catDeferred = async(Dispatchers.IO) {
                    kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        try { catQuery.get(Source.SERVER).await() } catch (e: Exception) {
                            Log.e("LocalNewsFeedVM", "catQuery error: ${e.message}")
                            null
                        }
                    }
                }

                val distSnap = distDeferred.await()
                val catSnap = catDeferred.await()

                val distPosts = distSnap?.documents?.mapNotNull { doc ->
                    convertToNewsPost(doc.id, doc.data ?: emptyMap())
                } ?: emptyList()

                val catPosts = catSnap?.documents?.mapNotNull { doc ->
                    convertToNewsPost(doc.id, doc.data ?: emptyMap())
                } ?: emptyList()

                var finalPosts = (distPosts + catPosts).distinctBy { it.id }.sortedByDescending { it.timestamp }

                // 🛡️ ZERO-EMPTY GUARANTEE: ఒకవేళ ఆ జిల్లాకు నేరుగా వార్తలు లేకుంటే తాజా రాష్ట్ర వార్తలను చూపిస్తాం
                if (finalPosts.isEmpty()) {
                    Log.d("LocalNewsFeedVM", "No direct posts for $district, fetching fallback latest news")
                    val fallbackSnap = kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        try {
                            newsRef.whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                                .get(Source.SERVER).await()
                        } catch (e: Exception) {
                            Log.e("LocalNewsFeedVM", "fallbackSnap error: ${e.message}")
                            null
                        }
                    }
                    val fallbackPosts = fallbackSnap?.documents?.mapNotNull { doc ->
                        convertToNewsPost(doc.id, doc.data ?: emptyMap())
                    } ?: emptyList()
                    if (fallbackPosts.isNotEmpty()) {
                        finalPosts = fallbackPosts
                    }
                }

                lastDocument = distSnap?.documents?.lastOrNull() ?: catSnap?.documents?.lastOrNull()
                _hasMore.value = ((distSnap?.size() ?: 0) >= pageSize || (catSnap?.size() ?: 0) >= pageSize)

                if (finalPosts.isNotEmpty()) {
                    val wasEmpty = _news.value.isEmpty()
                    _news.value = finalPosts
                    val validIds = finalPosts.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                    if (wasEmpty) {
                        _shouldScrollToTop.value = true
                    }
                }
                _loading.value = false

                val currentTime = System.currentTimeMillis()
                lastRefreshTimeLong = currentTime
                _lastRefreshTime.value = currentTime
            } catch (e: Exception) {
                 Log.e("LocalNewsFeedVM", "loadNews exception: ${e.message}", e)
            } finally {
                // 🛡️ RACE CONDITION SHIELD: ఈ కొరుటీన్ ఇంకా యాక్టివ్ జాబ్ అయితేనే లోడింగ్ మరియు ఫెచింగ్ స్టేట్ రీసెట్ చేయాలి
                if (coroutineContext[Job] == loadJob) {
                    _loading.value = false
                    isFetching = false
                    if (pendingLoadMore && _hasMore.value) {
                        pendingLoadMore = false
                        if (_news.value.isNotEmpty()) {
                            loadMore(currentLanguage, currentUser)
                        }
                    }
                }
            }
        }
    }
    
    fun loadMore(language: Language, currentUser: User?) {
        currentLanguage = language
        val district = _activeDistrict.value ?: return
        if (!_hasMore.value) return
        if (isFetching) {
            pendingLoadMore = true
            return
        }

        viewModelScope.launch {
            isFetching = true
            try {
                val newsRef = FirebaseService.db.collection("news")
                val cleanAliases = Constants.getDistrictAliases(district)
                    .map { it.trim() }
                    .filter { it.isNotBlank() }
                    .distinct()
                    .take(10)

                val baseQ = if (cleanAliases.size > 1) {
                    newsRef.whereEqualTo("approved", true).whereIn("district", cleanAliases)
                } else if (cleanAliases.size == 1) {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", cleanAliases[0])
                } else {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                }

                var q = baseQ
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(pageSize.toLong())

                val lastDoc = lastDocument
                if (lastDoc != null) {
                    q = q.startAfter(lastDoc)
                }

                val snap = kotlinx.coroutines.withTimeoutOrNull(10000L) {
                    try { q.get(Source.SERVER).await() } catch (e: Exception) { null }
                }

                if (snap != null && !snap.isEmpty) {
                    lastDocument = snap.documents.lastOrNull()
                    _hasMore.value = snap.size() >= pageSize

                    val fetchedPosts = withContext(Dispatchers.Default) {
                        snap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                    }

                    val currentIds = _news.value.map { it.id }.toSet()
                    val uniqueNewPosts = fetchedPosts.filter { post -> !currentIds.contains(post.id) }

                    if (uniqueNewPosts.isNotEmpty()) {
                        val rankedNewPosts = withContext(Dispatchers.Default) {
                            rankLocalNews(uniqueNewPosts, district, currentUser)
                        }
                        val postsToAppend = if (rankedNewPosts.isNotEmpty()) rankedNewPosts else uniqueNewPosts.sortedByDescending { it.timestamp }
                        _news.value = _news.value + postsToAppend
                        val validIds = postsToAppend.filter { it.type == "news" }.map { it.id }
                        if (validIds.isNotEmpty()) {
                            prefs.incrementPostViewCounts(validIds)
                        }
                    }
                } else {
                    _hasMore.value = false
                }
            } catch (e: Exception) {
                android.util.Log.e("LocalNewsFeedViewModel", "LoadMore query failed: ${e.message}")
                _hasMore.value = false
            } finally {
                isFetching = false
                if (pendingLoadMore && _hasMore.value) {
                    pendingLoadMore = false
                    loadMore(language, currentUser)
                }
            }
        }
    }
    
    fun onAppResume(language: Language, currentUser: User?) {
        refreshIfStale(language, currentUser)
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 60000 || _news.value.isEmpty()) {
            loadNews(language, currentUser)
        }
    }

    /**
     * అన్ని జిల్లా వార్తలను తాజాదనం (timestamp descending) ఆధారంగా నేరుగా చూపిస్తాము.
     * ఎల్లప్పుడూ తాజా వార్తలే (Newest First) మొదట కనిపించాలి.
     */
    private fun rankLocalNews(
        posts: List<NewsPost>,
        district: String,
        currentUser: User?
    ): List<NewsPost> {
        if (posts.isEmpty()) return emptyList()

        // 🚀 ఎల్లప్పుడూ తాజా వార్తలే మొదట రావాలి (Strict Timestamp Descending, no pinning of old posts)
        return posts.sortedByDescending { it.timestamp }.distinctBy { it.id }
    }

    private fun convertToNewsPost(id: String, data: Map<String, Any?>): NewsPost? {
        return try {
            if ((data["webOnly"] as? Boolean) == true) return null
            com.alfanews.telugu.models.mapMapToNewsPost(id, data, currentLanguage)
        } catch (e: Exception) {
            null
        }
    }
}
