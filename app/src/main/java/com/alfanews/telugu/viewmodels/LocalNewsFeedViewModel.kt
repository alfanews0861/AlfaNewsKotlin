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

    enum class LocalFeedStage { DISTRICT, STATE, GENERAL }
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
        val savedDistrict = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
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
        if (district.isNullOrBlank()) return emptyList()
        val list = mutableListOf(district)
        when {
            // --- TELANGANA DISTRICTS ---
            district.contains("ఆదిలాబాద్") || district.equals("Adilabad", ignoreCase = true) ->
                list.addAll(listOf("ఆదిలాబాద్", "Adilabad"))
            district.contains("కొత్తగూడెం") || district.contains("భద్రాద్రి") || district.contains("Kothagudem", ignoreCase = true) || district.contains("Bhadradri", ignoreCase = true) ->
                list.addAll(listOf("భద్రాద్రి కొత్తగూడెం", "కొత్తగూడెం", "Bhadradri", "Kothagudem", "Bhadradri Kothagudem"))
            district.contains("హన్మకొండ") || district.contains("హనుమకొండ") || district.contains("Hanamkonda", ignoreCase = true) || district.contains("Hanumakonda", ignoreCase = true) ->
                list.addAll(listOf("హన్మకొండ", "హనుమకొండ", "వరంగల్ అర్బన్", "Hanamkonda", "Hanumakonda"))
            district.contains("హైదరాబాద్") || district.contains("Hyderabad", ignoreCase = true) || district.equals("HYD", ignoreCase = true) ->
                list.addAll(listOf("హైదరాబాద్", "Hyderabad", "HYD", "సైబరాబాద్", "Cyberabad", "సికింద్రాబాద్", "Secunderabad"))
            district.contains("జగిత్యాల") || district.contains("Jagtial", ignoreCase = true) ->
                list.addAll(listOf("జగిత్యాల", "Jagtial"))
            district.contains("జనగాం") || district.contains("Jangaon", ignoreCase = true) ->
                list.addAll(listOf("జనగాం", "Jangaon"))
            district.contains("భూపాలపల్లి") || district.contains("జయశంకర్") || district.contains("Bhupalpally", ignoreCase = true) ->
                list.addAll(listOf("జయశంకర్ భూపాలపల్లి", "భూపాలపల్లి", "Bhupalpally", "Jayashankar Bhupalpally"))
            district.contains("గద్వాల") || district.contains("జోగులాంబ") || district.contains("Gadwal", ignoreCase = true) ->
                list.addAll(listOf("జోగులాంబ గద్వాల", "గద్వాల", "Gadwal", "Jogulamba Gadwal"))
            district.contains("కామారెడ్డి") || district.contains("Kamareddy", ignoreCase = true) ->
                list.addAll(listOf("కామారెడ్డి", "Kamareddy"))
            district.contains("కరీంనగర్") || district.contains("Karimnagar", ignoreCase = true) ->
                list.addAll(listOf("కరీంనగర్", "Karimnagar"))
            district.contains("ఖమ్మం") || district.contains("Khammam", ignoreCase = true) ->
                list.addAll(listOf("ఖమ్మం", "Khammam"))
            district.contains("ఆసిఫాబాద్") || district.contains("కుమ్రం") || district.contains("Asifabad", ignoreCase = true) ->
                list.addAll(listOf("కుమ్రం భీమ్ ఆసిఫాబాద్", "ఆసిఫాబాద్", "Asifabad", "Komaram Bheem"))
            district.contains("మహబూబాబాద్") || district.contains("Mahabubabad", ignoreCase = true) ->
                list.addAll(listOf("మహబూబాబాద్", "Mahabubabad"))
            district.contains("మహబూబ్") || district.contains("మహబూబ్‌నగర్") || district.contains("Mahabubnagar", ignoreCase = true) || district.contains("Mahboobnagar", ignoreCase = true) ->
                list.addAll(listOf("మహబూబ్ నగర్", "మహబూబ్‌నగర్", "Mahabubnagar", "Mahboobnagar"))
            district.contains("మంచిర్యాల") || district.contains("Mancherial", ignoreCase = true) ->
                list.addAll(listOf("మంచిర్యాల", "Mancherial"))
            district.contains("మెదక్") || district.contains("Medak", ignoreCase = true) ->
                list.addAll(listOf("మెదక్", "Medak"))
            district.contains("మేడ్చల్") || district.contains("మల్కాజిగిరి") || district.contains("Medchal", ignoreCase = true) || district.contains("Malkajgiri", ignoreCase = true) ->
                list.addAll(listOf("మేడ్చల్ మల్కాజిగిరి", "మేడ్చల్", "మల్కాజిగిరి", "Medchal", "Malkajgiri", "Medchal-Malkajgiri"))
            district.contains("ములుగు") || district.contains("Mulugu", ignoreCase = true) ->
                list.addAll(listOf("ములుగు", "Mulugu"))
            district.contains("నాగర్ కర్నూల్") || district.contains("నాగర్‌కర్నూల్") || district.contains("Nagarkurnool", ignoreCase = true) ->
                list.addAll(listOf("నాగర్ కర్నూల్", "నాగర్‌కర్నూల్", "Nagarkurnool"))
            district.contains("నల్గొండ") || district.contains("నల్లగొండ") || district.contains("Nalgonda", ignoreCase = true) ->
                list.addAll(listOf("నల్గొండ", "నల్లగొండ", "Nalgonda"))
            district.contains("నారాయణపేట") || district.contains("Narayanpet", ignoreCase = true) ->
                list.addAll(listOf("నారాయణపేట", "Narayanpet"))
            district.contains("నిర్మల్") || district.contains("Nirmal", ignoreCase = true) ->
                list.addAll(listOf("నిర్మల్", "Nirmal"))
            district.contains("నిజామాబాద్") || district.contains("Nizamabad", ignoreCase = true) ->
                list.addAll(listOf("నిజామాబాద్", "Nizamabad"))
            district.contains("పెద్దపల్లి") || district.contains("Peddapalli", ignoreCase = true) ->
                list.addAll(listOf("పెద్దపల్లి", "Peddapalli"))
            district.contains("సిరిసిల్ల") || district.contains("రాజన్న") || district.contains("Sircilla", ignoreCase = true) ->
                list.addAll(listOf("రాజన్న సిరిసిల్ల", "సిరిసిల్ల", "Sircilla", "Rajanna Sircilla"))
            district.contains("రంగారెడ్డి") || district.contains("Rangareddy", ignoreCase = true) ->
                list.addAll(listOf("రంగారెడ్డి", "Rangareddy", "Ranga Reddy"))
            district.contains("సంగారెడ్డి") || district.contains("Sangareddy", ignoreCase = true) ->
                list.addAll(listOf("సంగారెడ్డి", "Sangareddy"))
            district.contains("సిద్దిపేట") || district.contains("Siddipet", ignoreCase = true) ->
                list.addAll(listOf("సిద్దిపేట", "Siddipet"))
            district.contains("సూర్యాపేట") || district.contains("Suryapet", ignoreCase = true) ->
                list.addAll(listOf("సూర్యాపేట", "Suryapet"))
            district.contains("వికారాబాద్") || district.contains("Vikarabad", ignoreCase = true) ->
                list.addAll(listOf("వికారాబాద్", "Vikarabad"))
            district.contains("వనపర్తి") || district.contains("Wanaparthy", ignoreCase = true) ->
                list.addAll(listOf("వనపర్తి", "Wanaparthy"))
            district.contains("వరంగల్") || district.contains("Warangal", ignoreCase = true) ->
                list.addAll(listOf("వరంగల్", "వరంగల్ రూరల్", "హన్మకొండ", "Warangal", "Warangal Rural"))
            district.contains("భువనగిరి") || district.contains("యాదాద్రి") || district.contains("Bhuvanagiri", ignoreCase = true) || district.contains("Yadadri", ignoreCase = true) ->
                list.addAll(listOf("యాదాద్రి భువనగిరి", "భువనగిరి", "Yadadri", "Bhuvanagiri", "Yadadri Bhuvanagiri"))

            // --- ANDHRA PRADESH DISTRICTS ---
            district.contains("అల్లూరి") || district.contains("పాడేరు") || district.contains("Alluri", ignoreCase = true) || district.contains("ASR", ignoreCase = true) || district.contains("Paderu", ignoreCase = true) ->
                list.addAll(listOf("అల్లూరి సీతారామరాజు", "అల్లూరి", "పాడేరు", "Alluri", "ASR", "Alluri Sitharama Raju", "Paderu"))
            district.contains("అనకాపల్లి") || district.contains("Anakapalli", ignoreCase = true) ->
                list.addAll(listOf("అనకాపల్లి", "Anakapalli"))
            district.contains("అనంతపురం") || district.contains("Anantapur", ignoreCase = true) ->
                list.addAll(listOf("అనంతపురం", "అనంతపురము", "Anantapur", "Ananthapur"))
            district.contains("అన్నమయ్య") || district.contains("రాయచోటి") || district.contains("Annamayya", ignoreCase = true) || district.contains("Rayachoti", ignoreCase = true) ->
                list.addAll(listOf("అన్నమయ్య", "రాయచోటి", "Annamayya", "Rayachoti"))
            district.contains("బాపట్ల") || district.contains("Bapatla", ignoreCase = true) ->
                list.addAll(listOf("బాపట్ల", "Bapatla"))
            district.contains("చిత్తూరు") || district.contains("Chittoor", ignoreCase = true) ->
                list.addAll(listOf("చిత్తూరు", "Chittoor"))
            district.contains("కోనసీమ") || district.contains("అమలాపురం") || district.contains("Konaseema", ignoreCase = true) || district.contains("Amalapuram", ignoreCase = true) ->
                list.addAll(listOf("కోనసీమ", "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ", "అమలాపురం", "Konaseema", "Amalapuram", "Dr. B.R. Ambedkar Konaseema"))
            district.contains("తూర్పు గోదావరి") || district.contains("రాజమండ్రి") || district.contains("East Godavari", ignoreCase = true) || district.contains("Rajahmundry", ignoreCase = true) ->
                list.addAll(listOf("తూర్పు గోదావరి", "రాజమండ్రి", "రాజమహేంద్రవరం", "East Godavari", "Rajahmundry"))
            district.contains("ఏలూరు") || district.contains("Eluru", ignoreCase = true) ->
                list.addAll(listOf("ఏలూరు", "Eluru"))
            district.contains("గుంటూరు") || district.contains("Guntur", ignoreCase = true) ->
                list.addAll(listOf("గుంటూరు", "Guntur"))
            district.contains("కాకినాడ") || district.contains("Kakinada", ignoreCase = true) ->
                list.addAll(listOf("కాకినాడ", "Kakinada"))
            district.contains("కృష్ణా") || district.contains("మచిలీపట్నం") || district.contains("Krishna", ignoreCase = true) || district.contains("Machilipatnam", ignoreCase = true) ->
                list.addAll(listOf("కృష్ణా", "మచిలీపట్నం", "Krishna", "Machilipatnam"))
            district.contains("కర్నూలు") || district.contains("Kurnool", ignoreCase = true) ->
                list.addAll(listOf("కర్నూలు", "Kurnool"))
            district.contains("నంద్యాల") || district.contains("Nandyal", ignoreCase = true) ->
                list.addAll(listOf("నంద్యాల", "Nandyal"))
            district.contains("ఎన్టీఆర్") || district.contains("విజయవాడ") || district.contains("NTR", ignoreCase = true) || district.contains("Vijayawada", ignoreCase = true) ->
                list.addAll(listOf("ఎన్టీఆర్", "విజయవాడ", "NTR", "Vijayawada"))
            district.contains("పల్నాడు") || district.contains("నరసరావుపేట") || district.contains("Palnadu", ignoreCase = true) || district.contains("Narasaraopeta", ignoreCase = true) ->
                list.addAll(listOf("పల్నాడు", "నరసరావుపేట", "Palnadu", "Narasaraopeta"))
            district.contains("మన్యం") || district.contains("పార్వతీపురం") || district.contains("Parvathipuram", ignoreCase = true) || district.contains("Manyam", ignoreCase = true) ->
                list.addAll(listOf("పార్వతీపురం మన్యం", "మన్యం", "పార్వతీపురం", "Parvathipuram", "Manyam", "Parvathipuram Manyam"))
            district.contains("ప్రకాశం") || district.contains("ఒంగోలు") || district.contains("Prakasam", ignoreCase = true) || district.contains("Ongole", ignoreCase = true) ->
                list.addAll(listOf("ప్రకాశం", "ఒంగోలు", "Prakasam", "Ongole"))
            district.contains("మార్కాపురం") || district.contains("Markapur", ignoreCase = true) ->
                list.addAll(listOf("మార్కాపురం", "Markapur"))
            district.contains("పోలవరం") || district.contains("Polavaram", ignoreCase = true) ->
                list.addAll(listOf("పోలవరం", "Polavaram"))
            district.contains("మదనపల్లె") || district.contains("Madanapalle", ignoreCase = true) ->
                list.addAll(listOf("మదనపల్లె", "Madanapalle"))
            district.contains("నెల్లూరు") || district.contains("Nellore", ignoreCase = true) ->
                list.addAll(listOf("శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", "నెల్లూరు", "Nellore", "SPSR Nellore", "Sri Potti Sriramulu Nellore"))
            district.contains("సత్యసాయి") || district.contains("పుట్టపర్తి") || district.contains("Sathya Sai", ignoreCase = true) || district.contains("Puttaparthi", ignoreCase = true) ->
                list.addAll(listOf("శ్రీ సత్యసాయి", "సత్యసాయి", "పుట్టపర్తి", "Sri Sathya Sai", "Sathya Sai", "Puttaparthi"))
            district.contains("శ్రీకాకుళం") || district.contains("Srikakulam", ignoreCase = true) ->
                list.addAll(listOf("శ్రీకాకుళం", "Srikakulam"))
            district.contains("తిరుపతి") || district.contains("తిరుమల") || district.contains("Tirupati", ignoreCase = true) || district.contains("Tirumala", ignoreCase = true) ->
                list.addAll(listOf("తిరుపతి", "తిరుమల", "Tirupati", "Tirumala"))
            district.contains("విశాఖ") || district.contains("వైజాగ్") || district.contains("Visakhapatnam", ignoreCase = true) || district.contains("Vizag", ignoreCase = true) ->
                list.addAll(listOf("విశాఖపట్నం", "విశాఖ", "వైజాగ్", "Visakhapatnam", "Vizag"))
            district.contains("విజయనగరం") || district.contains("Vizianagaram", ignoreCase = true) ->
                list.addAll(listOf("విజయనగరం", "Vizianagaram"))
            district.contains("పశ్చిమ గోదావరి") || district.contains("భీమవరం") || district.contains("West Godavari", ignoreCase = true) || district.contains("Bhimavaram", ignoreCase = true) ->
                list.addAll(listOf("పశ్చిమ గోదావరి", "భీమవరం", "West Godavari", "Bhimavaram"))
            district.contains("కడప") || district.contains("వైఎస్ఆర్") || district.contains("Kadapa", ignoreCase = true) ->
                list.addAll(listOf("వైఎస్ఆర్ కడప", "కడప", "YSR Kadapa", "Kadapa"))
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
        isFetching = false
        
        loadJob = viewModelScope.launch {
            if (isFetching) return@launch
            isFetching = true
            
            val newsRef = FirebaseService.db.collection("news")
            val districtAliases = getDistrictAliases(district)
            val primaryAliases = districtAliases.take(30)

            if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) {
                _isOnline.value = false
                if (_news.value.isEmpty()) {
                    // 📴 OFFLINE ONLY: Use local cache only when user has no internet connection
                    try {
                        val cachedSnap = newsRef
                            .whereEqualTo("approved", true)
                            .whereIn("district", primaryAliases)
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
            
            try {
                var posts: List<NewsPost> = emptyList()
                var snapshot: com.google.firebase.firestore.QuerySnapshot? = null

                try {
                    // 🚀 STEP 1: Search by 'district' field directly with whereIn (Single Batch Query)
                    val query = newsRef
                        .whereEqualTo("approved", true)
                        .whereIn("district", primaryAliases)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(pageSize.toLong())
                    
                    val snap = kotlinx.coroutines.withTimeoutOrNull(3500L) {
                        query.get().await()
                    }
                    if (snap != null && !snap.isEmpty) {
                        currentStage = LocalFeedStage.DISTRICT
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
                        
                        val fallbackSnapshot = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                            fallbackQuery.get().await()
                        }
                        if (fallbackSnapshot != null && !fallbackSnapshot.isEmpty) {
                            currentStage = LocalFeedStage.DISTRICT
                            snapshot = fallbackSnapshot
                            posts = withContext(Dispatchers.Default) {
                                fallbackSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                            }
                        }
                    }

                    // 🚀 STEP 3: State-Level Fallback if district has zero local news right now
                    if (posts.isEmpty()) {
                        val isAP = Constants.AP_DISTRICTS.any { it.equals(district, ignoreCase = true) || district.contains(it) || it.contains(district) } ||
                                   listOf("Andhra", "AP", "నెల్లూరు", "కడప", "విజయవాడ", "వైజాగ్", "గుంటూరు", "తిరుపతి", "Nellore", "Kadapa").any { district.contains(it, ignoreCase = true) }
                        val stateTags = if (isAP) {
                            listOf("Andhra Pradesh", "AndhraPradesh", "AP", "Andhra", "ఆంధ్రప్రదేశ్", "ఆంధ్ర", "State News", "జాతీయం", "General", "State")
                        } else {
                            listOf("Telangana", "TS", "TG", "తెలంగాణ", "హైదరాబాద్", "Hyderabad", "State News", "జాతీయం", "General", "State")
                        }
                        
                        val stateQuery = newsRef
                            .whereEqualTo("approved", true)
                            .whereIn("district", stateTags)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(pageSize.toLong())
                        
                        val stateSnapshot = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                            stateQuery.get().await()
                        }
                        if (stateSnapshot != null && !stateSnapshot.isEmpty) {
                            currentStage = LocalFeedStage.STATE
                            snapshot = stateSnapshot
                            posts = withContext(Dispatchers.Default) {
                                stateSnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                            }
                        }
                    }

                    // 🚀 STEP 4: Emergency Fallback to latest approved news if local/state news is empty
                    if (posts.isEmpty()) {
                        val emergencySnapshot = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                            newsRef
                                .whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                                .get().await()
                        }
                        if (emergencySnapshot != null && !emergencySnapshot.isEmpty) {
                            currentStage = LocalFeedStage.GENERAL
                            snapshot = emergencySnapshot
                            posts = withContext(Dispatchers.Default) {
                                emergencySnapshot.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                            }
                        }
                    }

                    // 🚀 STEP 5: Cache Fallback if network was slow or empty
                    if (posts.isEmpty()) {
                        try {
                            val cachedSnap = newsRef
                                .whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                                .get(com.google.firebase.firestore.Source.CACHE)
                                .await()
                            if (!cachedSnap.isEmpty) {
                                snapshot = cachedSnap
                                posts = withContext(Dispatchers.Default) {
                                    cachedSnap.documents.mapNotNull { doc -> convertToNewsPost(doc.id, doc.data ?: emptyMap()) }
                                }
                            }
                        } catch (_: Exception) { }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("LocalNewsFeedViewModel", "News fetch failed for $district: ${e.message}")
                }
                
                lastDocument = snapshot?.documents?.lastOrNull()
                // Keep hasMore = true so pagination advances to State and General news smoothly
                _hasMore.value = true
                
                val rankedPosts = withContext(Dispatchers.Default) {
                    rankLocalNews(posts, district, currentUser)
                }

                val wasEmpty = _news.value.isEmpty()
                if (rankedPosts.isNotEmpty()) {
                    _news.value = rankedPosts
                }
                // Scroll to top on fresh district news load only if feed was empty
                if (rankedPosts.isNotEmpty()) {
                    val validIds = rankedPosts.filter { it.type == "news" }.map { it.id }
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
                    loadMore(currentLanguage, currentUser)
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
                val districtAliases = getDistrictAliases(district)
                val mappedState = Constants.mapDistrictToState(district)
                val isAP = mappedState == "Andhra Pradesh" || Constants.AP_DISTRICTS.contains(district) || district.contains("నెల్లూరు") || district.contains("కడప")
                val stateTags = if (isAP) {
                    listOf("Andhra Pradesh", "ఆంధ్రప్రదేశ్", "AP", "State", "రాష్ట్రం")
                } else {
                    listOf("Telangana", "తెలంగాణ", "TS", "State", "రాష్ట్రం")
                }

                var attempts = 0
                var appendedCount = 0

                while (attempts < 3 && appendedCount == 0 && _hasMore.value) {
                    attempts++
                    var snap: com.google.firebase.firestore.QuerySnapshot? = null

                    when (currentStage) {
                        LocalFeedStage.DISTRICT -> {
                            val primaryAliases = districtAliases.take(30)
                            var q = newsRef
                                .whereEqualTo("approved", true)
                                .whereIn("district", primaryAliases)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                            val lastDocDistrict = lastDocument
                            if (lastDocDistrict != null) {
                                q = q.startAfter(lastDocDistrict)
                            }
                            val res = kotlinx.coroutines.withTimeoutOrNull(3500L) {
                                try { q.get().await() } catch (e: Exception) { null }
                            }
                            if (res != null && !res.isEmpty) {
                                snap = res
                            } else {
                                // 🔄 Try category aliases fallback
                                val categoryAliases = districtAliases.take(10)
                                var backupQuery = newsRef
                                    .whereEqualTo("approved", true)
                                    .whereArrayContainsAny("categories", categoryAliases)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(pageSize.toLong())
                                val lastDocBackup = lastDocument
                                if (lastDocBackup != null) {
                                    backupQuery = backupQuery.startAfter(lastDocBackup)
                                }
                                val backupRes = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                                    try { backupQuery.get().await() } catch (e: Exception) { null }
                                }
                                if (backupRes != null && !backupRes.isEmpty) {
                                    snap = backupRes
                                } else {
                                    // District news exhausted! Transition smoothly to STATE news!
                                    currentStage = LocalFeedStage.STATE
                                    lastDocument = null
                                    continue
                                }
                            }
                        }
                        LocalFeedStage.STATE -> {
                            var stateQuery = newsRef
                                .whereEqualTo("approved", true)
                                .whereIn("district", stateTags)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                            val lastDocState = lastDocument
                            if (lastDocState != null) {
                                stateQuery = stateQuery.startAfter(lastDocState)
                            }
                            val stateRes = kotlinx.coroutines.withTimeoutOrNull(3000L) {
                                try { stateQuery.get().await() } catch (e: Exception) { null }
                            }
                            if (stateRes != null && !stateRes.isEmpty) {
                                snap = stateRes
                            } else {
                                // State news exhausted! Transition smoothly to GENERAL news!
                                currentStage = LocalFeedStage.GENERAL
                                lastDocument = null
                                continue
                            }
                        }
                        LocalFeedStage.GENERAL -> {
                            var generalQuery = newsRef
                                .whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(pageSize.toLong())
                            val lastDocGeneral = lastDocument
                            if (lastDocGeneral != null) {
                                generalQuery = generalQuery.startAfter(lastDocGeneral)
                            }
                            val generalRes = kotlinx.coroutines.withTimeoutOrNull(3000L) {
                                try { generalQuery.get().await() } catch (e: Exception) { null }
                            }
                            if (generalRes != null && !generalRes.isEmpty) {
                                snap = generalRes
                            } else {
                                // End of general news reached: cleanly stop pagination to prevent endless re-fetch loop
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
                            _news.value = _news.value + rankedNewPosts
                            appendedCount = rankedNewPosts.size
                            val validIds = rankedNewPosts.filter { it.type == "news" }.map { it.id }
                            if (validIds.isNotEmpty()) {
                                prefs.incrementPostViewCounts(validIds)
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("LocalNewsFeedViewModel", "LoadMore query failed: ${e.message}")
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

        // 1. యూజర్ యొక్క ప్రాథమిక మండలాన్ని (Primary Mandal) గుర్తించడం
        val primaryMandal = prefs.getEffectiveUserMandal(district, currentUser)
        val constituency = if (!primaryMandal.isNullOrBlank()) {
            com.alfanews.telugu.utils.LocationHierarchyManager.getConstituencyForMandal(district, primaryMandal)
        } else null
        val constituencyMandals = if (!constituency.isNullOrBlank()) {
            com.alfanews.telugu.utils.LocationHierarchyManager.getMandalsForConstituency(district, constituency)
        } else emptyList()

        fun computeLocalScore(post: NewsPost): Double {
            val postMandal = com.alfanews.telugu.utils.LocationHierarchyManager.extractMandalFromPost(post, district)

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

        // 2. చదివిన వార్తలను వెనక్కి నెట్టడం (Unread vs Seen)
        val unreadPosts = posts.filter { prefs.getPostViewCount(it.id) < 2 }
        val readPosts = posts.filter { it !in unreadPosts }

        val rankedUnread = unreadPosts.sortedByDescending { computeLocalScore(it) }
        val rankedRead = readPosts.sortedByDescending { computeLocalScore(it) }

        return (rankedUnread + rankedRead).distinctBy { it.id }
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
