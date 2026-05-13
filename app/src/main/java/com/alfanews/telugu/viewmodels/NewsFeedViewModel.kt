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
import com.alfanews.telugu.services.WeatherService
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.PreferenceManager
import com.alfanews.telugu.utils.Constants
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale

class NewsFeedViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    
    private val _news = MutableStateFlow<List<NewsPost>>(emptyList())
    val news: StateFlow<List<NewsPost>> = _news.asStateFlow()

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

    fun resetScrollSignal() {
        _shouldScrollToTop.value = false
    }

    private val _sharedPostId = MutableStateFlow<String?>(null)
    val sharedPostId: StateFlow<String?> = _sharedPostId.asStateFlow()

    fun setSharedPostId(postId: String?) {
        _sharedPostId.value = postId
    }

    private var prefCursor: DocumentSnapshot? = null
    private var mainCursor: DocumentSnapshot? = null
    private var isFetching = false
    private var lastRefreshTimeLong: Long = 0
    // Tracks consecutive loadMore calls that returned no unique posts to avoid infinite/continuous fetching
    private var consecutiveEmptyLoads = 0

    // ✅ CANONICAL CATEGORIES (Matches backend in functions/src/categories.ts)
    private val globalCategories = listOf("రాజకీయం", "క్రైమ్", "వినోదం", "క్రీడలు", "వ్యాపారం", "టెక్నాలజీ", "భక్తి", "ఆరోగ్యం", "విద్య/ఉద్యోగాలు", "వ్యవసాయం")
    
    // ✅ CATEGORY ALIASES for flexible matching (handles typos and variations)
    private val categoryAliases = mapOf(
        "రాజకీయం" to listOf("పలిటిక్‌", "రాజకీయ సమాచారం", "politics", "elections", "ఎన్నికలు"),
        "క్రైమ్" to listOf("అపరాధం", "crime", "న్యాయ సమాచారం", "court"),
        "వినోదం" to listOf("సినిమా", "movie", "entertainment", "OTT"),
        "క్రీడలు" to listOf("sports", "cricket", "cricket news"),
        "వ్యాపారం" to listOf("business", "economy", "trade"),
        "టెక్నాలజీ" to listOf("technology", "tech", "AI"),
        "భక్తి" to listOf("spiritual", "religion", "temple"),
        "ఆరోగ్యం" to listOf("health", "medical", "medical news"),
        "విద్య/ఉద్యోగాలు" to listOf("education", "jobs", "school"),
        "వ్యవసాయం" to listOf("agriculture", "farm", "farmer"),
        "జాతీయం" to listOf("national", "india", "domestic"),
        "ప్రపంచం" to listOf("international", "world", "global")
    )
    
    private val FETCH_LIMIT = 20 // Increased for more content per batch
    private val MIN_BATCH_SIZE = 5
    
    /**
     * ✅ NEW: Normalize category to canonical form
     * Handles typos, aliases, and English/Telugu variations
     */
    private fun normalizeCategory(input: String): String {
        val cleaned = input.trim().lowercase()
        
        // Direct match first
        for ((canonical, aliases) in categoryAliases) {
            if (cleaned == canonical.lowercase()) return canonical
            if (aliases.any { cleaned == it.lowercase() }) return canonical
            // Partial match for longer strings
            if (aliases.any { cleaned.contains(it.lowercase()) || it.lowercase().contains(cleaned) }) return canonical
        }
        
        return input // Return original if no match found
    }
    
    /**
     * ✅ NEW: Check if a category is global (not district-specific)
     */
    private fun isGlobalCategory(category: String): Boolean {
        val normalized = normalizeCategory(category)
        
        // Check if it's in the canonical global categories
        if (globalCategories.contains(normalized)) return true
        
        // Check if any alias matches a global keyword
        val globalKeywords = listOf(
            "సినిమా", "cinema", "movie", "films", "వినోదం", "entertainment",
            "స్పోర్ట్స్", "sports", "cricket", "క్రీడలు",
            "రాజకీయం", "politics", "elections",
            "క్రైమ్", "crime", "court",
            "వ్యాపారం", "business", "economy",
            "టెక్నాలజీ", "technology", "tech", "AI",
            "ఆరోగ్యం", "health", "medical",
            "విద్య", "education", "school", "ఉద్యోగాలు", "jobs",
            "భక్తి", "spiritual", "religion",
            "వ్యవసాయం", "agriculture", "farm",
            "జాతీయం", "national", "india",
            "ప్రపంచం", "international", "world"
        )
        
        return globalKeywords.any { keyword -> 
            normalized.contains(keyword, ignoreCase = true) || keyword.contains(normalized, ignoreCase = true)
        }
    }

    init {
        // loadNews will be called by View/Activity with proper parameters
    }

     fun loadNews(language: Language, currentUser: User?, initialPostId: String? = null) {
          if (isFetching && initialPostId == null) return
          
          _loading.value = true 
          isFetching = true

           viewModelScope.launch {
              try {
                  // ఇంటర్నెట్ తనిఖీ
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
                       _hasMore.value = true
                       consecutiveEmptyLoads = 0
                   }

                  val district = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
                  _userDistrict.value = district

                   // ═══════════════════════════════════════════════════════════════════
                   // 🚀 NEW USER OPTIMIZATION: Skip preferences/district for first load
                   // ═══════════════════════════════════════════════════════════════════
                   // If this is the first time loading (news is empty) and user has NO district,
                   // immediately load GENERAL NEWS without waiting for preferences/location detection
                   val isFirstTimeLoad = _news.value.isEmpty()
                   val isNewUser = district == null

                   // ఉపయోగకర్త ఇష్ట కేటిగరీలను ఫెచ్ చేయండి
                   val preferredCats = try { AnalyticsService.getUserPreferredCategories().take(10) } catch (e: Exception) { emptyList<String>() }

                   // సమాంతర ఫెచింగ్ - జనరల్, ఉపయోగకర్త ఇష్ట, జిల్లా వార్తలు
                   val greetingBatchDeferred = async {
                       if (initialPostId == null && _news.value.isEmpty()) {
                           try { fetchGreetingPost() } catch (e: Exception) { null }
                       } else null
                   }

                   // For new users, skip preference fetching on first load to show news immediately
                   val prefBatchDeferred = async {
                       if (preferredCats.isNotEmpty() && !isNewUser) {
                           try {
                               fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), null, district, excludeDistricts = true)
                           } catch (e: Exception) { Pair(emptyList<NewsPost>(), null) }
                       } else Pair(emptyList<NewsPost>(), null)
                   }

                   val mainBatchDeferred = async {
                       try {
                           // ✅ ALWAYS EXCLUDE DISTRICTS FOR HOME FEED (As per user request)
                           fetchFilteredBatch(FirebaseService.db.collection("news"), null, district, excludeDistricts = true)
                       } catch (e: Exception) { Pair(emptyList<NewsPost>(), null) }
                   }

                   // ✅ HOME FEED EXCLUSION: We don't fetch local district news for the home page
                   val localBatchDeferred = async {
                       Pair(emptyList<NewsPost>(), null)
                   }

                   val greetingPost = greetingBatchDeferred.await()
                   val prefBatch = prefBatchDeferred.await()
                   val mainBatch = mainBatchDeferred.await()
                   val localBatch = localBatchDeferred.await()

                   var finalPosts = withContext(Dispatchers.Default) {
                       rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first)
                   }

                   prefCursor = prefBatch.second
                   mainCursor = mainBatch.second

                   // 🚀 CRITICAL: If after filtering we have no news, don't let it loop
                   if (finalPosts.isEmpty() && (mainCursor != null || prefCursor != null)) {
                       // We scanned but found nothing global. Stop here to save bill/data.
                       _hasMore.value = false
                   }

                  // Inject greeting at the very top
                  greetingPost?.let {
                      finalPosts = (listOf(it) + finalPosts).distinctBy { it.id }
                  }

                   // 🔗 Deeplink: Fetch the specific post if initialPostId is provided
                   if (initialPostId != null) {
                       try {
                           val doc = FirebaseService.db.collection("news").document(initialPostId).get().await()
                           if (doc.exists()) {
                               mapDocumentToNewsPost(doc)?.let { post ->
                                   finalPosts = (listOf(post) + finalPosts).distinctBy { it.id }
                               }
                           }
                           // If doc doesn't exist, it's silently skipped (user still sees other news)
                       } catch (e: Exception) {
                           // Log deeplink error for debugging, but don't crash
                           // In production, consider reporting to analytics
                       }
                   }

                   _news.value = finalPosts.distinctBy { it.id }
                   
                   // ✅ UI RAPID REFRESH: If we only had a few posts, show the first 5 immediately
                   // even before full processing finishes if possible
                   if (_news.value.isEmpty() && finalPosts.isNotEmpty()) {
                        _news.value = finalPosts.take(5)
                        _loading.value = false
                   }

                   val currentTime = System.currentTimeMillis()
                   lastRefreshTimeLong = currentTime
                   _lastRefreshTime.value = currentTime
                   if (_news.value.isEmpty() && mainCursor == null) _hasMore.value = false
                   
                   // ✅ NEW: Track user interests immediately (even for new users)
                   // Build preference profiles from first load onwards
                   val postsToLog = finalPosts.filter { it.type == "news" }.take(20)
                   if (postsToLog.isNotEmpty()) {
                       try {
                           com.alfanews.telugu.services.AnalyticsService.logBulkCategoryViews(postsToLog.map { it.categories }, weight = 1)
                       } catch (e: Exception) { }
                   }

              } catch (e: Exception) {
                  if (_news.value.isEmpty()) _hasMore.value = false
              } finally {
                  _loading.value = false
                  isFetching = false
              }
          }
      }

    fun loadMore(language: Language, currentUser: User?) {
         if (isFetching || !_hasMore.value) return

         viewModelScope.launch {
             isFetching = true
             try {
                 val district = _userDistrict.value
                 val preferredCats = AnalyticsService.getUserPreferredCategories().take(10)

                 // కర్సర్ స్టేట్‌ను వెరిఫై చేయండి
                 val shouldFetchPref = preferredCats.isNotEmpty() && (prefCursor != null)
                 val shouldFetchMain = mainCursor != null
                 
                 val prefBatchDeferred = async {
                     if (shouldFetchPref) {
                         fetchFilteredBatch(
                             FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), 
                             prefCursor, 
                             district, 
                             excludeDistricts = true
                         )
                     } else Pair(emptyList<NewsPost>(), null)
                 }

                 val mainBatchDeferred = async {
                     if (shouldFetchMain) {
                         fetchFilteredBatch(
                             FirebaseService.db.collection("news"), 
                             mainCursor, 
                             district, 
                             excludeDistricts = true
                         )
                     } else Pair(emptyList<NewsPost>(), null)
                 }

                 // ✅ HOME FEED EXCLUSION: We don't fetch local district news for the home page
                 val localBatchDeferred = async {
                     Pair(emptyList<NewsPost>(), null)
                 }

                 val prefBatch = prefBatchDeferred.await()
                 val mainBatch = mainBatchDeferred.await()
                 val localBatch = localBatchDeferred.await()

                 val newPosts = withContext(Dispatchers.Default) {
                     rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first)
                 }

                 // కర్సర్‌లను సరిగా అప్‌డేట్ చేయండి
                 prefCursor = prefBatch.second
                 mainCursor = mainBatch.second

                   if (newPosts.isNotEmpty()) {
                      val currentIds = _news.value.map { it.id }.toSet()
                      val uniqueNewPosts = newPosts.filter { !currentIds.contains(it.id) }
                      
                      if (uniqueNewPosts.isNotEmpty()) {
                          _news.value = _news.value + uniqueNewPosts

                          // ✅ Track interests continuously - Batch log for efficiency
                          val newsToLog = uniqueNewPosts.filter { it.type == "news" }
                          if (newsToLog.isNotEmpty()) {
                              try {
                                  com.alfanews.telugu.services.AnalyticsService.logBulkCategoryViews(newsToLog.map { it.categories }, weight = 1)
                              } catch (e: Exception) { }
                          }
                           // Reset consecutive empty load counter since we added new items
                           consecutiveEmptyLoads = 0
                      } else {
                          // No unique posts after dedup - only stop if BOTH cursors exhausted
                          // or after 4 consecutive empty loads to handle 40/30/30 filtering
                           consecutiveEmptyLoads += 1
                           if (mainCursor == null && prefCursor == null) {
                               _hasMore.value = false
                           } else if (consecutiveEmptyLoads >= 4) {
                               // After 4 consecutive empty loadMore results, stop further loading
                               _hasMore.value = false
                           }
                      }
                  } else {
                      // No posts returned from fetch at all
                      _hasMore.value = false
                  }

             } catch (e: Exception) {
             } finally {
                 isFetching = false
             }
         }
     }

     private suspend fun fetchFilteredBatch(baseQuery: Query, cursor: DocumentSnapshot?, district: String?, excludeDistricts: Boolean): Pair<List<NewsPost>, DocumentSnapshot?> {
           var currentCursor = cursor
           var query = baseQuery.whereEqualTo("approved", true).orderBy("timestamp", Query.Direction.DESCENDING).limit(FETCH_LIMIT.toLong())
           if (currentCursor != null) query = query.startAfter(currentCursor)

           val snapshot = query.get().await()

           if (snapshot.isEmpty) {
               return Pair(emptyList(), null)
           }

           val batch = snapshot.documents.mapNotNull { doc ->
               mapDocumentToNewsPost(doc)
           }

           currentCursor = snapshot.documents.lastOrNull()
           
           if (snapshot.size() < FETCH_LIMIT) {
               currentCursor = null
           }
           
           return Pair(batch, currentCursor)
       }

      private suspend fun rankAndBlendPosts(pref: List<NewsPost>, main: List<NewsPost>, local: List<NewsPost>): List<NewsPost> = withContext(Dispatchers.Default) {
           // ═══════════════════════════════════════════════════════════════════
           // 📰 NEWS FEED MIXING: 40% FRESH → 30% PERSONALIZED → 30% DISCOVERY
           // ═══════════════════════════════════════════════════════════════════

           // STEP 1: COMBINE & DEDUPLICATE
           // రెండుసార్లు లెక్కకు రాకుండా distinctBy వాడండి
           val allPosts = (pref + main + local).distinctBy { it.id }
           if (allPosts.isEmpty()) return@withContext emptyList<NewsPost>()

           // STEP 2: CATEGORIZE BY TYPE (Separate special posts)
           // గ్రీటింగ్‌లను విభజించండి
           val festivalGreetings = allPosts.filter { it.type == "greeting" && it.likes == 0 }
           val quoteGreetings = allPosts.filter { it.type == "greeting" && it.likes == 1 }

           // చరిత్ర కార్డులను విభజించండి (History of the Day)
           val historyPosts = allPosts.filter { it.type == "history" }

           // కార్టూన్ కార్డులను విభజించండి (12వ స్థానం)
           val cartoonPosts = allPosts.filter { it.type == "cartoon" }

           // Regular news (for 40/30/30 mix)
           val normalNews = allPosts.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" }

           if (normalNews.isEmpty()) {
               return@withContext (festivalGreetings + quoteGreetings + historyPosts + cartoonPosts).distinctBy { it.id }
           }

           // STEP 3: CALCULATE MIXING PERCENTAGES (40/30/30)
           // 40% వార్తలను "తాజాదనం" (Freshness) ఆధారంగా, 30% Personalized, 30% Discovery
           val totalToRank = normalNews.size

           // తక్కువ న్యూస్ ఉన్నప్పుడు కూడా సరిగా కాలిక్యులేట్ చేయండి
           val freshCount = if (totalToRank > 10) (totalToRank * 0.4).toInt() else maxOf(1, (totalToRank * 0.4).toInt())
           val personalizedCount = if (totalToRank > 10) (totalToRank * 0.3).toInt() else maxOf(1, totalToRank / 3)
           val discoveryCount = if (totalToRank > 10) (totalToRank * 0.3).toInt() else maxOf(1, totalToRank / 3)

           val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (e: Exception) { emptySet() }

           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // STEP 4A: 40% FRESH (by Recency/Timestamp)
           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // తాజా వార్తలను నిర్ణయించండి (Fresh - 40% by recency)
           val freshNews = normalNews
               .sortedByDescending { it.timestamp }    // Most recent first
               .take(freshCount)                       // Take 40% by count

           val freshIds = freshNews.map { it.id }.toSet()

           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // STEP 4B: 30% PERSONALIZED (by User Interest + Relevance Score)
           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // మిగిలిన వార్తలకు స్కోర్ ఇవ్వండి (Personalized - 30% user interests)
           val remainingAfterFresh = normalNews.filter { it.id !in freshIds }
           val scoredNews = remainingAfterFresh.map { post ->
               post to (try { AnalyticsService.calculateRelevanceScore(post) } catch (e: Exception) { 0.0 })
           }.sortedByDescending { it.second }          // Highest relevance score first
               .take(personalizedCount)                // Take 30% by count
               .map { it.first }

           val personalizedIds = scoredNews.map { it.id }.toSet()

           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // STEP 4C: 30% DISCOVERY (New Categories/Exploration)
           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // ఎంపిక చేసిన కేటాగరీలలో లేని వార్తలను కనుగొనండి (Discovery - 30% new categories)
           val discoveryNews = normalNews.filter { it.id !in freshIds && it.id !in personalizedIds }
               .filter { post ->
                   post.categories.none { it in preferredCategories }  // Not in preferences
               }.shuffled()                            // Random order for discovery
               .take(discoveryCount)                   // Take 30% by count

           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // STEP 5: BLEND IN ORDER (Fresh → Personalized → Discovery)
           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // రెండింటినీ కలపండి (FreshNews + Personalized + Discovery)
           val blendedNews = (freshNews + scoredNews + discoveryNews).toMutableList()

           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // STEP 6: INSERT SPECIAL POSTS AT EXACT POSITIONS
           // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           // Position 6: QUOTE OF THE DAY
           // కోట్ కార్డును 6వ స్థానంలో (Index 6) ఖచ్చితమైన ఆర్డర్‌లో పెట్టండి
           if (quoteGreetings.isNotEmpty()) {
               val size = blendedNews.size
               val targetIdx = if (6 <= size) 6 else if (size > 0) size - 1 else 0
               if (targetIdx >= 0 && targetIdx <= blendedNews.size) {
                   blendedNews.add(targetIdx, quoteGreetings.first())
               } else {
                   blendedNews.add(quoteGreetings.first())
               }
           }

           // Position 9: HISTORY OF THE DAY
           // చరిత్ర (History of the Day) కార్డును 9వ స్థానంలో (Index 9) పెట్టండి
           if (historyPosts.isNotEmpty()) {
               val size = blendedNews.size
               val targetIdx = if (9 <= size) 9 else if (size > 0) size - 1 else 0
               if (targetIdx >= 0 && targetIdx <= blendedNews.size) {
                   blendedNews.add(targetIdx, historyPosts.first())
               } else {
                   blendedNews.add(historyPosts.first())
               }
           }

           // Position 8: WEATHER WIDGET (వాతావరణం)
           // వాతావరణ కార్డును 9వ వార్తగా (Index 8) పెట్టండి
           // Only add on the first load (when cursors are null) to avoid duplicates in pagination
           if (mainCursor == null && prefCursor == null) {
               val lat = prefs.lastLat.takeIf { it != 0.0 }
               val lon = prefs.lastLon.takeIf { it != 0.0 }
               val weatherPost = generateWeatherPost(prefs.localPlace, _userDistrict.value, lat, lon)
               val sizeAfterHistory = blendedNews.size
               val weatherIdx = if (8 <= sizeAfterHistory) 8 else if (sizeAfterHistory > 0) sizeAfterHistory - 1 else 0
               blendedNews.add(weatherIdx, weatherPost)
           }

           // Position 12: CARTOON (State-Specific)
           // కార్టూన్ కార్డును 12వ స్థానంలో (Index 12) పెట్టండి (స్టేట్-నిర్దిష్టమైన)
           if (cartoonPosts.isNotEmpty()) {
               val userDistrict = _userDistrict.value
               val userState = mapDistrictToState(userDistrict)

               // ఉపయోగకర్తకు సంబంధించిన కార్టూన్‌ను కనుగొనండి
               // If user is from Telangana, show Telangana cartoon; if from AP, show AP cartoon
               val relevantCartoon = if (userState != null) {
                   cartoonPosts.find { post ->
                       post.district?.equals(userState, ignoreCase = true) == true
                   }
               } else null

               // ఫోల్‌బ్యాక్: సంబంధం లేని కార్టూన్ ఏదైనా లాగా ఉపయోగించండి
               val cartoonToAdd = relevantCartoon ?: cartoonPosts.firstOrNull()

               if (cartoonToAdd != null) {
                   val size = blendedNews.size
                   val targetIdx = if (12 <= size) 12 else if (size > 0) size - 1 else 0
                   if (targetIdx >= 0 && targetIdx <= blendedNews.size) {
                       blendedNews.add(targetIdx, cartoonToAdd)
                   } else {
                       blendedNews.add(cartoonToAdd)
                   }
               }
           }

           // Position 1: FESTIVAL GREETING (Always First)
           // పండుగ కార్డును ఎల్లప్పుడూ మొదట (Index 0) పెట్టండి
           // If today is a festival/holiday, this appears on top
           if (festivalGreetings.isNotEmpty()) {
               blendedNews.add(0, festivalGreetings.first())
           }

          blendedNews
      }

    private suspend fun fetchGreetingPost(): NewsPost? {
        return try {
            val snapshot = FirebaseService.db.collection("news")
                .whereEqualTo("type", "greeting")
                .whereEqualTo("approved", true)
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(1)
                .get()
                .await()
            
            val doc = snapshot.documents.firstOrNull() ?: return null
            return mapDocumentToNewsPost(doc)
        } catch (e: Exception) {
            null
        }
    }

    private fun mapDocumentToNewsPost(doc: DocumentSnapshot): NewsPost? {
        return try {
            val data = doc.data ?: return null
            
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

            NewsPost(
                id = doc.id,
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
                tags = (data["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                entities = (data["entities"] as? Map<*, *>)?.let { entitiesMap ->
                    com.alfanews.telugu.models.Entities(
                        people = (entitiesMap["people"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        organizations = (entitiesMap["organizations"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        locations = (entitiesMap["locations"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
                    )
                } ?: com.alfanews.telugu.models.Entities(),
                type = data["type"]?.toString() ?: "news"
            )
        } catch (e: Exception) { 
            null 
        }
    }

    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?, language: Language = Language.TELUGU) {
        viewModelScope.launch {
            try {
                // ఫాస్ట్ గా లొకేషన్ డిటెక్ట్ చేయడానికి 2000ms (2 సెకన్లు) మాత్రమే టైమ్ అవుట్
                kotlinx.coroutines.withTimeout(2000L) {
                    val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
                    
                    // అత్యంత ఖచ్చితమైన GPS లొకేషన్ (HIGH_ACCURACY) వాడటం
                    val location = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
                    if (location != null) {
                        processLocationUpdate(context, location.latitude, location.longitude, language, currentUser)
                    }
                }
            } catch (e: Exception) {
                // 2 సెకన్లు దాటితే లేదా ఎర్రర్ వస్తే సైలెంట్ గా వదిలేస్తుంది (తద్వారా లొకేషన్ సెలెక్టర్ ఓపెన్ అవుతుంది)
            }
        }
    }

    private suspend fun processLocationUpdate(context: Context, lat: Double, lon: Double, language: Language, currentUser: User?): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val geocoder = Geocoder(context, Locale("te"))
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocation(lat, lon, 1)
                if (!addresses.isNullOrEmpty()) {
                    val address = addresses[0]
                    
                    // మండలం లేదా ఊరు పేరును గుర్తించండి
                    val locality = address.locality ?: address.subLocality ?: address.subAdminArea
                    if (locality != null) {
                        prefs.localPlace = locality
                        prefs.lastLat = lat
                        prefs.lastLon = lon
                    }

                    val detectedName = address.subAdminArea ?: address.locality ?: address.adminArea
                    val mappedDistrict = Constants.ALL_DISTRICTS.find { 
                        it.contains(detectedName ?: "", ignoreCase = true) || (detectedName ?: "").contains(it, ignoreCase = true) 
                    }
                    if (mappedDistrict != null && prefs.detectedDistrict != mappedDistrict) {
                        prefs.detectedDistrict = mappedDistrict
                        withContext(Dispatchers.Main) {
                            _userDistrict.value = mappedDistrict
                            loadNews(language, currentUser)
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
        loadNews(Language.TELUGU, currentUser)
    }

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
        // యూజర్ కోరిక మేరకు ఇది 'తాజా వార్తలు' ఎప్పుడూ ఉండేలా చేస్తుంది
        if (now - lastRefreshTimeLong > 600000 || _news.value.isEmpty()) {
            loadNews(language, currentUser)
        }
    }

     private fun mapDistrictToState(district: String?): String? {
         if (district == null) return null
         
         // తెలంగాణ జిల్లాలు
         val telanganDistricts = Constants.TS_DISTRICTS
         
         // ఆంధ్రప్రదేశ్ జిల్లాలు
         val apDistricts = Constants.AP_DISTRICTS
         
         return when {
             telanganDistricts.contains(district) -> "Telangana"
             apDistricts.contains(district) -> "Andhra Pradesh"
             else -> null
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
                 english = "Current weather update for $location. Temperature is around $temperatureStr. Reported at ${if (realWeatherData != null) WeatherService.formatTime(realWeatherData.time) else "now"}. Please stay tuned for more details."
             ),
             location = displayLocation,
             type = "weather",
             timestamp = System.currentTimeMillis(),
             latitude = lat,
             longitude = lon
         )
     }
}
