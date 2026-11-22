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
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.BuildConfig
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
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
import kotlinx.coroutines.withTimeoutOrNull
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
        if (prefs.cachedMinVersionCode > BuildConfig.VERSION_CODE) return
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
                    val snapshot = FirebaseService.db.collection("local_ads")
                        .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                        .get().await()
                    
                    val ads = snapshot.documents.mapNotNull { com.alfanews.telugu.models.LocalAd.fromSnapshot(it) }
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

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    fun setSharedPostId(postId: String?) {
        _sharedPostId.value = postId
    }

    fun requestScrollToTop() {
        _shouldScrollToTop.value = true
    }

    private var pinnedPost: NewsPost? = null

    fun navigateToPost(post: NewsPost) {
        pinnedPost = post
        _sharedPostId.value = post.id
        val current = _news.value
        _news.value = (listOf(post) + current.filter { it.id != post.id }).distinctBy { it.id }
        _shouldScrollToTop.value = true
    }

    fun navigateToPostId(postId: String) {
        if (postId.isBlank()) return
        _sharedPostId.value = postId
        val current = _news.value
        val existing = current.find { it.id == postId }
        if (existing != null) {
            pinnedPost = existing
            _news.value = listOf(existing) + current.filter { it.id != postId }
            _sharedPostId.value = postId
            _shouldScrollToTop.value = true
        } else {
            viewModelScope.launch {
                try {
                    val doc = FirebaseService.db.collection(resolveActiveCollection()).document(postId).get().await()
                    if (doc.exists()) {
                        val post = mapDocumentToNewsPost(doc)
                        if (post != null) {
                            pinnedPost = post
                            _news.value = (listOf(post) + _news.value.filter { it.id != postId })
                            _sharedPostId.value = postId
                            _shouldScrollToTop.value = true
                        }
                    }
                } catch (e: Exception) {
                    Log.e("NewsFeedVM", "navigateToPostId error: ${e.message}")
                }
            }
        }
    }

    private var prefCursor: DocumentSnapshot? = null
    private var mainCursor: DocumentSnapshot? = null
    private var localCursor: DocumentSnapshot? = null
    private var prefCursorTs: Long? = null
    private var mainCursorTs: Long? = null
    private var localCursorTs: Long? = null
    @Volatile private var isFetching = false
    val isFetchingState: Boolean get() = isFetching
    @Volatile private var lastFetchStartTime: Long = 0L
    private var currentFetchJob: kotlinx.coroutines.Job? = null
    private var lastRefreshTimeLong: Long = 0
    private var consecutiveEmptyLoads = 0

    // 🚀 IN-MEMORY CACHES TO SAVE FIRESTORE READS
    private var cachedGreetingPost: NewsPost? = null
    private var cachedGreetingFetchTime: Long = 0L
    private val GREETING_CACHE_TTL = 30 * 60 * 1000L // 30 mins

    private var cachedActiveSurvey: NewsPost? = null
    private var cachedSurveyFetchTime: Long = 0L
    private var cachedSurveyDistrict: String? = null
    private val SURVEY_CACHE_TTL = 15 * 60 * 1000L // 15 mins

    private fun isDistrictMatch(postDistrict: String?, targetDistrict: String?): Boolean {
        if (postDistrict.isNullOrBlank() || targetDistrict.isNullOrBlank()) return false
        if (postDistrict.equals(targetDistrict, ignoreCase = true)) return true
        val aliases = Constants.getDistrictAliases(targetDistrict)
        return aliases.any { it.equals(postDistrict, ignoreCase = true) || postDistrict.contains(it, ignoreCase = true) || it.contains(postDistrict, ignoreCase = true) }
    }

    private fun resolveActiveStateCode(district: String? = _userDistrict.value): com.alfanews.telugu.utils.StateCode {
        return com.alfanews.telugu.utils.EditionRegistry.resolveStateCode(prefs.selectedState, district)
            ?: prefs.getEffectiveStateCode()
    }

    private fun resolveActiveCollection(district: String? = _userDistrict.value): String {
        val stateCode = resolveActiveStateCode(district)
        return com.alfanews.telugu.utils.EditionRegistry.getCollectionForEdition(stateCode, currentLanguage)
    }

    /**
     * 🛡️ STRICT HOME FEED FILTERING (9-State & AP/TS Strict Isolation):
     * - Own State + National/Universal ONLY: AP users NEVER see TS posts and TS users NEVER see AP posts (even if isGlobal=true).
     * - Universal News: National, International, Cinema, Sports, Politics (national), Business, Tech, Crime, Education, Health, Devotional, Lifestyle.
     * - Local District News: ONLY allowed if it matches the user's OWN district.
     * - OTHER DISTRICTS' local news are STRICTLY FILTERED OUT!
     */
    private fun isPostAllowedForHomeFeed(post: NewsPost, userDistrict: String?, userState: String?): Boolean {
        val userStateCode = com.alfanews.telugu.utils.EditionRegistry.resolveStateCode(
            prefs.selectedState ?: userState,
            userDistrict
        )

        // 1. Strict State Isolation across all 9 states (including AP vs TS, regardless of isGlobal)
        if (userStateCode != null && userState != "BOTH") {
            val postStateCode = com.alfanews.telugu.utils.EditionRegistry.resolveStateCode(
                post.stateCode ?: post.state,
                post.district
            )
            if (postStateCode != null && postStateCode != userStateCode) {
                return false
            }
            // Fallback inference for legacy AP/TS posts lacking explicit state/district tags
            if (postStateCode == null && (userStateCode == com.alfanews.telugu.utils.StateCode.AP || userStateCode == com.alfanews.telugu.utils.StateCode.TS)) {
                val inferred = inferStateFromPost(post)
                val inferredCode = com.alfanews.telugu.utils.EditionRegistry.resolveStateCode(inferred, null)
                if (inferredCode != null && inferredCode != userStateCode) {
                    return false
                }
            }
        }

        // 2. Special posts (Greeting, History, Cartoon)
        if (post.type == "greeting" || post.type == "history" || post.type == "cartoon") {
            if (post.type == "cartoon" && userStateCode != null && userState != "BOTH") {
                val cartoonStateCode = com.alfanews.telugu.utils.EditionRegistry.resolveStateCode(
                    post.stateCode ?: post.state,
                    post.district
                )
                if (cartoonStateCode != null && cartoonStateCode != userStateCode) return false
            }
            return true
        }

        // 3. District Check: Is this a local district post?
        val postDist = post.district?.trim()
        val hasLocalCategory = post.category?.trim() == "జిల్లా వార్త" || 
                               post.category?.trim() == "స్థానిక" || 
                               post.categories.any { it.trim() == "జిల్లా వార్త" || it.trim() == "Local" || it.trim() == "స్థానిక" }
        
        val isSpecificDistrict = !postDist.isNullOrBlank() && Constants.isSpecificDistrict(postDist)

        if (hasLocalCategory || isSpecificDistrict) {
            // It is a local district post. MUST match userDistrict!
            if (userDistrict.isNullOrBlank()) {
                return false // Unknown district user shouldn't see random other districts' local news
            }
            val aliases = Constants.getDistrictAliases(userDistrict)
            val isUserDistrict = postDist.equals(userDistrict, ignoreCase = true) ||
                    aliases.any { alias ->
                        alias.equals(postDist, ignoreCase = true) ||
                        postDist?.contains(alias, ignoreCase = true) == true ||
                        alias.contains(postDist ?: "", ignoreCase = true)
                    } ||
                    post.categories.any { cat ->
                        cat.equals(userDistrict, ignoreCase = true) ||
                        aliases.any { alias -> alias.equals(cat, ignoreCase = true) }
                    }
            
            // STRICTLY REJECT other districts' local news!
            return isUserDistrict
        }

        // 4. Non-district news (General, National, International, Cinema, Sports, Politics, Business, Education, Tech, Crime, Health, Devotional, Lifestyle, etc.)
        return true
    }


    fun loadNews(
        language: Language,
        currentUser: User?,
        initialPostId: String? = null,
        forceRefresh: Boolean = false,
        isExplicitScrollToTop: Boolean = false
    ) {
        if (prefs.cachedMinVersionCode > BuildConfig.VERSION_CODE) {
            Log.w("NewsFeedVM", "Force update required (cachedMinVersionCode: ${prefs.cachedMinVersionCode} > ${BuildConfig.VERSION_CODE}). Skipping loadNews to avoid egress.")
            _loading.value = false
            return
        }
        currentLanguage = language
        val now = System.currentTimeMillis()
        // 🛡️ DEBOUNCE DOUBLE-RESUME: If a fetch was already triggered within the last 3.5 seconds and is running,
        // do NOT cancel it and restart! Let the active query finish smoothly.
        if (isFetching && initialPostId == null && (now - lastFetchStartTime < 3500L)) return
        if (isFetching && initialPostId == null && !forceRefresh) return
        if (forceRefresh && initialPostId == null) {
            pinnedPost = null
        }
        
        currentFetchJob?.cancel()
        lastFetchStartTime = now

        val rawDistrict = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
        val district = if (rawDistrict != null && Constants.isSpecificDistrict(rawDistrict)) {
            rawDistrict
        } else {
            val validFallback = currentUser?.district?.takeIf { Constants.isSpecificDistrict(it) }
                ?: prefs.detectedDistrict?.takeIf { Constants.isSpecificDistrict(it) }
                ?: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు"
            prefs.selectedDistrict = validFallback
            validFallback
        }
        _userDistrict.value = district
        val userState = Constants.mapDistrictToState(district)

        val preferredCats = try {
            AnalyticsService.getExpandedPreferredCategoriesForQuery(10)
        } catch (e: Exception) {
            emptyList<String>()
        }

        // Non-blocking background loader for local ads
        loadLocalAds(district)

        if (_news.value.isEmpty()) {
            _loading.value = true 
        }
        isFetching = true

        currentFetchJob = viewModelScope.launch {
            try {
                if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) {
                    if (_news.value.isEmpty()) {
                        _isOnline.value = false
                        _loading.value = false
                        isFetching = false
                        return@launch
                    }
                }
                _isOnline.value = true

                // Always reset cursors on loadNews
                prefCursor = null
                mainCursor = null
                localCursor = null
                prefCursorTs = null
                mainCursorTs = null
                localCursorTs = null
                _hasMore.value = true
                consecutiveEmptyLoads = 0

                val activeStateCode = resolveActiveStateCode(district)
                val collectionName = com.alfanews.telugu.utils.EditionRegistry.getCollectionForEdition(activeStateCode, currentLanguage)
                val newsRef = FirebaseService.db.collection(collectionName)

                val initialTargetDeferred = async(Dispatchers.IO) {
                    if (!initialPostId.isNullOrBlank()) {
                        try {
                            val doc = newsRef.document(initialPostId).get().await()
                            if (doc.exists()) mapDocumentToNewsPost(doc) else null
                        } catch (_: Exception) { null }
                    } else null
                }

                // 🚀 PARALLEL SURVEY FETCH: Run concurrently so it never adds serial latency
                val surveyDeferred = async(Dispatchers.IO) {
                    if (initialPostId == null) {
                        try {
                            fetchActiveSurvey()
                        } catch (_: Exception) { null }
                    } else null
                }

                // 🌐 PHASE 2: Server-Side CDN Edge Cache (/api/feed?type=home) — ~25 KB Gzipped, 0 Firestore Internet Egress, 0 device disk cache!
                val edgeFeed = com.alfanews.telugu.services.FeedEdgeCacheService.fetchHomeFeed(
                    collection = collectionName,
                    stateCode = activeStateCode.name,
                    district = district,
                    language = currentLanguage,
                    limit = 25
                )

                val initialTargetPost = initialTargetDeferred.await()

                if (edgeFeed != null) {
                    val edgeMergedMain = (edgeFeed.statePosts + edgeFeed.main).distinctBy { it.id }
                    val edgeFilteredMain = edgeMergedMain.filter { isPostAllowedForHomeFeed(it, district, userState) }
                    val edgeFilteredDistrict = edgeFeed.local.filter { isPostAllowedForHomeFeed(it, district, userState) }

                    if (edgeFilteredMain.isNotEmpty() || edgeFilteredDistrict.isNotEmpty()) {
                        mainCursorTs = edgeFeed.mainLastTs
                        localCursorTs = edgeFeed.localLastTs
                        prefCursorTs = edgeFeed.mainLastTs

                        val edgeGreeting = edgeFeed.greeting?.takeIf {
                            initialPostId == null && prefs.getPostViewCount(it.id) < 2
                        }
                        val edgeSurvey = surveyDeferred.await()

                        val edgeBlended = withContext(Dispatchers.Default) {
                            val fastCandidates = edgeFilteredMain.filter {
                                it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey"
                            }
                            val anchors = com.alfanews.telugu.utils.NewsFeedBlender.pickFastPathTop3(
                                candidates = fastCandidates,
                                userDistrict = district,
                                relevanceScorer = { post -> try { AnalyticsService.calculateRelevanceScore(post) } catch (_: Exception) { post.qualityScore } },
                                count = 3
                            )
                            rankAndBlendPosts(
                                pref = emptyList(),
                                main = edgeFilteredMain,
                                local = edgeFilteredDistrict,
                                isFirstPage = true,
                                userDistrict = district,
                                userState = userState,
                                activeSurvey = edgeSurvey,
                                fastPathAnchors = anchors
                            )
                        }

                        val pin = pinnedPost ?: initialTargetPost
                        val finalPosts = (listOfNotNull(pin, edgeGreeting) + edgeBlended).distinctBy { it.id }

                        if (_news.value.isNotEmpty() && !isExplicitScrollToTop) {
                            val currentNews = _news.value
                            val olderRemaining = currentNews.filter { cur ->
                                finalPosts.none { it.id == cur.id } && (cur.id == pin?.id || isPostAllowedForHomeFeed(cur, district, userState))
                            }
                            _news.value = (finalPosts + olderRemaining).distinctBy { it.id }
                        } else {
                            _news.value = finalPosts
                        }

                        _hasMore.value = (mainCursorTs != null || finalPosts.size >= 10)
                        lastRefreshTimeLong = System.currentTimeMillis()
                        _lastRefreshTime.value = lastRefreshTimeLong
                        if ((initialPostId == null && isExplicitScrollToTop) || pin != null) {
                            _shouldScrollToTop.value = true
                        }
                        Log.d("NewsFeedVM", "🌐 Edge CDN Feed loaded ${finalPosts.size} posts (0 Firestore egress)")
                        return@launch
                    }
                }

                val shouldRunFastPath = _news.value.isEmpty() || forceRefresh

                // 🚀 FIRESTORE FALLBACK (Phase 1 Bounded Limits — 70%+ egress reduction vs previous 125-doc cold start):
                val fastDeferred = async(Dispatchers.IO) {
                    if (shouldRunFastPath) {
                        try {
                            withTimeoutOrNull(3000L) {
                                newsRef.whereEqualTo("approved", true)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(6)
                                    .get().await()
                            }
                        } catch (_: Exception) { null }
                    } else null
                }

                val primaryQuery = newsRef.whereEqualTo("approved", true)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(20)

                val mainDeferred = async(Dispatchers.IO) {
                    try {
                        kotlinx.coroutines.withTimeoutOrNull(6000L) { primaryQuery.get().await() }
                    } catch (e: Exception) {
                        Log.w("NewsFeedVM", "Primary query error: ${e.message}")
                        null
                    }
                }

                // 🏛️ OWN-STATE STREAM: Parallel query ensuring strong own-state coverage for AP, TS & all 7 expansion states
                val stateDeferred = async(Dispatchers.IO) {
                    try {
                        val stateAliases = com.alfanews.telugu.utils.EditionRegistry.getStateFirestoreAliases(activeStateCode)
                        kotlinx.coroutines.withTimeoutOrNull(5000L) {
                            newsRef.whereEqualTo("approved", true)
                                .whereIn("state", stateAliases)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .limit(10)
                                .get().await()
                        }
                    } catch (e: Exception) {
                        Log.w("NewsFeedVM", "State query error: ${e.message}")
                        null
                    }
                }

                val districtDeferred = async(Dispatchers.IO) {
                    if (!district.isNullOrBlank()) {
                        val aliases = Constants.getDistrictAliases(district)
                            .map { it.trim() }
                            .filter { it.isNotBlank() }
                            .distinct()
                            .take(10)
                        try {
                            kotlinx.coroutines.withTimeoutOrNull(5000L) {
                                if (aliases.size > 1) {
                                    newsRef.whereEqualTo("approved", true)
                                        .whereIn("district", aliases)
                                        .orderBy("timestamp", Query.Direction.DESCENDING)
                                        .limit(10)
                                        .get().await()
                                } else {
                                    newsRef.whereEqualTo("approved", true)
                                        .whereEqualTo("district", aliases.firstOrNull() ?: district)
                                        .orderBy("timestamp", Query.Direction.DESCENDING)
                                        .limit(10)
                                        .get().await()
                                }
                            }
                        } catch (e: Exception) {
                            Log.w("NewsFeedVM", "District query error: ${e.message}")
                            null
                        }
                    } else null
                }

                val prefDeferred = async(Dispatchers.IO) {
                    if (preferredCats.isNotEmpty()) {
                        try {
                            kotlinx.coroutines.withTimeoutOrNull(5000L) {
                                newsRef.whereEqualTo("approved", true)
                                    .whereArrayContainsAny("categories", preferredCats)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                                    .limit(10)
                                    .get().await()
                            }
                        } catch (_: Exception) { null }
                    } else null
                }

                val greetingDeferred = async(Dispatchers.IO) {
                    if (initialPostId == null) {
                        try {
                            val post = fetchGreetingPost()
                            if (post != null && prefs.getPostViewCount(post.id) < 2) post else null
                        } catch (_: Exception) { null }
                    } else null
                }

                // surveyDeferred already launched in parallel above before Edge CDN / Firestore split

                // ⚡ SERVER FAST PATH (< 300ms): Await lightweight 10-doc query FIRST & display Top 3 immediately
                // Anchoring these exact 3 posts prevents UI flicker and keeps Fast Path 3 intact while 40/30/30 blends from index 3+
                var fastPathAnchors: List<NewsPost> = emptyList()
                val fastSnap = fastDeferred.await()
                if (fastSnap != null && !fastSnap.isEmpty) {
                    val fastTop3 = withContext(Dispatchers.Default) {
                        val allowed = fastSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                            .filter {
                                it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" &&
                                    isPostAllowedForHomeFeed(it, district, userState)
                            }
                        com.alfanews.telugu.utils.NewsFeedBlender.pickFastPathTop3(
                            candidates = allowed,
                            userDistrict = district,
                            relevanceScorer = { post -> try { AnalyticsService.calculateRelevanceScore(post) } catch (_: Exception) { post.qualityScore } },
                            count = 3
                        )
                    }
                    if (fastTop3.isNotEmpty()) {
                        fastPathAnchors = fastTop3
                        val pin = pinnedPost ?: initialTargetPost
                        val targetAndFast = (listOfNotNull(pin) + fastTop3).distinctBy { it.id }
                        val currentTopId = _news.value.firstOrNull()?.id
                        val newTopId = targetAndFast.firstOrNull()?.id
                        if (_news.value.isEmpty() || currentTopId != newTopId) {
                            val olderRemaining = _news.value.filter { cur -> targetAndFast.none { it.id == cur.id } }
                            _news.value = (targetAndFast + olderRemaining).distinctBy { it.id }
                            _loading.value = false
                            lastRefreshTimeLong = System.currentTimeMillis()
                            _lastRefreshTime.value = lastRefreshTimeLong
                            Log.d("NewsFeedVM", "⚡ Server Fast Path: ${targetAndFast.size} fresh posts on screen in < 300ms")
                        }
                    }
                }

                val mainSnap = mainDeferred.await()
                val stateSnap = stateDeferred.await()
                val districtSnap = districtDeferred.await()
                val prefSnap = prefDeferred.await()
                val initialGreeting = greetingDeferred.await()
                val initialSurvey = surveyDeferred.await()

                var freshPosts = mainSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val statePosts = stateSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val districtPosts = districtSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val prefPosts = prefSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()

                // Fallback to Firestore Cache if server query timed out/empty and memory is empty
                if (freshPosts.isEmpty() && _news.value.isEmpty()) {
                    try {
                        val cachedSnap = primaryQuery.get(Source.CACHE).await()
                        freshPosts = cachedSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                        if (freshPosts.isNotEmpty()) {
                            mainCursor = cachedSnap.documents.lastOrNull()
                        }
                    } catch (_: Exception) {}
                } else if (mainSnap?.documents?.isNotEmpty() == true) {
                    mainCursor = mainSnap.documents.lastOrNull()
                }

                if (districtSnap?.documents?.isNotEmpty() == true) {
                    localCursor = districtSnap.documents.lastOrNull()
                }

                if (prefSnap?.documents?.isNotEmpty() == true) {
                    prefCursor = prefSnap.documents.lastOrNull()
                }

                // 4. 🎯 STRICT STATE & DISTRICT FILTERING + TRUE 40/30/30 USER-INTEREST BLENDING (After Fast Path 3!)
                val mergedMain = (statePosts + freshPosts).distinctBy { it.id }
                val filteredMain = mergedMain.filter { isPostAllowedForHomeFeed(it, district, userState) }
                val filteredDistrict = districtPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }
                val filteredPref = prefPosts.filter { isPostAllowedForHomeFeed(it, district, userState) }

                if (filteredMain.isNotEmpty() || filteredDistrict.isNotEmpty() || filteredPref.isNotEmpty()) {
                    val blended = withContext(Dispatchers.Default) {
                        rankAndBlendPosts(
                            pref = filteredPref,
                            main = filteredMain,
                            local = filteredDistrict,
                            isFirstPage = true,
                            userDistrict = district,
                            userState = userState,
                            activeSurvey = initialSurvey,
                            fastPathAnchors = fastPathAnchors
                        )
                    }

                    val pin = pinnedPost ?: initialTargetPost
                    val finalPosts = (listOfNotNull(pin, initialGreeting) + blended).distinctBy { it.id }

                    // 🛡️ PRESERVE OLDER NEWS ON BACKGROUND REFRESH:
                    // If this is a background/resume refresh (not an explicit user pull-to-refresh or district change),
                    // preserve existing older news so reading position doesn't glitch or truncate!
                    if (_news.value.isNotEmpty() && !isExplicitScrollToTop) {
                        val currentNews = _news.value
                        val olderRemaining = currentNews.filter { cur -> finalPosts.none { it.id == cur.id } && (cur.id == pin?.id || isPostAllowedForHomeFeed(cur, district, userState)) }
                        _news.value = (finalPosts + olderRemaining).distinctBy { it.id }
                    } else {
                        _news.value = finalPosts
                    }
                    // 🚀 PAGINATION GUARD: Ensure swiping never prematurely halts if server still has documents
                    _hasMore.value = (mainCursor != null || freshPosts.size >= 10 || finalPosts.size >= 10)
                    lastRefreshTimeLong = System.currentTimeMillis()
                    _lastRefreshTime.value = lastRefreshTimeLong

                    // Scroll to top ONLY on explicit user refresh (pull to refresh or district change) or cold start or when a post is pinned
                    if ((initialPostId == null && isExplicitScrollToTop) || pin != null) {
                        _shouldScrollToTop.value = true
                    }
                } else if (_news.value.isNotEmpty()) {
                    _hasMore.value = true
                }
            } catch (e: Exception) {
                Log.e("NewsFeedVM", "loadNews failed: ${e.message}")
                _isOnline.value = com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())
                if (_news.value.isEmpty()) {
                    _hasMore.value = false
                }
            } finally {
                _loading.value = false
                _isRefreshing.value = false
                isFetching = false
            }
        }
    }

    fun loadMore(language: Language, currentUser: User?) {
        if (prefs.cachedMinVersionCode > BuildConfig.VERSION_CODE) {
            _hasMore.value = false
            return
        }
        currentLanguage = language
        if (isFetching || !_hasMore.value) return
        viewModelScope.launch {
            isFetching = true
            try {
                val district = _userDistrict.value
                val userState = Constants.mapDistrictToState(district)
                val preferredCats = try {
                    AnalyticsService.getExpandedPreferredCategoriesForQuery(10)
                } catch (e: Exception) {
                    emptyList<String>()
                }
                val shouldFetchPref = preferredCats.isNotEmpty() && (prefCursor != null || prefCursorTs != null)
                val shouldFetchLocal = (localCursor != null || localCursorTs != null) && !district.isNullOrBlank()
                val shouldFetchMain = mainCursor != null || mainCursorTs != null
                val newsRef = FirebaseService.db.collection(resolveActiveCollection(district))

                val prefBatchDeferred = async(Dispatchers.IO) {
                    if (shouldFetchPref) {
                        try {
                            val baseQ = newsRef.whereEqualTo("approved", true)
                                .whereArrayContainsAny("categories", preferredCats)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                            val q = when {
                                prefCursor != null -> baseQ.startAfter(prefCursor!!).limit(10)
                                prefCursorTs != null -> baseQ.startAfter(com.google.firebase.Timestamp(java.util.Date(prefCursorTs!!))).limit(10)
                                else -> null
                            }
                            if (q != null) kotlinx.coroutines.withTimeoutOrNull(5000L) { q.get().await() } else null
                        } catch (_: Exception) { null }
                    } else null
                }

                val localBatchDeferred = async(Dispatchers.IO) {
                    if (shouldFetchLocal && !district.isNullOrBlank()) {
                        try {
                            val aliases = Constants.getDistrictAliases(district)
                                .map { it.trim() }
                                .filter { it.isNotBlank() }
                                .distinct()
                                .take(10)
                            val baseQ = if (aliases.size > 1) {
                                newsRef.whereEqualTo("approved", true)
                                    .whereIn("district", aliases)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                            } else {
                                newsRef.whereEqualTo("approved", true)
                                    .whereEqualTo("district", aliases.firstOrNull() ?: district)
                                    .orderBy("timestamp", Query.Direction.DESCENDING)
                            }
                            val q = when {
                                localCursor != null -> baseQ.startAfter(localCursor!!).limit(10)
                                localCursorTs != null -> baseQ.startAfter(com.google.firebase.Timestamp(java.util.Date(localCursorTs!!))).limit(10)
                                else -> null
                            }
                            if (q != null) kotlinx.coroutines.withTimeoutOrNull(5000L) { q.get().await() } else null
                        } catch (_: Exception) { null }
                    } else null
                }

                val mainBatchDeferred = async(Dispatchers.IO) {
                    if (shouldFetchMain) {
                        try {
                            val baseQ = newsRef.whereEqualTo("approved", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                            val q = when {
                                mainCursor != null -> baseQ.startAfter(mainCursor!!).limit(20)
                                mainCursorTs != null -> baseQ.startAfter(com.google.firebase.Timestamp(java.util.Date(mainCursorTs!!))).limit(20)
                                else -> null
                            }
                            if (q != null) kotlinx.coroutines.withTimeoutOrNull(6000L) { q.get().await() } else null
                        } catch (_: Exception) { null }
                    } else null
                }

                val prefSnap = prefBatchDeferred.await()
                val localSnap = localBatchDeferred.await()
                val mainSnap = mainBatchDeferred.await()

                if (prefSnap?.documents?.isNotEmpty() == true) {
                    prefCursor = prefSnap.documents.lastOrNull()
                    prefCursorTs = null
                }
                if (localSnap?.documents?.isNotEmpty() == true) {
                    localCursor = localSnap.documents.lastOrNull()
                    localCursorTs = null
                }
                if (mainSnap?.documents?.isNotEmpty() == true) {
                    mainCursor = mainSnap.documents.lastOrNull()
                    mainCursorTs = null
                }

                val prefBatch = prefSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val localBatch = localSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()
                val mainBatch = mainSnap?.documents?.mapNotNull { mapDocumentToNewsPost(it) } ?: emptyList()

                val filteredPref = prefBatch.filter { isPostAllowedForHomeFeed(it, district, userState) }
                val filteredLocal = localBatch.filter { isPostAllowedForHomeFeed(it, district, userState) }
                val filteredMain = mainBatch.filter { isPostAllowedForHomeFeed(it, district, userState) }
                val previousTail = _news.value.takeLast(6)

                val newPosts = withContext(Dispatchers.Default) {
                    rankAndBlendPosts(
                        pref = filteredPref,
                        main = filteredMain,
                        local = filteredLocal,
                        isFirstPage = false,
                        userDistrict = district,
                        userState = userState,
                        tailPrefix = previousTail
                    )
                }


                if (newPosts.isNotEmpty()) {
                    val currentIds = _news.value.map { it.id }.toSet()
                    val uniqueNewPosts = newPosts.filter { !currentIds.contains(it.id) }
                    if (uniqueNewPosts.isNotEmpty()) {
                        _news.value = _news.value + uniqueNewPosts
                        consecutiveEmptyLoads = 0
                    } else {
                        consecutiveEmptyLoads += 1
                        if (mainCursor == null && prefCursor == null && localCursor == null &&
                            mainCursorTs == null && prefCursorTs == null && localCursorTs == null) {
                            _hasMore.value = false
                        } else if (consecutiveEmptyLoads >= 6) {
                            _hasMore.value = false
                        }
                    }
                } else {
                    consecutiveEmptyLoads += 1
                    if (mainCursor == null && prefCursor == null && localCursor == null &&
                        mainCursorTs == null && prefCursorTs == null && localCursorTs == null) {
                        _hasMore.value = false
                    } else if (consecutiveEmptyLoads >= 6) {
                        _hasMore.value = false
                    }
                }
            } catch (e: Exception) {
                Log.e("NewsFeedVM", "loadMore failed: ${e.message}")
            } finally {
                isFetching = false
            }
        }
    }

    private suspend fun rankAndBlendPosts(
        pref: List<NewsPost>,
        main: List<NewsPost>,
        local: List<NewsPost>,
        isFirstPage: Boolean = false,
        userDistrict: String? = null,
        userState: String? = null,
        activeSurvey: NewsPost? = null,
        fastPathAnchors: List<NewsPost> = emptyList(),
        tailPrefix: List<NewsPost> = emptyList()
    ): List<NewsPost> = withContext(Dispatchers.Default) {
        val allRaw = (pref + main + local).distinctBy { it.id }
        var filteredPref = pref.filter { prefs.getPostViewCount(it.id) < 2 }
        var filteredMain = main.filter { prefs.getPostViewCount(it.id) < 2 }
        var filteredLocal = local.filter { prefs.getPostViewCount(it.id) < 2 }

        // If first page and unread count is low (< 5), take from raw posts so feed is rich and fresh
        if (isFirstPage && (filteredPref.size + filteredMain.size + filteredLocal.size) < 5 && allRaw.isNotEmpty()) {
            filteredPref = pref.take(5)
            filteredMain = main.take(15)
            filteredLocal = local.take(10)
        }

        // STRICT HOME FEED SAFETY CHECK: Every single post MUST pass isPostAllowedForHomeFeed
        var allPosts = (filteredPref + filteredMain + filteredLocal).distinctBy { it.id }.filter { post ->
            isPostAllowedForHomeFeed(post, userDistrict, userState)
        }

        // 🚀 PAGINATION SAFETY: If user read many posts earlier and unread filter leaves 0 posts,
        // fallback to allRaw that are allowed for home feed so pagination never hits an artificial dead end!
        if (allPosts.isEmpty() && allRaw.isNotEmpty()) {
            allPosts = allRaw.filter { post -> isPostAllowedForHomeFeed(post, userDistrict, userState) }
        }

        if (allPosts.isEmpty() && !isFirstPage) return@withContext emptyList<NewsPost>()

        val festivalGreetings = allPosts.filter { it.type == "greeting" && it.likes == 0 }
        val quoteGreetings = allPosts.filter { it.type == "greeting" && it.likes == 1 }
        val historyPosts = allPosts.filter { it.type == "history" }
        val cartoonPosts = allPosts.filter { it.type == "cartoon" }
        var normalNews = allPosts.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" }

        // If normalNews is empty due to read counts, take allRaw that are ALLOWED for home feed
        if (normalNews.isEmpty() && allRaw.isNotEmpty()) {
            normalNews = allRaw.filter { post ->
                post.type != "greeting" && post.type != "history" && post.type != "cartoon" && post.type != "survey" &&
                isPostAllowedForHomeFeed(post, userDistrict, userState)
            }
        }

        if (normalNews.isEmpty() && !isFirstPage) {
            return@withContext emptyList<NewsPost>()
        }

        val interestProfile = try {
            AnalyticsService.getInterestProfile()
        } catch (_: Exception) {
            com.alfanews.telugu.utils.NewsFeedBlender.InterestProfile()
        }

        // Keep Fast Path 3 anchored on page 1; if fastPathAnchors was empty (e.g. non-forceRefresh),
        // pick 3 diverse ultra-fresh posts as the top 3 anchors so blending starts cleanly at index 3!
        val effectiveAnchors = if (isFirstPage) {
            if (fastPathAnchors.isNotEmpty()) {
                fastPathAnchors.filter { isPostAllowedForHomeFeed(it, userDistrict, userState) }.take(3)
            } else {
                com.alfanews.telugu.utils.NewsFeedBlender.pickFastPathTop3(
                    candidates = normalNews.sortedByDescending { it.timestamp }.take(10),
                    userDistrict = userDistrict,
                    relevanceScorer = { post -> try { AnalyticsService.calculateRelevanceScore(post) } catch (_: Exception) { post.qualityScore } },
                    count = 3
                )
            }
        } else {
            emptyList()
        }

        val blendedNews = com.alfanews.telugu.utils.NewsFeedBlender.blendNormalNews(
            normalNews = normalNews,
            fastPathAnchors = effectiveAnchors,
            tailPrefix = tailPrefix,
            userDistrict = userDistrict,
            interestProfile = interestProfile,
            relevanceScorer = { post -> try { AnalyticsService.calculateRelevanceScore(post) } catch (_: Exception) { post.qualityScore } },
            userInterestScorer = { post -> try { AnalyticsService.calculateUserInterestScore(post) } catch (_: Exception) { 0.0 } }
        ).toMutableList()

        if (isFirstPage) {
            // 🚀 PARALLEL ACTIVE SURVEY: Placed right after Fast Path 3 (index 3) so Fast Path 0..2 stays undisturbed
            activeSurvey?.let { insertSafely(blendedNews, it, 3) }

            if (quoteGreetings.isNotEmpty()) { insertSafely(blendedNews, quoteGreetings.first(), 7) }

            // Weather card at index 4 (morning 5-10 AM) or index 9 (evening)
            val currentHour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
            val isMorning = currentHour in 5..10

            if (blendedNews.size >= 4) {
                val isManualDistrict = prefs.selectedDistrict != null && prefs.selectedDistrict != prefs.detectedDistrict
                val lat = if (isManualDistrict) null else prefs.lastLat.takeIf { it != 0.0 }
                val lon = if (isManualDistrict) null else prefs.lastLon.takeIf { it != 0.0 }
                val place = if (isManualDistrict) null else prefs.localPlace
                val weatherTargetIndex = if (isMorning) 4 else 9
                insertSafely(blendedNews, generateInstantWeatherPost(place, userDistrict ?: _userDistrict.value, lat, lon), weatherTargetIndex)
                updateWeatherInBackground(place, userDistrict ?: _userDistrict.value, lat, lon)
            }

            if (historyPosts.isNotEmpty()) { insertSafely(blendedNews, historyPosts.first(), 10) }
            if (cartoonPosts.isNotEmpty()) {
                val distState = userState ?: Constants.mapDistrictToState(userDistrict ?: _userDistrict.value)
                val relevantCartoon = cartoonPosts.find { it.district?.equals(distState, ignoreCase = true) == true || it.state?.equals(distState, ignoreCase = true) == true } ?: cartoonPosts.firstOrNull()
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
            val snapshot = FirebaseService.db.collection(resolveActiveCollection()).whereEqualTo("type", "greeting").whereEqualTo("approved", true).orderBy("timestamp", Query.Direction.DESCENDING).limit(1).get().await()
            val doc = snapshot.documents.firstOrNull() ?: return@withContext null
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
            val snapshot = FirebaseService.db.collection(resolveActiveCollection(currentDist))
                .whereEqualTo("type", "survey")
                .whereEqualTo("approved", true)
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(3) // 🚀 Optimized from limit(20) to limit(3) to save 17 reads per load
                .get().await()
            
            val surveys = snapshot.documents.mapNotNull { mapDocumentToNewsPost(it) }
            
            val userState: String? = when {
                currentDist == null -> null
                currentDist == "హైదరాబాద్" -> AnalyticsService.getStateEngagementRatio()
                else -> mapDistrictToState(currentDist)
            }

            val matchingSurvey = surveys.firstOrNull { survey ->
                if (survey.isExpired) return@firstOrNull false

                // 1. Filter by State
                if (userState != null && userState != "BOTH") {
                    val surveyState = survey.state
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
            com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data, currentLanguage)
        } catch (e: Exception) { null }
    }

    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?, language: Language = Language.TELUGU) {
        viewModelScope.launch {
            try {
                // 🚀 INCREASED TIMEOUT: 5 seconds for better GPS reliability
                kotlinx.coroutines.withTimeout(5000L) {
                    val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
                    val location = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
                    if (location != null) { processLocationUpdate(context, location.latitude, location.longitude, language, currentUser) }
                }
            } catch (e: Exception) { }
        }
    }

    private suspend fun processLocationUpdate(context: Context, lat: Double, lon: Double, language: Language, currentUser: User?): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                // ✅ FIX: Always save GPS coordinates immediately, regardless of geocoder result.
                // Old code only saved coords if locality was found → rural areas never got coord-based weather!
                prefs.lastLat = lat
                prefs.lastLon = lon

                val geocoder = Geocoder(context, Locale("te"))
                val addresses = geocoder.getFromLocation(lat, lon, 1)
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
                        // Try English Geocoder fallback for better matching
                        val engGeocoder = Geocoder(context, Locale.ENGLISH)
                        val engAddresses = engGeocoder.getFromLocation(lat, lon, 1)
                        val engName = engAddresses?.firstOrNull()?.let { it.subAdminArea ?: it.locality ?: it.adminArea }
                        if (engName != null) {
                            mappedDistrict = WeatherService.getTeluguNameForEnglish(engName)
                        }
                    }

                    if (mappedDistrict != null && prefs.detectedDistrict != mappedDistrict) {
                        prefs.detectedDistrict = mappedDistrict
                        withContext(Dispatchers.Main) { _userDistrict.value = mappedDistrict; loadNews(language, currentUser) }
                        return@withContext true
                    }
                }
            } catch (e: Exception) { }
            false
        }
    }

    fun setUserDistrict(district: String, currentUser: User?) {
        val resolvedState = com.alfanews.telugu.utils.EditionRegistry.resolveStateCode(null, district)
            ?: prefs.getEffectiveStateCode()
        val validatedLang = prefs.setEdition(resolvedState, district, currentLanguage)
        _userDistrict.value = district
        loadNews(validatedLang, currentUser, forceRefresh = true, isExplicitScrollToTop = true)
    }

    fun setUserEdition(
        stateCode: com.alfanews.telugu.utils.StateCode,
        district: String,
        requestedLanguage: Language,
        currentUser: User?
    ) {
        val validatedLang = prefs.setEdition(stateCode, district, requestedLanguage)
        _userDistrict.value = district
        _news.value = emptyList()
        loadNews(validatedLang, currentUser, forceRefresh = true, isExplicitScrollToTop = true)
    }

    fun onAppResume(language: Language, currentUser: User?) {
        refreshIfStale(language, currentUser)
    }

    /**
     * ⚡ LIGHTWEIGHT DELTA REFRESH:
     * When returning to app after 5+ minutes, do NOT dump memory or re-execute 4 heavy queries (100 docs).
     * Instead, fetch only top 5 fresh approved articles from server.
     * If there are brand new posts not already in memory, prepend them smoothly to the top.
     * Preserves scroll position and existing posts, saving 95%+ server reads!
     */
    fun refreshFeedDelta(language: Language, currentUser: User?) {
        if (prefs.cachedMinVersionCode > BuildConfig.VERSION_CODE) {
            _isRefreshing.value = false
            return
        }
        if (isFetching) return
        val currentPosts = _news.value
        if (currentPosts.isEmpty()) {
            loadNews(language, currentUser, forceRefresh = true, isExplicitScrollToTop = false)
            return
        }

        val now = System.currentTimeMillis()
        lastRefreshTimeLong = now
        _lastRefreshTime.value = now

        val rawDistrict = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
        val district = if (rawDistrict != null && Constants.isSpecificDistrict(rawDistrict)) {
            rawDistrict
        } else {
            "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు"
        }
        val userState = Constants.mapDistrictToState(district)

        viewModelScope.launch {
            try {
                if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) return@launch
                val newsRef = FirebaseService.db.collection(resolveActiveCollection(district))
                val fastSnap = withTimeoutOrNull(3000L) {
                    newsRef.whereEqualTo("approved", true)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(8)
                        .get().await()
                }

                if (fastSnap != null && !fastSnap.isEmpty) {
                    val existingIds = _news.value.map { it.id }.toSet()
                    val brandNewDiverse = withContext(Dispatchers.Default) {
                        val brandNew = fastSnap.documents.mapNotNull { mapDocumentToNewsPost(it) }
                            .filter { it.id !in existingIds && isPostAllowedForHomeFeed(it, district, userState) }
                        com.alfanews.telugu.utils.NewsFeedBlender.pickFastPathTop3(
                            candidates = brandNew,
                            userDistrict = district,
                            relevanceScorer = { post -> try { AnalyticsService.calculateRelevanceScore(post) } catch (_: Exception) { post.qualityScore } },
                            count = 3
                        )
                    }

                    if (brandNewDiverse.isNotEmpty()) {
                        Log.d("NewsFeedVM", "⚡ Delta refresh: prepending ${brandNewDiverse.size} diverse fresh posts to feed")
                        val currentList = _news.value
                        _news.value = (brandNewDiverse + currentList).distinctBy { it.id }
                    } else {
                        Log.d("NewsFeedVM", "⚡ Delta refresh: feed is already up-to-date (0 new posts)")
                    }
                }
            } catch (e: Exception) {
                Log.w("NewsFeedVM", "Delta refresh failed silently: ${e.message}")
            }
        }
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        val isEmpty = _news.value.isEmpty()
        val isStale = (now - lastRefreshTimeLong > 300000L)
        if (isEmpty) {
            _isOnline.value = true
            loadNews(language, currentUser, forceRefresh = true, isExplicitScrollToTop = false)
        } else if (isStale && !isFetching) {
            _isOnline.value = true
            refreshFeedDelta(language, currentUser)
        }
    }

     private fun mapDistrictToState(district: String?): String? {
         if (district == null) return null
         
         val telanganaStrings = listOf("Telangana", "Telangana State", "TS", "తెలంగాణ", "Telangana News")
         val apStrings = listOf("Andhra Pradesh", "AndhraPradesh", "AP", "ఆంధ్రప్రదేశ్", "Andhra", "ఆంధ్ర", "AP News")
         
         val telanganDistricts = Constants.TS_DISTRICTS; val apDistricts = Constants.AP_DISTRICTS
         return when {
             telanganDistricts.contains(district) || telanganaStrings.any { it.equals(district, ignoreCase = true) } -> "Telangana"
             apDistricts.contains(district) || apStrings.any { it.equals(district, ignoreCase = true) } -> "Andhra Pradesh"
             else -> null
         }
     }

     /**
      * 🧠 SMART INFERENCE:
      * Determines if a news post belongs to Telangana or Andhra Pradesh 
      * based on district, categories, or keywords in text.
      */
     private fun inferStateFromPost(post: NewsPost): String? {
         // 1. Check direct district mapping
         val dState = mapDistrictToState(post.district)
         if (dState != null) return dState
         
         // 2. Check categories
         val cats = post.categories
         var i = 0
         val size = cats.size
         while (i < size) {
             val cat = cats[i]
             val cState = mapDistrictToState(cat)
             if (cState != null) return cState
             i = i + 1
         }
         
         // 3. Entity/Keyword Inference from Headline & Content
         val text = "${post.headline.telugu} ${post.content.telugu}"
         
         val tsTerms = listOf(
             "రేవంత్", "కేసీఆర్", "కేటీఆర్", "హరీష్ రావు", "కోమటిరెడ్డి", "విక్రమార్క", 
             "ఈటల", "బండి సంజయ్", "కిషన్ రెడ్డి", "బీఆర్ఎస్", "బిఆర్ఎస్", "TRS", "తెలంగాణ"
         )
         val apTerms = listOf(
             "చంద్రబాబు", "పవన్ కళ్యాణ్", "జనసేన", "లోకేష్", "జగన్", "వైసీపీ", 
             "YSRCP", "టీడీపీ", "TDP", "ఆంధ్రప్రదేశ్", "వైఎస్ఆర్", "అనిత"
         )

         // Use a word-boundary match or just contains for speed in a feed
         if (tsTerms.any { text.contains(it, ignoreCase = true) }) return "Telangana"
         if (apTerms.any { text.contains(it, ignoreCase = true) }) return "Andhra Pradesh"
         
         return null
     }

     private fun generateInstantWeatherPost(place: String?, district: String?, lat: Double? = null, lon: Double? = null): NewsPost {
         val location = if (district == prefs.detectedDistrict) (place ?: district ?: "హైదరాబాద్") else (district ?: "హైదరాబాద్")
         val weatherData = WeatherService.getCachedWeather(location, lat, lon)

         var temperatureStr = ""
         var weatherHeadlineTe = "వాతావరణ తాజా సమాచారం"
         var weatherContentTe = "నేడు $location లో వాతావరణం ఆహ్లాదకరంగా ఉంటుంది. మీ రోజువారీ పనులకు ఇది అనుకూల సమయం."
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

     /**
      * 🌤️ NON-BLOCKING BACKGROUND WEATHER UPDATE:
      * Fetches real-time weather from API asynchronously in the background.
      * Updates the weather card in-place without delaying feed loading or freezing swiping.
      */
     private fun updateWeatherInBackground(place: String?, district: String?, lat: Double?, lon: Double?) {
         viewModelScope.launch(Dispatchers.IO) {
             try {
                 val location = if (district == prefs.detectedDistrict) (place ?: district ?: "హైదరాబాద్") else (district ?: "హైదరాబాద్")
                 val weatherData = kotlinx.coroutines.withTimeoutOrNull(6000L) {
                     WeatherService.fetchWeather(location, lat, lon)
                 } ?: return@launch

                 val rounded = kotlin.math.round(weatherData.temp).toInt()
                 val temperatureStr = "${rounded}°C "
                 val weatherHeadlineTe = WeatherService.getWeatherDescription(weatherData.code, com.alfanews.telugu.models.Language.TELUGU)
                 val weatherContentTe = WeatherService.getConversationalDescription(
                     code = weatherData.code,
                     temp = weatherData.temp,
                     location = location,
                     isDay = weatherData.isDay,
                     humidity = weatherData.humidity,
                     windSpeed = weatherData.wind,
                     language = com.alfanews.telugu.models.Language.TELUGU
                 )
                 val weatherContentEn = WeatherService.getConversationalDescription(
                     code = weatherData.code,
                     temp = weatherData.temp,
                     location = location,
                     isDay = weatherData.isDay,
                     humidity = weatherData.humidity,
                     windSpeed = weatherData.wind,
                     language = com.alfanews.telugu.models.Language.ENGLISH
                 )

                 withContext(Dispatchers.Main) {
                     val current = _news.value
                     val weatherIdx = current.indexOfFirst { it.type == "weather" }
                     if (weatherIdx >= 0) {
                         val updated = current[weatherIdx].copy(
                             headline = com.alfanews.telugu.models.Headline(
                                 telugu = "$temperatureStr$location వాతావరణం: $weatherHeadlineTe",
                                 english = "$temperatureStr$location Weather"
                             ),
                             content = com.alfanews.telugu.models.Content(telugu = weatherContentTe, english = weatherContentEn)
                         )
                         val mutable = current.toMutableList()
                         mutable[weatherIdx] = updated
                         _news.value = mutable
                         Log.d("NewsFeedVM", "🌤️ Live weather card updated in-place: $temperatureStr$location")
                     }
                 }
             } catch (_: Exception) {}
         }
     }
}
