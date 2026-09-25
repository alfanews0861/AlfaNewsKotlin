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
                    _news.value = emptyList()
                    _loading.value = true
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
    private val universalDistricts = Constants.UNIVERSAL_IDENTIFIERS

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
        if (Constants.isUniversalOrGeneral(post.district) && !post.categories.contains("జిల్లా వార్త")) {
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

    /**
     * 🛑 STRICT STATE ISOLATION (తెలంగాణ & ఆంధ్రప్రదేశ్ వార్తల విభజన):
     */
    private fun isPostAllowedForState(post: NewsPost, userState: String?): Boolean {
        if (userState.isNullOrBlank() || userState == "BOTH") return true

        // 1. పోస్ట్ నేరుగా వేరొక రాష్ట్రానికి చెందినదిగా గుర్తిస్తే తిరస్కరించు (రాజకీయాలు, నాయకులు, సంస్థలు, కంటెంట్)
        val postState = inferStateFromPost(post)
        if (postState != null && postState != userState) {
            return false
        }

        // 2. పోస్ట్ యొక్క జిల్లా వేరొక రాష్ట్రానికి చెందినది అయితే తిరస్కరించు
        val postDistrictState = Constants.mapDistrictToState(post.district)
        if (postDistrictState != null && postDistrictState != userState) {
            return false
        }

        // 3. పోస్ట్ state field వేరొక రాష్ట్రానికి చెందినది అయితే తిరస్కరించు
        val explicitState = Constants.mapDistrictToState(post.state)
        if (explicitState != null && explicitState != userState) {
            return false
        }

        // 4. గ్లోబల్ లేదా న్యూట్రల్ పోస్టులను అనుమతించు
        if (isGlobalPost(post)) {
            return true
        }

        return true
    }

    /**
     * 🛡️ STRICT DISTRICT & STATE FEED ISOLATION:
     * ఒక జిల్లా ఫీడ్‌లో లేదా హోమ్ ఫీడ్‌లో వేరొక జిల్లా స్థానిక వార్తలు రాకుండా పూర్తిగా నియంత్రిస్తుంది.
     */
    private fun isPostAllowedForFeed(post: NewsPost, userDistrict: String?, userState: String?): Boolean {
        // 1. State check
        if (!isPostAllowedForState(post, userState)) {
            return false
        }

        // 2. District News check:
        val isDistrictNews = post.categories.contains("జిల్లా వార్త") || 
            (!post.district.isNullOrBlank() && Constants.ALL_DISTRICTS.any { Constants.isDistrictMatch(post.district, it) })

        if (isDistrictNews) {
            if (userDistrict.isNullOrBlank()) {
                // If user has not selected district, don't show specific other district local news in general feed
                return false
            } else {
                // Only show if it belongs to user's district!
                val matches = Constants.isDistrictMatch(post.district, userDistrict) ||
                    post.categories.any { Constants.isDistrictMatch(it, userDistrict) }
                if (!matches) {
                    return false
                }
            }
        }

        return true
    }

    private val FETCH_LIMIT = 50 // Increased to ensure enough posts survive client-side filtering

      fun loadNews(language: Language, currentUser: User?, initialPostId: String? = null) {
          currentLanguage = language
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

                    // 🚀 FAST PATH: Quick top 3 fresh breaking news (General/State/National/Entertainment)
                    // Strictly excludes other districts' hyper-local news. Runs within ~300ms while splash screen is active.
                    val isColdStart = _news.value.isEmpty()
                    val fastBatchJob = async {
                        if (isColdStart) {
                            try {
                                val generalDistricts = getGeneralDistrictsForState(userState).take(30)
                                val snap = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                                    FirebaseService.db.collection("news")
                                        .whereEqualTo("approved", true)
                                        .whereIn("district", generalDistricts)
                                        .orderBy("timestamp", Query.Direction.DESCENDING)
                                        .limit(3)
                                        .get()
                                        .await()
                                }
                                val allPosts = snap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                                val statePosts = allPosts.filter { post ->
                                    if (!isPostAllowedForState(post, userState)) return@filter false
                                    // 🛡️ STRICT DISTRICT EXCLUSION: Do not show other districts' reporter news in general feed
                                    val isDistrictNews = post.categories.contains("జిల్లా వార్త")
                                    if (isDistrictNews) {
                                        if (district != null) {
                                            val matches = post.district == district || post.categories.contains(district) || Constants.isDistrictMatch(post.district, district)
                                            if (!matches) return@filter false
                                        } else {
                                            return@filter false
                                        }
                                    }
                                    true
                                }
                                val posts = statePosts
                                if (posts.isNotEmpty()) {
                                    Pair(posts, snap?.documents?.lastOrNull())
                                } else {
                                    // 📴 Fallback to cache if network query was empty
                                    val cachedSnap = try {
                                        FirebaseService.db.collection("news")
                                            .whereEqualTo("approved", true)
                                            .whereIn("district", generalDistricts)
                                            .orderBy("timestamp", Query.Direction.DESCENDING)
                                            .limit(3)
                                            .get(com.google.firebase.firestore.Source.CACHE)
                                            .await()
                                    } catch (e: Exception) { null }
                                    val cachedPosts = cachedSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) }
                                        ?.filter { post ->
                                            isPostAllowedForState(post, userState) &&
                                            (!post.categories.contains("జిల్లా వార్త") || (district != null && (post.district == district || post.categories.contains(district) || Constants.isDistrictMatch(post.district, district))))
                                        } ?: emptyList()
                                    Pair(cachedPosts, cachedSnap?.documents?.lastOrNull())
                                }
                            } catch (e: Exception) {
                                // 📴 Fallback to cache on timeout/error
                                val generalDistricts = getGeneralDistrictsForState(userState).take(30)
                                val cachedSnap = try {
                                    FirebaseService.db.collection("news")
                                        .whereEqualTo("approved", true)
                                        .whereIn("district", generalDistricts)
                                        .orderBy("timestamp", Query.Direction.DESCENDING)
                                        .limit(3)
                                        .get(com.google.firebase.firestore.Source.CACHE)
                                        .await()
                                } catch (ex: Exception) { null }
                                val cachedPosts = cachedSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) }
                                    ?.filter { post ->
                                        isPostAllowedForState(post, userState) &&
                                        (!post.categories.contains("జిల్లా వార్త") || (district != null && (post.district == district || post.categories.contains(district) || Constants.isDistrictMatch(post.district, district))))
                                    } ?: emptyList()
                                Pair(cachedPosts, null)
                            }
                        } else {
                            Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                        }
                    }
                    
                    val preferredCats = try { AnalyticsService.getUserPreferredCategories().take(10) } catch (e: Exception) { emptyList<String>() }

                    val greetingBatchDeferred = async {
                        if (initialPostId == null) {
                            try { 
                                val post = fetchGreetingPost()
                                if (post != null && prefs.getPostViewCount(post.id) < 2) post else null
                            } catch (e: Exception) { null }
                        } else null
                    }

                    val surveyBatchDeferred = async {
                        if (initialPostId == null) {
                            try { fetchActiveSurvey() } catch (e: Exception) { null }
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

                    // 🧠 BACKGROUND PROCESSING: Heavy 40/30/30 Mixing started in parallel from the start
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

                    // Greeting and Survey posts
                    val initialGreeting = greetingBatchDeferred.await()
                    val initialSurvey = surveyBatchDeferred.await()
                    if (initialGreeting != null) {
                        if (_news.value.isNotEmpty() && _news.value.none { it.id == initialGreeting.id }) {
                            _news.value = (listOf(initialGreeting) + _news.value).distinctBy { it.id }
                        }
                    }

                    val prefBatch = prefBatchDeferred.await()
                    val localBatch = localBatchDeferred.await()
                    val mainBatch = mainBatchDeferred.await()

                    var finalPosts = withContext(Dispatchers.Default) {
                        rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first, isFirstPage = true, injectedSurvey = initialSurvey)
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
                            val emergencySnapshot = kotlinx.coroutines.withTimeoutOrNull(4000L) {
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

                    // 🚨 SECONDARY GUARANTEE: If network emergency fetch returned empty, read from Firestore Cache!
                    if (finalPosts.isEmpty()) {
                        try {
                            val cachedSnap = FirebaseService.db.collection("news")
                                .whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(FETCH_LIMIT.toLong())
                                .get(com.google.firebase.firestore.Source.CACHE)
                                .await()
                            val cachedList = cachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                            if (cachedList.isNotEmpty()) {
                                finalPosts = cachedList
                            }
                        } catch (e: Exception) { }
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
         var anyFetched = false
        viewModelScope.launch {
             isFetching = true
             try {
                 val district = _userDistrict.value
                 val userState = mapDistrictToState(district)
                 val preferredCats = try { AnalyticsService.getUserPreferredCategories().take(10) } catch (e: Exception) { emptyList<String>() }

                 var attempts = 0
                 var appendedCount = 0

                 // Reduced max attempts from 3 to 2 to prevent excessive latency during scroll
                 while (attempts < 2 && appendedCount == 0 && _hasMore.value) {
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
                             anyFetched = true
                          } else {
                              consecutiveEmptyLoads += 1
                              if (mainCursor == null && prefCursor == null && localCursor == null) {
                                  // Cursors reached the end: cleanly stop pagination to prevent endless re-fetch loop
                                  _hasMore.value = false
                                  break
                              }
                              if (consecutiveEmptyLoads >= 2) {
                                  _hasMore.value = false
                                  break
                              }
                          }
                      } else {
                          if (mainCursor == null && prefCursor == null && localCursor == null) {
                              _hasMore.value = false
                              break
                          }
                          consecutiveEmptyLoads += 1
                          if (consecutiveEmptyLoads >= 2) {
                              _hasMore.value = false
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
                     if (anyFetched) {
                         loadMore(currentLanguage, currentUser)
                     }
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
                val districtAliases = Constants.getDistrictAliases(district)
                val primaryAliases = districtAliases.take(30)
                query = if (primaryAliases.size > 1) {
                    query.whereIn("district", primaryAliases)
                } else {
                    query.whereEqualTo("district", primaryAliases.firstOrNull() ?: district)
                }
            }
            query = query.orderBy("timestamp", Query.Direction.DESCENDING).limit(limit.toLong())
            if (currentCursor != null) query = query.startAfter(currentCursor)
            
            try {
                val snapshot = kotlinx.coroutines.withTimeoutOrNull(6000L) {
                    query.get().await()
                }
                if (snapshot == null || snapshot.isEmpty) {
                    // 🚀 STEP 2: If district query by 'district' field returned empty, check categories array with category aliases
                    if (!district.isNullOrBlank() && !excludeDistricts) {
                        try {
                            val categoryAliases = Constants.getDistrictAliases(district).take(10)
                            var catQuery = FirebaseService.db.collection("news")
                                .whereEqualTo("approved", true)
                                .whereArrayContainsAny("categories", categoryAliases)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(limit.toLong())
                            if (currentCursor != null) catQuery = catQuery.startAfter(currentCursor)
                            val catSnap = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                                catQuery.get().await()
                            }
                            if (catSnap != null && !catSnap.isEmpty) {
                                val allCatPosts = catSnap.documents.mapNotNull { doc -> mapDocumentToNewsPost(doc) }
                                val filtered = allCatPosts.filter { post -> isPostAllowedForState(post, userState) }
                                val catBatch = filtered
                                if (catBatch.isNotEmpty()) {
                                    return Pair(catBatch, catSnap.documents.lastOrNull() ?: currentCursor)
                                }
                            }
                        } catch (e: Exception) { }
                    }

                    // ✅ Fallback query కూడా userState filter apply చేయడం
                    var fallbackQuery = FirebaseService.db.collection("news")
                        .whereEqualTo("approved", true)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(limit.toLong())
                    
                    if (currentCursor != null) fallbackQuery = fallbackQuery.startAfter(currentCursor)
                    
                    val fallbackSnapshot = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                        try {
                            fallbackQuery.get().await()
                        } catch (e: Exception) {
                            null
                        }
                    }
                    if (fallbackSnapshot == null || fallbackSnapshot.isEmpty) {
                        return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), currentCursor)
                    }
                    
                    val allFallback = fallbackSnapshot.documents.mapNotNull { doc -> mapDocumentToNewsPost(doc) }
                    val filtered = allFallback.filter { post -> isPostAllowedForState(post, userState) }
                    val batch = filtered
                    currentCursor = fallbackSnapshot.documents.lastOrNull() ?: currentCursor
                    return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
                }
                val allBatch = snapshot.documents.mapNotNull { doc ->
                    mapDocumentToNewsPost(doc)
                }
                val filtered = allBatch.filter { post -> isPostAllowedForState(post, userState) }
                val batch = filtered
                currentCursor = snapshot.documents.lastOrNull() ?: currentCursor

                return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
            } catch (e: Exception) {
                // If the primary query times out, return the cursor to prevent endless loops.
                return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), currentCursor)
            }
        }




       private suspend fun rankAndBlendPosts(
           pref: List<NewsPost>,
           main: List<NewsPost>,
           local: List<NewsPost>,
           isFirstPage: Boolean = false,
           injectedSurvey: NewsPost? = null
       ): List<NewsPost> = withContext(Dispatchers.Default) {
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
                            (post.district == currentDist || post.categories.contains(currentDist) || Constants.isDistrictMatch(post.district, currentDist))
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
                        val matchesUserDistrict = (post.district == currentDist || post.categories.contains(currentDist) || Constants.isDistrictMatch(post.district, currentDist))
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
               if (normalNews.isEmpty()) {
                   normalNews = allRaw.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" }
               }
           }

            if (normalNews.isEmpty() && !isFirstPage) {
                normalNews = allRaw.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" && isPostAllowedForState(it, userState) }
                if (normalNews.isEmpty()) {
                    normalNews = allRaw.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" }
                }
                if (normalNews.isEmpty()) {
                    return@withContext emptyList<NewsPost>() 
                }
            }

           val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (e: Exception) { emptySet() }

           // 🚀 1. POOL SEPARATION
           val localIds = local.map { it.id }.toSet()
           val localCandidates = normalNews.filter { post ->
               post.id in localIds ||
               (post.categories.contains("జిల్లా వార్త") && currentDist != null && Constants.isDistrictMatch(post.district, currentDist))
           }
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
               val activeSurvey = injectedSurvey ?: fetchActiveSurvey()
               
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
        val survey = cachedActiveSurvey
        if (survey != null && cachedSurveyDistrict == currentDist && (now - cachedSurveyFetchTime) < SURVEY_CACHE_TTL) {
            if (!survey.isExpired) {
                return@withContext survey
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
            if ((data["webOnly"] as? Boolean) == true) return null
            com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data, currentLanguage)
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
        if (now - lastRefreshTimeLong > 60000 || _news.value.isEmpty()) { loadNews(language, currentUser) }
    }

     private fun mapDistrictToState(district: String?): String? {
         return Constants.mapDistrictToState(district)
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

     private fun generateWeatherPost(place: String?, district: String?, lat: Double? = null, lon: Double? = null): NewsPost {
         val location = if (district == prefs.detectedDistrict) (place ?: district ?: "హైదరాబాద్") else (district ?: "హైదరాబాద్")
         
         // 🚀 Instant 0ms cached lookup: Do not block news feed blending with network calls.
         // WeatherCardView fetches live weather asynchronously via LaunchedEffect upon rendering.
         val weatherData = WeatherService.getCachedWeather(location, lat, lon)

         var temperatureStr = ""; var weatherHeadlineTe = "వాతావరణ తాజా సమాచారం"; var weatherContentTe = "ప్రస్తుతం $location లో వాతావరణ వివరాలు అందుబాటులో ఉన్నాయి."
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
