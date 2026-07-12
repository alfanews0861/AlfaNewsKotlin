package com.alfanews.telugu.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.toUserObject
import com.google.firebase.Timestamp
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.*

data class ReporterStats(
    val todayPosts: Int = 0,
    val weekPosts: Int = 0
)

class ReportersViewModel(application: Application) : AndroidViewModel(application) {

    private val _reporters = MutableStateFlow<List<User>>(emptyList())
    val reporters: StateFlow<List<User>> = _reporters.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _reporterStats = MutableStateFlow<Map<String, ReporterStats>>(emptyMap())
    val reporterStats: StateFlow<Map<String, ReporterStats>> = _reporterStats.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _sortOrder = MutableStateFlow("Recent") // "Recent", "Points", "Today", "Week", "Name"
    val sortOrder: StateFlow<String> = _sortOrder.asStateFlow()

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setSortOrder(order: String) {
        _sortOrder.value = order
    }

    fun fetchReporters(currentUser: User, district: String? = null, mandal: String? = null) {
        viewModelScope.launch {
            _loading.value = true
            try {
                var query = FirebaseService.db.collection("users")
                    .whereEqualTo("role", UserRole.REPORTER.name)
                
                if (district != null && district.isNotEmpty()) {
                    query = query.whereEqualTo("district", district)
                }
                
                if (mandal != null && mandal.isNotEmpty()) {
                    query = query.whereEqualTo("assignedMandal", mandal)
                }
                
                if (currentUser.role == UserRole.REGIONAL_INCHARGE && currentUser.assignedDistricts.isNotEmpty()) {
                    if (district == null) {
                        query = query.whereIn("district", currentUser.assignedDistricts)
                    }
                }

                val snapshot = query.get().await()
                val list = snapshot.documents.mapNotNull { it.toUserObject() }
                _reporters.value = list
                
                // Fetch stats for these reporters
                if (list.isNotEmpty()) {
                    fetchReportersForStats(list.map { it.id })
                }
            } catch (e: Exception) {
                e.printStackTrace()
                _reporters.value = emptyList()
            } finally {
                _loading.value = false
            }
        }
    }

    fun fetchReportersForStats(reporterIds: List<String>) {
        viewModelScope.launch {
            val statsMap = _reporterStats.value.toMutableMap()
            
            val cal = Calendar.getInstance()
            cal.set(Calendar.HOUR_OF_DAY, 0)
            cal.set(Calendar.MINUTE, 0)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            val todayStart = cal.time
            
            cal.add(Calendar.DAY_OF_YEAR, -7)
            val weekStart = cal.time

            reporterIds.forEach { id ->
                try {
                    // 🚀 FETCH ALL RECENT POSTS for this reporter and filter in Kotlin
                    // This handles mixed data types (Timestamp vs Long) in Firestore
                    val snapshot = FirebaseService.db.collection("news")
                        .whereEqualTo("reporter.id", id)
                        .whereGreaterThanOrEqualTo("timestamp", com.google.firebase.Timestamp(weekStart))
                        .get().await()
                    
                    val posts = snapshot.documents.map { doc ->
                        val data = doc.data ?: return@map 0L
                        when (val ts = data["timestamp"]) {
                            is com.google.firebase.Timestamp -> ts.toDate().time
                            is Number -> ts.toLong()
                            else -> 0L
                        }
                    }

                    val todayCount = posts.count { it >= todayStart.time }
                    val weekCount = posts.count { it >= weekStart.time }
                        
                    statsMap[id] = ReporterStats(
                        todayPosts = todayCount,
                        weekPosts = weekCount
                    )
                } catch (e: Exception) {
                    // Fallback for safety
                    try {
                        val snapshot = FirebaseService.db.collection("news")
                            .whereEqualTo("reporter.id", id)
                            .whereGreaterThanOrEqualTo("timestamp", weekStart.time)
                            .get().await()

                        val posts = snapshot.documents.map { doc ->
                            val data = doc.data ?: return@map 0L
                            when (val ts = data["timestamp"]) {
                                is com.google.firebase.Timestamp -> ts.toDate().time
                                is Number -> ts.toLong()
                                else -> 0L
                            }
                        }
                        statsMap[id] = ReporterStats(
                            todayPosts = posts.count { it >= todayStart.time },
                            weekPosts = posts.count { it >= weekStart.time }
                        )
                    } catch (innerE: Exception) {
                        innerE.printStackTrace()
                    }
                }
            }
            _reporterStats.value = statsMap
        }
    }

    val filteredReporters: StateFlow<List<User>> = combine(
        _reporters, _searchQuery, _sortOrder, _reporterStats
    ) { reporters, query, sort, stats ->
        var list = if (query.isBlank()) {
            reporters
        } else {
            reporters.filter { 
                it.name.contains(query, ignoreCase = true) || 
                (it.phone ?: "").contains(query) ||
                (it.district ?: "").contains(query, ignoreCase = true) ||
                (it.assignedMandal ?: "").contains(query, ignoreCase = true)
            }
        }

        when (sort) {
            "Points" -> list.sortedByDescending { it.points }
            "Today" -> list.sortedByDescending { stats[it.id]?.todayPosts ?: 0 }
            "Week" -> list.sortedByDescending { stats[it.id]?.weekPosts ?: 0 }
            "Name" -> list.sortedBy { it.name }
            else -> list // Default Recent/Original
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())
}
