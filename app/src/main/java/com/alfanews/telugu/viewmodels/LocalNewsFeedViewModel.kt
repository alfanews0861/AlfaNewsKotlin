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
import com.alfanews.telugu.services.WeatherService
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
    
    private val _loading = MutableStateFlow(true)
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
            
            if (_news.value.isEmpty()) {
                loadNews(Language.TELUGU, currentUser)
            }
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
                    val address = addresses[0]
                    
                    // మండలం లేదా ఊరు పేరును గుర్తించండి
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

    /**
     * యూజర్ ఉన్న ఖచ్చితమైన ప్రాంతం లేదా జిల్లా ఆధారంగా వాతావరణ సమాచారాన్ని తెస్తుంది.
     */
    private suspend fun generateWeatherPost(place: String?, district: String?, lat: Double? = null, lon: Double? = null): NewsPost {
        // ప్రాధాన్యత: ఒకవేళ యూజర్ ఎంచుకున్న జిల్లా, తను ఉన్న జిల్లా ఒకటే అయితే 'Place' (మండలం/ఊరు) వాడండి.
        // లేకపోతే కేవలం ఎంచుకున్న జిల్లా (District) వాతావరణం మాత్రమే చూపించండి.
        val isViewingDetectedDistrict = district == prefs.detectedDistrict
        val location = if (isViewingDetectedDistrict) (place ?: district ?: "హైదరాబాద్") else (district ?: "హైదరాబాద్")
        val displayLocation = location
        
        // 🌍 నిజమైన వాతావరణ డేటా కోసం API కాల్
        val realWeatherData = WeatherService.fetchWeather(location, lat, lon)
        
        val temperatureStr: String
        val weatherHeadlineTe: String
        val weatherContentTe: String
        val weatherHeadlineEn: String
        
        if (realWeatherData != null) {
            val (temp, code, wind, time) = realWeatherData
            val weatherDesc = WeatherService.getWeatherDescription(code)
            val formattedTime = WeatherService.formatTime(time)
            
            temperatureStr = "${temp.toInt()}°C"
            weatherHeadlineTe = weatherDesc
            
            // వివరణాత్మక కంటెంట్ (Descriptive Content)
            weatherContentTe = buildString {
                append("నేడు $location లో వాతావరణం $weatherDesc. ")
                append("ప్రస్తుత ఉష్ణోగ్రత ${temp.toInt()}°C గా ఉంది. ")
                append("గాలి వేగం గంటకు ${wind.toInt()} కిలోమీటర్లు. ")
                append("ఇది $formattedTime గంటల సమయం నాటి సమాచారం. ")
                
                // వాతావరణం ఆధారంగా సూచనలు
                when (code) {
                    0 -> append("ఆకాశం నిర్మలంగా ఉంది, ప్రయాణాలకు మరియు బయటి పనులకు ఇది అనుకూల సమయం.")
                    1, 2, 3 -> append("ఆకాశం పాక్షికంగా మేఘావృతమై ఉంటుంది, ఎండ తీవ్రత తక్కువగా ఉండి వాతావరణం ఆహ్లాదకరంగా ఉంటుంది.")
                    45, 48 -> append("పొగమంచు కురిసే అవకాశం ఉంది, వాహనదారులు జాగ్రత్తగా ఉండాలి.")
                    51, 53, 55, 61, 63, 65, 80, 81, 82 -> append("తేలికపాటి నుండి మోస్తరు వర్షం పడే అవకాశం ఉంది, బయటకు వెళ్లేటప్పుడు గొడుగు లేదా రెయిన్ కోట్ వెంట ఉంచుకోవడం మంచిది.")
                    95, 96, 99 -> append("పిడుగులతో కూడిన భారీ వర్షం పడే సూచనలు ఉన్నాయి, ఉరుముల సమయంలో చెట్ల కింద లేదా బహిరంగ ప్రదేశాల్లో ఉండకండి.")
                    else -> append("వాతావరణం సాధారణంగా ఉంటుంది, మీ పనులను ప్లాన్ చేసుకోవచ్చు.")
                }
            }
            weatherHeadlineEn = "${WeatherService.getWeatherTypeLabel(code)} ($temperatureStr)"
        } else {
            // ఫాల్‌బ్యాక్ (డేటా రాకపోతే - వాతావరణం సాధారణంగా ఉంటుందని చూపించండి)
            temperatureStr = "31°C"
            weatherHeadlineTe = "సాధారణ వాతావరణం"
            weatherContentTe = "ప్రస్తుతం $location లో వాతావరణం సాధారణంగా ఉంది. ఉష్ణోగ్రత సుమారు $temperatureStr గా నమోదయ్యే అవకాశం ఉంది. మీ రోజువారీ పనులకు ఇది అనుకూలమైన సమయం."
            weatherHeadlineEn = "Normal Weather ($temperatureStr)"
        }

        return NewsPost(
            id = "weather_${System.currentTimeMillis() / (1000 * 60 * 60)}", // Hourly unique ID
            headline = com.alfanews.telugu.models.Headline(
                telugu = "$displayLocation వాతావరణం: $weatherHeadlineTe",
                english = "$displayLocation Weather: $weatherHeadlineEn"
            ),
            content = com.alfanews.telugu.models.Content(
                telugu = weatherContentTe,
                english = "Current weather update for $displayLocation. Temperature is around $temperatureStr. Reported at ${if (realWeatherData != null) WeatherService.formatTime(realWeatherData.time) else "now"}. Please stay tuned for more details."
            ),
            location = displayLocation,
            type = "weather",
            timestamp = System.currentTimeMillis(),
            latitude = lat,
            longitude = lon
        )
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
        val district = _activeDistrict.value
        if (district == null) {
            _loading.value = false
            return
        }
        
        _loading.value = true // Set loading here before launch
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

            // _news.value = emptyList() // Optimization: Don't clear news immediately to avoid flickering spinner on refresh
            lastDocument = null
            _hasMore.value = true
            
            try {
                val newsRef = FirebaseService.db.collection("news")
                
                var posts: List<NewsPost> = emptyList()
                var snapshot: com.google.firebase.firestore.QuerySnapshot? = null

                try {
                    val query = newsRef
                        .whereEqualTo("approved", true)
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
                             .whereEqualTo("approved", true)
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
                
                // ✅ FIXED: No generic fallback! If district news not found, show empty state
                // This ensures LocalNewsFeed stays pure to selected district
                // User can manually select another district if no news available
                lastDocument = snapshot?.documents?.lastOrNull()
                _hasMore.value = snapshot?.documents?.size == pageSize

                // ℹ️ Log engagement for user interest tracking even in local feed
                if (posts.isNotEmpty()) {
                    try {
                        com.alfanews.telugu.services.AnalyticsService.logBulkCategoryViews(posts.map { it.categories }, weight = 1)
                    } catch (e: Exception) { }
                }
                
                // వాతావరణ కార్డును 9వ స్థానంలో (Index 8) పెట్టండి
                val finalPosts = posts.toMutableList()
                val lat = prefs.lastLat.takeIf { it != 0.0 }
                val lon = prefs.lastLon.takeIf { it != 0.0 }
                
                if (finalPosts.size >= 8) {
                    finalPosts.add(8, generateWeatherPost(prefs.localPlace, district, lat, lon))
                } else {
                    // నియోజకవర్గం/జిల్లాలో వార్తలు లేకపోయినా వాతావరణ కార్డ్ చూపించాలి
                    finalPosts.add(generateWeatherPost(prefs.localPlace, district, lat, lon))
                }

                _news.value = finalPosts
                
                // ✅ UI RAPID REFRESH
                if (_news.value.isEmpty() && finalPosts.isNotEmpty()) {
                    _news.value = finalPosts.take(5)
                    _loading.value = false
                }

                val currentTime = System.currentTimeMillis()
                lastRefreshTimeLong = currentTime
                _lastRefreshTime.value = currentTime
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
                         .whereEqualTo("approved", true)
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
                             .whereEqualTo("approved", true)
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

                  // ✅ FIXED: No generic fallback on loadMore either
                  // If no new district posts, just stop pagination
                  if (newPosts.isNotEmpty()) {
                      lastDocument = snapshot?.documents?.lastOrNull()
                      _hasMore.value = snapshot?.documents?.size == pageSize

                      // Track engagement for interest tracking
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
                 _loading.value = false
             }
         }
     }
    
     @Suppress("UNCHECKED_CAST")
    fun onAppResume(language: Language, currentUser: User?) {
        // ప్రతిసారి యాప్‌లోకి తిరిగి వచ్చినప్పుడు టాప్‌కి వెళ్లాలి
        if (_news.value.isNotEmpty()) {
            _shouldScrollToTop.value = true
        }
        refreshIfStale(language, currentUser)
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        // 10 నిమిషాల కంటే ఎక్కువ సమయం గడిస్తే రిఫ్రెష్ చేయండి (600,000 ms)
        if (now - lastRefreshTimeLong > 600000 || _news.value.isEmpty()) {
            loadNews(language, currentUser)
        }
    }

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