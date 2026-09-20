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
import com.alfanews.telugu.models.SurveyQuestion
import com.alfanews.telugu.models.SurveyOption
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.WeatherService
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
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale

class NewsFeedViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    private var currentLanguage: Language = Language.TELUGU

    init {
        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                if (district != _userDistrict.value) {
                    _userDistrict.value = district
                    loadNews(Language.TELUGU, null)
                }
            }
        }
    }
    
    private val _news = MutableStateFlow<kotlin.collections.List<NewsPost>>(emptyList())
    val news: StateFlow<kotlin.collections.List<NewsPost>> = _news.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _userDistrict = MutableStateFlow<String?>(prefs.getEffectiveDistrict())
    val userDistrict: StateFlow<String?> = _userDistrict.asStateFlow()

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _lastRefreshTime = MutableStateFlow(0L)
    val lastRefreshTime: StateFlow<Long> = _lastRefreshTime.asStateFlow()

    private val _shouldScrollToTop = MutableStateFlow(false)
    val shouldScrollToTop: StateFlow<Boolean> = _shouldScrollToTop.asStateFlow()

    private val _localAds = MutableStateFlow<kotlin.collections.List<com.alfanews.telugu.models.LocalAd>>(emptyList())
    val localAds: StateFlow<kotlin.collections.List<com.alfanews.telugu.models.LocalAd>> = _localAds.asStateFlow()

    fun resetScrollSignal() {
        _shouldScrollToTop.value = false
    }

    private fun loadLocalAds(district: String?) {
        viewModelScope.launch {
            try {
                val now = System.currentTimeMillis()
                val gson = Gson()
                
                // 1. Check Cache
                val cacheKey = district ?: "ALL"
                val cachedJson = prefs.getLocalAdsCache(cacheKey)
                val cacheTime = prefs.getLocalAdsTimestamp(cacheKey)
                val isCacheValid = (now - cacheTime) < (30L * 60L * 1000L) // 30 minutes
                
                // ✅ Cache valid + non-empty అయితే మాత్రమే use చేయి
                // Empty list cache చేసినా Firestore నుండి refetch చేస్తాం
                val cachedList: List<com.alfanews.telugu.models.LocalAd>? = if (isCacheValid && cachedJson != null && cachedJson != "[]") {
                    try {
                        val type = object : TypeToken<List<com.alfanews.telugu.models.LocalAd>>() {}.type
                        val parsed = gson.fromJson<List<com.alfanews.telugu.models.LocalAd>>(cachedJson, type)
                        if (parsed.isNullOrEmpty()) null else parsed // empty cache = refetch
                    } catch (e: Exception) { null }
                } else null
                
                val allAds = if (cachedList != null) {
                    Log.d("NewsFeedVM", "Loading local ads from cache for $cacheKey (${cachedList.size} ads)")
                    cachedList
                } else {
                    Log.d("NewsFeedVM", "Fetching local ads from Firestore for $cacheKey")
                    val snapshot = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                        FirebaseService.db.collection("local_ads")
                            .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                            .get().await()
                    }
                    
                    val ads = snapshot?.documents?.mapNotNull { com.alfanews.telugu.models.LocalAd.fromSnapshot(it) } ?: emptyList()
                    Log.d("NewsFeedVM", "Firestore returned ${ads.size} active ads")
                    
                    // Empty అయినా cache చేయి కానీ timestamp set చేయొద్దు — తద్వారా తర్వాత retry చేస్తుంది
                    if (ads.isNotEmpty()) {
                        prefs.saveLocalAdsCache(cacheKey, gson.toJson(ads))
                    }
                    ads
                }
                
                val validAds = allAds.filter { ad ->
                    // district null అయితే (user location unknown) - targetDistrict == "ALL" ads మాత్రమే చూపించు
                    val isForDistrict = if (district == null) {
                        ad.targetDistrict == "ALL"
                    } else {
                        ad.targetDistrict == "ALL" || ad.targetDistrict == district
                    }
                    // targetState filter: "ALL" అయితే అందరికీ, లేదా user state కి match అయితే
                    val userState = if (district != null) {
                        val tsDistricts = com.alfanews.telugu.utils.Constants.TS_DISTRICTS
                        val apDistricts = com.alfanews.telugu.utils.Constants.AP_DISTRICTS
                        when {
                            tsDistricts.contains(district) -> "TS"
                            apDistricts.contains(district) -> "AP"
                            else -> null
                        }
                    } else null
                    val isForState = ad.targetState == "ALL" || userState == null || ad.targetState == userState
                    val isWithinDate = if (ad.adType == com.alfanews.telugu.models.AdType.TIME_BASED_FIXED) {
                        (ad.startDate ?: 0) <= now && (ad.endDate ?: Long.MAX_VALUE) >= now
                    } else true
                    val isNotFinished = if (ad.adType == com.alfanews.telugu.models.AdType.VIEWS_BASED) {
                        ad.viewsCurrent < ad.viewsOrdered
                    } else true
                    isForDistrict && isForState && isWithinDate && isNotFinished
                }

                // 2. Queue Logic (Seen vs Unseen)
                val seenIds = prefs.getSeenLocalAdIds()
                val unseenAds = validAds.filter { it.id !in seenIds }
                val seenAds = validAds.filter { it.id in seenIds }

                android.util.Log.d("NewsFeedVM", "Ad Queue - Total: ${validAds.size}, Unseen: ${unseenAds.size}, Seen: ${seenAds.size}")

                if (unseenAds.isEmpty() && validAds.isNotEmpty()) {
                    android.util.Log.d("NewsFeedVM", "All ads seen. Resetting seen list.")
                    prefs.clearSeenLocalAds()
                    _localAds.value = validAds.shuffled()
                } else {
                    _localAds.value = unseenAds.shuffled() + seenAds.shuffled()
                }
            } catch (e: Exception) {
                android.util.Log.e("NewsFeedVM", "Error loading local ads: ${e.message}")
                _localAds.value = emptyList()
            }
        }
    }

    private val _sharedPostId = MutableStateFlow<String?>(null)
    val sharedPostId: StateFlow<String?> = _sharedPostId.asStateFlow()

    fun setSharedPostId(postId: String?) {
        _sharedPostId.value = postId
    }

    private var prefCursor: DocumentSnapshot? = null
    private var mainCursor: DocumentSnapshot? = null
    private var localCursor: DocumentSnapshot? = null
    @Volatile private var isFetching = false
    private var currentFetchJob: kotlinx.coroutines.Job? = null
    private var lastRefreshTimeLong: Long = 0
    private var consecutiveEmptyLoads = 0
    private var pendingLoadMore = false

    // 🚀 IN-MEMORY CACHES TO SAVE FIRESTORE READS
    private var cachedGreetingPost: NewsPost? = null
    private var cachedGreetingFetchTime: Long = 0L
    private val GREETING_CACHE_TTL = 30 * 60 * 1000L // 30 mins

    private var cachedActiveSurvey: NewsPost? = null
    private var cachedSurveyFetchTime: Long = 0L
    private var cachedSurveyDistrict: String? = null
    private val SURVEY_CACHE_TTL = 15 * 60 * 1000L // 15 mins

    // 🌐 UNIVERSAL DISTRICT IDENTIFIERS (Applicable to both Telangana & Andhra Pradesh)
    private val universalDistricts = listOf(
        "General", "State", "Sports", "Health", "Technology", "Business", "Entertainment", "Cinema",
        "National", "International", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle",
        "India", "World", "Global", "జనరల్", "భారతదేశం", "ప్రపంచం", "జాతీయం", "అంతర్జాతీయం",
        "సినిమా", "స్పోర్ట్స్", "క్రీడలు", "వ్యాపారం", "టెక్నాలజీ", "ఆరోగ్యం", "విద్య", "వ్యవసాయం", "భక్తి"
    )

    // 🌐 STRICTLY UNIVERSAL CATEGORIES (No state-specific politics or state-specific tags)
    private val strictlyGlobalKeywords = listOf(
        "సినిమా", "స్పోర్ట్స్", "క్రీడలు", "జాతీయం", "అంతర్జాతీయం", "వ్యాపారం", 
        "ఆరోగ్యం", "విద్య", "టెక్నాలజీ", "వ్యవసాయం", "భక్తి", 
        "వినోదం", "ప్రపంచం", "లైఫ్ స్టైల్", "జనరల్", "భారతదేశం", "సినిమా వార్తలు",
        "cinema", "sports", "health", "technology", "business", "entertainment",
        "national", "international", "crime", "education", "agriculture", "devotional", "lifestyle"
    )

    private fun isGlobalCategory(category: String?): Boolean {
        if (category.isNullOrBlank()) return false
        return strictlyGlobalKeywords.any { kw -> category.contains(kw, ignoreCase = true) }
    }

    private fun isGlobalPost(post: NewsPost): Boolean {
        if (post.isGlobal) return true
        if (isGlobalCategory(post.category)) return true
        if (post.categories.any { isGlobalCategory(it) }) return true
        if (universalDistricts.any { it.equals(post.district, ignoreCase = true) } && !post.categories.contains("జిల్లా వార్త")) {
            return true
        }
        return false
    }

    /**
     * Firestore లో general news fetch చేసేందుకు ఆయా రాష్ట్రానికి సరిపోయే district ట్యాగ్‌లు
     * (గరిష్టంగా 30 items - Firestore whereIn limit)
     */
    private fun getGeneralDistrictsForState(userState: String?): List<String> {
        val coreUniversal = listOf(
            "General", "State", "Sports", "Health", "Technology", "Business", 
            "Entertainment", "Cinema", "National", "International", "Crime", 
            "Education", "Agriculture", "Devotional", "Lifestyle", "India", "World"
        )
        return when (userState) {
            "Telangana" -> (coreUniversal + listOf("Telangana", "TS", "TG", "తెలంగాణ", "హైదరాబాద్", "Hyderabad", "State News", "జాతీయం", "సినిమా", "క్రీడలు")).distinct().take(30)
            "Andhra Pradesh" -> (coreUniversal + listOf("Andhra Pradesh", "AndhraPradesh", "AP", "Andhra", "ఆంధ్రప్రదేశ్", "State News", "జాతీయం", "సినిమా", "క్రీడలు")).distinct().take(30)
            else -> (coreUniversal + listOf("State", "Telangana", "Andhra Pradesh", "TS", "AP", "తెలంగాణ", "ఆంధ్రప్రదేశ్", "హైదరాబాద్", "జాతీయం", "సినిమా", "క్రీడలు")).distinct().take(30)
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
            district.contains("రంగారెడ్డి") || district.contains("Rangareddy", ignoreCase = true) || district.contains("Ranga Reddy", ignoreCase = true) ->
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
                list.addAll(listOf("వరంగల్", "వరంగల్ రూరల్", "Warangal", "Warangal Rural"))
            district.contains("భువనగిరి") || district.contains("యాదాద్రి") || district.contains("Yadadri", ignoreCase = true) || district.contains("Bhongir", ignoreCase = true) ->
                list.addAll(listOf("యాదాద్రి భువనగిరి", "భువనగిరి", "యాదాద్రి", "Yadadri", "Bhongir", "Yadadri Bhuvanagiri"))

            // --- ANDHRA PRADESH DISTRICTS ---
            district.contains("అల్లూరి") || district.contains("సీతారామరాజు") || district.contains("Alluri", ignoreCase = true) ->
                list.addAll(listOf("అల్లూరి సీతారామరాజు", "అల్లూరి", "Alluri", "ASR District"))
            district.contains("అనకాపల్లి") || district.contains("Anakapalli", ignoreCase = true) ->
                list.addAll(listOf("అనకాపల్లి", "Anakapalli"))
            district.contains("అనంతపురం") || district.contains("Anantapur", ignoreCase = true) || district.contains("Ananthapur", ignoreCase = true) ->
                list.addAll(listOf("అనంతపురం", "Anantapur", "Ananthapuramu"))
            district.contains("అన్నమయ్య") || district.contains("రాజంపేట") || district.contains("రాయచోటి") || district.contains("Annamayya", ignoreCase = true) ->
                list.addAll(listOf("అన్నమయ్య", "Annamayya", "Rayachoti"))
            district.contains("బాపట్ల") || district.contains("Bapatla", ignoreCase = true) ->
                list.addAll(listOf("బాపట్ల", "Bapatla"))
            district.contains("చిత్తూరు") || district.contains("Chittoor", ignoreCase = true) ->
                list.addAll(listOf("చిత్తూరు", "Chittoor"))
            district.contains("కోనసీమ") || district.contains("అంబేడ్కర్") || district.contains("Konaseema", ignoreCase = true) ->
                list.addAll(listOf("డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ", "కోనసీమ", "Konaseema", "Dr. B.R. Ambedkar Konaseema"))
            district.contains("తూర్పు గోదావరి") || district.contains("తూర్పుగోదావరి") || district.contains("East Godavari", ignoreCase = true) || district.contains("రాజమండ్రి") ->
                list.addAll(listOf("తూర్పు గోదావరి", "తూర్పుగోదావరి", "East Godavari", "Rajahmundry"))
            district.contains("ఏలూరు") || district.contains("Eluru", ignoreCase = true) ->
                list.addAll(listOf("ఏలూరు", "Eluru"))
            district.contains("గుంటూరు") || district.contains("Guntur", ignoreCase = true) ->
                list.addAll(listOf("గుంటూరు", "Guntur"))
            district.contains("కాకినాడ") || district.contains("Kakinada", ignoreCase = true) ->
                list.addAll(listOf("కాకినాడ", "Kakinada"))
            district.contains("కృష్ణా") || district.contains("మచిలీపట్నం") || district.contains("Krishna", ignoreCase = true) ->
                list.addAll(listOf("కృష్ణా", "Krishna", "Machilipatnam"))
            district.contains("కర్నూలు") || district.contains("Kurnool", ignoreCase = true) ->
                list.addAll(listOf("కర్నూలు", "Kurnool"))
            district.contains("నంద్యాల") || district.contains("Nandyal", ignoreCase = true) ->
                list.addAll(listOf("నంద్యాల", "Nandyal"))
            district.contains("ఎన్టీఆర్") || district.contains("విజయవాడ") || district.contains("NTR", ignoreCase = true) ->
                list.addAll(listOf("ఎన్టీఆర్", "NTR", "Vijayawada", "NTR District"))
            district.contains("పల్నాడు") || district.contains("నరసరావుపేట") || district.contains("Palnadu", ignoreCase = true) ->
                list.addAll(listOf("పల్నాడు", "Palnadu", "Narasaraopet"))
            district.contains("పార్వతీపురం") || district.contains("మన్యం") || district.contains("Parvathipuram", ignoreCase = true) || district.contains("Manyam", ignoreCase = true) ->
                list.addAll(listOf("పార్వతీపురం మన్యం", "మన్యం", "పార్వతీపురం", "Parvathipuram", "Manyam"))
            district.contains("ప్రకాశం") || district.contains("ఒంగోలు") || district.contains("Prakasam", ignoreCase = true) || district.contains("Ongole", ignoreCase = true) ->
                list.addAll(listOf("ప్రకాశం", "ఒంగోలు", "Prakasam", "Ongole"))
            district.contains("నెల్లూరు") || district.contains("శ్రీ పొట్టి శ్రీరాములు") || district.contains("Nellore", ignoreCase = true) || district.contains("SPSR", ignoreCase = true) ->
                list.addAll(listOf("శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", "నెల్లూరు", "Nellore", "SPSR Nellore"))
            district.contains("సత్యసాయి") || district.contains("పుట్టపర్తి") || district.contains("Sri Sathya Sai", ignoreCase = true) ->
                list.addAll(listOf("శ్రీ సత్యసాయి", "సత్యసాయి", "Sri Sathya Sai", "Puttaparthi"))
            district.contains("శ్రీకాకుళం") || district.contains("Srikakulam", ignoreCase = true) ->
                list.addAll(listOf("శ్రీకాకుళం", "Srikakulam"))
            district.contains("తిరుపతి") || district.contains("Tirupati", ignoreCase = true) || district.contains("బాలాజీ") ->
                list.addAll(listOf("తిరుపతి", "శ్రీ బాలాజీ", "Tirupati"))
            district.contains("విశాఖపట్నం") || district.contains("విశాఖ") || district.contains("Visakhapatnam", ignoreCase = true) || district.contains("Vizag", ignoreCase = true) ->
                list.addAll(listOf("విశాఖపట్నం", "విశాఖ", "వైజాగ్", "Visakhapatnam", "Vizag"))
            district.contains("విజయనగరం") || district.contains("Vizianagaram", ignoreCase = true) ->
                list.addAll(listOf("విజయనగరం", "Vizianagaram"))
            district.contains("పశ్చిమ గోదావరి") || district.contains("పశ్చిమగోదావరి") || district.contains("West Godavari", ignoreCase = true) || district.contains("భీమవరం") ->
                list.addAll(listOf("పశ్చిమ గోదావరి", "పశ్చిమగోదావరి", "West Godavari", "Bhimavaram"))
            district.contains("కడప") || district.contains("వైఎస్ఆర్") || district.contains("Kadapa", ignoreCase = true) ->
                list.addAll(listOf("వైఎస్ఆర్ కడప", "కడప", "YSR Kadapa", "Kadapa"))
        }
        return list.distinct()
    }

    private fun isDistrictMatch(postDistrict: String?, targetDistrict: String?): Boolean {
        if (postDistrict.isNullOrBlank() || targetDistrict.isNullOrBlank()) return false
        if (postDistrict.equals(targetDistrict, ignoreCase = true)) return true
        val aliases = getDistrictAliases(targetDistrict)
        return aliases.any { it.equals(postDistrict, ignoreCase = true) || postDistrict.contains(it, ignoreCase = true) || it.contains(postDistrict, ignoreCase = true) }
    }

    private val FETCH_LIMIT = 20 

      fun loadNews(language: Language, currentUser: User?, initialPostId: String? = null) {
          currentLanguage = language
          if (isFetching && initialPostId == null) return
          
          currentFetchJob?.cancel()
          isFetching = false

          if (_news.value.isEmpty()) {
              _loading.value = true 
          }
          isFetching = true

           currentFetchJob = viewModelScope.launch {
              try {
                   val district = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
                   _userDistrict.value = district
                   val userState = mapDistrictToState(district)

                   if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) {
                       if (_news.value.isEmpty()) {
                           _isOnline.value = false
                           // 📴 OFFLINE ONLY: Use local cache only when user has no internet connection
                           try {
                               val cachedSnap = FirebaseService.db.collection("news")
                                   .whereEqualTo("approved", true)
                                   .orderBy("timestamp", Query.Direction.DESCENDING)
                                   .limit(FETCH_LIMIT.toLong())
                                   .get(com.google.firebase.firestore.Source.CACHE)
                                   .await()
                               val cachedPosts = cachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                                   .filter { isPostAllowedForState(it, userState) }
                               if (cachedPosts.isNotEmpty()) {
                                   _news.value = cachedPosts
                               }
                           } catch (e: Exception) { }
                           _loading.value = false
                           isFetching = false
                           return@launch
                       }
                   }
                   _isOnline.value = true

                   // Always reset cursors on loadNews to avoid appending initialPostId to a subsequent page
                   prefCursor = null
                   mainCursor = null
                   localCursor = null
                   _hasMore.value = true
                   consecutiveEmptyLoads = 0
                   
                   // district null అయినా load చేయి — targetDistrict=="ALL" ads అందరికీ చూపించాలి
                   loadLocalAds(district)

                    val isGuest = currentUser == null || currentUser.id.isBlank() || currentUser.id == "guest" || currentUser.role == com.alfanews.telugu.models.UserRole.GUEST
                    val isNewUser = district.isNullOrBlank()
                    val isGuestOrNew = isGuest || isNewUser

                    // 🚀 FAST PATH: Quick top 10 news via direct primary index query
                    val isColdStart = _news.value.isEmpty()
                    val fastBatchJob = async {
                        if (isColdStart) {
                            try {
                                val snap = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                                    FirebaseService.db.collection("news")
                                        .whereEqualTo("approved", true)
                                        .orderBy("timestamp", Query.Direction.DESCENDING)
                                        .limit(10)
                                        .get()
                                        .await()
                                }
                                val posts = snap?.documents?.mapNotNull { mapDocumentToNewsPost(it) }
                                    ?.filter { isPostAllowedForState(it, userState) } ?: emptyList()
                                Pair(posts, snap?.documents?.lastOrNull())
                            } catch (e: Exception) { Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null) }
                        } else {
                            Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                        }
                    }
                    
                    val greetingBatchDeferred = async {
                        if (initialPostId == null) {
                            try { 
                                val post = fetchGreetingPost()
                                if (post != null && prefs.getPostViewCount(post.id) < 2) post else null
                            } catch (e: Exception) { null }
                        } else null
                    }

                    // 🚀 TARGET POST FAST PATH: When opening via deep link or notification, fetch target post IMMEDIATELY
                    val initialPostDeferred = async {
                        if (initialPostId != null) {
                            try {
                                val doc = FirebaseService.db.collection("news").document(initialPostId).get().await()
                                if (doc.exists()) mapDocumentToNewsPost(doc) else null
                            } catch (e: Exception) { null }
                        } else null
                    }

                    val initialTargetPost = initialPostDeferred.await()
                    val fastBatch = fastBatchJob.await()
                    
                    if (initialTargetPost != null || fastBatch.first.isNotEmpty()) {
                        val initialList = mutableListOf<NewsPost>()
                        initialTargetPost?.let { initialList.add(it) }
                        initialList.addAll(fastBatch.first)
                        
                        // 🔄 FAST LOAD: Display fresh news immediately without waiting for anything else
                        if (_news.value.isEmpty()) {
                            _news.value = initialList.distinctBy { it.id }
                            _loading.value = false 
                        } else if (initialTargetPost != null) {
                            _news.value = (listOf(initialTargetPost) + _news.value).distinctBy { it.id }
                            _loading.value = false
                        } else if (fastBatch.first.isNotEmpty()) {
                            _news.value = (initialList + _news.value).distinctBy { it.id }
                            _loading.value = false
                        }
                    }

                    // Greeting post is merged at top if available
                    val initialGreeting = greetingBatchDeferred.await()
                    if (initialGreeting != null) {
                        if (_news.value.isNotEmpty() && _news.value.none { it.id == initialGreeting.id }) {
                            _news.value = (listOf(initialGreeting) + _news.value).distinctBy { it.id }
                        }
                    }

                    // 🧠 BACKGROUND PROCESSING: Heavy 40/30/30 Mixing for ALL users (including guest and new users)
                    val preferredCats = try { AnalyticsService.getUserPreferredCategories().take(10) } catch (e: Exception) { emptyList<String>() }

                    val prefBatchDeferred = async {
                        if (preferredCats.isNotEmpty()) {
                            try {
                                fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), null, null, excludeDistricts = false, userState = userState)
                            } catch (e: Exception) { Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null) }
                        } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                    }

                    val localBatchDeferred = async {
                        if (!district.isNullOrBlank()) {
                            try {
                                fetchFilteredBatch(FirebaseService.db.collection("news"), null, district, excludeDistricts = false, userState = userState)
                            } catch (e: Exception) { Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null) }
                        } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                    }

                    val mainBatchDeferred = async {
                        try {
                            fetchFilteredBatch(
                                FirebaseService.db.collection("news"),
                                null,
                                district,
                                // ✅ FIX: district null (guest/new user) అయినా excludeDistricts = true
                                // Home feed లో district-specific news రాకుండా block చేస్తుంది
                                // Local news → localBatch లో మాత్రమే వస్తుంది (district set అయినప్పుడు)
                                excludeDistricts = true,
                                userState = userState
                            )
                        } catch (e: Exception) { Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null) }
                    }

                    val prefBatch = prefBatchDeferred.await()
                    val localBatch = localBatchDeferred.await()
                    val mainBatch = mainBatchDeferred.await()

                    var finalPosts = withContext(Dispatchers.Default) {
                        rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first, isFirstPage = true)
                    }

                    prefCursor = prefBatch.second
                    mainCursor = mainBatch.second
                    localCursor = localBatch.second

                    if (finalPosts.isEmpty() && (mainCursor != null || prefCursor != null || localCursor != null)) {
                        val extraPrefDeferred = async {
                            if (prefCursor != null && preferredCats.isNotEmpty()) {
                                fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, null, excludeDistricts = false, userState = userState)
                            } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                        }
                        val extraLocalDeferred = async {
                            if (localCursor != null && !district.isNullOrBlank()) {
                                fetchFilteredBatch(FirebaseService.db.collection("news"), localCursor, district, excludeDistricts = false, userState = userState)
                            } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                        }
                        val extraMainDeferred = async {
                            if (mainCursor != null) {
                                fetchFilteredBatch(FirebaseService.db.collection("news"), mainCursor, district, excludeDistricts = !district.isNullOrBlank(), userState = userState)
                            } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                        }
                        val extraPref = extraPrefDeferred.await()
                        val extraLocal = extraLocalDeferred.await()
                        val extraMain = extraMainDeferred.await()
                        
                        prefCursor = extraPref.second
                        localCursor = extraLocal.second
                        mainCursor = extraMain.second
                        
                        val extraPosts = withContext(Dispatchers.Default) {
                            rankAndBlendPosts(extraPref.first, extraMain.first, extraLocal.first, isFirstPage = false)
                        }
                        finalPosts = (finalPosts + extraPosts).distinctBy { it.id }
                    }

                    // 🚨 ZERO EMPTY FEED GUARANTEE: If finalPosts is still empty, fallback directly to latest approved news!
                    if (finalPosts.isEmpty()) {
                        try {
                            val emergencySnapshot = kotlinx.coroutines.withTimeoutOrNull(3000L) {
                                FirebaseService.db.collection("news")
                                    .whereEqualTo("approved", true)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(FETCH_LIMIT.toLong())
                                    .get().await()
                            }
                            val emergencyList = emergencySnapshot?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                            if (emergencyList.isNotEmpty()) {
                                finalPosts = emergencyList
                                mainCursor = emergencySnapshot?.documents?.lastOrNull()
                                _hasMore.value = (emergencySnapshot?.documents?.size ?: 0) == FETCH_LIMIT
                            }
                        } catch (e: Exception) {
                            Log.e("NewsFeedVM", "Emergency fetch failed: ${e.message}")
                        }
                    }

                   if (finalPosts.isEmpty() && mainCursor == null && prefCursor == null && localCursor == null) {
                       _hasMore.value = false
                   }

                  initialGreeting?.let {
                      finalPosts = (listOf(it) + finalPosts).distinctBy { it.id }
                  }

                   if (initialPostId != null) {
                        val targetPost = initialTargetPost ?: try {
                            val doc = FirebaseService.db.collection("news").document(initialPostId).get().await()
                            if (doc.exists()) mapDocumentToNewsPost(doc) else null
                        } catch (e: Exception) { null }

                        targetPost?.let { post ->
                            finalPosts = (listOf(post) + finalPosts).distinctBy { it.id }
                        }
                    }

                    val currentDisplayed = _news.value
                    if (currentDisplayed.isNotEmpty()) {
                        val currentIds = currentDisplayed.map { it.id }.toSet()
                        val newBlended = finalPosts.filter { it.id !in currentIds }
                        _news.value = (currentDisplayed + newBlended).distinctBy { it.id }
                    } else {
                        _news.value = finalPosts.distinctBy { it.id }
                    }
                    
                    // ✅ FIX (Bug 6): Initial load లో కూడా post view count increment చేయాలి (బ్యాచ్ రూపంలో ఒకేసారి)
                    if (finalPosts.isNotEmpty()) {
                        val validIds = finalPosts.filter { it.type == "news" || it.type == "greeting" }.map { it.id }
                        prefs.incrementPostViewCounts(validIds)
                    }

                    // DO NOT forcefully scroll to top on background mixing completion
                    lastRefreshTimeLong = System.currentTimeMillis()

               } catch (e: Exception) {
                   if (_news.value.isEmpty()) _hasMore.value = false
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
         if (!_hasMore.value) return
         if (isFetching) {
             pendingLoadMore = true
             return
         }
         viewModelScope.launch {
             isFetching = true
             try {
                 val district = _userDistrict.value
                 val userState = mapDistrictToState(district)
                 val preferredCats = try { AnalyticsService.getUserPreferredCategories().take(10) } catch (e: Exception) { emptyList<String>() }

                 var attempts = 0
                 var appendedCount = 0

                 while (attempts < 3 && appendedCount == 0 && _hasMore.value) {
                     attempts++
                     val shouldFetchPref = preferredCats.isNotEmpty() && (prefCursor != null)
                     val shouldFetchLocal = localCursor != null && !district.isNullOrBlank()
                     val shouldFetchMain = mainCursor != null || (prefCursor == null && localCursor == null)
                      
                     val prefBatchDeferred = async {
                          if (shouldFetchPref) {
                              fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, null, excludeDistricts = false, userState = userState)
                          } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                      }
                      val localBatchDeferred = async {
                          if (shouldFetchLocal) {
                              fetchFilteredBatch(FirebaseService.db.collection("news"), localCursor, district, excludeDistricts = false, userState = userState)
                          } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                      }
                      val mainBatchDeferred = async {
                          if (shouldFetchMain) {
                              fetchFilteredBatch(FirebaseService.db.collection("news"), mainCursor, district, excludeDistricts = true, userState = userState)
                          } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                     }

                     val prefBatch = prefBatchDeferred.await()
                     val localBatch = localBatchDeferred.await()
                     val mainBatch = mainBatchDeferred.await()

                     var newPosts = withContext(Dispatchers.Default) {
                         rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first, isFirstPage = false)
                     }

                     if (newPosts.isEmpty() && (prefBatch.first.isNotEmpty() || mainBatch.first.isNotEmpty() || localBatch.first.isNotEmpty())) {
                         val allRaw = (prefBatch.first + mainBatch.first + localBatch.first).distinctBy { it.id }
                         newPosts = allRaw.filter { isPostAllowedForState(it, userState) }
                     }

                     if (prefBatch.second != null) prefCursor = prefBatch.second
                     if (localBatch.second != null) localCursor = localBatch.second
                     if (mainBatch.second != null) mainCursor = mainBatch.second

                     if (newPosts.isNotEmpty()) {
                         val currentIds = _news.value.map { it.id }.toSet()
                         val uniqueNewPosts = newPosts.filter { !currentIds.contains(it.id) }
                         if (uniqueNewPosts.isNotEmpty()) {
                             _news.value = _news.value + uniqueNewPosts
                             appendedCount = uniqueNewPosts.size
                             val validIds = uniqueNewPosts.filter { it.type == "news" || it.type == "greeting" }.map { it.id }
                             if (validIds.isNotEmpty()) {
                                 prefs.incrementPostViewCounts(validIds)
                             }
                             consecutiveEmptyLoads = 0
                         } else {
                             consecutiveEmptyLoads += 1
                             if (mainCursor == null && prefCursor == null && localCursor == null) {
                                 // Cursors reached the end: reset mainCursor to allow circular / continuous feed
                                 mainCursor = null
                                 _hasMore.value = true
                                 break
                             }
                         }
                     } else {
                         if (mainCursor == null && prefCursor == null && localCursor == null) {
                             mainCursor = null
                             _hasMore.value = true
                             break
                         }
                     }
                 }
             } catch (e: Exception) {
                 android.util.Log.e("NewsFeedVM", "LoadMore failed: ${e.message}")
             } finally {
                 isFetching = false
                 if (pendingLoadMore && _hasMore.value) {
                     pendingLoadMore = false
                     loadMore(currentLanguage, currentUser)
                 }
             }
         }
     }

     private suspend fun fetchFilteredBatch(baseQuery: Query, cursor: DocumentSnapshot?, district: String?, excludeDistricts: Boolean, limit: Int = FETCH_LIMIT, userState: String? = null): Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?> {
            var currentCursor = cursor
            var query = baseQuery.whereEqualTo("approved", true)
            if (excludeDistricts) {
                // ✅ FIX: district null (guest/unknown) అయినా whereIn filter apply చేయాలి
                // getGeneralDistrictsForState(null) → universal + both-state general districts return చేస్తుంది
                // ఇది district-specific news (జిల్లా వార్తలు) home feed లో రాకుండా block చేస్తుంది
                val generalCats = getGeneralDistrictsForState(userState).take(30)
                query = query.whereIn("district", generalCats)
            } else if (!district.isNullOrBlank()) {
                // 🚀 FIX: Use whereEqualTo("district", ...) instead of whereArrayContains("categories", ...)
                // to avoid Firestore conflict when baseQuery already has an array filter (like whereArrayContainsAny).
                query = query.whereEqualTo("district", district)
            }
            query = query.orderBy("timestamp", Query.Direction.DESCENDING).limit(limit.toLong())
            if (currentCursor != null) query = query.startAfter(currentCursor)
            
            try {
                val snapshot = kotlinx.coroutines.withTimeoutOrNull(8000L) {
                    query.get().await()
                }
                if (snapshot == null || snapshot.isEmpty) {
                    // ✅ Fallback query కూడా userState filter apply చేయడం
                    var fallbackQuery = FirebaseService.db.collection("news")
                        .whereEqualTo("approved", true)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(limit.toLong())
                    
                    if (currentCursor != null) fallbackQuery = fallbackQuery.startAfter(currentCursor)
                    
                    val fallbackSnapshot = kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        fallbackQuery.get().await()
                    }
                    if (fallbackSnapshot == null || fallbackSnapshot.isEmpty) {
                        return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), currentCursor)
                    }
                    
                    // userState filter apply చేసి fallback batch filter చేయడం
                    val batch = fallbackSnapshot.documents.mapNotNull { doc -> mapDocumentToNewsPost(doc) }
                        .filter { post -> isPostAllowedForState(post, userState) }
                    currentCursor = fallbackSnapshot.documents.lastOrNull() ?: currentCursor
                    return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
                }
                val batch = snapshot.documents.mapNotNull { doc ->
                    mapDocumentToNewsPost(doc)
                }.filter { post -> isPostAllowedForState(post, userState) }
                currentCursor = snapshot.documents.lastOrNull() ?: currentCursor

                // 🚀 CRUCIAL FIX: If snapshot had documents but ALL were filtered out by state filter,
                // don't leave the batch empty! Fetch from general fallback query.
                if (batch.isEmpty()) {
                    var fallbackQuery = FirebaseService.db.collection("news")
                        .whereEqualTo("approved", true)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(limit.toLong())
                    if (currentCursor != null) fallbackQuery = fallbackQuery.startAfter(currentCursor)
                    val fallbackSnapshot = kotlinx.coroutines.withTimeoutOrNull(6000L) {
                        fallbackQuery.get().await()
                    }
                    if (fallbackSnapshot != null && !fallbackSnapshot.isEmpty) {
                        val fallbackBatch = fallbackSnapshot.documents.mapNotNull { doc -> mapDocumentToNewsPost(doc) }
                            .filter { post -> isPostAllowedForState(post, userState) }
                        return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(fallbackBatch, fallbackSnapshot.documents.lastOrNull() ?: currentCursor)
                    }
                }

                return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
            } catch (e: Exception) {
                if (excludeDistricts) {
                    try {
                        var fallbackQuery = baseQuery.whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING).limit(limit.toLong())
                        if (currentCursor != null) fallbackQuery = fallbackQuery.startAfter(currentCursor)
                        val fallbackSnapshot = kotlinx.coroutines.withTimeoutOrNull(6000L) {
                            fallbackQuery.get().await()
                        }
                        if (fallbackSnapshot != null && !fallbackSnapshot.isEmpty) {
                            val batch = fallbackSnapshot.documents.mapNotNull { doc ->
                                mapDocumentToNewsPost(doc)
                            }.filter { post -> isPostAllowedForState(post, userState) }
                            currentCursor = fallbackSnapshot.documents.lastOrNull() ?: currentCursor
                            return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
                        }
                    } catch (ex: Exception) {
                        // ignore and return current cursor
                    }
                }
                return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), currentCursor)
            }
        }

    /**
     * 🛑 STRICT STATE ISOLATION (తెలంగాణ & ఆంధ్రప్రదేశ్ వార్తల విభజన):
     * ఒక post వినియోగదారు రాష్ట్రం కి అనుమతించవచ్చా లేదా చెక్ చేస్తుంది.
     * @param post The news post to check
     * @param userState వినియోగదారు రాష్ట్రం: "Telangana", "Andhra Pradesh", లేదా null (గుర్తించబడని సందర్భంలో)
     */
    private fun isPostAllowedForState(post: NewsPost, userState: String?): Boolean {
        // రాష్ట్రం ఇంకా గుర్తించబడని కొత్త వినియోగదారులకు అన్నీ చూపించు
        if (userState.isNullOrBlank() || userState == "BOTH") return true

        // 🌟 GLOBAL POST EXEMPTION: జాతీయ, అంతర్జాతీయ, సినిమా, క్రీడలు, బిజినెస్, టెక్నాలజీ లాంటి
        // గ్లోబల్ వార్తలను రెండు రాష్ట్రాల ప్రజలకూ అనుమతించాలి!
        if (isGlobalPost(post)) {
            val postDistrictState = mapDistrictToState(post.district)
            if (postDistrictState != null && postDistrictState != userState) {
                return false
            }
            return true
        }

        // 1. పోస్ట్ నేరుగా వేరొక రాష్ట్రానికి చెందినదిగా గుర్తిస్తే తిరస్కరించు
        val postState = inferStateFromPost(post)
        if (postState != null && postState != userState) {
            return false
        }

        // 2. పోస్ట్ యొక్క జిల్లా వేరొక రాష్ట్రానికి చెందినది అయితే తిరస్కరించు
        val postDistrictState = mapDistrictToState(post.district)
        if (postDistrictState != null && postDistrictState != userState) {
            return false
        }

        return true
    }


       private suspend fun rankAndBlendPosts(pref: List<NewsPost>, main: List<NewsPost>, local: List<NewsPost>, isFirstPage: Boolean = false): List<NewsPost> = withContext(Dispatchers.Default) {
            val allRaw = (pref + main + local).distinctBy { it.id }
            var filteredPref = pref.filter { prefs.getPostViewCount(it.id) < 2 }
            var filteredMain = main.filter { prefs.getPostViewCount(it.id) < 2 }
            var filteredLocal = local.filter { prefs.getPostViewCount(it.id) < 2 }

            // 🚀 ROBUSTNESS: Unread వార్తలను ముందుంచి, చదివిన వాటిని వెనక్కి నెడతాం (పూర్తిగా డిలీట్ చేయము).
            // అన్‌రీడ్ పోస్టులు తక్కువగా ఉంటే (< 8), రా-పోస్టులతో ఫీడ్‌ను నింపి ఎక్స్‌ట్రా నెట్‌వర్క్ రౌండ్‌ట్రిప్స్ మరియు ఖాళీ స్క్రీన్ ఆలస్యాన్ని నివారిస్తాము.
            if ((filteredPref.size + filteredMain.size + filteredLocal.size) < 8 && allRaw.isNotEmpty()) {
                filteredPref = if (filteredPref.size >= 3) filteredPref else pref
                filteredMain = if (filteredMain.size >= 4) filteredMain else main
                filteredLocal = if (filteredLocal.size >= 2) filteredLocal else local
            }

            val currentDist = _userDistrict.value
            val userState: String? = mapDistrictToState(currentDist)

            val allPosts = (filteredPref + filteredMain + filteredLocal).distinctBy { it.id }.filter { post ->
                if (post.type == "survey") {
                    if (userState != null && post.state != null && post.state != userState) return@filter false
                    if (post.isReporter) {
                        val matchesUserDistrict = currentDist != null && 
                            (post.district == currentDist || post.categories.contains(currentDist) || isDistrictMatch(post.district, currentDist))
                        if (!matchesUserDistrict) return@filter false
                    }
                }
                if (post.type != "news") {
                    if (post.type == "cartoon" && !isPostAllowedForState(post, userState)) return@filter false
                    return@filter true
                }
                
                // 🛑 1. STRICT STATE ISOLATION (రెండు రాష్ట్రాల వార్తలు & ప్రాంతీయ రాజకీయాల విభజన):
                // Telangana users -> No AP regional politics or AP news
                // AP users -> No Telangana regional politics or TS news
                if (!isPostAllowedForState(post, userState)) {
                    return@filter false
                }
                
                // 2. 🛡️ REPORTER DISTRICT NEWS FILTER
                // Only show 'District News' from reporters if it's the user's own district.
                val isDistrictNewsCategory = post.categories.contains("జిల్లా వార్త")
                if (isDistrictNewsCategory && post.isReporter) {
                    if (currentDist != null) {
                        val matchesUserDistrict = (post.district == currentDist || post.categories.contains(currentDist) || isDistrictMatch(post.district, currentDist))
                        if (!matchesUserDistrict) return@filter false
                    }
                }
                
                true
            }

           if (allPosts.isEmpty() && !isFirstPage) return@withContext emptyList<NewsPost>()

           val festivalGreetings = allPosts.filter {
               it.type == "greeting" && (it.category == "పండుగలు" || it.headline.telugu.contains("శుభాకాంక్షలు") || it.likes == 0)
           }
           val quoteGreetings = allPosts.filter {
               it.type == "greeting" && (it.category == "ప్రేరణ" || it.headline.telugu.contains("మంచి మాట") || it.headline.english.equals("Quote of the Day", ignoreCase = true) || it.likes == 1) && it !in festivalGreetings
           }
           val historyPosts = allPosts.filter { it.type == "history" }
           val cartoonPosts = allPosts.filter { it.type == "cartoon" }
           var normalNews = allPosts.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" }

           // 🚀 FIRST PAGE SAFETY: If normalNews is empty on first page, fallback to allRaw normal news so feed is never blank
           if (isFirstPage && normalNews.isEmpty() && allRaw.isNotEmpty()) {
               normalNews = allRaw.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" && isPostAllowedForState(it, userState) }
           }

            if (normalNews.isEmpty() && !isFirstPage) {
                normalNews = allRaw.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" && isPostAllowedForState(it, userState) }
                if (normalNews.isEmpty()) {
                    return@withContext emptyList<NewsPost>() 
                }
            }

           val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (e: Exception) { emptySet() }

           // 🚀 1. POOL SEPARATION
           val localIds = local.map { it.id }.toSet()
           val localCandidates = normalNews.filter { it.id in localIds || it.categories.contains("జిల్లా వార్త") }
               .sortedByDescending { it.timestamp }
               .toMutableList()
           val localCandidateIds = localCandidates.map { it.id }.toSet()

           val generalCandidates = normalNews.filter { it.id !in localCandidateIds }

           // 1. Personalized pool: Scored posts with positive relevance score, kept strictly in relevance order
           val scoredPosts = generalCandidates.map { post ->
               post to (try { AnalyticsService.calculateRelevanceScore(post) } catch (e: Exception) { 0.0 })
           }.filter { it.second > 0.0 }
            .sortedByDescending { it.second }
            .map { it.first }
            .toMutableList()

           // 2. Fresh pool: Newest general news by timestamp DESC (preferred categories given gentle boost in fresh slot)
           val preferredGeneral = generalCandidates.filter { post -> post.categories.any { it in preferredCategories } }
               .sortedByDescending { it.timestamp }
           val otherGeneral = generalCandidates.filter { it !in preferredGeneral }
               .sortedByDescending { it.timestamp }
           val freshCandidates = (preferredGeneral + otherGeneral).toMutableList()

           // 3. Discovery pool: Posts exploring categories not yet in user's top preferences
           val discoveryCandidates = generalCandidates.filter { post ->
               post.categories.none { it in preferredCategories }
           }.sortedByDescending { it.timestamp }.toMutableList()

           // 🚀 2. TRUE INTERLEAVED 40/30/30 BLENDING
           val blendedNews = mutableListOf<NewsPost>()
           val addedIds = mutableSetOf<String>()

           fun pollNext(list: MutableList<NewsPost>): NewsPost? {
               while (list.isNotEmpty()) {
                   val item = list.removeAt(0)
                   if (item.id !in addedIds) {
                       addedIds.add(item.id)
                       return item
                   }
               }
               return null
           }

           // 🔄 Interleaved Cadence:
           // Slot 0: Fresh #1 (Top Breaking)
           // Slot 1: Personalized #1 (Top User Interest)
           // Slot 2: Local #1 (District News)
           // Slot 3: Fresh #2
           // Slot 4: Personalized #2
           // Slot 5: Discovery #1
           val maxIterations = normalNews.size + 15
           var loopCount = 0
           while (addedIds.size < normalNews.size && loopCount < maxIterations) {
               val cycle = loopCount % 6
               val nextPost = when (cycle) {
                   0 -> pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(localCandidates) ?: pollNext(discoveryCandidates)
                   1 -> pollNext(scoredPosts) ?: pollNext(freshCandidates) ?: pollNext(localCandidates) ?: pollNext(discoveryCandidates)
                   2 -> pollNext(localCandidates) ?: pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(discoveryCandidates)
                   3 -> pollNext(freshCandidates) ?: pollNext(scoredPosts) ?: pollNext(discoveryCandidates) ?: pollNext(localCandidates)
                   4 -> pollNext(scoredPosts) ?: pollNext(freshCandidates) ?: pollNext(discoveryCandidates) ?: pollNext(localCandidates)
                   5 -> pollNext(discoveryCandidates) ?: pollNext(freshCandidates) ?: pollNext(localCandidates) ?: pollNext(scoredPosts)
                   else -> pollNext(freshCandidates)
               }
               if (nextPost != null) {
                   blendedNews.add(nextPost)
               } else {
                   val remaining = normalNews.firstOrNull { it.id !in addedIds }
                   if (remaining != null) {
                       addedIds.add(remaining.id)
                       blendedNews.add(remaining)
                   } else {
                       break
                   }
               }
               loopCount++
           }

           if (blendedNews.isEmpty() && normalNews.isNotEmpty()) {
               blendedNews.addAll(normalNews)
           }

           if (isFirstPage) {
               val activeSurvey = fetchActiveSurvey()
               
               // Inject active survey at 3rd card (index 2)
               activeSurvey?.let { insertSafely(blendedNews, it, 2) }

               if (quoteGreetings.isNotEmpty()) { insertSafely(blendedNews, quoteGreetings.first(), 7) }
               
               // ✅ WEATHER CARD FIX:
               // Moved to index 9 (was 8) due to survey at index 2
               val currentHour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
                val isMorning = currentHour in 5..10

                if (blendedNews.size >= 4) {
                    val isManualDistrict = prefs.selectedDistrict != null && prefs.selectedDistrict != prefs.detectedDistrict
                    val lat = if (isManualDistrict) null else prefs.lastLat.takeIf { it != 0.0 }
                    val lon = if (isManualDistrict) null else prefs.lastLon.takeIf { it != 0.0 }
                    val place = if (isManualDistrict) null else prefs.localPlace
                    val weatherTargetIndex = if (isMorning) 4 else 9
                    insertSafely(blendedNews, generateWeatherPost(place, _userDistrict.value, lat, lon), weatherTargetIndex)
                }

               if (historyPosts.isNotEmpty()) { insertSafely(blendedNews, historyPosts.first(), 10) }
                if (cartoonPosts.isNotEmpty()) {
                    val userDist = _userDistrict.value
                    val userState = mapDistrictToState(userDist)
                    val relevantCartoon = cartoonPosts.find { isPostAllowedForState(it, userState) }
                    relevantCartoon?.let { insertSafely(blendedNews, it, 13) }
                }
               if (festivalGreetings.isNotEmpty()) { blendedNews.add(0, festivalGreetings.first()) }
           }
          blendedNews
      }

    private fun insertSafely(list: MutableList<NewsPost>, post: NewsPost, targetIdx: Int) {
        val actualIdx = if (targetIdx >= list.size) list.size else targetIdx
        list.add(actualIdx, post)
    }

    private suspend fun fetchGreetingPost(): NewsPost? = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (cachedGreetingPost != null && (now - cachedGreetingFetchTime) < GREETING_CACHE_TTL) {
            return@withContext cachedGreetingPost
        }
        try {
            val snapshot = kotlinx.coroutines.withTimeoutOrNull(2000L) {
                FirebaseService.db.collection("news").whereEqualTo("type", "greeting").whereEqualTo("approved", true).orderBy("timestamp", Query.Direction.DESCENDING).limit(1).get().await()
            }
            val doc = snapshot?.documents?.firstOrNull() ?: return@withContext null
            val post = mapDocumentToNewsPost(doc)
            if (post != null) {
                cachedGreetingPost = post
                cachedGreetingFetchTime = now
            }
            post
        } catch (e: Exception) { null }
    }

    private suspend fun fetchActiveSurvey(): NewsPost? = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val currentDist = _userDistrict.value
        if (cachedActiveSurvey != null && cachedSurveyDistrict == currentDist && (now - cachedSurveyFetchTime) < SURVEY_CACHE_TTL) {
            if (!cachedActiveSurvey!!.isExpired) {
                return@withContext cachedActiveSurvey
            }
        }
        try {
            // NOTE: whereGreaterThan("timestamp") range filter తో composite index అవసరం
            // కానీ firestore.indexes.json లో లేదు కాబట్టి query fail అవుతుంది.
            // isExpired client-side check ఇప్పటికే expiry handle చేస్తుంది — server-side range filter అవసరం లేదు.
            val snapshot = kotlinx.coroutines.withTimeoutOrNull(2000L) {
                FirebaseService.db.collection("news")
                    .whereEqualTo("type", "survey")
                    .whereEqualTo("approved", true)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(3) // 🚀 Optimized from limit(20) to limit(3) to save 17 reads per load
                    .get().await()
            }
            
            val surveys = snapshot?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
            
            val userState: String? = mapDistrictToState(currentDist)

            val matchingSurvey = surveys.firstOrNull { survey ->
                if (survey.isExpired) return@firstOrNull false

                // 1. Filter by State
                if (userState != null) {
                    val surveyState = mapDistrictToState(survey.state ?: survey.district)
                    if (surveyState != null && surveyState != userState) {
                        return@firstOrNull false
                    }
                }

                // 2. Filter by District (if not global/state-wide)
                if (!survey.isGlobal) {
                    if (currentDist != null) {
                        val matchesUserDistrict = (survey.district.equals(currentDist, ignoreCase = true) ||
                            survey.categories.any { it.equals(currentDist, ignoreCase = true) })
                        if (!matchesUserDistrict) return@firstOrNull false
                    }
                }

                true
            }

            if (matchingSurvey != null) {
                cachedActiveSurvey = matchingSurvey
                cachedSurveyFetchTime = now
                cachedSurveyDistrict = currentDist
            }
            matchingSurvey
        } catch (e: java.lang.Exception) {
            Log.e("NewsFeedVM", "Error fetching active survey: ${e.message}")
            null
        }
    }

    private fun mapDocumentToNewsPost(doc: DocumentSnapshot): NewsPost? {
        return try {
            val data = doc.data ?: return null
            val rawHeadline = data["headline"]
            val rawContent = data["content"]
            
            val headlineTe = when (rawHeadline) {
                is Map<*, *> -> rawHeadline["telugu"]?.toString() ?: ""
                is String -> rawHeadline
                else -> ""
            }
            val headlineEn = when (rawHeadline) {
                is Map<*, *> -> rawHeadline["english"]?.toString() ?: ""
                else -> ""
            }
            
            val contentTe = when (rawContent) {
                is Map<*, *> -> rawContent["telugu"]?.toString() ?: ""
                is String -> rawContent
                else -> ""
            }
            val contentEn = when (rawContent) {
                is Map<*, *> -> rawContent["english"]?.toString() ?: ""
                else -> ""
            }

            val likesCount = (data["likes"] as? Number)?.toInt() ?: 0
            val commentsCount = (data["comments"] as? Number)?.toInt() ?: 0
            val sharesCount = (data["shares"] as? Number)?.toInt() ?: 0
            val postTimestamp = when (val ts = data["timestamp"]) {
                is com.google.firebase.Timestamp -> ts.toDate().time
                is Number -> ts.toLong()
                is java.util.Date -> ts.time
                else -> {
                    when (val fallback = data["createdAt"] ?: data["publishedAt"]) {
                        is com.google.firebase.Timestamp -> fallback.toDate().time
                        is Number -> fallback.toLong()
                        is java.util.Date -> fallback.time
                        else -> System.currentTimeMillis()
                    }
                }
            }
            val categoryValue = data["category"]?.toString() ?: "General News"
            val categoriesList = (data["categories"] as? List<*>)?.mapNotNull { it?.toString() } ?: listOf(categoryValue)

            val rawQuestions = data["surveyQuestions"] as? List<*>
            val surveyQuestionsList = rawQuestions?.mapNotNull { qObj ->
                val qMap = qObj as? Map<*, *> ?: return@mapNotNull null
                val qId = qMap["id"]?.toString() ?: ""
                
                val qText = when (val qTextVal = qMap["questionText"]) {
                    is Map<*, *> -> {
                        if (currentLanguage == Language.ENGLISH) {
                            qTextVal["english"]?.toString() ?: qTextVal["telugu"]?.toString() ?: ""
                        } else {
                            qTextVal["telugu"]?.toString() ?: qTextVal["english"]?.toString() ?: ""
                        }
                    }
                    else -> qTextVal?.toString() ?: ""
                }
                
                val rawOpts = qMap["options"] as? List<*>
                val optionsList = rawOpts?.mapNotNull { oObj ->
                    val oMap = oObj as? Map<*, *> ?: return@mapNotNull null
                    val oId = oMap["id"]?.toString() ?: ""
                    
                    val oText = when (val oTextVal = oMap["text"]) {
                        is Map<*, *> -> {
                            if (currentLanguage == Language.ENGLISH) {
                                oTextVal["english"]?.toString() ?: oTextVal["telugu"]?.toString() ?: ""
                            } else {
                                oTextVal["telugu"]?.toString() ?: oTextVal["english"]?.toString() ?: ""
                            }
                        }
                        else -> oTextVal?.toString() ?: ""
                    }
                    
                    val oNext = oMap["nextQuestionId"]?.toString()
                    SurveyOption(id = oId, text = oText, nextQuestionId = oNext)
                } ?: emptyList()
                SurveyQuestion(id = qId, questionText = qText, options = optionsList)
            } ?: emptyList()

            val isMultiPageVal = data["isMultiPage"] as? Boolean ?: false
            val fakeVotesBaseVal = (data["fakeVotesBase"] as? Number)?.toInt() ?: 11000
            val surveyCreatedAtVal = when (val sca = data["surveyCreatedAt"]) {
                is com.google.firebase.Timestamp -> sca.toDate().time
                is Number -> sca.toLong()
                else -> postTimestamp
            }
            val votesMap = java.util.HashMap<String, Int>()
            val vRaw = data["votes"] as? Map<*, *>
            if (vRaw != null) {
                for (vEntry in vRaw.entries) {
                    val vk = vEntry.key?.toString() ?: ""
                    val vv = (vEntry.value as? Number)?.toInt() ?: 0
                    votesMap.put(vk, vv)
                }
            }
            val realVotesCountVal = (data["realVotesCount"] as? Number)?.toInt() ?: 0
            val expiryTimestampVal = when (val exp = data["expiryTimestamp"]) {
                is com.google.firebase.Timestamp -> exp.toDate().time
                is Number -> exp.toLong()
                else -> null
            }
            val stateVal = data["state"]?.toString()

            NewsPost(
                id = doc.id,
                headline = com.alfanews.telugu.models.Headline(
                    telugu = headlineTe,
                    english = headlineEn
                ),
                content = com.alfanews.telugu.models.Content(
                    telugu = contentTe,
                    english = contentEn
                ),
                mediaUrl = data["mediaUrl"]?.toString() ?: "",
                mediaType = if (data["mediaType"]?.toString() == "VIDEO") com.alfanews.telugu.models.MediaType.VIDEO else com.alfanews.telugu.models.MediaType.IMAGE,
                youtubeUrl = data["youtubeUrl"]?.toString(),
                postFormat = if (data["postFormat"]?.toString() == "16:9") com.alfanews.telugu.models.PostFormat.HORIZONTAL else com.alfanews.telugu.models.PostFormat.VERTICAL,
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
                district = data["district"]?.toString() ?: "State",
                verificationStatus = data["verificationStatus"]?.toString() ?: "UNVERIFIED",
                category = categoryValue,
                tags = (data["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                entities = (data["entities"] as? Map<*, *>)?.let { entitiesMap ->
                    com.alfanews.telugu.models.Entities(
                        people = (entitiesMap["people"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        organizations = (entitiesMap["organizations"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        locations = (entitiesMap["locations"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
                    )
                } ?: com.alfanews.telugu.models.Entities(),
                type = data["type"]?.toString() ?: "news",
                approved = data["approved"] as? Boolean ?: false,
                aiProcessed = data["aiProcessed"] as? Boolean ?: false,
                isGlobal = data["isGlobal"] as? Boolean ?: false,
                isReporter = data["isReporter"] as? Boolean ?: (data["processingType"]?.toString() == "REPORTER_SUBMISSION"),
                surveyQuestions = surveyQuestionsList,
                isMultiPage = isMultiPageVal,
                fakeVotesBase = fakeVotesBaseVal,
                surveyCreatedAt = surveyCreatedAtVal,
                votes = votesMap,
                realVotesCount = realVotesCountVal,
                expiryTimestamp = expiryTimestampVal,
                state = stateVal
            )
        } catch (e: Exception) { null }
    }

    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?, language: Language = Language.TELUGU) {
        // 🛡️ 48-Hour GPS Throttling: గత 48 గంటల్లో లొకేషన్ రికార్డ్ అయి ఉంటే మళ్లీ GPS ఆన్ చేయకుండా క్యాష్ చేసిన లొకేషన్ వాడతాము
        if (!prefs.isLocationDetectionStale() && prefs.getEffectiveDistrict() != null && prefs.lastLat != 0.0 && prefs.lastLon != 0.0) {
            return
        }

        viewModelScope.launch {
            try {
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
                // ⚡ 1. Fast check: Use last known location first (< 10ms)
                val lastLoc = fusedLocationClient.lastLocation.await()
                if (lastLoc != null) {
                    val updated = processLocationUpdate(context, lastLoc.latitude, lastLoc.longitude, language, currentUser)
                    if (updated) return@launch
                }

                // ⚡ 2. If no cached location, get current location with balanced accuracy (3s timeout)
                kotlinx.coroutines.withTimeout(3000L) {
                    val location = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                    if (location != null) { processLocationUpdate(context, location.latitude, location.longitude, language, currentUser) }
                }
            } catch (e: Exception) { }
        }
    }

    private suspend fun processLocationUpdate(context: Context, lat: Double, lon: Double, language: Language, currentUser: User?): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                // ✅ FIX: Always save GPS coordinates immediately, regardless of geocoder result.
                prefs.lastLat = lat
                prefs.lastLon = lon
                prefs.lastLocationDetectionTime = System.currentTimeMillis()

                val addresses = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                    try {
                        val geocoder = Geocoder(context, Locale("te"))
                        geocoder.getFromLocation(lat, lon, 1)
                    } catch (e: Exception) { null }
                }
                if (!addresses.isNullOrEmpty()) {
                    val address = addresses[0]
                    val locality = address.locality ?: address.subLocality ?: address.subAdminArea
                    if (locality != null) { prefs.localPlace = locality }
                    
                    val detectedName = address.subAdminArea ?: address.locality ?: address.adminArea ?: ""
                    
                    // 🌍 SMART MAPPING: Try Telugu first, then English mapping
                    var mappedDistrict = Constants.ALL_DISTRICTS.find { 
                        it.contains(detectedName, ignoreCase = true) || detectedName.contains(it, ignoreCase = true) 
                    }
                    
                    if (mappedDistrict == null) {
                        // Try English Geocoder fallback for better matching with timeout
                        val engAddresses = kotlinx.coroutines.withTimeoutOrNull(2000L) {
                            try {
                                val engGeocoder = Geocoder(context, Locale.ENGLISH)
                                engGeocoder.getFromLocation(lat, lon, 1)
                            } catch (e: Exception) { null }
                        }
                        val engName = engAddresses?.firstOrNull()?.let { it.subAdminArea ?: it.locality ?: it.adminArea }
                        if (engName != null) {
                            mappedDistrict = WeatherService.getTeluguNameForEnglish(engName)
                        }
                    }

                    if (mappedDistrict != null && prefs.detectedDistrict != mappedDistrict) {
                        prefs.detectedDistrict = mappedDistrict
                        viewModelScope.launch {
                            NotificationHelper.syncDistrictTopic(getApplication(), prefs.getEffectiveDistrict())
                        }
                        withContext(Dispatchers.Main) { 
                            _userDistrict.value = mappedDistrict
                            if (prefs.selectedDistrict == null) {
                                loadNews(language, currentUser) 
                            }
                        }
                        return@withContext true
                    }
                }
            } catch (e: Exception) { }
            false
        }
    }

    fun setUserDistrict(district: String, currentUser: User?) {
        prefs.selectedDistrict = district
        _userDistrict.value = district
        viewModelScope.launch {
            NotificationHelper.syncDistrictTopic(getApplication(), district)
        }
        loadNews(Language.TELUGU, currentUser)
    }

    fun onAppResume(language: Language, currentUser: User?) {
        loadNews(language, currentUser)
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 300000 || _news.value.isEmpty()) { loadNews(language, currentUser) }
    }

     private fun mapDistrictToState(district: String?): String? {
         if (district.isNullOrBlank()) return null
         val clean = district.trim().replace("జిల్లా", "").replace("డిస్ట్రిక్ట్", "").replace("District", "", ignoreCase = true).trim()

         val telanganaIdentifiers = setOf(
             "Telangana", "Telangana State", "TS", "TG", "తెలంగాణ", "తెలంగాణా", "Telangana News", "తెలంగాణ వార్తలు",
             "హైదరాబాద్", "Hyderabad", "సికింద్రాబాద్", "Secunderabad", "సైబరాబాద్", "Cyberabad",
             "ఆదిలాబాద్", "Adilabad", "భద్రాద్రి కొత్తగూడెం", "కొత్తగూడెం", "Kothagudem", "Bhadradri",
             "హన్మకొండ", "హనుమకొండ", "వరంగల్ అర్బన్", "Hanamkonda", "Hanumakonda",
             "వరంగల్", "వరంగల్ రూరల్", "Warangal", "జగిత్యాల", "Jagtial", "జనగాం", "Jangaon",
             "జయశంకర్ భూపాలపల్లి", "భూపాలపల్లి", "Bhupalpally", "జోగులాంబ గద్వాల", "గద్వాల", "Gadwal",
             "కామారెడ్డి", "Kamareddy", "కరీంనగర్", "Karimnagar", "ఖమ్మం", "Khammam",
             "కుమ్రం భీమ్ ఆసిఫాబాద్", "ఆసిఫాబాద్", "Asifabad", "మహబూబాబాద్", "Mahabubabad",
             "మహబూబ్ నగర్", "మహబూబ్‌నగర్", "Mahabubnagar", "మంచిర్యాల", "Mancherial",
             "మెదక్", "Medak", "మేడ్చల్ మల్కాజిగిరి", "మేడ్చల్", "మల్కాజిగిరి", "Malkajgiri", "Medchal",
             "ములుగు", "Mulugu", "నాగర్ కర్నూల్", "నాగర్‌కర్నూల్", "Nagarkurnool",
             "నల్గొండ", "Nalgonda", "నారాయణపేట", "Narayanpet", "నిర్మల్", "Nirmal",
             "నిజామాబాద్", "Nizamabad", "పెద్దపల్లి", "Peddapalli", "రాజన్న సిరిసిల్ల", "సిరిసిల్ల", "Sircilla",
             "రంగారెడ్డి", "Rangareddy", "Ranga Reddy", "సంగారెడ్డి", "Sangareddy",
             "సిద్దిపేట", "Siddipet", "సూర్యాపేట", "Suryapet", "వికారాబాద్", "Vikarabad",
             "వనపర్తి", "Wanaparthy", "యాదాద్రి భువనగిరి", "భువనగిరి", "Bhuvanagiri", "Yadadri"
         )

         val apIdentifiers = setOf(
             "Andhra Pradesh", "AndhraPradesh", "AP", "Andhra", "ఆంధ్రప్రదేశ్", "ఆంధ్ర ప్రదేశ్", "ఆంధ్ర", "AP News", "ఆంధ్రప్రదేశ్ వార్తలు", "ఆంధ్ర వార్తలు",
             "అల్లూరి సీతారామరాజు", "అల్లూరి", "Alluri", "పాడేరు", "Paderu",
             "అనకాపల్లి", "Anakapalli", "అనంతపురం", "అనంతపురము", "Anantapur", "Ananthapur",
             "అన్నమయ్య", "Annamayya", "రాయచోటి", "Rayachoti", "బాపట్ల", "Bapatla",
             "చిత్తూరు", "Chittoor", "కోనసీమ", "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ", "Amalapuram", "అమలాపురం",
             "తూర్పు గోదావరి", "రాజమండ్రి", "రాజమహేంద్రవరం", "Rajahmundry", "Rajamahendravaram", "East Godavari",
             "ఏలూరు", "Eluru", "గుంటూరు", "Guntur", "కాకినాడ", "Kakinada",
             "కృష్ణా", "మచిలీపట్నం", "Krishna", "Machilipatnam", "కర్నూలు", "Kurnool",
             "నంద్యాల", "Nandyal", "ఎన్టీఆర్", "విజయవాడ", "NTR", "Vijayawada",
             "పల్నాడు", "నరసరావుపేట", "Palnadu", "Narasaraopeta",
             "పార్వతీపురం మన్యం", "మన్యం", "పార్వతీపురం", "Parvathipuram", "Manyam",
             "ప్రకాశం", "ఒంగోలు", "Prakasam", "Ongole", "మార్కాపురం", "Markapur",
             "పోలవరం", "Polavaram", "మదనపల్లె", "Madanapalle",
             "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", "నెల్లూరు", "Nellore", "SPSR Nellore",
             "శ్రీ సత్యసాయి", "సత్యసాయి", "పుట్టపర్తి", "Sri Sathya Sai", "Sathya Sai", "Puttaparthi",
             "శ్రీకాకుళం", "Srikakulam", "తిరుపతి", "తిరుమల", "Tirupati",
             "విశాఖపట్నం", "విశాఖ", "వైజాగ్", "Visakhapatnam", "Vizag",
             "విజయనగరం", "Vizianagaram", "పశ్చిమ గోదావరి", "భీమవరం", "West Godavari", "Bhimavaram",
             "వైఎస్ఆర్ కడప", "వైఎస్సార్ కడప", "కడప", "Kadapa", "YSR Kadapa", "అమరావతి", "Amaravati"
         )

         if (telanganaIdentifiers.any { it.equals(clean, ignoreCase = true) || clean.contains(it, ignoreCase = true) }) {
             return "Telangana"
         }
         if (apIdentifiers.any { it.equals(clean, ignoreCase = true) || clean.contains(it, ignoreCase = true) }) {
             return "Andhra Pradesh"
         }

         if (Constants.TS_DISTRICTS.any { it.contains(clean, ignoreCase = true) || clean.contains(it, ignoreCase = true) }) {
             return "Telangana"
         }
         if (Constants.AP_DISTRICTS.any { it.contains(clean, ignoreCase = true) || clean.contains(it, ignoreCase = true) }) {
             return "Andhra Pradesh"
         }

         return null
     }

     /**
      * 🧠 SMART INFERENCE:
      * ఒక వార్తా పోస్ట్ తెలంగాణకు చెందినదా లేదా ఆంధ్రప్రదేశ్‌కు చెందినదా అని
      * state, district, categories, entities మరియు కంటెంట్/హెడ్‌లైన్ ఆధారంగా కచ్చితంగా గుర్తిస్తుంది.
      */
     private fun inferStateFromPost(post: NewsPost): String? {
         // 1. Direct post.state check
         val directState = mapDistrictToState(post.state)
         if (directState != null) return directState

         // 2. Direct district mapping
         val dState = mapDistrictToState(post.district)
         if (dState != null) return dState

         // 3. Category & categories mapping
         if (!post.category.isNullOrBlank()) {
             val cState = mapDistrictToState(post.category)
             if (cState != null) return cState
         }
         for (cat in post.categories) {
             val cState = mapDistrictToState(cat)
             if (cState != null) return cState
         }

         // 4. Tags mapping
         for (tag in post.tags) {
             val tState = mapDistrictToState(tag)
             if (tState != null) return tState
         }

         // 5. Entities (locations, people, organizations)
         val entities = post.entities
         for (loc in entities.locations) {
             val lState = mapDistrictToState(loc)
             if (lState != null) return lState
         }
         for (org in entities.organizations) {
             val oState = mapDistrictToState(org)
             if (oState != null) return oState
         }

         // 6. Keywords Inference from Headline & Content
         val text = "${post.headline.telugu} ${post.headline.english} ${post.content.telugu} ${post.content.english}"

         val tsTerms = listOf(
            // Leaders & Ministers
            "రేవంత్", "రేవంత్‌రెడ్డి", "రేవంత్ రెడ్డి", "Revanth", "కేసీఆర్", "KCR", "కేటీఆర్", "KTR",
            "హరీశ్ రావు", "హరీష్ రావు", "హరీష్‌రావు", "Harish Rao", "భట్టి విక్రమార్క", "విక్రమార్క",
            "కోమటిరెడ్డి", "ఉత్తమ్ కుమార్", "పొంగులేటి", "ఈటల రాజేందర్", "ఈటల", "బండి సంజయ్",
            "కిషన్ రెడ్డి", "ధర్మపురి అరవింద్", "సీతక్క", "పొన్నం ప్రభాకర్", "దామోదర రాజనర్సింహ",
            "జూపల్లి", "తుమ్మల నాగేశ్వరరావు", "కల్వకుంట్ల కవిత", "ఎమ్మెల్సీ కవిత", "కల్వకుంట్ల", "కేశవరావు", "కే కేశవరావు",
            // Parties, Orgs & Gov
            "బీఆర్ఎస్", "బిఆర్ఎస్", "BRS", "TRS", "టిఆర్ఎస్", "టీఆర్ఎస్",
            "తెలంగాణ కాంగ్రెస్", "TG కాంగ్రెస్", "TPCC", "టీపీసీసీ", "తెలంగాణ బీజేపీ",
            "TSRTC", "TGSRTC", "హైడ్రా", "HYDRAA", "GHMC", "జీహెచ్ఎంసీ", "HMDA",
            "కాళేశ్వరం", "సింగరేణి", "యాదాద్రి", "భద్రాచలం",
            // State references
            "తెలంగాణ", "తెలంగాణా", "Telangana", "TG ప్రభుత్వం", "తెలంగాణ ప్రభుత్వం",
            "తెలంగాణ అసెంబ్లీ", "తెలంగాణ సచివాలయం", "తెలంగాణ వార్తలు"
        )

        val apTerms = listOf(
            // Leaders & Ministers
            "చంద్రబాబు", "చంద్రబాబు నాయుడు", "నారా చంద్రబాబు", "Chandrababu", "పవన్ కళ్యాణ్",
            "పవన్‌కళ్యాణ్", "Pawan Kalyan", "నారా లోకేష్", "లోకేశ్", "లోకేష్", "Nara Lokesh",
            "జగన్", "వైఎస్ జగన్", "జగన్ మోహన్ రెడ్డి", "Jagan", "YSRCP", "వైసీపీ", "వైసిపి",
            "వంగలపూడి అనిత", "హోంమంత్రి అనిత", "నాదెండ్ల మనోహర్", "అచ్చెన్నాయుడు", "పయ్యావుల కేశవ్",
            "కొల్లు రవీంద్ర", "కందుల దుర్గారావు", "ఆర్కే రోజా", "రోజా సెల్వమణి", "పేర్ని నాని", "కొడాలి నాని",
            "విజయసాయి రెడ్డి", "వైవీ సుబ్బారెడ్డి", "సజ్జల", "బొత్స సత్యనారాయణ", "బొత్స",
            // Parties, Orgs & Gov
            "టీడీపీ", "టిడిపి", "TDP", "తెలుగుదేశం", "తెలుగు దేశం", "జనసేన", "Janasena", "JSP",
            "ఏపీ కాంగ్రెస్", "APCC", "ఏపీపీసీసీ", "ఏపీ బీజేపీ",
            "APSRTC", "ఏపీఎస్ ఆర్టీసీ", "తిరుమల", "TTD", "తిరుపతి దేవస్థానం",
            "అమరావతి", "పోలవరం", "విశాఖ ఉక్కు",
            // State references
            "ఆంధ్రప్రదేశ్", "ఆంధ్ర ప్రదేశ్", "ఆంధ్ర", "Andhra Pradesh", "Andhra",
            "ఏపీ ప్రభుత్వం", "ఆంధ్రప్రదేశ్ ప్రభుత్వం", "ఏపీ అసెంబ్లీ", "ఏపీ సచివాలయం", "ఆంధ్రప్రదేశ్ వార్తలు"
        )

         var tsScore = 0
         var apScore = 0
         for (term in tsTerms) {
             if (text.contains(term, ignoreCase = true)) tsScore++
         }
         for (term in apTerms) {
             if (text.contains(term, ignoreCase = true)) apScore++
         }

         if (tsScore > apScore && tsScore > 0) return "Telangana"
         if (apScore > tsScore && apScore > 0) return "Andhra Pradesh"

         return null
     }

     private suspend fun generateWeatherPost(place: String?, district: String?, lat: Double? = null, lon: Double? = null): NewsPost {
         val location = if (district == prefs.detectedDistrict) (place ?: district ?: "హైదరాబాద్") else (district ?: "హైదరాబాద్")
         
         // ✅ FIX: Increased timeout to 8000ms so mobile networks have enough time to fetch real weather.
         val weatherData = try {
             kotlinx.coroutines.withTimeout(8000L) {
                 WeatherService.fetchWeather(location, lat, lon)
             }
         } catch (e: Exception) { null }

         var temperatureStr = ""; var weatherHeadlineTe = "వాతావరణ తాజా సమాచారం"; var weatherContentTe = "ప్రస్తుతం $location లో వాతావరణ వివరాలు అందుబాటులో లేవు. నెట్‌వర్క్ చెక్ చేసుకుని మళ్ళీ ప్రయత్నించండి."
         var weatherContentEn = "Current weather update for $location."
         if (weatherData != null) {
             val rounded = kotlin.math.round(weatherData.temp).toInt()
             temperatureStr = "${rounded}°C "
             weatherHeadlineTe = WeatherService.getWeatherDescription(weatherData.code, com.alfanews.telugu.models.Language.TELUGU)
             weatherContentTe = WeatherService.getConversationalDescription(
                 code = weatherData.code,
                 temp = weatherData.temp,
                 location = location,
                 isDay = weatherData.isDay,
                 humidity = weatherData.humidity,
                 windSpeed = weatherData.wind,
                 language = com.alfanews.telugu.models.Language.TELUGU
             )
             weatherContentEn = WeatherService.getConversationalDescription(
                 code = weatherData.code,
                 temp = weatherData.temp,
                 location = location,
                 isDay = weatherData.isDay,
                 humidity = weatherData.humidity,
                 windSpeed = weatherData.wind,
                 language = com.alfanews.telugu.models.Language.ENGLISH
             )
         }
         // ✅ FIX: Use 5-min bucket for ID so the card refreshes more frequently.
         return NewsPost(
             id = "weather_${System.currentTimeMillis() / (1000 * 60 * 5)}",
             headline = com.alfanews.telugu.models.Headline(
                 telugu = "$temperatureStr$location వాతావరణం: $weatherHeadlineTe", 
                 english = "$temperatureStr$location Weather"
             ),
             content = com.alfanews.telugu.models.Content(telugu = weatherContentTe, english = weatherContentEn),
             location = location, type = "weather", timestamp = System.currentTimeMillis(), latitude = lat, longitude = lon
         )
     }
}
