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
                val snapshot = FirebaseService.db.collection("local_ads")
                    .whereEqualTo("status", com.alfanews.telugu.models.AdStatus.ACTIVE.name)
                    .get().await()
                
                val allAds = snapshot.documents.mapNotNull { com.alfanews.telugu.models.LocalAd.fromSnapshot(it) }
                
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
                _localAds.value = validAds.shuffled()
            } catch (e: Exception) {
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
    private var isFetching = false
    private var lastRefreshTimeLong: Long = 0
    private var consecutiveEmptyLoads = 0

    private val globalDistricts = listOf(
        "Politics", "Sports", "Cinema", "National", "International", 
        "Business", "Crime", "Health", "Education", "Technology", 
        "Agriculture", "General", "State", "Entertainment", "World",
        "Devotional", "Lifestyle", "AndhraPradesh", "Telangana"
    )

    private val strictlyGlobalKeywords = listOf(
        "సినిమా", "స్పోర్ట్స్", "జాతీయం", "అంతర్జాతీయం", "వ్యాపారం", 
        "ఆరోగ్యం", "విద్య", "టెక్నాలజీ", "వ్యవసాయం", "భక్తి", 
        "వినోదం", "ప్రపంచం", "క్రైమ్", "లైఫ్ స్టైల్", "జనరల్", "రాష్ట్రం",
        "రాష్ట్ర వార్తలు", "ముఖ్యాంశాలు", "బ్రేకింగ్", "వైరల్", "తాజా వార్తలు"
    )

    private fun isGlobalCategory(category: String): Boolean {
        return strictlyGlobalKeywords.any { kw -> category.contains(kw, ignoreCase = true) }
    }

    private val FETCH_LIMIT = 20 

     fun loadNews(language: Language, currentUser: User?, initialPostId: String? = null) {
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
                               fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), null, district, excludeDistricts = false)
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
                               fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, district, excludeDistricts = false)
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
                   
                   if (finalPosts.isNotEmpty()) {
                       try {
                           AnalyticsService.logBulkCategoryViews(finalPosts.map { it.categories }, weight = 1)
                       } catch (e: Exception) { }
                   }
                   
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
                         fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, district, excludeDistricts = false)
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
                          AnalyticsService.logBulkCategoryViews(newPosts.map { it.categories }, weight = 1)
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

     private suspend fun fetchFilteredBatch(baseQuery: Query, cursor: DocumentSnapshot?, district: String?, excludeDistricts: Boolean, limit: Int = FETCH_LIMIT): Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?> {
           var currentCursor = cursor
           var query = baseQuery.whereEqualTo("approved", true)
           if (excludeDistricts) {
               val generalCats = globalDistricts.distinct().take(30)
               query = query.whereIn("district", generalCats)
           } else if (district != null) {
               query = query.whereArrayContains("categories", district)
           }
           query = query.orderBy("timestamp", Query.Direction.DESCENDING).limit(limit.toLong())
           if (currentCursor != null) query = query.startAfter(currentCursor)
           val snapshot = query.get().await()
           if (snapshot.isEmpty) {
               return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(emptyList(), null)
           }
           val batch = snapshot.documents.mapNotNull { doc ->
               mapDocumentToNewsPost(doc)
           }
           currentCursor = snapshot.documents.lastOrNull()
           return Pair<kotlin.collections.List<NewsPost>, DocumentSnapshot?>(batch, currentCursor)
       }

       private suspend fun rankAndBlendPosts(pref: kotlin.collections.List<NewsPost>, main: kotlin.collections.List<NewsPost>, local: kotlin.collections.List<NewsPost>, isFirstPage: Boolean = false): kotlin.collections.List<NewsPost> = withContext(Dispatchers.Default) {
            val filteredPref = pref.filter { prefs.getPostViewCount(it.id) < 2 }
            val filteredMain = main.filter { prefs.getPostViewCount(it.id) < 2 }
            val filteredLocal = local.filter { prefs.getPostViewCount(it.id) < 2 }

            val allPosts = (filteredPref + filteredMain + filteredLocal).distinctBy { it.id }.filter { post ->
                if (post.type != "news") return@filter true
                
                val currentDist = _userDistrict.value
                val isDistrictNewsCategory = post.categories.contains("జిల్లా వార్త")
                val matchesUserDistrict = currentDist != null && (post.district == currentDist || post.categories.contains(currentDist))
                
                // ✅ Home feed filtering rule:
                // Everything except 'District News' category should appear,
                // unless it matches the user's selected district.
                if (!isDistrictNewsCategory || matchesUserDistrict) return@filter true
                
                false
            }

           if (allPosts.isEmpty() && !isFirstPage) return@withContext emptyList<NewsPost>()

           val festivalGreetings = allPosts.filter { it.type == "greeting" && it.likes == 0 }
           val quoteGreetings = allPosts.filter { it.type == "greeting" && it.likes == 1 }
           val historyPosts = allPosts.filter { it.type == "history" }
           val cartoonPosts = allPosts.filter { it.type == "cartoon" }
           val normalNews = allPosts.filter { it.type != "greeting" && it.type != "history" && it.type != "cartoon" }

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
               fun insertSafely(list: MutableList<NewsPost>, post: NewsPost, targetIdx: Int) {
                   if (list.isEmpty()) { list.add(post) } 
                   else { val actualIdx = if (targetIdx >= list.size) list.size else targetIdx; list.add(actualIdx, post) }
               }
               if (quoteGreetings.isNotEmpty()) { insertSafely(blendedNews, quoteGreetings.first(), 6) }
               val lat = prefs.lastLat.takeIf { it != 0.0 }
               val lon = prefs.lastLon.takeIf { it != 0.0 }
               insertSafely(blendedNews, generateWeatherPost(prefs.localPlace, _userDistrict.value, lat, lon), 8)

               if (historyPosts.isNotEmpty()) { insertSafely(blendedNews, historyPosts.first(), 9) }
               if (cartoonPosts.isNotEmpty()) {
                   val userDist = _userDistrict.value
                   val userState = mapDistrictToState(userDist)
                   val relevantCartoon = cartoonPosts.find { it.district?.equals(userState, ignoreCase = true) == true } ?: cartoonPosts.firstOrNull()
                   relevantCartoon?.let { insertSafely(blendedNews, it, 12) }
               }
               if (festivalGreetings.isNotEmpty()) { blendedNews.add(0, festivalGreetings.first()) }
           }
          blendedNews
      }

    private suspend fun fetchGreetingPost(): NewsPost? {
        return try {
            val snapshot = FirebaseService.db.collection("news").whereEqualTo("type", "greeting").whereEqualTo("approved", true).orderBy("timestamp", Query.Direction.DESCENDING).limit(1).get().await()
            val doc = snapshot.documents.firstOrNull() ?: return null
            return mapDocumentToNewsPost(doc)
        } catch (e: Exception) { null }
    }

    private fun mapDocumentToNewsPost(doc: DocumentSnapshot): NewsPost? {
        return try {
            val data = doc.data ?: return null
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
                aiProcessed = data["aiProcessed"] as? Boolean ?: false
            )
        } catch (e: Exception) { null }
    }

    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?, language: Language = Language.TELUGU) {
        viewModelScope.launch {
            try {
                kotlinx.coroutines.withTimeout(2000L) {
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
                val geocoder = Geocoder(context, Locale("te"))
                val addresses = geocoder.getFromLocation(lat, lon, 1)
                if (!addresses.isNullOrEmpty()) {
                    val address = addresses[0]
                    val locality = address.locality ?: address.subLocality ?: address.subAdminArea
                    if (locality != null) { prefs.localPlace = locality; prefs.lastLat = lat; prefs.lastLon = lon }
                    val detectedName = address.subAdminArea ?: address.locality ?: address.adminArea
                    val mappedDistrict = Constants.ALL_DISTRICTS.find { it.contains(detectedName ?: "", ignoreCase = true) || (detectedName ?: "").contains(it, ignoreCase = true) }
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
         val telanganDistricts = Constants.TS_DISTRICTS; val apDistricts = Constants.AP_DISTRICTS
         return when {
             telanganDistricts.contains(district) -> "Telangana"
             apDistricts.contains(district) -> "Andhra Pradesh"
             else -> null
         }
     }

     private suspend fun generateWeatherPost(place: String?, district: String?, lat: Double? = null, lon: Double? = null): NewsPost {
         val location = if (district == prefs.detectedDistrict) (place ?: district ?: "హైదరాబాద్") else (district ?: "హైదరాబాద్")
         
         // 🚀 ZERO WAITING: Timeout for weather fetch to prevent blocking the feed
         val weatherData = try {
             kotlinx.coroutines.withTimeout(800L) {
                 WeatherService.fetchWeather(location, lat, lon)
             }
         } catch (e: Exception) { null }

         var temperatureStr = "31°C"; var weatherHeadlineTe = "సాధారణ వాతావరణం"; var weatherContentTe = "ప్రస్తుతం $location లో వాతావరణం సాధారణంగా ఉంది."
         if (weatherData != null) {
             temperatureStr = "${weatherData.temp.toInt()}°C"; weatherHeadlineTe = WeatherService.getWeatherDescription(weatherData.code)
             weatherContentTe = "నేడు $location లో వాతావరణం ${WeatherService.getWeatherDescription(weatherData.code)}. ప్రస్తుత ఉష్ణోగ్రత ${weatherData.temp.toInt()}°C గా ఉంది. గాలి వేగం గంటకు ${weatherData.wind.toInt()} కిలోమీటర్లు."
         }
         return NewsPost(
             id = "weather_${System.currentTimeMillis() / (1000 * 60 * 10)}",
             headline = com.alfanews.telugu.models.Headline(telugu = "$location వాతావరణం: $weatherHeadlineTe", english = "$location Weather"),
             content = com.alfanews.telugu.models.Content(telugu = weatherContentTe, english = "Current weather update for $location."),
             location = location, type = "weather", timestamp = System.currentTimeMillis(), latitude = lat, longitude = lon
         )
     }
}
