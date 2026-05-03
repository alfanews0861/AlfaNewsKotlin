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

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _userDistrict = MutableStateFlow<String?>(prefs.getEffectiveDistrict())
    val userDistrict: StateFlow<String?> = _userDistrict.asStateFlow()

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _sharedPostId = MutableStateFlow<String?>(null)
    val sharedPostId: StateFlow<String?> = _sharedPostId.asStateFlow()

    fun setSharedPostId(postId: String?) {
        _sharedPostId.value = postId
    }

    private var prefCursor: DocumentSnapshot? = null
    private var mainCursor: DocumentSnapshot? = null
    private var isFetching = false
    
    private val globalCategories = listOf("రాజకీయం", "క్రైమ్", "వినోదం", "క్రీడలు", "వ్యాపారం", "టెక్నాలజీ", "భక్తి", "ఆరోగ్యం", "విద్య/ఉద్యోగాలు", "వ్యవసాయం")
    private val FETCH_LIMIT = 50 // Increased for high volume (300+ daily news)
    private val MIN_BATCH_SIZE = 20 // Target more items per fetch

    init {
        // Start loading news as soon as ViewModel is initialized
        loadNews(Language.TELUGU, null)
    }

     fun loadNews(language: Language, currentUser: User?, initialPostId: String? = null) {
          if (isFetching && initialPostId == null) return

          viewModelScope.launch {
              // ఇంటర్నెట్ తనిఖీ
              if (!com.alfanews.telugu.utils.NetworkUtils.isOnline(getApplication())) {
                  _isOnline.value = false
                  _loading.value = false
                  return@launch
              }
              _isOnline.value = true

              isFetching = true
              _loading.value = true

              if (initialPostId == null) {
                  prefCursor = null
                  mainCursor = null
                  _hasMore.value = true
              }

               try {
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
                           fetchFilteredBatch(FirebaseService.db.collection("news"), null, district, excludeDistricts = true)
                       } catch (e: Exception) { Pair(emptyList<NewsPost>(), null) }
                   }

                   // జిల్లా-స్పెసిఫిక్ వార్తలను కూడా ఫెచ్ చేయండి (but skip for new users on first load)
                   val localBatchDeferred = async {
                       if (district != null && !isNewUser) {
                           try {
                               val localQuery = FirebaseService.db.collection("news").whereArrayContains("categories", district)
                               fetchFilteredBatch(localQuery, null, district, excludeDistricts = false)
                           } catch (e: Exception) { Pair(emptyList<NewsPost>(), null) }
                       } else Pair(emptyList<NewsPost>(), null)
                   }

                   val greetingPost = greetingBatchDeferred.await()
                   val prefBatch = prefBatchDeferred.await()
                   val mainBatch = mainBatchDeferred.await()
                   val localBatch = localBatchDeferred.await()

                   prefCursor = prefBatch.second
                   mainCursor = mainBatch.second

                   var finalPosts = withContext(Dispatchers.Default) {
                       rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first)
                   }

                  // --- CRITICAL FALLBACK ---
                  // If no news found after filtering, load ALL news (first time users don't have district set)
                  if (finalPosts.isEmpty()) {
                      try {
                          val fallbackSnapshot = FirebaseService.db.collection("news")
                              .orderBy("timestamp", Query.Direction.DESCENDING)
                              .limit((FETCH_LIMIT * 2).toLong())
                              .get()
                              .await()

                          val fallbackList = fallbackSnapshot.documents.mapNotNull { doc ->
                              mapDocumentToNewsPost(doc)
                          }.filter { post ->
                              // 1. Truly Global/State-wide categories (Show on Home even if local)
                              val strictlyGlobalKeywords = listOf(
                                  "సినిమా", "స్పోర్ట్స్", "జాతీయం", "అంతర్జాతీయం", "వినోదం",
                                  "Movie", "Sports", "National", "International", "Entertainment",
                                  "State", "Andhra Pradesh", "Telangana", "AP", "TS"
                              )

                              // 2. Identify if it is Local (has a district name)
                              val isRealDistrict = post.district != null && Constants.ALL_DISTRICTS.contains(post.district)
                              val hasDistrictCategory = post.categories.any { it in Constants.ALL_DISTRICTS }
                              val isLocal = isRealDistrict || hasDistrictCategory

                              // 3. Identify if it has a Global interest category
                              val hasGlobal = post.categories.any { cat -> 
                                  strictlyGlobalKeywords.any { kw -> cat.contains(kw, ignoreCase = true) }
                              } || (post.district != null && strictlyGlobalKeywords.any { kw -> post.district.contains(kw, ignoreCase = true) })

                              // Filter Logic: If it is local news, it must have a Global category to show on Home.
                              // This prevents local "Politics", "Development", "Governance" etc. from flooding home feed.
                              !(isLocal && !hasGlobal)
                          }

                          if (fallbackList.isNotEmpty()) {
                              finalPosts = fallbackList.take(FETCH_LIMIT)
                              mainCursor = fallbackSnapshot.documents.lastOrNull()
                          }
                      } catch (e: Exception) { }
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
                  if (_news.value.isEmpty() && mainCursor == null) _hasMore.value = false

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
                 val shouldFetchPref = preferredCats.isNotEmpty() && (prefCursor != null || _news.value.size < 100)
                 val shouldFetchMain = mainCursor != null || _news.value.size < 100
                 
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

                 // జిల్లా వార్తలను కూడా లోడ్ చేయండి
                 val localBatchDeferred = async {
                     if (district != null && _news.value.size < 150) {
                         try {
                             val localQuery = FirebaseService.db.collection("news").whereArrayContains("categories", district)
                             fetchFilteredBatch(localQuery, null, district, excludeDistricts = false)
                         } catch (e: Exception) { Pair(emptyList<NewsPost>(), null) }
                     } else Pair(emptyList<NewsPost>(), null)
                 }

                 val prefBatch = prefBatchDeferred.await()
                 val mainBatch = mainBatchDeferred.await()
                 val localBatch = localBatchDeferred.await()

                 // కర్సర్‌లను సరిగా అప్‌డేట్ చేయండి
                 prefCursor = prefBatch.second
                 mainCursor = mainBatch.second

                 val newPosts = withContext(Dispatchers.Default) {
                     rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first)
                 }

                 if (newPosts.isNotEmpty()) {
                     val currentIds = _news.value.map { it.id }.toSet()
                     _news.value = _news.value + newPosts.filter { !currentIds.contains(it.id) }
                 }

                 // రెండు కర్సర్‌లు null కావడం అంటే ఇక డేటా లేదు
                 if (mainCursor == null && prefCursor == null) {
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
          val filteredList = mutableListOf<NewsPost>()
          var attempts = 0
          var lastSnapshot: com.google.firebase.firestore.QuerySnapshot? = null

          // లక్ష్య సంఖ్యకు చేరుకునే వరకు లూప్ కొనసాగండి
          while (filteredList.size < MIN_BATCH_SIZE && attempts < 4) {
              attempts++
              var query = baseQuery.orderBy("timestamp", Query.Direction.DESCENDING).limit(FETCH_LIMIT.toLong())
              if (currentCursor != null) query = query.startAfter(currentCursor)

              val snapshot = query.get().await()
              lastSnapshot = snapshot

              if (snapshot.isEmpty) {
                  currentCursor = null
                  break
              }

               val batch = snapshot.documents.mapNotNull { doc ->
                   val post = mapDocumentToNewsPost(doc) ?: return@mapNotNull null

                   // హోమ్ ఫీడ్ (excludeDistricts = true) లో జనరల్ న్యూస్‌ను చేర్చండి
                   // కానీ కేవలం జిల్లా-నిర్దిష్ట న్యూస్‌ను కొంచెం ఫిల్టర్ చేయండి
                   if (excludeDistricts) {
                       val postDist = post.district
                       val postCategories = post.categories
                       
                       // 1. Truly Global/State-wide categories (Always show on Home Feed)
                       val strictlyGlobalKeywords = listOf(
                           "సినిమా", "స్పోర్ట్స్", "జాతీయం", "అంతర్జాతీయం", "వినోదం",
                           "Movie", "Sports", "National", "International", "Entertainment",
                           "State", "Andhra Pradesh", "Telangana", "AP", "TS"
                       )

                       // 2. Identify if it's a District-specific post
                       val isRealDistrict = postDist != null && Constants.ALL_DISTRICTS.contains(postDist)
                       val hasDistrictCategory = postCategories.any { it in Constants.ALL_DISTRICTS }
                       val isLocal = isRealDistrict || hasDistrictCategory

                       // 3. Identify if it has a Global category
                       val hasGlobal = postCategories.any { cat -> 
                           strictlyGlobalKeywords.any { kw -> cat.contains(kw, ignoreCase = true) }
                       } || (postDist != null && strictlyGlobalKeywords.any { kw -> postDist.contains(kw, ignoreCase = true) })

                       // 4. ఫిల్టర్ లాజిక్:
                       // ఒక వార్త జిల్లాకు సంబంధించినది అయ్యి, గ్లోబల్ కేటగరీ లేకపోతే అది "Purely Local" (గ్రామ స్థాయి వార్త).
                       // అటువంటి వార్తలను హోమ్ ఫీడ్ లో చూపించకూడదు.
                       // ఉదాహరణకు: జిల్లా "Politics" లేదా "Development" వార్తలు హోమ్ ఫీడ్ లో రావు.
                       if (isLocal && !hasGlobal) {
                           return@mapNotNull null
                       }
                   }

                   post
               }

              filteredList.addAll(batch)
              currentCursor = snapshot.documents.lastOrNull()

              // Firestore పంపిన సంఖ్య అరికట్టుకంటే, అక్కడ ఎక్కువ డేటా లేదు
              if (snapshot.size() < FETCH_LIMIT) {
                  currentCursor = null
                  break
              }
          }
          return Pair(filteredList, currentCursor)
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
                    val detectedName = addresses[0].subAdminArea ?: addresses[0].locality ?: addresses[0].adminArea
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

     fun refreshIfStale(language: Language, currentUser: User?) {
         loadNews(language, currentUser)
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
}
