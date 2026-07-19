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
                    Log.d("NewsFeedVM", "Loading local ads from cache for $district")
                    val type = object : TypeToken<List<com.alfanews.telugu.models.LocalAd>>() {}.type
                    gson.fromJson<List<com.alfanews.telugu.models.LocalAd>>(cachedJson, type)
                } else {
                    Log.d("NewsFeedVM", "Fetching local ads from Firestore for $district")
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
    private var lastRefreshTimeLong: Long = 0
    private var consecutiveEmptyLoads = 0

    private val globalDistricts = listOf(
        "State", "National", "International", "AndhraPradesh", "Telangana",
        "Andhra Pradesh", "Telangana State", "India", "World", "AP", "TS", 
        "State News", "National News", "General", "Andhra", "Global",
        "హైదరాబాద్", "తెలంగాణ", "ఆంధ్రప్రదేశ్", "భారతదేశం", "ప్రపంచం", "జాతీయం",
        "అంతర్జాతీయం", "రాష్ట్రం", "రాష్ట్ర వార్తలు", "Hyderabad"
    )

    private val strictlyGlobalKeywords = listOf(
        "సినిమా", "స్పోర్ట్స్", "జాతీయం", "అంతర్జాతీయం", "వ్యాపారం", 
        "ఆరోగ్యం", "విద్య", "టెక్నాలజీ", "వ్యవసాయం", "భక్తి", 
        "వినోదం", "ప్రపంచం", "క్రైమ్", "లైఫ్ స్టైల్", "జనరల్", "రాష్ట్రం",
        "రాష్ట్ర వార్తలు", "ముఖ్యాంశాలు", "బ్రేకింగ్", "వైరల్", "తాజా వార్తలు",
        "ఆంధ్రప్రదేశ్", "తెలంగాణ", "భారతదేశం", "రాజకీయం", "సినిమా వార్తలు"
    )

    private fun isGlobalCategory(category: String): Boolean {
        return strictlyGlobalKeywords.any { kw -> category.contains(kw, ignoreCase = true) }
    }

    private val FETCH_LIMIT = 20 

      fun loadNews(language: Language, currentUser: User?, initialPostId: String? = null) {
          currentLanguage = language
          if (isFetching && initialPostId == null) return
          if (_news.value.isEmpty()) {
              _loading.value = true 
          }
          isFetching = true

           viewModelScope.launch {
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

                   if (initialPostId == null) {
                       prefCursor = null
                       mainCursor = null
                       localCursor = null
                       _hasMore.value = true
                       consecutiveEmptyLoads = 0
                   }

                  val district = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
                  _userDistrict.value = district
                  
                  if (district != null) {
                      loadLocalAds(district)
                  }

                   // 🚀 FAST PATH: Quick top 5 news to dismiss splash screen
                   val fastBatchJob = async {
                       try {
                           fetchFilteredBatch(FirebaseService.db.collection("news"), null, district, excludeDistricts = true, limit = 5)
                       } catch (e: Exception) { Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null) }
                   }
                   
                   val greetingBatchDeferred = async {
                       if (initialPostId == null) {
                           try { 
                               val post = fetchGreetingPost()
                               if (post != null && prefs.getPostViewCount(post.id) < 2) post else null
                           } catch (e: Exception) { null }
                       } else null
                   }

                   val fastBatch = fastBatchJob.await()
                   val initialGreeting = greetingBatchDeferred.await()
                   
                   if (fastBatch.first.isNotEmpty() || initialGreeting != null) {
                       val initialList = mutableListOf<NewsPost>()
                       initialGreeting?.let { initialList.add(it) }
                       initialList.addAll(fastBatch.first)
                       
                       // 🔄 BACKGROUND REFRESH: Only apply fast batch if the list is currently empty.
                       // This prevents the "blank screen" or "jump" issue when news is refreshed in the background.
                       if (_news.value.isEmpty()) {
                           _news.value = initialList.distinctBy { it.id }
                           _loading.value = false 
                       }
                   }

                   // 🧠 BACKGROUND PROCESSING: Heavy 40/30/30 Mixing
                   val isNewUser = district == null
                   val preferredCats = try { AnalyticsService.getUserPreferredCategories().take(10) } catch (e: Exception) { emptyList<String>() }

                   val prefBatchDeferred = async {
                       if (preferredCats.isNotEmpty() && !isNewUser) {
                           try {
                               // 🚀 FIX: Remove district filter for preferred categories news.
                               // This allows global topics like Cinema/Sports (often tagged Hyderabad or State)
                               // to appear for all users regardless of their location.
                               fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), null, null, excludeDistricts = false)
                           } catch (e: Exception) { Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null) }
                       } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                   }

                   val localBatchDeferred = async {
                       if (district != null) {
                           try {
                               fetchFilteredBatch(FirebaseService.db.collection("news"), null, district, excludeDistricts = false)
                           } catch (e: Exception) { Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null) }
                       } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                   }

                   val mainBatchDeferred = async {
                       try {
                           fetchFilteredBatch(FirebaseService.db.collection("news"), null, district, excludeDistricts = true)
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
                               // 🚀 FIX: Remove district filter for preferred categories news in extra batch too
                               fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, null, excludeDistricts = false)
                           } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                       }
                       val extraLocalDeferred = async {
                           if (localCursor != null && district != null) {
                               fetchFilteredBatch(FirebaseService.db.collection("news"), localCursor, district, excludeDistricts = false)
                           } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                       }
                       val extraMainDeferred = async {
                           if (mainCursor != null) {
                               fetchFilteredBatch(FirebaseService.db.collection("news"), mainCursor, district, excludeDistricts = true)
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

                   if (finalPosts.isEmpty() && mainCursor == null && prefCursor == null && localCursor == null) {
                       _hasMore.value = false
                   }

                  initialGreeting?.let {
                      finalPosts = (listOf(it) + finalPosts).distinctBy { it.id }
                  }

                   if (initialPostId != null) {
                       try {
                           val doc = FirebaseService.db.collection("news").document(initialPostId).get().await()
                           if (doc.exists()) {
                               mapDocumentToNewsPost(doc)?.let { post ->
                                   finalPosts = (listOf(post) + finalPosts).distinctBy { it.id }
                               }
                           }
                       } catch (e: Exception) { }
                   }

                    _news.value = finalPosts.distinctBy { it.id }
                    
                    // ✅ FIX (Bug 6): Initial load లో కూడా post view count increment చేయాలి
                    // (loadMore() లో ఇది ఉంది, కానీ loadNews() లో missing గా ఉంది)
                    if (finalPosts.isNotEmpty()) {
                        finalPosts.forEach { post ->
                            if (post.type == "news" || post.type == "greeting") {
                                prefs.incrementPostViewCount(post.id)
                            }
                        }
                    }
                    // ✅ FIX (Bug 1): logBulkCategoryViews ఇక్కడ నుండి తొలగించబడింది.
                    // User చదవని posts categories కి score ఇవ్వడం wrong.
                    // Actual engagement మాత్రమే track చేయాలి (logPostEngagement, logLongView).

                   if (initialPostId == null) {
                       _shouldScrollToTop.value = true
                   }
                   lastRefreshTimeLong = System.currentTimeMillis()

              } catch (e: Exception) {
                  if (_news.value.isEmpty()) _hasMore.value = false
              } finally {
                  _loading.value = false
                  isFetching = false
              }
          }
      }

    fun loadMore(language: Language, currentUser: User?) {
         currentLanguage = language
         if (isFetching || !_hasMore.value) return
         viewModelScope.launch {
             isFetching = true
             try {
                 val district = _userDistrict.value
                 val preferredCats = AnalyticsService.getUserPreferredCategories().take(10)
                 val shouldFetchPref = preferredCats.isNotEmpty() && (prefCursor != null)
                 val shouldFetchLocal = localCursor != null && district != null
                 val shouldFetchMain = mainCursor != null
                 
                 val prefBatchDeferred = async {
                     if (shouldFetchPref) {
                         // 🚀 FIX: Remove district filter for preferred categories in loadMore as well
                         fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, null, excludeDistricts = false)
                     } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                 }
                 val localBatchDeferred = async {
                     if (shouldFetchLocal) {
                         fetchFilteredBatch(FirebaseService.db.collection("news"), localCursor, district, excludeDistricts = false)
                     } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                 }
                 val mainBatchDeferred = async {
                     if (shouldFetchMain) {
                         fetchFilteredBatch(FirebaseService.db.collection("news"), mainCursor, district, excludeDistricts = true)
                     } else Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                 }

                 val prefBatch = prefBatchDeferred.await()
                 val localBatch = localBatchDeferred.await()
                 val mainBatch = mainBatchDeferred.await()

                 val newPosts = withContext(Dispatchers.Default) {
                     rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first, isFirstPage = false)
                 }

                 newPosts.forEach { post ->
                     if (post.type == "news" || post.type == "greeting") {
                         prefs.incrementPostViewCount(post.id)
                     }
                 }

                 prefCursor = prefBatch.second
                 localCursor = localBatch.second
                 mainCursor = mainBatch.second

                  if (newPosts.isNotEmpty()) {
                       try {
                           // ✅ FIX (Bug 1): logBulkCategoryViews loadMore నుండి తొలగించబడింది.
                           // Scroll చేసి చూడటం engagement కాదు — actual read/long-view మాత్రమే track చేయాలి.
                       } catch (e: Exception) { }
                      
                      val currentIds = _news.value.map { it.id }.toSet()
                      val uniqueNewPosts = newPosts.filter { !currentIds.contains(it.id) }
                      if (uniqueNewPosts.isNotEmpty()) {
                          _news.value = _news.value + uniqueNewPosts
                           consecutiveEmptyLoads = 0
                      } else {
                           consecutiveEmptyLoads += 1
                           if (mainCursor == null && prefCursor == null && localCursor == null) {
                               _hasMore.value = false
                           } else if (consecutiveEmptyLoads >= 4) {
                               _hasMore.value = false
                           }
                      }
                  } else {
                      if (mainCursor == null && prefCursor == null && localCursor == null) {
                          _hasMore.value = false
                      }
                  }
             } catch (e: Exception) {
             } finally {
                 isFetching = false
             }
         }
     }

     private suspend fun fetchFilteredBatch(baseQuery: Query, cursor: DocumentSnapshot?, district: String?, excludeDistricts: Boolean, limit: Int = FETCH_LIMIT, userState: String? = null): Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?> {
            var currentCursor = cursor
            var query = baseQuery.whereEqualTo("approved", true)
            if (excludeDistricts) {
                val generalCats = globalDistricts.distinct().take(30)
                query = query.whereIn("district", generalCats)
            } else if (district != null) {
                // 🚀 FIX: Use whereEqualTo("district", ...) instead of whereArrayContains("categories", ...)
                // to avoid Firestore conflict when baseQuery already has an array filter (like whereArrayContainsAny).
                query = query.whereEqualTo("district", district)
            }
            query = query.orderBy("timestamp", Query.Direction.DESCENDING).limit(limit.toLong())
            if (currentCursor != null) query = query.startAfter(currentCursor)
            
            try {
                val snapshot = query.get().await()
                if (snapshot.isEmpty) {
                    // ✅ FIX (Bug 3): Fallback query కూడా userState filter apply చేయడం
                    // పాత కోడ్: district filter లేకుండా any approved news fetch చేసేది
                    var fallbackQuery = FirebaseService.db.collection("news")
                        .whereEqualTo("approved", true)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                        .limit(limit.toLong())
                    
                    if (currentCursor != null) fallbackQuery = fallbackQuery.startAfter(currentCursor)
                    
                    val fallbackSnapshot = fallbackQuery.get().await()
                    if (fallbackSnapshot.isEmpty) {
                        return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
                    }
                    
                    // userState filter apply చేసి fallback batch filter చేయడం
                    val batch = fallbackSnapshot.documents.mapNotNull { doc -> mapDocumentToNewsPost(doc) }
                        .filter { post -> isPostAllowedForState(post, userState) }
                    currentCursor = fallbackSnapshot.documents.lastOrNull()
                    return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
                }
                val batch = snapshot.documents.mapNotNull { doc ->
                    mapDocumentToNewsPost(doc)
                }
                currentCursor = snapshot.documents.lastOrNull()
                return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
            } catch (e: Exception) {
                if (excludeDistricts) {
                    try {
                        var fallbackQuery = baseQuery.whereEqualTo("approved", true)
                            .orderBy("timestamp", Query.Direction.DESCENDING).limit(limit.toLong())
                        if (currentCursor != null) fallbackQuery = fallbackQuery.startAfter(currentCursor)
                        val fallbackSnapshot = fallbackQuery.get().await()
                        if (!fallbackSnapshot.isEmpty) {
                            val batch = fallbackSnapshot.documents.mapNotNull { doc ->
                                mapDocumentToNewsPost(doc)
                            }
                            currentCursor = fallbackSnapshot.documents.lastOrNull()
                            return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
                        }
                    } catch (ex: Exception) {
                        // ignore and throw original exception
                    }
                }
                throw e
            }
        }

    /**
     * ✅ NEW (Bug 3 & 5): ఒక post వినియోగదారు రాష్ట్రం కి allow చేయాలా మో చెక్ చేస్తుంది.
     * @param post The news post to check
     * @param userState వినియోగద఺రు రాష్ట్రం: "Telangana", "Andhra Pradesh", "BOTH", లేదా null (new user)
     */
    private fun isPostAllowedForState(post: NewsPost, userState: String?): Boolean {
        // New users (district detect కాలేదు) కి అన్నీ చూపించు
        if (userState == null || userState == "BOTH") return true
        val postState = inferStateFromPost(post) ?: return true // state కిగోణాలని రాని posts అందరికీ చూపించు
        return postState == userState
    }


       private suspend fun rankAndBlendPosts(pref: List<NewsPost>, main: List<NewsPost>, local: List<NewsPost>, isFirstPage: Boolean = false): List<NewsPost> = withContext(Dispatchers.Default) {
            val allRaw = (pref + main + local).distinctBy { it.id }
            var filteredPref = pref.filter { prefs.getPostViewCount(it.id) < 2 }
            var filteredMain = main.filter { prefs.getPostViewCount(it.id) < 2 }
            var filteredLocal = local.filter { prefs.getPostViewCount(it.id) < 2 }

            // 🚀 ROBUSTNESS: If everything is filtered out because it's "seen", 
            // relax the filter to show recently seen news on the first page.
            if (isFirstPage && filteredPref.isEmpty() && filteredMain.isEmpty() && filteredLocal.isEmpty() && allRaw.isNotEmpty()) {
                filteredPref = pref.take(5)
                filteredMain = main.take(10)
                filteredLocal = local.take(10)
            }

            val allPosts = (filteredPref + filteredMain + filteredLocal).distinctBy { it.id }.filter { post ->
                if (post.type == "survey") {
                    if (post.isReporter) {
                        val currentDist = _userDistrict.value
                        val matchesUserDistrict = currentDist != null && 
                            (post.district == currentDist || post.categories.contains(currentDist))
                        if (!matchesUserDistrict) return@filter false
                    }
                }
                if (post.type != "news") return@filter true
                
                val currentDist = _userDistrict.value
                
                // 1. 🛡️ REPORTER DISTRICT NEWS FILTER
                // Only show 'District News' from reporters if it's the user's own district.
                // 🚀 NEW USER FIX: If district is null (not yet detected), show all district news
                // so the feed is never empty for new users.
                val isDistrictNewsCategory = post.categories.contains("జిల్లా వార్త")
                if (isDistrictNewsCategory && post.isReporter) {
                    if (currentDist != null) {
                        val matchesUserDistrict = (post.district == currentDist || post.categories.contains(currentDist))
                        if (!matchesUserDistrict) return@filter false
                    }
                    // If currentDist is null, we allow the post through (Universal view for new users)
                }

                // 2. 🏛️ POLITICAL FILTER (State-Based)
                // Telangana users -> Only Telangana politics
                // AP users -> Only AP politics
                // Hyderabad users -> Based on engagement ratio (Bug 4 fix)
                val isPolitics = post.categories.any { it.contains("రాజకీయం", true) || it.contains("Politics", true) } || 
                                 post.category?.contains("రాజకీయం", true) == true || post.category?.contains("Politics", true) == true
                
                val userState: String? = when {
                    currentDist == null -> null // New user — show everything
                    currentDist == "హైదరాబాద్" -> AnalyticsService.getStateEngagementRatio() // ✅ Bug 4: Engagement-based
                    else -> mapDistrictToState(currentDist)
                }

                // 3. 🏛️ POLITICS: State-based filter
                if (isPolitics && userState != null && userState != "BOTH") {
                    val postState = inferStateFromPost(post)
                    // If user is from a state and post is from a different state, filter it out.
                    // National/General politics (postState == null) are kept for everyone.
                    if (postState != null && postState != userState) {
                        return@filter false
                    }
                }

                // 4. ✅ NEW (Bug 5): STATE FILTER FOR ALL NEWS (not just politics)
                // TS districts లో AP district news రాకూడదు, AP districts లో TS news రాకూడదు.
                // కానీ: isGlobal posts, జిల్లా వార్త కాని news కి apply చేయం (cinema/sports/etc)
                // New users (userState == null) కి filter apply చేయం
                if (userState != null && userState != "BOTH") {
                    val postState = inferStateFromPost(post)
                    if (postState != null && postState != userState) {
                        // TS/AP specific district-level post అయితే filter
                        // కానీ isGlobal = true అయిన posts అందరికీ చూపించాలి
                        if (!post.isGlobal) {
                            return@filter false
                        }
                    }
                }
                
                true
            }

           if (allPosts.isEmpty() && !isFirstPage) return@withContext emptyList<NewsPost>()

           val festivalGreetings = allPosts.filter { it.type == "greeting" && it.likes == 0 }
           val quoteGreetings = allPosts.filter { it.type == "greeting" && it.likes == 1 }
           val historyPosts = allPosts.filter { it.type == "history" }
           val cartoonPosts = allPosts.filter { it.type == "cartoon" }
           val normalNews = allPosts.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" && it.type != "survey" }

           if (normalNews.isEmpty() && !isFirstPage) {
               return@withContext emptyList<NewsPost>() 
           }

           val totalToRank = normalNews.size
           val freshCount = if (totalToRank > 0) maxOf(1, (totalToRank * 0.4).toInt()) else 0
           val personalizedCount = if (totalToRank > 0) maxOf(1, (totalToRank * 0.3).toInt()) else 0
           val discoveryCount = if (totalToRank > 0) maxOf(1, (totalToRank * 0.3).toInt()) else 0

           val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (e: Exception) { emptySet() }

           // 🚀 1. Separate "Fresh" (General) and Local news
           // Per user request: Everything except 'District News' category should be in the fresh section
           val generalFreshNews = normalNews.filter { post ->
               !post.categories.contains("జిల్లా వార్త")
           }
           
           // 🚀 2. Slots 2-6 (Index 1-5): Top 5 General Fresh News (Preferred categories prioritized)
           val preferredGeneral = generalFreshNews.filter { post -> post.categories.any { it in preferredCategories } }
               .sortedByDescending { it.timestamp }
           val otherGeneral = generalFreshNews.filter { it !in preferredGeneral }
               .sortedByDescending { it.timestamp }
           
           val top5Fresh = (preferredGeneral + otherGeneral).take(5)
           val top5Ids = top5Fresh.map { it.id }.toSet()

           // 🚀 3. Process remaining news for the rest of the feed
           val remainingNormal = normalNews.filter { it.id !in top5Ids }
           val freshCountAdjusted = if (freshCount > 5) freshCount - 5 else 0
           
           val freshNewsRemaining = remainingNormal.sortedByDescending { it.timestamp }.take(freshCountAdjusted)
           val freshIdsTotal = (top5Ids + freshNewsRemaining.map { it.id }).toSet()

           val scoredNews = remainingNormal.filter { it.id !in freshIdsTotal }.map { post ->
               post to (try { AnalyticsService.calculateRelevanceScore(post) } catch (e: Exception) { 0.0 })
           }.sortedByDescending { it.second }.take(personalizedCount).map { it.first }
           val personalizedIds = scoredNews.map { it.id }.toSet()

           val discoveryNews = remainingNormal.filter { it.id !in freshIdsTotal && it.id !in personalizedIds }
               .filter { post -> post.categories.none { it in preferredCategories } }.shuffled().take(discoveryCount)

           val blendedNews = (top5Fresh + freshNewsRemaining + scoredNews + discoveryNews).toMutableList()

           if (isFirstPage) {
               val activeSurvey = fetchActiveSurvey()

               fun insertSafely(list: MutableList<NewsPost>, post: NewsPost, targetIdx: Int) {
                   val actualIdx = if (targetIdx >= list.size) list.size else targetIdx
                   list.add(actualIdx, post)
               }
               
               // Inject active survey at 3rd card (index 2)
               activeSurvey?.let { insertSafely(blendedNews, it, 2) }

               if (quoteGreetings.isNotEmpty()) { insertSafely(blendedNews, quoteGreetings.first(), 7) }
               
               // ✅ WEATHER CARD FIX:
               // Moved to index 9 (was 8) due to survey at index 2
               if (blendedNews.size >= 5) {
                   val lat = prefs.lastLat.takeIf { it != 0.0 }
                   val lon = prefs.lastLon.takeIf { it != 0.0 }
                   insertSafely(blendedNews, generateWeatherPost(prefs.localPlace, _userDistrict.value, lat, lon), 9)
               }

               if (historyPosts.isNotEmpty()) { insertSafely(blendedNews, historyPosts.first(), 10) }
               if (cartoonPosts.isNotEmpty()) {
                   val userDist = _userDistrict.value
                   val userState = mapDistrictToState(userDist)
                   val relevantCartoon = cartoonPosts.find { it.district?.equals(userState, ignoreCase = true) == true } ?: cartoonPosts.firstOrNull()
                   relevantCartoon?.let { insertSafely(blendedNews, it, 13) }
               }
               if (festivalGreetings.isNotEmpty()) { blendedNews.add(0, festivalGreetings.first()) }
           }
          blendedNews
      }

    private suspend fun fetchGreetingPost(): NewsPost? = withContext(Dispatchers.IO) {
        try {
            val snapshot = FirebaseService.db.collection("news").whereEqualTo("type", "greeting").whereEqualTo("approved", true).orderBy("timestamp", Query.Direction.DESCENDING).limit(1).get().await()
            val doc = snapshot.documents.firstOrNull() ?: return@withContext null
            mapDocumentToNewsPost(doc)
        } catch (e: Exception) { null }
    }

    private suspend fun fetchActiveSurvey(): NewsPost? = withContext(Dispatchers.IO) {
        try {
            val fiveDaysAgo = System.currentTimeMillis() - (5 * 24 * 60 * 60 * 1000L)
            val snapshot = FirebaseService.db.collection("news")
                .whereEqualTo("type", "survey")
                .whereEqualTo("approved", true)
                .whereGreaterThan("timestamp", fiveDaysAgo)
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(1)
                .get().await()
            
            val doc = snapshot.documents.firstOrNull() ?: return@withContext null
            val survey = mapDocumentToNewsPost(doc)
            
            // Filter if already answered (tracked in PreferenceManager)
            if (survey != null && prefs.isSurveyAnswered(survey.id)) null else survey
        } catch (e: Exception) {
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
                else -> System.currentTimeMillis()
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
                realVotesCount = realVotesCountVal
            )
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
        prefs.selectedDistrict = district; _userDistrict.value = district; loadNews(Language.TELUGU, currentUser)
    }

    fun onAppResume(language: Language, currentUser: User?) {
        loadNews(language, currentUser)
    }

    fun refreshIfStale(language: Language, currentUser: User?) {
        val now = System.currentTimeMillis()
        if (now - lastRefreshTimeLong > 300000 || _news.value.isEmpty()) { loadNews(language, currentUser) }
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

     private suspend fun generateWeatherPost(place: String?, district: String?, lat: Double? = null, lon: Double? = null): NewsPost {
         val location = if (district == prefs.detectedDistrict) (place ?: district ?: "హైదరాబాద్") else (district ?: "హైదరాబాద్")
         
         // ✅ FIX: Increased timeout to 8000ms so mobile networks have enough time to fetch real weather.
         // Previous 1500ms was too short, causing timeout → weatherData=null → wrong temp from headline.
         val weatherData = try {
             kotlinx.coroutines.withTimeout(8000L) {
                 WeatherService.fetchWeather(location, lat, lon)
             }
         } catch (e: Exception) { null }

         var temperatureStr = ""; var weatherHeadlineTe = "వాతావరణ తాజా సమాచారం"; var weatherContentTe = "ప్రస్తుతం $location లో వాతావరణ వివరాలు అందుబాటులో లేవు. నెట్‌వర్క్ చెక్ చేసుకుని మళ్ళీ ప్రయత్నించండి."
         if (weatherData != null) {
             temperatureStr = "${weatherData.temp.toInt()}°C "
             weatherHeadlineTe = WeatherService.getWeatherDescription(weatherData.code)
             weatherContentTe = WeatherService.getConversationalDescription(weatherData.code, weatherData.temp, location)
         }
         // ✅ FIX: Use 5-min bucket for ID so the card refreshes more frequently.
         // Old 10-min bucket caused distinctBy{id} to skip re-fetch of stale weather cards.
         return NewsPost(
             id = "weather_${System.currentTimeMillis() / (1000 * 60 * 5)}",
             headline = com.alfanews.telugu.models.Headline(
                 telugu = "$temperatureStr$location వాతావరణం: $weatherHeadlineTe", 
                 english = "$temperatureStr$location Weather"
             ),
             content = com.alfanews.telugu.models.Content(telugu = weatherContentTe, english = "Current weather update for $location."),
             location = location, type = "weather", timestamp = System.currentTimeMillis(), latitude = lat, longitude = lon
         )
     }
}
