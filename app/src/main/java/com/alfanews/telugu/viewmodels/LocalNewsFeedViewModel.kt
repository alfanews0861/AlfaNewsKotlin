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
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale

class LocalNewsFeedViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    
    private val _news = MutableStateFlow<List<NewsPost>>(emptyList())
    val news: StateFlow<List<NewsPost>> = _news.asStateFlow()
    
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()
    
    private val _generalNews = MutableStateFlow<List<NewsPost>>(emptyList())
    val generalNews: StateFlow<List<NewsPost>> = _generalNews.asStateFlow()
    
    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()
    
    private val _activeDistrict = MutableStateFlow(prefs.getEffectiveDistrict())
    val activeDistrict: StateFlow<String?> = _activeDistrict.asStateFlow()
    
    private val _localAds = MutableStateFlow<List<com.alfanews.telugu.models.LocalAd>>(emptyList())
    val localAds: StateFlow<List<com.alfanews.telugu.models.LocalAd>> = _localAds.asStateFlow()

    private val _isDetecting = MutableStateFlow(false)
    val isDetecting: StateFlow<Boolean> = _isDetecting.asStateFlow()
    
    private var lastDocument: DocumentSnapshot? = null
    private val pageSize = 20 // Increased from 10 to show more news
    private var loadJob: Job? = null
    
    fun setDistrict(district: String) {
        if (prefs.selectedDistrict == district && _activeDistrict.value == district) return
        
        // UI వెంటనే లోడింగ్ స్టేట్ లోకి వెళ్ళడానికి
        _loading.value = true
        _news.value = emptyList()
        _hasMore.value = true
        
        prefs.selectedDistrict = district
        _activeDistrict.value = district
        loadNews(Language.TELUGU, null) 
    }
    
    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?) {
        // 1. వెంటనే Cache/Preferences లేదా User Profile లో ఏ జిల్లా ఉందేమో చూడు
        val savedDistrict = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
        if (savedDistrict != null) {
            _activeDistrict.value = savedDistrict
            _isDetecting.value = false
            if (_news.value.isEmpty()) loadNews(Language.TELUGU, currentUser)
            return
        }

        // 2. ఏ జిల్లా దొరకకపోతేనే, లొకేషన్ డిటెక్షన్ ప్రాసెస్ మొదలుపెట్టు
        if (_isDetecting.value) return
        _isDetecting.value = true
        
        viewModelScope.launch {
            try {
                // ఫాస్ట్ గా లొకేషన్ డిటెక్ట్ చేయడానికి 2000ms (2 సెకన్లు) మాత్రమే టైమ్ అవుట్ 
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
                // 2 సెకన్లు దాటితే లేదా ఎర్రర్ వస్తే వెంటనే మాన్యువల్ సెలెక్షన్ కి పంపుతుంది
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
                    val adminArea = addresses[0].adminArea ?: ""
                    if (adminArea.contains("Andhra", ignoreCase = true) || adminArea.contains("Telangana", ignoreCase = true)) {
                        val subAdmin = addresses[0].subAdminArea
                        val locality = addresses[0].locality
                        
                        val detectedName = subAdmin ?: locality ?: adminArea
                        val district = findMatchingDistrict(detectedName)
                        
                        if (district != null) return@withContext district
                        
                        if (subAdmin != null) {
                           val secondAttempt = findMatchingDistrict(subAdmin.replace("District", "").trim())
                           if (secondAttempt != null) return@withContext secondAttempt
                        }
                    }
                }
            } catch (e: Exception) { }
            null
        }
    }

    private fun loadGeneralNews() {
        // We removed general news loading to force District Selection
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
                
                // జిల్లా మరియు తేదీల వారీగా ఫిల్టర్ చేయడం
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
                
                _localAds.value = validAds
            } catch (e: Exception) {
                _localAds.value = emptyList()
            }
        }
    }

    fun loadNews(language: Language, currentUser: User?) {
        val district = _activeDistrict.value ?: return
        
        loadLocalAds(district) // లోకల్ యాడ్స్ లోడ్ చేయండి
        
        loadJob?.cancel()
        
        loadJob = viewModelScope.launch {
            // ఇంటర్నెట్ తనిఖీ
            if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) {
                _isOnline.value = false
                _loading.value = false
                return@launch
            }
            _isOnline.value = true

            _loading.value = true
            _news.value = emptyList()
            lastDocument = null
            _hasMore.value = true
            
            try {
                val newsRef = FirebaseService.db.collection("news")
                
                var posts: List<NewsPost> = emptyList()
                var snapshot: com.google.firebase.firestore.QuerySnapshot? = null

                try {
                    val query = newsRef
                        .whereArrayContains("categories", district)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                    
                    snapshot = query.get().await()
                    posts = withContext(Dispatchers.Default) {
                        snapshot!!.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                    }
                } catch (e: Exception) {
                    // Index missing or query failed - try with just district field
                    try {
                         val fallbackQuery = newsRef
                             .whereEqualTo("district", district)
                             .orderBy("timestamp", Query.Direction.DESCENDING)
                             .limit(pageSize.toLong())

                         snapshot = fallbackQuery.get().await()
                         posts = withContext(Dispatchers.Default) {
                             snapshot!!.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                         }
                     } catch (e2: Exception) {
                         // Both failed, will use generic fallback below
                     }
                }
                
                // If local news is empty or query failed, fetch generic news so the user doesn't see a blank screen
                if (posts.isEmpty()) {
                    val fallbackQuery = FirebaseService.db.collection("news")
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                    val fallbackSnapshot = fallbackQuery.get().await()
                    posts = withContext(Dispatchers.Default) {
                        fallbackSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                    }
                    lastDocument = fallbackSnapshot.documents.lastOrNull()
                    _hasMore.value = fallbackSnapshot.documents.size == pageSize
                } else {
                    lastDocument = snapshot?.documents?.lastOrNull()
                    _hasMore.value = snapshot?.documents?.size == pageSize
                }
                
                _news.value = posts
            } catch (e: Exception) {
                 _hasMore.value = false
            } finally {
                _loading.value = false
            }
        }
    }
    
    fun loadMore(language: Language, currentUser: User?) {
         val district = _activeDistrict.value ?: return
         if (!_hasMore.value || _loading.value || lastDocument == null) return
         
         viewModelScope.launch {
             _loading.value = true
             
             try {
                 val newsRef = FirebaseService.db.collection("news")
                 var newPosts: List<NewsPost> = emptyList()
                 var snapshot: com.google.firebase.firestore.QuerySnapshot? = null

                 try {
                     val query = newsRef
                         .whereArrayContains("categories", district)
                         .orderBy("timestamp", Query.Direction.DESCENDING)
                         .let { if (lastDocument != null) it.startAfter(lastDocument!!) else it }
                         .limit(pageSize.toLong())
                     
                     snapshot = query.get().await()
                     newPosts = withContext(Dispatchers.Default) {
                         snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                     }
                 } catch (e: Exception) {
                     // Index missing or query failed - try with just district field
                     try {
                         val fallbackQuery = newsRef
                             .whereEqualTo("district", district)
                             .orderBy("timestamp", Query.Direction.DESCENDING)
                             .let { if (lastDocument != null) it.startAfter(lastDocument!!) else it }
                             .limit(pageSize.toLong())
                         
                         snapshot = fallbackQuery.get().await()
                         newPosts = withContext(Dispatchers.Default) {
                             snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                         }
                     } catch (e2: Exception) {
                         // Both failed, will use generic fallback below
                     }
                 }
                 
                 // If local news fetch is empty on loadMore, try fetching fallback generic news 
                 if (newPosts.isEmpty() && _news.value.size < 50) {
                      val fallbackQuery = FirebaseService.db.collection("news")
                         .orderBy("timestamp", Query.Direction.DESCENDING)
                         .let { if (lastDocument != null) it.startAfter(lastDocument!!) else it }
                         .limit(pageSize.toLong())
                      val fallbackSnapshot = fallbackQuery.get().await()
                      newPosts = withContext(Dispatchers.Default) {
                          fallbackSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                      }
                      lastDocument = fallbackSnapshot.documents.lastOrNull()
                      _hasMore.value = fallbackSnapshot.documents.size == pageSize
                 } else if (newPosts.isNotEmpty()) {
                     lastDocument = snapshot?.documents?.lastOrNull()
                     _hasMore.value = snapshot?.documents?.size == pageSize
                 } else {
                     _hasMore.value = false
                 }
                 
                 _news.value = _news.value + newPosts
             } catch (e: Exception) {
                 _hasMore.value = false
             } finally {
                 _loading.value = false
             }
         }
     }
    
     @Suppress("UNCHECKED_CAST")
     private fun convertToNewsPost(id: String, data: Map<String, Any?>): NewsPost? {
         try {
             val type = data["type"]?.toString() ?: "news"
             // ✅ FIXED: Include greeting, history, and cartoon posts instead of filtering them out
             // These special posts should appear in local feeds too, not just the home feed
             // if (type == "greeting" || type == "history") {
             //     return null // Exclude greeting and history cards from the main news feed
             // }

            // Safe mapping for numbers
            val likesCount = (data["likes"] as? Number)?.toInt() ?: 0
            val commentsCount = (data["comments"] as? Number)?.toInt() ?: 0
            val sharesCount = (data["shares"] as? Number)?.toInt() ?: 0
            
            // Safe mapping for timestamp
            val postTimestamp = when (val ts = data["timestamp"]) {
                is com.google.firebase.Timestamp -> ts.toDate().time
                is Number -> ts.toLong()
                is java.util.Date -> ts.time
                else -> System.currentTimeMillis()
            }

            // Categories list fallback
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
                type = type
            )
        } catch(e: Exception) {
            return null
        }
    }
}