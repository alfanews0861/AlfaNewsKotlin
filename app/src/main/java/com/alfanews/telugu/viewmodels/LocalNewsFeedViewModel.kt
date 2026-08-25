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
import com.alfanews.telugu.utils.Constants
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
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
import kotlinx.coroutines.withTimeout
import java.util.Locale

class LocalNewsFeedViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    private var currentLanguage: Language = Language.TELUGU
    
    init {
        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != _activeDistrict.value) {
                    _activeDistrict.value = district
                    loadNews(Language.TELUGU, null)
                }
            }
        }
    }

    private val _news = MutableStateFlow<List<NewsPost>>(emptyList())
    val news: StateFlow<List<NewsPost>> = _news.asStateFlow()
    
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()
    
    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()
    
    private val _activeDistrict = MutableStateFlow(prefs.getEffectiveDistrict())
    val activeDistrict: StateFlow<String?> = _activeDistrict.asStateFlow()
    
    private val _localAds = MutableStateFlow<List<com.alfanews.telugu.models.LocalAd>>(emptyList())
    val localAds: StateFlow<List<com.alfanews.telugu.models.LocalAd>> = _localAds.asStateFlow()

    private val _isDetecting = MutableStateFlow(false)
    val isDetecting: StateFlow<Boolean> = _isDetecting.asStateFlow()

    private val _lastRefreshTime = MutableStateFlow(0L)
    val lastRefreshTime: StateFlow<Long> = _lastRefreshTime.asStateFlow()

    private val _shouldScrollToTop = MutableStateFlow(false)
    val shouldScrollToTop: StateFlow<Boolean> = _shouldScrollToTop.asStateFlow()

    fun resetScrollSignal() {
        _shouldScrollToTop.value = false
    }

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
        prefs.selectedDistrict = district
        _activeDistrict.value = district
        AnalyticsService.logDistrictSelected(district, oldDistrict)
        loadNews(Language.TELUGU, null) 
    }
    
    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?) {
        val savedDistrict = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
        if (savedDistrict != null) {
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
                withTimeout(2000L) {
                    val fusedLocationClient = LocationServices.getFusedLocationProviderClient(getApplication<Application>())
                    val loc = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
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
                val geocoder = Geocoder(getApplication(), Locale("te"))
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocation(lat, lon, 1)
                if (!addresses.isNullOrEmpty()) {
                    val address = addresses[0]
                    val localityPlace = address.locality ?: address.subLocality ?: address.subAdminArea
                    if (localityPlace != null) {
                        prefs.localPlace = localityPlace
                        prefs.lastLat = lat
                        prefs.lastLon = lon
                    }
                    val adminArea = address.adminArea ?: ""
                    if (adminArea.contains("Andhra", ignoreCase = true) || adminArea.contains("Telangana", ignoreCase = true)) {
                        val subAdmin = address.subAdminArea
                        val locality = address.locality
                        val detectedName = subAdmin ?: locality ?: adminArea
                        val district = findMatchingDistrict(detectedName)
                        if (district != null) {
                            val placeForMandal = locality ?: address.subLocality ?: address.featureName ?: localityPlace
                            val matchedMandal = com.alfanews.telugu.utils.LocationHierarchyManager.findMatchingMandal(district, placeForMandal)
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
        loadNews(Language.TELUGU, currentUser)
    }

    private fun findMatchingDistrict(name: String?): String? {
        if (name == null) return null
        return Constants.ALL_DISTRICTS.find { 
            it.contains(name, ignoreCase = true) || name.contains(it, ignoreCase = true)
        }
    }

    private fun getDistrictAliases(district: String?): List<String> {
        if (district.isNullOrBlank()) return emptyList()
        val list = mutableListOf(district)
        when {
            district.contains("నెల్లూరు") -> list.addAll(listOf("శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", "నెల్లూరు", "Nellore", "SPSR Nellore"))
            district.contains("కడప") -> list.addAll(listOf("వైఎస్ఆర్ కడప", "కడప", "YSR Kadapa", "Kadapa"))
            district.contains("సత్యసాయి") -> list.addAll(listOf("శ్రీ సత్యసాయి", "సత్యసాయి", "Sri Sathya Sai"))
            district.contains("అల్లూరి") -> list.addAll(listOf("అల్లూరి సీతారామరాజు", "అల్లూరి", "Alluri"))
            district.contains("మన్యం") || district.contains("పార్వతీపురం") -> list.addAll(listOf("పార్వతీపురం మన్యం", "మన్యం", "పార్వతీపురం"))
            district.contains("కొత్తగూడెం") -> list.addAll(listOf("భద్రాద్రి కొత్తగూడెం", "కొత్తగూడెం", "Bhadradri"))
            district.contains("ఆసిఫాబాద్") -> list.addAll(listOf("కుమ్రం భీమ్ ఆసిఫాబాద్", "ఆసిఫాబాద్", "Asifabad"))
            district.contains("భూపాలపల్లి") -> list.addAll(listOf("జయశంకర్ భూపాలపల్లి", "భూపాలపల్లి", "Bhupalpally"))
            district.contains("గద్వాల") -> list.addAll(listOf("జోగులాంబ గద్వాల", "గద్వాల", "Gadwal"))
            district.contains("సిరిసిల్ల") -> list.addAll(listOf("రాజన్న సిరిసిల్ల", "సిరిసిల్ల", "Sircilla"))
            district.contains("భువనగిరి") -> list.addAll(listOf("యాదాద్రి భువనగిరి", "భువనగిరి", "Yadadri"))
            district.contains("మేడ్చల్") -> list.addAll(listOf("మేడ్చల్ మల్కాజిగిరి", "మేడ్చల్", "Medchal"))
            district.contains("హన్మకొండ") || district.contains("హనుమకొండ") -> list.addAll(listOf("హన్మకొండ", "హనుమకొండ", "వరంగల్ అర్బన్", "Hanamkonda"))
            district.contains("వరంగల్") -> list.addAll(listOf("వరంగల్", "వరంగల్ రూరల్", "హన్మకొండ", "Warangal"))
        }
        return list.distinct()
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
                    val snapshot = FirebaseService.db.collection("local_ads")
                        .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                        .get().await()
                    
                    val ads = snapshot.documents.mapNotNull { com.alfanews.telugu.models.LocalAd.fromSnapshot(it) }
                    
                    // Save to cache
                    prefs.saveLocalAdsCache(district, gson.toJson(ads))
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
        val district = _activeDistrict.value
        if (district == null) {
            _loading.value = false
            return
        }
        
        // 🔄 BACKGROUND LOAD: Only show full-screen loading if we have no news to show.
        if (_news.value.isEmpty()) {
            _loading.value = true 
        }
        loadLocalAds(district) 
        loadJob?.cancel()
        
        loadJob = viewModelScope.launch {
            if (isFetching) return@launch
            isFetching = true
            
            if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) {
                _isOnline.value = false
                _loading.value = false
                isFetching = false
                return@launch
            }
            _isOnline.value = true

            lastDocument = null
            _hasMore.value = true
            consecutiveEmptyLoads = 0
            
            try {
                val newsRef = FirebaseService.db.collection("news")
                var posts: List<NewsPost> = emptyList()
                var snapshot: com.google.firebase.firestore.QuerySnapshot? = null

                try {
                    val districtAliases = getDistrictAliases(district)
                    
                    // 🚀 STEP 1: Search by 'district' field directly with whereIn (Single Batch Query)
                    val primaryAliases = districtAliases.take(30)
                    val query = newsRef
                        .whereEqualTo("approved", true)
                        .whereIn("district", primaryAliases)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                    
                    val snap = query.get().await()
                    if (!snap.isEmpty) {
                        snapshot = snap
                        posts = withContext(Dispatchers.Default) {
                            snap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                        }
                    }

                    // 🚀 STEP 2: Fallback - Search by categories array with whereArrayContainsAny
                    if (posts.isEmpty()) {
                        val categoryAliases = districtAliases.take(10)
                        val fallbackQuery = newsRef
                            .whereEqualTo("approved", true)
                            .whereArrayContainsAny("categories", categoryAliases)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                        
                        val fallbackSnapshot = fallbackQuery.get().await()
                        if (!fallbackSnapshot.isEmpty) {
                            snapshot = fallbackSnapshot
                            posts = withContext(Dispatchers.Default) {
                                fallbackSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                            }
                        }
                    }

                    // 🚀 STEP 3: State-Level Fallback if district has zero local news right now
                    if (posts.isEmpty()) {
                        val isAP = Constants.AP_DISTRICTS.contains(district) || district.contains("నెల్లూరు") || district.contains("కడప")
                        val stateTags = if (isAP) {
                            listOf("Andhra Pradesh", "ఆంధ్రప్రదేశ్", "AP", "State", "రాష్ట్రం")
                        } else {
                            listOf("Telangana", "తెలంగాణ", "TS", "State", "రాష్ట్రం")
                        }
                        
                        val stateQuery = newsRef
                            .whereEqualTo("approved", true)
                            .whereIn("district", stateTags)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                        
                        val stateSnapshot = stateQuery.get().await()
                        if (!stateSnapshot.isEmpty) {
                            snapshot = stateSnapshot
                            posts = withContext(Dispatchers.Default) {
                                stateSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                            }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("LocalNewsFeedViewModel", "News fetch failed for $district: ${e.message}")
                }
                
                lastDocument = snapshot?.documents?.lastOrNull()
                _hasMore.value = snapshot?.documents?.size == pageSize
                
                val rankedPosts = withContext(Dispatchers.Default) {
                    rankLocalNews(posts, district, currentUser)
                }

                _news.value = rankedPosts
                // Only scroll to top if we are loading the first page (lastDocument is null)
                if (lastDocument == null) {
                    _shouldScrollToTop.value = true 
                }
                _loading.value = false 

                val currentTime = System.currentTimeMillis()
                lastRefreshTimeLong = currentTime
                _lastRefreshTime.value = currentTime
            } catch (e: Exception) {
                 _hasMore.value = false
            } finally {
                _loading.value = false
                isFetching = false
            }
        }
    }
    
    fun loadMore(language: Language, currentUser: User?) {
         currentLanguage = language
         val district = _activeDistrict.value ?: return
         val currentLastDoc = lastDocument
         if (!_hasMore.value || isFetching || currentLastDoc == null) return
         
         viewModelScope.launch {
             isFetching = true
             try {
                 val newsRef = FirebaseService.db.collection("news")
                 var snapshot: com.google.firebase.firestore.QuerySnapshot? = null
                 val districtAliases = getDistrictAliases(district)
                 val newPosts = try {
                     var snap: com.google.firebase.firestore.QuerySnapshot? = null
                     val primaryAliases = districtAliases.take(30)
                     val query = newsRef
                         .whereEqualTo("approved", true)
                         .whereIn("district", primaryAliases)
                         .orderBy("timestamp", Query.Direction.DESCENDING)
                         .startAfter(currentLastDoc)
                         .limit(pageSize.toLong())
                     
                     val res = query.get().await()
                     if (!res.isEmpty) {
                         snap = res
                     } else {
                         // 🔄 FALLBACK: Try categories array with whereArrayContainsAny
                         val categoryAliases = districtAliases.take(10)
                         val backupQuery = newsRef
                             .whereEqualTo("approved", true)
                             .whereArrayContainsAny("categories", categoryAliases)
                             .orderBy("timestamp", Query.Direction.DESCENDING)
                             .startAfter(currentLastDoc)
                             .limit(pageSize.toLong())
                         val backupRes = backupQuery.get().await()
                         if (!backupRes.isEmpty) {
                             snap = backupRes
                         }
                     }
                     snapshot = snap

                     withContext(Dispatchers.Default) {
                         snap?.documents?.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) } ?: emptyList()
                     }
                 } catch (e: Exception) {
                     android.util.Log.e("LocalNewsFeedViewModel", "LoadMore query failed: ${e.message}")
                     emptyList<NewsPost>()
                 }
                 
                 if (newPosts.isNotEmpty()) {
                     lastDocument = snapshot?.documents?.lastOrNull()
                     _hasMore.value = (snapshot?.documents?.size ?: 0) == pageSize
                     
                     val currentIds = _news.value.map { it.id }.toSet()
                     val uniqueNewPosts = newPosts.filter { post: NewsPost -> !currentIds.contains(post.id) }
                     
                     if (uniqueNewPosts.isNotEmpty()) {
                         val rankedNewPosts = withContext(Dispatchers.Default) {
                             rankLocalNews(uniqueNewPosts, district, currentUser)
                         }
                         _news.value = _news.value + rankedNewPosts
                         consecutiveEmptyLoads = 0
                     } else {
                          consecutiveEmptyLoads++
                          if (consecutiveEmptyLoads >= 3) {
                              _hasMore.value = false
                          }
                      }
                 } else {
                     _hasMore.value = false
                 }
             } catch (e: Exception) {
                 _hasMore.value = false
             } finally {
                 isFetching = false
             }
         }
     }
    
    fun onAppResume(language: Language, currentUser: User?) {
        loadNews(language, currentUser)
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 300000 || _news.value.isEmpty()) {
            loadNews(language, currentUser)
        }
    }

    /**
     * 3-Tier ప్రాధాన్యత ఆర్డర్ లో జిల్లా వార్తలను ర్యాంక్ చేస్తుంది:
     * 1. Tier 1 (టాప్ ప్రయారిటీ): యూజర్ ఎక్కువగా చదివే మండలం / GPS గుర్తించిన మండలం వార్తలు
     * 2. Tier 2 (రెండవ ప్రయారిటీ): ఆ నియోజకవర్గంలోని (Assembly Constituency) ఇతర మండలాల వార్తలు
     * 3. Tier 3 (మూడవ ప్రయారిటీ): చుట్టుపక్కల నియోజకవర్గాలు & జిల్లాలోని ఇతర వార్తలు
     */
    private fun rankLocalNews(
        posts: List<NewsPost>,
        district: String,
        currentUser: User?
    ): List<NewsPost> {
        if (posts.isEmpty()) return emptyList()

        // 1. యూజర్ యొక్క ప్రాథమిక మండలాన్ని (Primary Mandal) గుర్తించడం
        val primaryMandal = prefs.getEffectiveUserMandal(district, currentUser)
        if (primaryMandal.isNullOrBlank()) {
            // Cold start or no reading/GPS signal: తాజా క్రమం (Timestamp DESC)
            return posts.sortedByDescending { it.timestamp }
        }

        // 2. ఆ మండలం చెందే అసెంబ్లీ నియోజకవర్గాన్ని (Constituency) గుర్తించడం
        val constituency = com.alfanews.telugu.utils.LocationHierarchyManager.getConstituencyForMandal(district, primaryMandal)
        val constituencyMandals = if (!constituency.isNullOrBlank()) {
            com.alfanews.telugu.utils.LocationHierarchyManager.getMandalsForConstituency(district, constituency)
        } else emptyList()

        // 3. 3-Tier గ్రూపింగ్
        val tier1Mandal = mutableListOf<NewsPost>()
        val tier2Constituency = mutableListOf<NewsPost>()
        val tier3District = mutableListOf<NewsPost>()

        for (post in posts) {
            val postMandal = com.alfanews.telugu.utils.LocationHierarchyManager.extractMandalFromPost(post, district)

            if (postMandal != null && isMandalMatch(postMandal, primaryMandal)) {
                tier1Mandal.add(post)
            } else if (postMandal != null && constituencyMandals.any { isMandalMatch(it, postMandal) }) {
                tier2Constituency.add(post)
            } else {
                tier3District.add(post)
            }
        }

        // ప్రతి గ్రూప్‌లో తాజా వార్తలకు ప్రాధాన్యత (Timestamp DESC)
        tier1Mandal.sortByDescending { it.timestamp }
        tier2Constituency.sortByDescending { it.timestamp }
        tier3District.sortByDescending { it.timestamp }

        // బ్లెండింగ్: యూజర్ మండలం -> ఆ నియోజకవర్గం -> జిల్లాలోని మిగతా వార్తలు
        return (tier1Mandal + tier2Constituency + tier3District).distinctBy { it.id }
    }

    private fun isMandalMatch(m1: String, m2: String): Boolean {
        val clean1 = m1.replace("అర్బన్", "").replace("రూరల్", "").replace("Urban", "", true).replace("Rural", "", true).trim()
        val clean2 = m2.replace("అర్బన్", "").replace("రూరల్", "").replace("Urban", "", true).replace("Rural", "", true).trim()
        return clean1.equals(clean2, ignoreCase = true) || clean1.contains(clean2, ignoreCase = true) || clean2.contains(clean1, ignoreCase = true)
    }

    private fun convertToNewsPost(id: String, data: Map<String, Any?>): NewsPost? {
        return try {
            com.alfanews.telugu.models.mapMapToNewsPost(id, data, currentLanguage)
        } catch (e: Exception) {
            null
        }
    }
}
