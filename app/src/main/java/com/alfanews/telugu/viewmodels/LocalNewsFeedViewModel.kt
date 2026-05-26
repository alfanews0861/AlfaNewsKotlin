package com.alfanews.telugu.viewmodels

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.location.Geocoder
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.PreferenceManager
import com.alfanews.telugu.utils.Constants
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.Locale

class LocalNewsFeedViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    
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
    
    fun setDistrict(district: String) {
        if (prefs.selectedDistrict == district && _activeDistrict.value == district) return
        _news.value = emptyList() // 🔄 Clear old news to avoid confusion when switching districts
        _loading.value = true     // 🔄 Show preparation screen
        _hasMore.value = true
        prefs.selectedDistrict = district
        _activeDistrict.value = district
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
                        if (district != null) return@withContext district
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


    private fun loadLocalAds(district: String) {
        viewModelScope.launch {
            try {
                val now = System.currentTimeMillis()
                val snapshot = FirebaseService.db.collection("local_ads")
                    .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                    .get().await()
                val allAds = snapshot.documents.mapNotNull { com.alfanews.telugu.models.LocalAd.fromSnapshot(it) }
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
                _localAds.value = validAds.shuffled()
            } catch (e: Exception) {
                _localAds.value = emptyList()
            }
        }
    }

    fun loadNews(language: Language, currentUser: User?) {
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
            
            try {
                val newsRef = FirebaseService.db.collection("news")
                var posts: List<NewsPost> = emptyList()
                var snapshot: com.google.firebase.firestore.QuerySnapshot? = null

                try {
                    // 🚀 STEP 1: Try finding by category array (Fastest & Standard)
                    var query = newsRef
                        .whereEqualTo("approved", true)
                        .whereArrayContains("categories", district)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                    
                    snapshot = query.get().await()
                    posts = withContext(Dispatchers.Default) {
                        snapshot!!.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                    }

                    // 🚀 STEP 2: Fallback - If no results, try matching by 'district' field directly
                    // This handles cases where AI might have missed adding district to categories array
                    if (posts.isEmpty()) {
                        val fallbackQuery = newsRef
                            .whereEqualTo("approved", true)
                            .whereEqualTo("district", district)
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
                } catch (e: Exception) {
                    android.util.Log.e("LocalNewsFeedViewModel", "News fetch failed for $district: ${e.message}")
                }
                
                lastDocument = snapshot?.documents?.lastOrNull()
                _hasMore.value = snapshot?.documents?.size == pageSize

                if (posts.isNotEmpty()) {
                    try {
                        com.alfanews.telugu.services.AnalyticsService.logBulkCategoryViews(posts.map { it.categories }, weight = 1)
                    } catch (e: Exception) { }
                }
                
                val finalPosts = posts.toMutableList()
                val lat = prefs.lastLat.takeIf { it != 0.0 }
                val lon = prefs.lastLon.takeIf { it != 0.0 }
                
                // Weather post removed as per user request to improve performance

                _news.value = finalPosts
                _shouldScrollToTop.value = true 
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
         val district = _activeDistrict.value ?: return
         val currentLastDoc = lastDocument
         if (!_hasMore.value || isFetching || currentLastDoc == null) return
         
         viewModelScope.launch {
             isFetching = true
             try {
                 val newsRef = FirebaseService.db.collection("news")
                 var newPosts: List<NewsPost> = emptyList()
                 var snapshot: com.google.firebase.firestore.QuerySnapshot? = null
                 try {
                     // 🚀 CHANGED: Match logic with loadNews for consistency
                     var query = newsRef
                         .whereEqualTo("approved", true)
                         .whereEqualTo("district", district)
                         .orderBy("timestamp", Query.Direction.DESCENDING)
                         .startAfter(currentLastDoc)
                         .limit(pageSize.toLong())
                     
                     snapshot = query.get().await()
                     
                     if (snapshot.isEmpty) {
                         // 🔄 FALLBACK: Try categories array if district field search returns nothing
                         val backupQuery = newsRef
                             .whereEqualTo("approved", true)
                             .whereArrayContains("categories", district)
                             .orderBy("timestamp", Query.Direction.DESCENDING)
                             .startAfter(currentLastDoc)
                             .limit(pageSize.toLong())
                         snapshot = backupQuery.get().await()
                     }

                     newPosts = withContext(Dispatchers.Default) {
                         snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                     }
                 } catch (e: Exception) {
                     android.util.Log.e("LocalNewsFeedViewModel", "LoadMore query failed: ${e.message}")
                 }
                  if (newPosts.isNotEmpty()) {
                      lastDocument = snapshot?.documents?.lastOrNull()
                      _hasMore.value = snapshot?.documents?.size == pageSize
                      try {
                          com.alfanews.telugu.services.AnalyticsService.logBulkCategoryViews(newPosts.map { it.categories }, weight = 1)
                      } catch (e: Exception) { }
                      _news.value = _news.value + newPosts
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

    private fun convertToNewsPost(id: String, data: Map<String, Any?>): NewsPost? {
         try {
            val type = data["type"]?.toString() ?: "news"
            val likesCount = (data["likes"] as? Number)?.toInt() ?: 0
            val commentsCount = (data["comments"] as? Number)?.toInt() ?: 0
            val sharesCount = (data["shares"] as? Number)?.toInt() ?: 0
            val postTimestamp = when (val ts = data["timestamp"]) {
                is com.google.firebase.Timestamp -> ts.toDate().time
                is Number -> ts.toLong()
                is java.util.Date -> ts.time
                else -> System.currentTimeMillis()
            }
            val categoriesList = (data["categories"] as? List<*>)?.mapNotNull { it?.toString() }
                ?: listOfNotNull(data["category"]?.toString(), data["district"]?.toString())
            return NewsPost(
                id = id,
                headline = com.alfanews.telugu.models.Headline(
                    telugu = (data["headline"] as? Map<*, *>)?.get("telugu")?.toString() ?: "",
                    english = (data["headline"] as? Map<*, *>)?.get("english")?.toString() ?: ""
                ),
                content = com.alfanews.telugu.models.Content(
                    telugu = (data["content"] as? Map<*, *>)?.get("telugu")?.toString() ?: "",
                    english = (data["content"] as? Map<*, *>)?.get("english")?.toString() ?: ""
                ),
                mediaUrl = data["mediaUrl"]?.toString() ?: "",
                mediaType = when (data["mediaType"]?.toString()) {
                    "VIDEO" -> com.alfanews.telugu.models.MediaType.VIDEO
                    else -> com.alfanews.telugu.models.MediaType.IMAGE
                },
                youtubeUrl = data["youtubeUrl"]?.toString(),
                postFormat = when (data["postFormat"]?.toString()) {
                    "16:9" -> com.alfanews.telugu.models.PostFormat.HORIZONTAL
                    else -> com.alfanews.telugu.models.PostFormat.VERTICAL
                },
                reporter = com.alfanews.telugu.models.Reporter(
                    id = (data["reporter"] as? Map<*, *>)?.get("id")?.toString() ?: "",
                    name = (data["reporter"] as? Map<*, *>)?.get("name")?.toString() ?: ""
                ),
                location = data["location"]?.toString() ?: "",
                timestamp = postTimestamp,
                categories = categoriesList,
                likes = likesCount,
                comments = commentsCount,
                shares = sharesCount,
                originalUrl = data["originalUrl"]?.toString(),
                district = data["district"]?.toString(),
                verificationStatus = data["verificationStatus"]?.toString() ?: "UNVERIFIED",
                type = type,
                approved = data["approved"] as? Boolean ?: false,
                aiProcessed = data["aiProcessed"] as? Boolean ?: false
            )
        } catch(e: Exception) {
            return null
        }
    }
}
