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
                    .whereIn("role", listOf("REPORTER", 2, 2.0))
                
                if (district != null && district.isNotEmpty()) {
                    query = query.whereEqualTo("district", district)
                }
                
                if (mandal != null && mandal.isNotEmpty()) {
                    query = query.whereEqualTo("assignedMandal", mandal)
                }

                val snapshot = query.get().await()
                var list = snapshot.documents.mapNotNull { it.toUserObject() }

                // In-memory filter for REGIONAL_INCHARGE to avoid Firestore multiple 'whereIn' crash
                if (currentUser.role == UserRole.REGIONAL_INCHARGE && currentUser.assignedDistricts.isNotEmpty()) {
                    if (district == null) {
                        list = list.filter { user -> currentUser.assignedDistricts.contains(user.district) }
                    }
                }

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

            try {
                // 🚀 OPTIMIZED: Query ONLY reporter posts using isReporter filter to save reads
                val timestampQuery = FirebaseService.db.collection("news")
                    .whereEqualTo("approved", true)
                    .whereEqualTo("isReporter", true)
                    .whereGreaterThanOrEqualTo("timestamp", com.google.firebase.Timestamp(weekStart))
                    .get()

                val longQuery = FirebaseService.db.collection("news")
                    .whereEqualTo("approved", true)
                    .whereEqualTo("isReporter", true)
                    .whereGreaterThanOrEqualTo("timestamp", weekStart.time)
                    .get()

                val snapshots = listOf(timestampQuery.await(), longQuery.await())
                
                // Track post counts per reporter
                val todayCounts = mutableMapOf<String, Int>()
                val weekCounts = mutableMapOf<String, Int>()

                snapshots.forEach { snapshot ->
                    snapshot.documents.forEach { doc ->
                        val isRep = doc.getBoolean("isReporter") ?: 
                                    (doc.getString("processingType") == "REPORTER_SUBMISSION")
                        if (!isRep) return@forEach

                        val reporterId = (doc.get("reporter") as? Map<*, *>)?.get("id") as? String ?: return@forEach
                        val rawTs = doc.get("timestamp")
                        
                        val ts = when (rawTs) {
                            is com.google.firebase.Timestamp -> rawTs.toDate().time
                            is Number -> rawTs.toLong()
                            else -> 0L
                        }

                        if (ts >= weekStart.time) {
                            weekCounts[reporterId] = (weekCounts[reporterId] ?: 0) + 1
                            if (ts >= todayStart.time) {
                                todayCounts[reporterId] = (todayCounts[reporterId] ?: 0) + 1
                            }
                        }
                    }
                }

                // Update the stats map for all requested reporters
                reporterIds.forEach { id ->
                    statsMap[id] = ReporterStats(
                        todayPosts = todayCounts[id] ?: 0,
                        weekPosts = weekCounts[id] ?: 0
                    )
                }
                
                _reporterStats.value = statsMap
            } catch (e: Exception) {
                e.printStackTrace()
            }
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

    fun triggerReporterActivityCheck(onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val result = com.alfanews.telugu.services.FirebaseFunctionsService.triggerReporterActivityCheck()
                if (result.isSuccess) {
                    val data = result.getOrNull()
                    val scanned = data?.get("reportersScanned") ?: 0
                    val acted = data?.get("inactiveActedOn") ?: 0
                    onResult(true, "పరిశీలన పూర్తయింది! ${scanned} రిపోర్టర్లను తనిఖీ చేసి, ${acted} మందిపై చర్యలు/హెచ్చరికలు అమలు చేసాము.")
                } else {
                    onResult(false, result.exceptionOrNull()?.message ?: "పరిశీలన ఫెయిల్ అయింది.")
                }
            } catch (e: Exception) {
                onResult(false, e.message ?: "error")
            } finally {
                _loading.value = false
            }
        }
    }
}
