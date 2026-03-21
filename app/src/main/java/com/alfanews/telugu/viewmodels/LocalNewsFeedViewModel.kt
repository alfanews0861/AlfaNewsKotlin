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
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL
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
        if (_isDetecting.value) return

        viewModelScope.launch {
            // 1. ప్రాధాన్యత 1: యూజర్ స్వయంగా ఎంచుకున్న జిల్లా (App Session/Prefs)
            if (prefs.selectedDistrict != null) {
                _activeDistrict.value = prefs.selectedDistrict
                if (_news.value.isEmpty()) loadNews(Language.TELUGU, currentUser)
                return@launch
            }

            // 2. ప్రాధాన్యత 2: రిజిస్టర్డ్ యూజర్ ప్రొఫైల్ జిల్లా (Database truth)
            currentUser?.district?.let {
                if(Constants.ALL_DISTRICTS.contains(it)) {
                    _activeDistrict.value = it
                    if (_news.value.isEmpty()) loadNews(Language.TELUGU, currentUser)
                    return@launch
                }
            }
            
            // 3. ప్రాధాన్యత 3: గతంలో గుర్తించిన జిల్లా (Cache)
            if (prefs.detectedDistrict != null) {
                _activeDistrict.value = prefs.detectedDistrict
                if (_news.value.isEmpty()) loadNews(Language.TELUGU, currentUser)
                return@launch
            }

            // 4. ఏమీ లేకపోతేనే కొత్తగా గుర్తించడం
            _isDetecting.value = true
            
            // GPS ద్వారా ప్రయత్నించడం - 3 సెకన్ల టైమౌట్
            try {
                withContext(Dispatchers.IO) {
                    try {
                        withTimeout(3000L) {
                            val fusedLocationClient = LocationServices.getFusedLocationProviderClient(getApplication<Application>())
                            val location = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                            location?.let {
                                val geocoder = Geocoder(getApplication(), Locale("te"))
                                @Suppress("DEPRECATION")
                                val addresses = geocoder.getFromLocation(it.latitude, it.longitude, 1)
                                if (addresses != null && addresses.size > 0) {
                                    val adminArea = addresses[0].adminArea ?: ""
                                    if (adminArea.contains("Andhra", ignoreCase = true) || adminArea.contains("Telangana", ignoreCase = true)) {
                                        val detectedName = addresses[0].subAdminArea ?: addresses[0].locality ?: adminArea
                                        val mappedDistrict = findMatchingDistrict(detectedName)
                                        if (mappedDistrict != null) {
                                            updateDetectedDistrict(mappedDistrict, currentUser)
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) { }
                }
            } catch (e: Exception) { }

            // IP-based location ద్వారా ప్రయత్నించడం - 3 సెకన్ల టైమౌట్
            try {
                withContext(Dispatchers.IO) {
                    try {
                        withTimeout(3000L) {
                            val response = URL("http://ip-api.com/json").readText()
                            val ipInfo = JSONObject(response)
                            val regionName = ipInfo.optString("regionName", "")
                            
                            if (regionName.contains("Andhra", ignoreCase = true) || regionName.contains("Telangana", ignoreCase = true)) {
                                val city = ipInfo.optString("city")
                                val mappedDistrict = findMatchingDistrict(city) ?: findMatchingDistrict(regionName)
                                if (mappedDistrict != null) {
                                    updateDetectedDistrict(mappedDistrict, currentUser)
                                }
                            }
                        }
                    } catch (e: Exception) { }
                }
            } catch (e: Exception) { }

            // చివరగా: లొకేషన్ దొరకకపోతే, default fallback హైదరాబాద్ కాకుండా, 
            // లొకేషన్ సెలెక్ట్ చేసుకోమని UI కి సూచించాలి
            _isDetecting.value = false
            if (_activeDistrict.value == null) {
                _loading.value = false
                loadGeneralNews()
            } else {
                if (_news.value.isEmpty()) loadNews(Language.TELUGU, currentUser)
            }
        }
    }

    private fun loadGeneralNews() {
        viewModelScope.launch {
            _loading.value = true
            try {
                val newsRef = FirebaseService.db.collection("news")
                val query = newsRef
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(pageSize.toLong())
                
                val snapshot = query.get().await()
                val posts = snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                
                _generalNews.value = posts
            } catch (e: Exception) {
            } finally {
                _loading.value = false
            }
        }
    }


    private fun updateDetectedDistrict(district: String, currentUser: User?) {
        prefs.detectedDistrict = district
        _activeDistrict.value = district
        _loading.value = true // Set loading TRUE before clearing detecting state
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
                val posts = snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                
                _news.value = posts
                lastDocument = snapshot.documents.lastOrNull()
                _hasMore.value = snapshot.documents.size == pageSize
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
                val newPosts = snapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                
                _news.value = _news.value + newPosts
                lastDocument = snapshot.documents.lastOrNull()
                _hasMore.value = snapshot.documents.size == pageSize
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
                verificationStatus = data["verificationStatus"] as? String ?: "UNVERIFIED",
                type = type
            )
        } catch(e: Exception) {
            return null
        }
    }
}
