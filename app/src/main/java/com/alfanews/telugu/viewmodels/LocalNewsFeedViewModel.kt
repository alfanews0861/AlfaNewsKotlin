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
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.ListenerRegistration
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
    private var activeCurrentUser: User? = null
    
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

    // 📡 REAL-TIME LISTENERS & STATE
    private var distListenerRegistration: ListenerRegistration? = null
    private var catListenerRegistration: ListenerRegistration? = null
    private var reporterListenerRegistration: ListenerRegistration? = null

    private var liveDistPosts: List<NewsPost> = emptyList()
    private var liveCatPosts: List<NewsPost> = emptyList()
    private var liveReporterPosts: List<NewsPost> = emptyList()

    init {
        val initialDist = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: prefs.userDistrict ?: "హైదరాబాద్"
        _activeDistrict.value = initialDist

        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != null && district != _activeDistrict.value) {
                    _activeDistrict.value = district
                    stopRealtimeNewsListeners()
                    liveDistPosts = emptyList()
                    liveCatPosts = emptyList()
                    liveReporterPosts = emptyList()
                    _hasMore.value = true
                    lastDocument = null
                    isFetching = false
                    _news.value = emptyList()
                    _loading.value = true
                    loadNews(Language.TELUGU, activeCurrentUser, forceRefresh = true)
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
        if (prefs.selectedDistrict == district && _activeDistrict.value == district) {
            startRealtimeNewsListeners(district, activeCurrentUser)
            return
        }
        val oldDistrict = prefs.selectedDistrict ?: prefs.detectedDistrict
        prefs.selectedDistrict = district
        _activeDistrict.value = district
        
        stopRealtimeNewsListeners()
        liveDistPosts = emptyList()
        liveCatPosts = emptyList()
        liveReporterPosts = emptyList()
        _hasMore.value = true
        lastDocument = null
        _news.value = emptyList()
        _loading.value = true
        
        AnalyticsService.logDistrictSelected(district, oldDistrict)
        viewModelScope.launch {
            NotificationHelper.syncDistrictTopic(getApplication(), district)
        }
        loadNews(Language.TELUGU, activeCurrentUser, forceRefresh = true) 
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
        stopRealtimeNewsListeners()
        liveDistPosts = emptyList()
        liveCatPosts = emptyList()
        liveReporterPosts = emptyList()
        lastDocument = null
        _hasMore.value = true
        _news.value = emptyList()
        _loading.value = true
        viewModelScope.launch {
            NotificationHelper.syncDistrictTopic(getApplication(), prefs.getEffectiveDistrict())
        }
        loadNews(Language.TELUGU, currentUser, forceRefresh = true)
    }

    private fun stopRealtimeNewsListeners() {
        distListenerRegistration?.remove()
        distListenerRegistration = null
        catListenerRegistration?.remove()
        catListenerRegistration = null
        reporterListenerRegistration?.remove()
        reporterListenerRegistration = null
    }

    private fun startRealtimeNewsListeners(district: String, currentUser: User?) {
        stopRealtimeNewsListeners()

        val newsRef = FirebaseService.db.collection("news")
        val cleanAliases = Constants.getDistrictAliases(district)
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .take(10)

        // 1. District Live Listener (Where district matches activeDistrict aliases and approved == true)
        val distQuery = (if (cleanAliases.size > 1) {
            newsRef.whereEqualTo("approved", true).whereIn("district", cleanAliases)
        } else if (cleanAliases.size == 1) {
            newsRef.whereEqualTo("approved", true).whereEqualTo("district", cleanAliases[0])
        } else {
            newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
        })
        .orderBy("timestamp", Query.Direction.DESCENDING)
        .limit(pageSize.toLong())

        distListenerRegistration = distQuery.addSnapshotListener { snapshot, error ->
            if (error != null) {
                Log.w("LocalNewsFeedVM", "Realtime distListener error: ${error.message}")
                return@addSnapshotListener
            }
            if (snapshot != null) {
                for (change in snapshot.documentChanges) {
                    if (change.type == DocumentChange.Type.REMOVED) {
                        val removedId = change.document.id
                        _news.value = _news.value.filter { it.id != removedId }
                    }
                }
                liveDistPosts = snapshot.documents.mapNotNull { doc ->
                    convertToNewsPost(doc.id, doc.data ?: emptyMap())
                }
                if (lastDocument == null) {
                    lastDocument = snapshot.documents.lastOrNull()
                    _hasMore.value = snapshot.size() >= pageSize
                }
                mergeAndEmitRealtimePosts()
            }
        }

        // 2. Category Live Listener (Where categories array contains activeDistrict aliases and approved == true)
        val catQuery = (if (cleanAliases.size > 1) {
            newsRef.whereEqualTo("approved", true).whereArrayContainsAny("categories", cleanAliases)
        } else if (cleanAliases.size == 1) {
            newsRef.whereEqualTo("approved", true).whereArrayContainsAny("categories", listOf(cleanAliases[0]))
        } else {
            newsRef.whereEqualTo("approved", true).whereArrayContainsAny("categories", listOf(district))
        })
        .orderBy("timestamp", Query.Direction.DESCENDING)
        .limit(pageSize.toLong())

        catListenerRegistration = catQuery.addSnapshotListener { snapshot, error ->
            if (error != null) {
                Log.w("LocalNewsFeedVM", "Realtime catListener error: ${error.message}")
                return@addSnapshotListener
            }
            if (snapshot != null) {
                for (change in snapshot.documentChanges) {
                    if (change.type == DocumentChange.Type.REMOVED) {
                        val removedId = change.document.id
                        _news.value = _news.value.filter { it.id != removedId }
                    }
                }
                liveCatPosts = snapshot.documents.mapNotNull { doc ->
                    convertToNewsPost(doc.id, doc.data ?: emptyMap())
                }
                mergeAndEmitRealtimePosts()
            }
        }

        // 3. Reporter's Own Posts Live Listener
        val reporterId = currentUser?.id?.takeIf { it.isNotBlank() } ?: activeCurrentUser?.id?.takeIf { it.isNotBlank() }
        if (!reporterId.isNullOrBlank()) {
            val repQuery = newsRef
                .whereEqualTo("originalReporterId", reporterId)
                .whereEqualTo("approved", true)
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(5)

            reporterListenerRegistration = repQuery.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.w("LocalNewsFeedVM", "Realtime reporterListener error: ${error.message}")
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    for (change in snapshot.documentChanges) {
                        if (change.type == DocumentChange.Type.REMOVED) {
                            val removedId = change.document.id
                            _news.value = _news.value.filter { it.id != removedId }
                        }
                    }
                    liveReporterPosts = snapshot.documents.mapNotNull { doc ->
                        convertToNewsPost(doc.id, doc.data ?: emptyMap())
                    }
                    mergeAndEmitRealtimePosts()
                }
            }
        }
    }

    @Synchronized
    private fun mergeAndEmitRealtimePosts() {
        val liveTopPosts = (liveReporterPosts + liveDistPosts + liveCatPosts)
            .distinctBy { it.id }
            .sortedByDescending { it.timestamp }

        if (liveTopPosts.isNotEmpty()) {
            val currentList = _news.value
            val liveIds = liveTopPosts.map { it.id }.toSet()
            
            // Retain older paginated posts (loaded via loadMore)
            val olderPosts = currentList.filter { it.id !in liveIds }
            val merged = (liveTopPosts + olderPosts).distinctBy { it.id }.sortedByDescending { it.timestamp }

            val hadPosts = currentList.isNotEmpty()
            val oldTopId = currentList.firstOrNull()?.id
            val newTopId = merged.firstOrNull()?.id
            val isBrandNewTopPost = hadPosts && oldTopId != null && newTopId != null && oldTopId != newTopId

            _news.value = merged
            _loading.value = false

            val currentTime = System.currentTimeMillis()
            lastRefreshTimeLong = currentTime
            _lastRefreshTime.value = currentTime

            val validIds = merged.filter { it.type == "news" }.map { it.id }
            prefs.incrementPostViewCounts(validIds)

            // When a brand new post appears at the top (e.g. reporter just published and it became live)
            if (isBrandNewTopPost || !hadPosts) {
                _shouldScrollToTop.value = true
            }
        }
    }

    fun prependPost(post: NewsPost) {
        _news.value = (listOf(post) + _news.value).distinctBy { it.id }
        _loading.value = false
        _shouldScrollToTop.value = true
    }

    private fun findMatchingDistrict(name: String?): String? {
        if (name.isNullOrBlank()) return null
        val clean = name.trim()
        Constants.ALL_DISTRICTS.find { 
            it.contains(clean, ignoreCase = true) || clean.contains(it, ignoreCase = true)
        }?.let { return it }
        com.alfanews.telugu.services.WeatherService.getTeluguNameForEnglish(clean)?.let { return it }
        for (d in Constants.ALL_DISTRICTS) {
            val aliases = Constants.getDistrictAliases(d)
            if (aliases.any { it.contains(clean, ignoreCase = true) || clean.contains(it, ignoreCase = true) }) {
                return d
            }
        }
        return null
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
        if (currentUser != null) {
            activeCurrentUser = currentUser
        }
        val userDist = currentUser?.district?.takeIf { it.isNotBlank() } ?: activeCurrentUser?.district?.takeIf { it.isNotBlank() } ?: prefs.userDistrict
        val district = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: userDist ?: "హైదరాబాద్"
        if (_activeDistrict.value != district) {
            _activeDistrict.value = district
        }
        
        // 🛡️ RACE & CANCEL SHIELD: ఆల్రెడీ ఫెచ్ అవుతుంటే డూప్లికేట్ కాల్స్ వల్ల రద్దవకుండా రక్షణ
        if (isFetching && loadJob?.isActive == true && !forceRefresh) {
            return
        }

        // 🔄 BACKGROUND LOAD: Only show full-screen loading if we have no news to show.
        if (_news.value.isEmpty()) {
            _loading.value = true 
        }
        loadLocalAds(district) 
        loadJob?.cancel()
        isFetching = false
        
        // 📡 REALTIME STREAM: సక్రియ జిల్లాకు రియల్ టైమ్ లిజనర్‌లను కనెక్ట్ చేసి ఉంచుతాం
        startRealtimeNewsListeners(district, currentUser ?: activeCurrentUser)
        
        loadJob = viewModelScope.launch {
            isFetching = true
            
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
                // ⚡ 1. SMART INSTANT LOCAL CACHE: స్థానిక వార్తలు లోకల్ క్యాష్‌లో ఉంటే వెంటనే (< 20ms) చూపించు
                if (_news.value.isEmpty()) {
                    try {
                        val cachedSnap = (if (cleanAliases.size > 1) {
                            newsRef.whereEqualTo("approved", true).whereIn("district", cleanAliases)
                        } else if (cleanAliases.size == 1) {
                            newsRef.whereEqualTo("approved", true).whereEqualTo("district", cleanAliases[0])
                        } else {
                            newsRef.whereEqualTo("approved", true).whereEqualTo("district", district)
                        })
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                        .get(Source.CACHE)
                        .await()

                        val cachedPosts = cachedSnap.documents.mapNotNull { doc ->
                            convertToNewsPost(doc.id, doc.data ?: emptyMap())
                        }
                        if (cachedPosts.isNotEmpty() && _news.value.isEmpty()) {
                            _news.value = cachedPosts
                            _loading.value = false
                            Log.d("LocalNewsFeedVM", "⚡ Instant Local Cache Display: ${cachedPosts.size} posts in < 20ms")
                        }
                    } catch (e: Exception) {
                        Log.d("LocalNewsFeedVM", "Local cache check: ${e.message}")
                    }
                }

                // 🌟 2. AUTHOR / REPORTER PRIORITY INJECTION:
                // లాగిన్ అయిన రిపోర్టర్/వినియోగదారుడి తాజా పోస్ట్‌లను ముందుగా తెచ్చి ఫీడ్ పైన చూపిస్తాం
                val myPosts = if (currentUser != null && !currentUser.id.isNullOrBlank()) {
                    try {
                        val myQuery = newsRef
                            .whereEqualTo("originalReporterId", currentUser.id)
                            .whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(5)
                        val mySnap = kotlinx.coroutines.withTimeoutOrNull(2000L) {
                            try { myQuery.get().await() } catch (e: Exception) { null }
                        } ?: try { myQuery.get(Source.CACHE).await() } catch (e: Exception) { null }
                        mySnap?.documents?.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) } ?: emptyList()
                    } catch (e: Exception) { emptyList() }
                } else emptyList()

                // 3. ⚡ PARALLEL FULL QUERY (3.5s Lean Timeout - no cascading delays):
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
                    kotlinx.coroutines.withTimeoutOrNull(3500L) {
                        try { distQuery.get().await() } catch (e: Exception) { null }
                    } ?: try { distQuery.get(Source.CACHE).await() } catch (e: Exception) { null }
                }
                val catDeferred = async(Dispatchers.IO) {
                    kotlinx.coroutines.withTimeoutOrNull(3500L) {
                        try { catQuery.get().await() } catch (e: Exception) { null }
                    } ?: try { catQuery.get(Source.CACHE).await() } catch (e: Exception) { null }
                }

                val distSnap = distDeferred.await()
                val catSnap = catDeferred.await()

                val distPosts = distSnap?.documents?.mapNotNull { doc ->
                    convertToNewsPost(doc.id, doc.data ?: emptyMap())
                } ?: emptyList()

                val catPosts = catSnap?.documents?.mapNotNull { doc ->
                    convertToNewsPost(doc.id, doc.data ?: emptyMap())
                } ?: emptyList()

                var finalPosts = (myPosts + distPosts + catPosts).distinctBy { it.id }.sortedByDescending { it.timestamp }

                // 🛡️ ZERO-EMPTY GUARANTEE: ఒకవేళ ఆ జిల్లాకు నేరుగా వార్తలు లేకుంటే తాజా రాష్ట్ర వార్తలను చూపిస్తాం
                if (finalPosts.isEmpty()) {
                    val userState = Constants.mapDistrictToState(district)
                    val fallbackSnap = kotlinx.coroutines.withTimeoutOrNull(2000L) {
                        try {
                            newsRef.whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                                .get().await()
                        } catch (e: Exception) { null }
                    } ?: try {
                        newsRef.whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                            .get(Source.CACHE).await()
                    } catch (e: Exception) { null }

                    val fallbackPosts = fallbackSnap?.documents?.mapNotNull { doc ->
                        convertToNewsPost(doc.id, doc.data ?: emptyMap())
                    } ?: emptyList()
                    val filteredFallback = if (userState != null) {
                        fallbackPosts.filter { post ->
                            val pState = Constants.mapDistrictToState(post.district ?: post.state)
                            pState == null || pState == userState
                        }
                    } else fallbackPosts
                    if (filteredFallback.isNotEmpty()) {
                        finalPosts = (myPosts + filteredFallback).distinctBy { it.id }
                    } else if (fallbackPosts.isNotEmpty()) {
                        finalPosts = (myPosts + fallbackPosts).distinctBy { it.id }
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
        if (currentUser != null) {
            activeCurrentUser = currentUser
        }
        val district = _activeDistrict.value ?: prefs.getEffectiveDistrict() ?: "హైదరాబాద్"
        if (distListenerRegistration == null) {
            startRealtimeNewsListeners(district, currentUser ?: activeCurrentUser)
        }
        refreshIfStale(language, currentUser)
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 30000 || _news.value.isEmpty()) {
            loadNews(language, currentUser, forceRefresh = true)
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopRealtimeNewsListeners()
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
