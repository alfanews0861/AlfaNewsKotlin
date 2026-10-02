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
        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != _activeDistrict.value) {
                    _activeDistrict.value = district
                    _news.value = emptyList()
                    _loading.value = true
                    _hasMore.value = true
                    currentStage = LocalFeedStage.DISTRICT
                    lastDocument = null
                    isFetching = false
                    loadNews(Language.TELUGU, null)
                }
            }
        }
        val initialDist = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: prefs.userDistrict
        if (initialDist != null) {
            _activeDistrict.value = initialDist
            loadNews(Language.TELUGU, null)
        }
    }

    fun resetScrollSignal() {
        _shouldScrollToTop.value = false
    }

    enum class LocalFeedStage { DISTRICT, DISTRICT_CATEGORIES, DISTRICT_MANDALS }
    private var currentStage = LocalFeedStage.DISTRICT
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
        _news.value = emptyList() // 🔄 Clear old news to avoid confusion when switching districts
        _loading.value = true     // 🔄 Show preparation screen
        _hasMore.value = true
        currentStage = LocalFeedStage.DISTRICT
        lastDocument = null
        prefs.selectedDistrict = district
        _activeDistrict.value = district
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

    fun loadNews(language: Language, currentUser: User?) {
        currentLanguage = language
        val userDist = currentUser?.district?.takeIf { it.isNotBlank() } ?: prefs.userDistrict
        val district = _activeDistrict.value ?: prefs.selectedDistrict ?: userDist ?: prefs.detectedDistrict
        if (district == null) {
            _loading.value = false
            return
        }
        if (_activeDistrict.value != district) {
            _activeDistrict.value = district
        }
        
        // 🔄 BACKGROUND LOAD: Only show full-screen loading if we have no news to show.
        if (_news.value.isEmpty()) {
            _loading.value = true 
        }
        loadLocalAds(district) 
        loadJob?.cancel()
        isFetching = false
        
        loadJob = viewModelScope.launch {
            if (isFetching) return@launch
            isFetching = true
            
            val newsRef = FirebaseService.db.collection("news")
            val districtAliases = Constants.getDistrictAliases(district)
            val primaryAliases = districtAliases.take(10) // 🚀 Max 10 items for Firestore whereIn!
            val districtMandals = Constants.MANDAL_DATA[district] ?: emptyList()

            // 🚀 INSTANT LOCAL CACHE FIRST: Show cached local news instantly (< 20ms) so user never sees blank screen
            if (_news.value.isEmpty()) {
                try {
                    val cacheQuery = if (primaryAliases.size > 1) {
                        newsRef.whereEqualTo("approved", true).whereIn("district", primaryAliases)
                    } else if (primaryAliases.size == 1) {
                        newsRef.whereEqualTo("approved", true).whereEqualTo("district", primaryAliases[0])
                    } else {
                        newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                    }
                    val cachedSnap = cacheQuery
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                        .get(com.google.firebase.firestore.Source.CACHE)
                        .await()
                    val cachedPosts = cachedSnap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                    val rankedCached = rankLocalNews(cachedPosts, district, currentUser)
                    if (rankedCached.isNotEmpty()) {
                        _news.value = rankedCached
                        _loading.value = false
                    } else if (cachedPosts.isNotEmpty()) {
                        _news.value = cachedPosts
                        _loading.value = false
                    } else {
                        // 🚀 Fast local cache scan: Check if general cache has any posts for this district
                        try {
                            val generalCachedSnap = newsRef
                                .whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                                .get(com.google.firebase.firestore.Source.CACHE)
                                .await()
                            val generalPosts = generalCachedSnap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                            val districtMatches = generalPosts.filter { post ->
                                post.district == district || post.categories.contains(district) || Constants.isDistrictMatch(post.district, district)
                            }
                            if (districtMatches.isNotEmpty()) {
                                _news.value = districtMatches
                                _loading.value = false
                            }
                        } catch (e: Exception) { }
                    }
                } catch (e: Exception) { }
            }

            if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) {
                _isOnline.value = false
                if (_news.value.isEmpty()) {
                    // 📴 OFFLINE ONLY: Use local cache only when user has no internet connection
                    try {
                        val offlineQuery = if (primaryAliases.size > 1) {
                            newsRef.whereEqualTo("approved", true).whereIn("district", primaryAliases)
                        } else if (primaryAliases.size == 1) {
                            newsRef.whereEqualTo("approved", true).whereEqualTo("district", primaryAliases[0])
                        } else {
                            newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                        }
                        val cachedSnap = offlineQuery
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                            .get(com.google.firebase.firestore.Source.CACHE)
                            .await()
                        val cachedPosts = cachedSnap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                        if (cachedPosts.isNotEmpty()) {
                            _news.value = rankLocalNews(cachedPosts, district, currentUser)
                        }
                    } catch (e: Exception) { }
                }
                _loading.value = false
                isFetching = false
                return@launch
            }
            _isOnline.value = true

            lastDocument = null
            _hasMore.value = true
            consecutiveEmptyLoads = 0
            
            var fetchedAny = false
            
            try {
                val fetchedMap = mutableMapOf<String, NewsPost>()
                var snapshot: com.google.firebase.firestore.QuerySnapshot? = null

                try {
                    // 🚀 STEP 1: Search by 'district' field directly with whereIn / whereEqualTo
                    val step1Query = if (primaryAliases.size > 1) {
                        newsRef.whereEqualTo("approved", true).whereIn("district", primaryAliases)
                    } else if (primaryAliases.size == 1) {
                        newsRef.whereEqualTo("approved", true).whereEqualTo("district", primaryAliases[0])
                    } else {
                        newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                    }
                    val query = step1Query
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                    
                    val snap = kotlinx.coroutines.withTimeoutOrNull(8000L) {
                        query.get().await()
                    }
                    if (snap != null && !snap.isEmpty) {
                        currentStage = LocalFeedStage.DISTRICT
                        snapshot = snap
                        snap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                            .forEach { fetchedMap[it.id] = it }
                    }

                    // 🚀 STEP 2: Multi-source merge - Search by categories array with whereArrayContainsAny if fetched count is low
                    if (fetchedMap.size < pageSize) {
                        val categoryAliases = districtAliases.take(10)
                        val fallbackQuery = newsRef
                            .whereEqualTo("approved", true)
                            .whereArrayContainsAny("categories", categoryAliases)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                        
                        val fallbackSnapshot = kotlinx.coroutines.withTimeoutOrNull(7000L) {
                            fallbackQuery.get().await()
                        }
                        if (fallbackSnapshot != null && !fallbackSnapshot.isEmpty) {
                            if (snapshot == null) {
                                currentStage = LocalFeedStage.DISTRICT_CATEGORIES
                                snapshot = fallbackSnapshot
                            }
                            fallbackSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                                .forEach { fetchedMap[it.id] = it }
                        }
                    }

                    // 🚀 STEP 3: Multi-source merge - Search by mandals array if still low
                    if (fetchedMap.size < pageSize && districtMandals.isNotEmpty()) {
                        val mandalQuery = newsRef
                            .whereEqualTo("approved", true)
                            .whereArrayContainsAny("categories", districtMandals.take(10))
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                        
                        val mandalSnapshot = kotlinx.coroutines.withTimeoutOrNull(7000L) {
                            mandalQuery.get().await()
                        }
                        if (mandalSnapshot != null && !mandalSnapshot.isEmpty) {
                            if (snapshot == null) {
                                currentStage = LocalFeedStage.DISTRICT_MANDALS
                                snapshot = mandalSnapshot
                            }
                            mandalSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                                .forEach { fetchedMap[it.id] = it }
                        }
                    }

                    // 🚀 STEP 4: State / Approved news fallback if local district has zero news
                    if (fetchedMap.isEmpty()) {
                        val stateFallbackQuery = newsRef
                            .whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                        val stateSnap = kotlinx.coroutines.withTimeoutOrNull(7000L) {
                            stateFallbackQuery.get().await()
                        }
                        if (stateSnap != null && !stateSnap.isEmpty) {
                            if (snapshot == null) snapshot = stateSnap
                            stateSnap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                                .forEach { fetchedMap[it.id] = it }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("LocalNewsFeedViewModel", "News fetch failed for $district: ${e.message}")
                }
                
                lastDocument = snapshot?.documents?.lastOrNull()
                _hasMore.value = snapshot != null && !snapshot.isEmpty

                val rankedPosts = withContext(Dispatchers.Default) {
                    rankLocalNews(fetchedMap.values.toList(), district, currentUser)
                }

                val wasEmpty = _news.value.isEmpty()
                val finalPosts = rankedPosts
                if (finalPosts.isNotEmpty()) {
                    fetchedAny = true
                    _news.value = finalPosts
                    val validIds = finalPosts.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                    if (wasEmpty) {
                        _shouldScrollToTop.value = true
                    }
                } else {
                    // 🛡️ Firestore returned docs but rankLocalNews filtered ALL of them (too strict).
                    // Fallback: show raw fetched posts sorted by timestamp so user never sees empty screen.
                    val fallbackPosts = withContext(Dispatchers.Default) {
                        fetchedMap.values.toList().sortedByDescending { it.timestamp }
                    }
                    if (fallbackPosts.isNotEmpty()) {
                        fetchedAny = true
                        _news.value = fallbackPosts
                        val validIds = fallbackPosts.filter { it.type == "news" }.map { it.id }
                        prefs.incrementPostViewCounts(validIds)
                        if (wasEmpty) _shouldScrollToTop.value = true
                    } else {
                        // Genuinely empty — no more pages to load
                        _hasMore.value = false
                    }
                }
                _loading.value = false 

                val currentTime = System.currentTimeMillis()
                lastRefreshTimeLong = currentTime
                _lastRefreshTime.value = currentTime
            } catch (e: Exception) {
                 // Do not disable hasMore on network failure; allow user retry by swiping
            } finally {
                _loading.value = false
                isFetching = false
                if (pendingLoadMore && _hasMore.value) {
                    pendingLoadMore = false
                    if (fetchedAny) {
                        loadMore(currentLanguage, currentUser)
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

        var anyFetched = false
        viewModelScope.launch {
            isFetching = true
            try {
                val newsRef = FirebaseService.db.collection("news")
                val districtAliases = Constants.getDistrictAliases(district)
                val districtMandals = Constants.MANDAL_DATA[district] ?: emptyList()

                var attempts = 0
                var appendedCount = 0

                while (attempts < 3 && appendedCount == 0 && _hasMore.value) {
                    attempts++
                    var snap: com.google.firebase.firestore.QuerySnapshot? = null

                    when (currentStage) {
                        LocalFeedStage.DISTRICT -> {
                            val primaryAliases = districtAliases.take(10) // 🚀 Max 10 items for Firestore whereIn
                            val baseQ = if (primaryAliases.size > 1) {
                                newsRef.whereEqualTo("approved", true).whereIn("district", primaryAliases)
                            } else if (primaryAliases.size == 1) {
                                newsRef.whereEqualTo("approved", true).whereEqualTo("district", primaryAliases[0])
                            } else {
                                newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                            }
                            var q = baseQ
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                            val lastDocDistrict = lastDocument
                            if (lastDocDistrict != null) {
                                q = q.startAfter(lastDocDistrict)
                            }
                            val res = kotlinx.coroutines.withTimeoutOrNull(7500L) {
                                try { q.get().await() } catch (e: Exception) { null }
                            }
                            if (res != null && !res.isEmpty) {
                                snap = res
                            } else {
                                // Transition to DISTRICT_CATEGORIES
                                currentStage = LocalFeedStage.DISTRICT_CATEGORIES
                                lastDocument = null
                                continue
                            }
                        }
                        LocalFeedStage.DISTRICT_CATEGORIES -> {
                            val categoryAliases = districtAliases.take(10)
                            var q = newsRef
                                .whereEqualTo("approved", true)
                                .whereArrayContainsAny("categories", categoryAliases)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                            val lastDocCategory = lastDocument
                            if (lastDocCategory != null) {
                                q = q.startAfter(lastDocCategory)
                            }
                            val categoryRes = kotlinx.coroutines.withTimeoutOrNull(7000L) {
                                try { q.get().await() } catch (e: Exception) { null }
                            }
                            if (categoryRes != null && !categoryRes.isEmpty) {
                                snap = categoryRes
                            } else {
                                // Transition to DISTRICT_MANDALS
                                currentStage = LocalFeedStage.DISTRICT_MANDALS
                                lastDocument = null
                                continue
                            }
                        }
                        LocalFeedStage.DISTRICT_MANDALS -> {
                            if (districtMandals.isEmpty()) {
                                _hasMore.value = false
                                break
                            }
                            val mandalAliases = districtMandals.take(10)
                            var q = newsRef
                                .whereEqualTo("approved", true)
                                .whereArrayContainsAny("categories", mandalAliases)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                            val lastDocMandal = lastDocument
                            if (lastDocMandal != null) {
                                q = q.startAfter(lastDocMandal)
                            }
                            val mandalRes = kotlinx.coroutines.withTimeoutOrNull(7000L) {
                                try { q.get().await() } catch (e: Exception) { null }
                            }
                            if (mandalRes != null && !mandalRes.isEmpty) {
                                snap = mandalRes
                            } else {
                                lastDocument = null
                                _hasMore.value = false
                                break
                            }
                        }
                    }

                    if (snap != null && !snap.isEmpty) {
                        lastDocument = snap.documents.lastOrNull()
                        val fetchedPosts = withContext(Dispatchers.Default) {
                            snap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                        }

                        val currentIds = _news.value.map { it.id }.toSet()
                        val uniqueNewPosts = fetchedPosts.filter { post -> !currentIds.contains(post.id) }

                        if (uniqueNewPosts.isNotEmpty()) {
                            val rankedNewPosts = withContext(Dispatchers.Default) {
                                rankLocalNews(uniqueNewPosts, district, currentUser)
                            }
                            if (rankedNewPosts.isNotEmpty()) {
                                _news.value = _news.value + rankedNewPosts
                                appendedCount = rankedNewPosts.size
                                if (appendedCount > 0) anyFetched = true
                                val validIds = rankedNewPosts.filter { it.type == "news" }.map { it.id }
                                if (validIds.isNotEmpty()) {
                                    prefs.incrementPostViewCounts(validIds)
                                }
                            } else {
                                // 🛡️ rankLocalNews filtered ALL unique posts — fallback to raw posts
                                // so user doesn't get stuck on a spinner that never resolves
                                val rawPosts = uniqueNewPosts.sortedByDescending { it.timestamp }
                                _news.value = _news.value + rawPosts
                                appendedCount = rawPosts.size
                                if (appendedCount > 0) anyFetched = true
                                val validIds = rawPosts.filter { it.type == "news" }.map { it.id }
                                if (validIds.isNotEmpty()) prefs.incrementPostViewCounts(validIds)
                            }
                        }
                    }
                }
                // 🛡️ INFINITE SPINNER FIX: After while loop exits with 0 appended posts,
                // stop showing the loading slot so user can keep reading existing articles.
                if (appendedCount == 0 && _hasMore.value) {
                    _hasMore.value = false
                }
            } catch (e: Exception) {
                android.util.Log.e("LocalNewsFeedViewModel", "LoadMore query failed: ${e.message}")
                _hasMore.value = false // prevent infinite spinner on error
            } finally {
                isFetching = false
                if (pendingLoadMore && _hasMore.value) {
                    pendingLoadMore = false
                    if (anyFetched) {
                        loadMore(language, currentUser)
                    }
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
     * ఒక వార్తా పోస్ట్ నిజంగా ఎంచుకున్న జిల్లాకు (లేదా ఆ జిల్లా మండలాలకు/అలీయాసెస్‌లకు) చెందుతుందో లేదో తనిఖీ చేస్తుంది.
     *
     * NOTE: Firestore query already pre-filtered with whereIn(district) / whereArrayContainsAny(categories).
     * So most posts will pass quickly via check #1 or #3 below.
     * The strict "other district" rejection (isGenericOrState) only applies when post.district is a
     * clearly different specific district (e.g. Kadapa post shown in Guntur feed).
     */
    private fun isPostMatchingDistrict(post: NewsPost, targetDistrict: String): Boolean {
        if (targetDistrict.isBlank()) return false

        val aliases = Constants.getDistrictAliases(targetDistrict)
        val mandals = Constants.MANDAL_DATA[targetDistrict] ?: emptyList()
        val lowerAliases = aliases.map { it.lowercase().trim() }
        val lowerMandals = mandals.map { it.lowercase().trim() }

        val postDist = post.district?.trim()

        // 1. Direct match or alias match on post.district
        if (!postDist.isNullOrBlank() && Constants.isDistrictMatch(postDist, targetDistrict)) {
            return true
        }

        // 2. Check categories and tags for district name or aliases
        //    (Firestore's whereIn on "district" and whereArrayContainsAny on "categories" already
        //     pre-selected these posts, so this check catches any remaining matches quickly)
        val postCatsAndTags = (post.categories + post.tags).map { it.lowercase().trim() }
        if (postCatsAndTags.any { item ->
            lowerAliases.any { alias -> alias.isNotBlank() && (item == alias || item.contains(alias)) }
        }) {
            return true
        }

        // 3. Check categories and tags for mandal names
        if (lowerMandals.isNotEmpty() && postCatsAndTags.any { item ->
            lowerMandals.any { mandal -> mandal.isNotBlank() && (item == mandal || item.contains(mandal)) }
        }) {
            return true
        }

        // 4. Check location field
        val postLoc = post.location.lowercase().trim()
        if (postLoc.isNotBlank()) {
            if (lowerAliases.any { alias -> alias.isNotBlank() && (postLoc == alias || postLoc.contains(alias) || alias.contains(postLoc)) } ||
                lowerMandals.any { mandal -> mandal.isNotBlank() && (postLoc == mandal || postLoc.contains(mandal) || mandal.contains(postLoc)) }) {
                return true
            }
        }

        // 5. Check extracted mandal via LocationHierarchyManager
        val extractedMandal = LocationHierarchyManager.extractMandalFromPost(post, targetDistrict)
        if (!extractedMandal.isNullOrBlank() && mandals.any { isMandalMatch(it, extractedMandal) }) {
            return true
        }

        // 6. Check headline for district alias or mandal
        val headlineTe = post.headline.telugu
        if (headlineTe.isNotBlank()) {
            if (aliases.any { alias -> alias.length >= 3 && headlineTe.contains(alias) } ||
                mandals.any { mandal -> mandal.length >= 4 && headlineTe.contains(mandal) }) {
                return true
            }
        }

        // 7. LAST RESORT: If postDist is a different SPECIFIC district → reject.
        //    If postDist is null/blank/generic/state-level → allow (it came from Firestore query match
        //    via categories/mandals, so it is relevant even if district field is not set precisely).
        val isGenericOrState = Constants.isStateOrGenericDistrict(postDist)
        if (!isGenericOrState) {
            // Explicitly assigned to another specific district — reject
            return false
        }

        // postDist is generic/null/state-level and passed Firestore pre-filter → accept
        return true
    }

    /**
     * 3-Tier ప్రాధాన్యత + యూజర్ ఆసక్తులు (Relevance Score) + తాజాదనం (Recency) ఆధారంగా జిల్లా వార్తలను ర్యాంక్ చేస్తుంది:
     * 1. Tier 1: యూజర్ మండలం (100 pts)
     * 2. Tier 2: నియోజకవర్గం (50 pts)
     * 3. Tier 3: ఇతర జిల్లా ప్రాంతాలు (20 pts)
     * + యూజర్ ఆసక్తుల బోనస్ (Relevance Score * 1.5)
     * + తాజాదనపు బోనస్ (Recency Bonus up to 35 pts)
     * + చదవని వార్తలకు ప్రథమ ప్రాధాన్యత (Unread first, Seen deprioritized)
     */
    private fun rankLocalNews(
        posts: List<NewsPost>,
        district: String,
        currentUser: User?
    ): List<NewsPost> {
        if (posts.isEmpty()) return emptyList()

        // 🚨 STRICT DISTRICT FILTERING:
        // Only allow posts that actually belong to the selected district or its mandals/aliases!
        // (Bypass for user's own posts so reporters always see their newly posted news)
        val filteredPosts = posts.filter { post ->
            val isOwnPost = currentUser != null && (
                post.reporter.id == currentUser.id ||
                post.originalReporterId == currentUser.id ||
                post.id.startsWith("post_${currentUser.id}_")
            )
            isOwnPost || isPostMatchingDistrict(post, district)
        }

        if (filteredPosts.isEmpty()) return emptyList()

        // 1. యూజర్ యొక్క ప్రాథమిక మండలాన్ని (Primary Mandal) గుర్తించడం
        val primaryMandal = prefs.getEffectiveUserMandal(district, currentUser)
        val constituency = if (!primaryMandal.isNullOrBlank()) {
            LocationHierarchyManager.getConstituencyForMandal(district, primaryMandal)
        } else null
        val constituencyMandals = if (!constituency.isNullOrBlank()) {
            LocationHierarchyManager.getMandalsForConstituency(district, constituency)
        } else emptyList()

        fun computeLocalScore(post: NewsPost): Double {
            val isOwnPost = currentUser != null && (
                post.reporter.id == currentUser.id ||
                post.originalReporterId == currentUser.id ||
                post.id.startsWith("post_${currentUser.id}_")
            )
            if (isOwnPost) {
                return 500.0 // Prioritize reporter's own post at the top
            }

            val postMandal = LocationHierarchyManager.extractMandalFromPost(post, district)

            val tierScore = when {
                !primaryMandal.isNullOrBlank() && postMandal != null && isMandalMatch(postMandal, primaryMandal) -> 100.0
                postMandal != null && constituencyMandals.any { isMandalMatch(it, postMandal) } -> 50.0
                else -> 20.0
            }

            val relevanceScore = try { AnalyticsService.calculateRelevanceScore(post) } catch (e: Exception) { 0.0 }
            val relevanceBonus = maxOf(-20.0, relevanceScore * 1.5)

            val hoursOld = maxOf(0.0, (System.currentTimeMillis() - post.timestamp) / (1000.0 * 60 * 60))
            val recencyBonus = 35.0 * Math.exp(-hoursOld / 24.0)

            return tierScore + relevanceBonus + recencyBonus
        }

        // 2. ర్యాంకింగ్ స్కోరు ప్రకారం ఆర్డర్ చేయడం
        val rankedPosts = filteredPosts.sortedByDescending { computeLocalScore(it) }

        return rankedPosts.distinctBy { it.id }
    }

    private fun isMandalMatch(m1: String, m2: String): Boolean {
        val clean1 = m1.replace("అర్బన్", "").replace("రూరల్", "").replace("Urban", "", true).replace("Rural", "", true).trim()
        val clean2 = m2.replace("అర్బన్", "").replace("రూరల్", "").replace("Urban", "", true).replace("Rural", "", true).trim()
        return clean1.equals(clean2, ignoreCase = true) || clean1.contains(clean2, ignoreCase = true) || clean2.contains(clean1, ignoreCase = true)
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
