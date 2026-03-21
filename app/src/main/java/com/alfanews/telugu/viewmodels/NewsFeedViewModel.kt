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
    private var localCursor: DocumentSnapshot? = null
    private var isFetching = false
    
    private val globalCategories = listOf("వినోదం", "క్రీడలు", "వ్యాపారం", "టెక్నాలజీ", "భక్తి", "ఆరోగ్యం", "విద్య/ఉద్యోగాలు")
    private val FETCH_LIMIT = 25 // Increased from 20
    private val MIN_BATCH_SIZE = 12 // Increased from 8

    init {
        // Start loading news as soon as ViewModel is initialized
        loadNews(Language.TELUGU, null)
    }

    fun loadNews(language: Language, currentUser: User?, initialPostId: String? = null) {
        if (isFetching && initialPostId == null) return
        
        viewModelScope.launch {
            isFetching = true
            if (_news.value.isEmpty()) _loading.value = true
            
            if (initialPostId == null) {
                prefCursor = null
                mainCursor = null
                localCursor = null
                _hasMore.value = true
            }

            try {
                val district = prefs.selectedDistrict ?: currentUser?.district ?: prefs.detectedDistrict
                _userDistrict.value = district
                val preferredCats = AnalyticsService.getUserPreferredCategories().take(10)

                // Parallel fetching using async to speed up loading
                val greetingBatchDeferred = async {
                    // Fetch greetings (where type == 'greeting')
                    fetchGreetingPost()
                }

                val prefBatchDeferred = async {
                    if (preferredCats.isNotEmpty()) {
                        fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), null, district, strictFilter = false)
                    } else Pair(emptyList<NewsPost>(), null)
                }

                val mainBatchDeferred = async {
                    // Main feed should be diverse, so strictFilter = false
                    fetchFilteredBatch(FirebaseService.db.collection("news"), null, district, strictFilter = false)
                }

                val localBatchDeferred = async {
                    if (district != null) {
                        fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContains("categories", district), null, district, strictFilter = true)
                    } else Pair(emptyList<NewsPost>(), null)
                }

                val greetingPost = greetingBatchDeferred.await()
                val prefBatch = prefBatchDeferred.await()
                val mainBatch = mainBatchDeferred.await()
                val localBatch = localBatchDeferred.await()

                prefCursor = prefBatch.second
                mainCursor = mainBatch.second
                localCursor = localBatch.second

                var finalPosts = rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first)

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
                if (finalPosts.isEmpty() && mainCursor == null) _hasMore.value = false

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
                    if (preferredCats.isNotEmpty() && (prefCursor != null || _news.value.size < 60)) {
                        fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContainsAny("categories", preferredCats), prefCursor, district, false)
                    } else Pair(emptyList<NewsPost>(), null)
                }

                val mainBatchDeferred = async {
                    if (mainCursor != null) {
                        fetchFilteredBatch(FirebaseService.db.collection("news"), mainCursor, district, false)
                    } else Pair(emptyList<NewsPost>(), null)
                }

                val localBatchDeferred = async {
                    if (district != null && (localCursor != null || _news.value.size < 60)) {
                        fetchFilteredBatch(FirebaseService.db.collection("news").whereArrayContains("categories", district), localCursor, district, true)
                    } else Pair(emptyList<NewsPost>(), null)
                }

                val prefBatch = prefBatchDeferred.await()
                val mainBatch = mainBatchDeferred.await()
                val localBatch = localBatchDeferred.await()

                // Crucial: Allow cursor to become null if it reached the end
                prefCursor = prefBatch.second
                mainCursor = mainBatch.second
                localCursor = localBatch.second

                val newPosts = rankAndBlendPosts(prefBatch.first, mainBatch.first, localBatch.first)

                if (newPosts.isNotEmpty()) {
                    val currentIds = _news.value.map { it.id }.toSet()
                    _news.value = _news.value + newPosts.filter { !currentIds.contains(it.id) }
                }

                if (mainCursor == null && prefCursor == null && localCursor == null) _hasMore.value = false

            } catch (e: Exception) {
            } finally {
                isFetching = false
            }
        }
    }

    private suspend fun fetchFilteredBatch(baseQuery: Query, cursor: DocumentSnapshot?, district: String?, strictFilter: Boolean): Pair<List<NewsPost>, DocumentSnapshot?> {
        var currentCursor = cursor
        val filteredList = mutableListOf<NewsPost>()
        var attempts = 0
        
        // Target more items to avoid frequent small loads
        while (filteredList.size < MIN_BATCH_SIZE && attempts < 3) {
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
                
                if (!strictFilter) return@mapNotNull if (post.district.isNullOrBlank()) post else null // Allow only general news
                
                val postDist = post.district
                if (postDist.isNullOrBlank() || postDist == district || post.categories.any { it in globalCategories }) post else null
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

    private fun rankAndBlendPosts(pref: List<NewsPost>, main: List<NewsPost>, local: List<NewsPost>): List<NewsPost> {
        val allPosts = (pref + main + local).distinctBy { it.id }
        
        val festivalGreetings = allPosts.filter { it.type == "greeting" && it.likes == 0 }
        val quoteGreetings = allPosts.filter { it.type == "greeting" && it.likes == 1 }
        val normalNews = allPosts.filter { it.type != "greeting" }

        // 30% వార్తలను "తాజాదనం" ఆధారంగా, 70% వార్తలను "పర్సనలైజ్డ్ స్కోర్" ఆధారంగా ఎంచుకుందాం
        val totalToRank = normalNews.size
        val randomCount = (totalToRank * 0.3).toInt()

        // 1. తాజా వార్తల నుండి 30% తీసుకోవడం (Serendipity)
        val freshNews = normalNews.sortedByDescending { it.timestamp }.take(randomCount)
        
        // 2. మిగిలిన వార్తలకు స్కోర్ ఇవ్వడం (Personalized)
        val remainingNews = normalNews.filter { it !in freshNews }
        val scoredNews = remainingNews.map { post ->
            post to AnalyticsService.calculateRelevanceScore(post)
        }.sortedByDescending { it.second }.map { it.first }.toMutableList()

        // 3. రెండింటినీ కలపడం (FreshNews + Personalized)
        val blendedNews = (freshNews + scoredNews).toMutableList()

        // కోట్ కార్డును 6-10 స్థానంలో రాండమ్ గా పెట్టడం
        if (quoteGreetings.isNotEmpty()) {
            val size = blendedNews.size
            val minIdx = if (6 < size) 6 else if (size > 0) size - 1 else 0
            val maxIdx = if (10 < size) 10 else if (size > 0) size - 1 else 0
            val insertIndex = (minIdx..maxIdx).random()
            blendedNews.add(insertIndex, quoteGreetings.first())
        }

        // పండుగ కార్డును మొదట పెట్టడం
        if (festivalGreetings.isNotEmpty()) {
            blendedNews.add(0, festivalGreetings.first())
        }

        return blendedNews
    }

    private suspend fun fetchGreetingPost(): NewsPost? {
        return try {
            val snapshot = FirebaseService.db.collection("news")
                .whereEqualTo("type", "greeting")
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(1)
                .get()
                .await()
            
            snapshot.documents.firstOrNull()?.let { mapDocumentToNewsPost(it) }
        } catch (e: Exception) {
            null
        }
    }

    private fun mapDocumentToNewsPost(doc: DocumentSnapshot): NewsPost? {
        return try {
            val data = doc.data ?: return null
            NewsPost(
                id = doc.id,
                headline = com.alfanews.telugu.models.Headline(
                    telugu = (data["headline"] as? Map<*, *>)?.get("telugu") as? String ?: "",
                    english = (data["headline"] as? Map<*, *>)?.get("english") as? String ?: ""
                ),
                content = com.alfanews.telugu.models.Content(
                    telugu = (data["content"] as? Map<*, *>)?.get("telugu") as? String ?: "",
                    english = (data["content"] as? Map<*, *>)?.get("english") as? String ?: ""
                ),
                mediaUrl = data["mediaUrl"] as? String ?: "",
                mediaType = when (data["mediaType"] as? String) {
                    "VIDEO" -> com.alfanews.telugu.models.MediaType.VIDEO
                    else -> com.alfanews.telugu.models.MediaType.IMAGE
                },
                youtubeUrl = data["youtubeUrl"] as? String,
                postFormat = when (data["postFormat"] as? String) {
                    "16:9" -> com.alfanews.telugu.models.PostFormat.HORIZONTAL
                    else -> com.alfanews.telugu.models.PostFormat.VERTICAL
                },
                reporter = com.alfanews.telugu.models.Reporter(
                    id = (data["reporter"] as? Map<*, *>)?.get("id") as? String ?: "",
                    name = (data["reporter"] as? Map<*, *>)?.get("name") as? String ?: ""
                ),
                location = data["location"] as? String ?: "",
                timestamp = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: System.currentTimeMillis(),
                categories = data["categories"] as? List<String> ?: emptyList(),
                likes = (data["likes"] as? Long)?.toInt() ?: 0,
                comments = (data["comments"] as? Long)?.toInt() ?: 0,
                shares = (data["shares"] as? Long)?.toInt() ?: 0,
                originalUrl = data["originalUrl"] as? String,
                district = data["district"] as? String,
                verificationStatus = data["verificationStatus"] as? String ?: "UNVERIFIED",
                tags = data["tags"] as? List<String> ?: emptyList(),
                entities = (data["entities"] as? Map<String, Any>)?.let { entitiesMap ->
                    com.alfanews.telugu.models.Entities(
                        people = entitiesMap["people"] as? List<String> ?: emptyList(),
                        organizations = entitiesMap["organizations"] as? List<String> ?: emptyList(),
                        locations = entitiesMap["locations"] as? List<String> ?: emptyList()
                    )
                } ?: com.alfanews.telugu.models.Entities()
            )
        } catch (e: Exception) { null }
    }

    @SuppressLint("MissingPermission")
    fun detectLocation(context: Context, currentUser: User?, language: Language = Language.TELUGU) {
        viewModelScope.launch {
            try {
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
                val location = fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                if (location != null) {
                    val geocoder = Geocoder(context, Locale("te"))
                    val addresses = withContext(Dispatchers.IO) { geocoder.getFromLocation(location.latitude, location.longitude, 1) }
                    if (!addresses.isNullOrEmpty()) {
                        val detectedName = addresses[0].subAdminArea ?: addresses[0].locality ?: addresses[0].adminArea
                        Constants.ALL_DISTRICTS.find { it.contains(detectedName ?: "", ignoreCase = true) || (detectedName ?: "").contains(it, ignoreCase = true) }?.let { mappedDistrict ->
                            if (prefs.detectedDistrict != mappedDistrict) {
                                prefs.detectedDistrict = mappedDistrict
                                _userDistrict.value = mappedDistrict
                                loadNews(language, currentUser)
                            }
                        }
                    }
                }
            } catch (e: Exception) { }
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
