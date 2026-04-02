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
    
    private val _generalNews = MutableStateFlow<List<NewsPost>>(emptyList())
    val generalNews: StateFlow<List<NewsPost>> = _generalNews.asStateFlow()
    
    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()
    
    private val _activeDistrict = MutableStateFlow(prefs.getEffectiveDistrict())
    val activeDistrict: StateFlow<String?> = _activeDistrict.asStateFlow()
    
    private val _isDetecting = MutableStateFlow(false)
    val isDetecting: StateFlow<Boolean> = _isDetecting.asStateFlow()
    
    private var lastDocument: DocumentSnapshot? = null
    private val pageSize = 10
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
                withTimeout(5000L) {
                    val fusedLocationClient = LocationServices.getFusedLocationProviderClient(getApplication<Application>())
                    val loc = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
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

    fun loadNews(language: Language, currentUser: User?) {
        val district = _activeDistrict.value ?: return
        
        loadJob?.cancel()
        _loading.value = true
        
        loadJob = viewModelScope.launch {
            _news.value = emptyList()
            lastDocument = null
            _hasMore.value = true
            
            try {
                val newsRef = FirebaseService.db.collection("news")
                val query = newsRef
                    .whereArrayContains("categories", district)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(pageSize.toLong())
                
                val snapshot = query.get().await()
                var posts = withContext(Dispatchers.Default) {
                    snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                }
                
                // If local news is empty, fetch generic news so the user doesn't see a blank screen
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
                    lastDocument = snapshot.documents.lastOrNull()
                    _hasMore.value = snapshot.documents.size == pageSize
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
                val query = newsRef
                    .whereArrayContains("categories", district)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .startAfter(lastDocument!!)
                    .limit(pageSize.toLong())
                
                val snapshot = query.get().await()
                var newPosts = withContext(Dispatchers.Default) {
                    snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                }
                
                // If local news fetch is empty on loadMore, try fetching fallback generic news 
                if (newPosts.isEmpty() && _news.value.size < 50) {
                     val fallbackQuery = FirebaseService.db.collection("news")
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .startAfter(lastDocument!!)
                        .limit(pageSize.toLong())
                     val fallbackSnapshot = fallbackQuery.get().await()
                     newPosts = withContext(Dispatchers.Default) {
                         fallbackSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                     }
                     lastDocument = fallbackSnapshot.documents.lastOrNull()
                     _hasMore.value = fallbackSnapshot.documents.size == pageSize
                } else if (newPosts.isNotEmpty()) {
                    lastDocument = snapshot.documents.lastOrNull()
                    _hasMore.value = snapshot.documents.size == pageSize
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
            val type = data["type"] as? String
            if (type == "greeting" || type == "history") {
                return null // Exclude greeting and history cards from the main news feed
            }

            return NewsPost(
                id = id,
                headline = com.alfanews.telugu.models.Headline(
                    telugu = (data["headline"] as? Map<*, *>)?.get("telugu") as? String ?: "",
                    english = (data["headline"] as? Map<*, *>)?.get("english") as? String ?: ""
                ),
                content = com.alfanews.telugu.models.Content(
                    telugu = (data["content"] as? Map<*, *>)?.get("telugu") as? String ?: "",
                    english = (data["content"] as? Map<*, *>)?.get("english") as? String ?: ""
                ),
                mediaUrl = data["mediaUrl"] as? String ?: "",
                mediaType = when (data["mediaType"] as? String) {
                    "VIDEO" -> com.alfanews.telugu.models.MediaType.VIDEO
                    else -> com.alfanews.telugu.models.MediaType.IMAGE
                },
                youtubeUrl = data["youtubeUrl"] as? String,
                postFormat = when (data["postFormat"] as? String) {
                    "16:9" -> com.alfanews.telugu.models.PostFormat.HORIZONTAL
                    else -> com.alfanews.telugu.models.PostFormat.VERTICAL
                },
                reporter = com.alfanews.telugu.models.Reporter(
                    id = (data["reporter"] as? Map<*, *>)?.get("id") as? String ?: "",
                    name = (data["reporter"] as? Map<*, *>)?.get("name") as? String ?: ""
                ),
                location = data["location"] as? String ?: "",
                timestamp = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: System.currentTimeMillis(),
                categories = data["categories"] as? List<String> ?: emptyList(),
                likes = (data["likes"] as? Long)?.toInt() ?: 0,
                comments = (data["comments"] as? Long)?.toInt() ?: 0,
                shares = (data["shares"] as? Long)?.toInt() ?: 0,
                originalUrl = data["originalUrl"] as? String,
                district = data["district"] as? String,
                verificationStatus = data["verificationStatus"] as? String ?: "UNVERIFIED",
                type = type
            )
        } catch(e: Exception) {
            return null
        }
    }
}
