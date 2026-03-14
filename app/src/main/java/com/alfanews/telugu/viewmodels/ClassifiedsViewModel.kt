package com.alfanews.telugu.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.ClassifiedAd
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ClassifiedsViewModel : ViewModel() {
    // Holds the raw, unfiltered list from Firestore
    private val _allAds = MutableStateFlow<List<ClassifiedAd>>(emptyList())

    // Holds the current category filter
    private val _selectedCategory = MutableStateFlow("All")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    // The final, filtered list of ads to be displayed by the UI
    private val _ads = MutableStateFlow<List<ClassifiedAd>>(emptyList())
    val ads: StateFlow<List<ClassifiedAd>> = _ads.asStateFlow()

    // Category counts map
    private val _categoryCounts = MutableStateFlow<Map<String, Int>>(emptyMap())
    val categoryCounts: StateFlow<Map<String, Int>> = _categoryCounts.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private var listenerRegistration: ListenerRegistration? = null

    init {
        // This coroutine will automatically re-filter the ads whenever
        // the full list or the selected category changes.
        viewModelScope.launch {
            combine(_allAds, _selectedCategory) { ads, category ->
                // Update counts whenever allAds changes
                val counts = ads.groupBy { it.category }.mapValues { it.value.size }
                _categoryCounts.value = counts

                if (category == "All") {
                    ads
                } else {
                    ads.filter { it.category == category }
                }
            }.collect { filteredAds ->
                _ads.value = filteredAds
            }
        }
    }

    fun setCategory(category: String) {
        _selectedCategory.value = category
    }

    fun loadAds(userId: String? = null) {
        viewModelScope.launch {
            _loading.value = true
            listenerRegistration?.remove()
            try {
                val adsRef = FirebaseService.db.collection("classifieds")
                val query = if (userId != null) {
                    adsRef.whereEqualTo("userId", userId)
                        .orderBy("timestamp", Query.Direction.DESCENDING)
                } else {
                    adsRef.orderBy("timestamp", Query.Direction.DESCENDING)
                }
                listenerRegistration = query.addSnapshotListener { snapshot, error ->
                    if (error != null) {
                        _loading.value = false
                        return@addSnapshotListener
                    }
                    if (snapshot != null) {
                        val fetchedAds = snapshot.documents.mapNotNull { doc ->
                            try {
                                val data = doc.data ?: return@mapNotNull null
                                ClassifiedAd(
                                    id = doc.id,
                                    userId = data["userId"] as? String ?: "",
                                    userName = data["userName"] as? String ?: "",
                                    title = data["title"] as? String ?: "",
                                    description = data["description"] as? String ?: "",
                                    price = (data["price"] as? Number)?.toDouble() ?: 0.0,
                                    category = data["category"] as? String ?: "",
                                    location = data["location"] as? String ?: "",
                                    imageUrl = data["imageUrl"] as? String ?: "",
                                    contactPhone = data["contactPhone"] as? String ?: "",
                                    whatsappNumber = data["whatsappNumber"] as? String,
                                    timestamp = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time
                                        ?: System.currentTimeMillis()
                                )
                            } catch (e: Exception) {
                                null
                            }
                        }
                        _allAds.value = fetchedAds
                        _loading.value = false
                    }
                }
            } catch (e: Exception) {
                _loading.value = false
            }
        }
    }

    suspend fun deleteAd(adId: String): Result<Unit> {
        return try {
            FirebaseService.db.collection("classifieds")
                .document(adId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun onCleared() {
        super.onCleared()
        listenerRegistration?.remove()
    }
}
