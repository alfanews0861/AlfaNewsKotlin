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
                
                // Fetch categories once
                val preferredCats = try { AnalyticsService.getUserPreferredCategories().take(10) } catch (e: Exception) { emptyList<String>() }

                // Parallel fetching using async to speed up loading
                // Only fetch greeting on first page
                val greetingBatchDeferred = async {
                    if (initialPostId == null && _news.value.isEmpty()) {
                        try { fetchGreetingPost() } catch (e: Exception) { null }
                    } else null
                }

                val prefBatchDeferred = async {
                    if (preferredCats.isNotEmpty()) {
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

                val greetingPost = greetingBatchDeferred.await()
                val prefBatch = prefBatchDeferred.await()
                val mainBatch = mainBatchDeferred.await()

                prefCursor = prefBatch.second
                mainCursor = mainBatch.second

                var finalPosts = withContext(Dispatchers.Default) {
                    rankAndBlendPosts(prefBatch.first, mainBatch.first, emptyList())
                }

                // --- CRITICAL FALLBACK ---
                if (finalPosts.isEmpty()) {
                    try {
                        val fallbackSnapshot = FirebaseService.db.collection("news")
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(FETCH_LIMIT.toLong())
                            .get()
                            .await()
                        
                        val fallbackList = fallbackSnapshot.documents.mapNotNull { doc -> mapDocumentToNewsPost(doc) }
                        if (fallbackList.isNotEmpty()) {
                            finalPosts = fallbackList
                            mainCursor = fallbackSnapshot.documents.lastOrNull()
                        }
                    } catch (e: Exception) { }
                }

                // Inject greeting at the very top
                greetingPost?.let {
                    finalPosts = (listOf(it) + finalPosts).distinctBy { it.id }
                }

                if (initialPostId != null) {
                    val doc = FirebaseService.db.collection("news").document(initialPostId).get().await()
                    mapDocumentToNewsPost(doc)?.let { post ->
                        finalPosts = (listOf(post) + finalPosts).distinctBy { it.id }
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

                val prefBatchDeferred = async {
                    if (preferredCats.isNotEmpty() && (prefCursor != null || _news.value.size < 150)) {
                        fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, district, excludeDistricts = true)
                    } else Pair(emptyList<NewsPost>(), null)
                }

                val mainBatchDeferred = async {
                    if (mainCursor != null) {
                        fetchFilteredBatch(FirebaseService.db.collection("news"), mainCursor, district, excludeDistricts = true)
                    } else Pair(emptyList<NewsPost>(), null)
                }

                val prefBatch = prefBatchDeferred.await()
                val mainBatch = mainBatchDeferred.await()

                // Crucial: Allow cursor to become null if it reached the end
                prefCursor = prefBatch.second
                mainCursor = mainBatch.second

                val newPosts = withContext(Dispatchers.Default) {
                    rankAndBlendPosts(prefBatch.first, mainBatch.first, emptyList())
                }

                if (newPosts.isNotEmpty()) {
                    val currentIds = _news.value.map { it.id }.toSet()
                    _news.value = _news.value + newPosts.filter { !currentIds.contains(it.id) }
                }

                if (mainCursor == null && prefCursor == null) _hasMore.value = false

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
        
        // Target more items to avoid frequent small loads
        while (filteredList.size < MIN_BATCH_SIZE && attempts < 4) { // Increased attempts to 4
            attempts++
            var query = baseQuery.orderBy("timestamp", Query.Direction.DESCENDING).limit(FETCH_LIMIT.toLong())
            if (currentCursor != null) query = query.startAfter(currentCursor)

            val snapshot = query.get().await()
            if (snapshot.isEmpty) {
                currentCursor = null
                break
            }

            val batch = snapshot.documents.mapNotNull { doc ->
                val post = mapDocumentToNewsPost(doc) ?: return@mapNotNull null
                
                // If on Home Feed (excludeDistricts = true), filter out district news
                if (excludeDistricts) {
                    val postDist = post.district
                    val hasDistrict = !postDist.isNullOrBlank() || post.categories.any { it in Constants.ALL_DISTRICTS }
                    // Only allow if it has NO district OR if it's in a global category which takes precedence
                    if (hasDistrict && post.categories.none { it in globalCategories }) {
                        return@mapNotNull null
                    }
                }
                
                post
            }

            filteredList.addAll(batch)
            currentCursor = snapshot.documents.lastOrNull()
            
            // If Firestore returned fewer than requested, there is no more data for this query
            if (snapshot.size() < FETCH_LIMIT) {
                currentCursor = null
                break
            }
        }
        return Pair(filteredList, currentCursor)
    }

    private suspend fun rankAndBlendPosts(pref: List<NewsPost>, main: List<NewsPost>, local: List<NewsPost>): List<NewsPost> = withContext(Dispatchers.Default) {
        val allPosts = (pref + main + local).distinctBy { it.id }
        if (allPosts.isEmpty()) return@withContext emptyList<NewsPost>()
        
        val festivalGreetings = allPosts.filter { it.type == "greeting" && it.likes == 0 }
        val quoteGreetings = allPosts.filter { it.type == "greeting" && it.likes == 1 }
        val normalNews = allPosts.filter { it.type != "greeting" }

        if (normalNews.isEmpty()) {
            return@withContext (festivalGreetings + quoteGreetings).distinctBy { it.id }
        }

        // 40% వార్తలను "తాజాదనం" (Freshness) ఆధారంగా, 30% Discovery, 30% Personalized
        val totalToRank = normalNews.size
        
        val discoveryCount = (totalToRank * 0.3).toInt()
        val freshCount = (totalToRank * 0.4).toInt()
        
        val preferredCategories = try { AnalyticsService.getUserPreferredCategories().toSet() } catch (e: Exception) { emptySet() }
        
        val discoveryNews = normalNews.filter { post -> 
            post.categories.none { it in preferredCategories } 
        }.shuffled().take(discoveryCount)
        
        val discoveryIds = discoveryNews.map { it.id }.toSet()
        
        val freshNews = normalNews.filter { it.id !in discoveryIds }
            .sortedByDescending { it.timestamp }
            .take(freshCount)
        
        val freshIds = freshNews.map { it.id }.toSet()
        
        // 2. మిగిలిన వార్తలకు స్కోర్ ఇవ్వడం (Personalized - 30%)
        val remainingNews = normalNews.filter { it.id !in discoveryIds && it.id !in freshIds }
        val scoredNews = remainingNews.map { post ->
            post to (try { AnalyticsService.calculateRelevanceScore(post) } catch (e: Exception) { 0.0 })
        }.sortedByDescending { it.second }.map { it.first }

        // 3. రెండింటినీ కలపడం (FreshNews + Discovery + Personalized)
        val blendedNews = (freshNews + discoveryNews + scoredNews).toMutableList()

        // కోట్ కార్డును 6-10 స్థానంలో రాండమ్ గా పెట్టడం
        if (quoteGreetings.isNotEmpty()) {
            val size = blendedNews.size
            val minIdx = if (6 < size) 6 else if (size > 0) size - 1 else 0
            val maxIdx = if (10 < size) 10 else if (size > 0) size - 1 else 0
            if (minIdx <= maxIdx) {
                val insertIndex = (minIdx..maxIdx).random()
                blendedNews.add(insertIndex, quoteGreetings.first())
            } else {
                blendedNews.add(quoteGreetings.first())
            }
        }

        // పండుగ కార్డును మొదట పెట్టడం
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
                kotlinx.coroutines.withTimeout(5000L) {
                    val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
                    
                    // Use balanced power accuracy for faster resolution and timeout after 5 seconds to avoid infinite spinners
                    val location = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                    if (location != null) {
                        processLocationUpdate(context, location.latitude, location.longitude, language, currentUser)
                    }
                }
            } catch (e: Exception) { }
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
        if (_news.value.isEmpty()) {
            loadNews(language, currentUser)
        }
    }
}
