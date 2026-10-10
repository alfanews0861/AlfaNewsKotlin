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
        val district = _activeDistrict.value ?: prefs.selectedDistrict ?: userDist ?: prefs.detectedDistrict ?: "హైదరాబాద్"
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
            val primaryAliases = districtAliases.take(10)

            _isOnline.value = com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())
            lastDocument = null
            _hasMore.value = true
            consecutiveEmptyLoads = 0

            try {
                // 🚀 DIRECT SERVER QUERY: ఆయా జిల్లాకు కేటాయించిన వార్తలను సర్వర్ నుండి నేరుగా తాజాదనం ప్రకారం తెస్తాము (No Cache, No Over-Engineering)
                val query = (if (primaryAliases.size > 1) {
                    newsRef.whereEqualTo("approved", true).whereIn("district", primaryAliases)
                } else if (primaryAliases.size == 1) {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", primaryAliases[0])
                } else {
                    newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                })
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(pageSize.toLong())

                val snapshot = try {
                    query.get(com.google.firebase.firestore.Source.SERVER).await()
                } catch (e: Exception) {
                    query.get().await()
                }

                val fetchedPosts = snapshot.documents.mapNotNull { doc ->
                    convertToNewsPost(doc.id, doc.data ?: emptyMap())
                }

                lastDocument = snapshot.documents.lastOrNull()
                _hasMore.value = snapshot.size() >= pageSize

                // 🚀 ఎల్లప్పుడూ ఆ జిల్లాలోని తాజా వార్తలే పైన కనిపించాలి
                val finalPosts = fetchedPosts.sortedByDescending { it.timestamp }.distinctBy { it.id }
                if (finalPosts.isNotEmpty()) {
                    val wasEmpty = _news.value.isEmpty()
                    _news.value = finalPosts
                    val validIds = finalPosts.filter { it.type == "news" }.map { it.id }
                    prefs.incrementPostViewCounts(validIds)
                    if (wasEmpty) {
                        _shouldScrollToTop.value = true
                    }
                } else {
                    _hasMore.value = false
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
                    if (_news.value.isNotEmpty()) {
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

        viewModelScope.launch {
            isFetching = true
            try {
                val newsRef = FirebaseService.db.collection("news")
                val districtAliases = Constants.getDistrictAliases(district)
                val primaryAliases = districtAliases.take(10)

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

                val lastDoc = lastDocument
                if (lastDoc != null) {
                    q = q.startAfter(lastDoc)
                }

                val snap = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                    try { q.get().await() } catch (e: Exception) { null }
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
