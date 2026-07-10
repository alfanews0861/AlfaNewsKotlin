package com.alfanews.telugu.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.toUserObject
import com.google.firebase.Timestamp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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

    fun fetchReporters(district: String, mandal: String? = null) {
        if (district.isEmpty()) {
            _reporters.value = emptyList()
            return
        }

        viewModelScope.launch {
            _loading.value = true
            try {
                var query = FirebaseService.db.collection("users")
                    .whereEqualTo("role", UserRole.REPORTER.name)
                    .whereEqualTo("district", district)
                
                if (!mandal.isNullOrEmpty()) {
                    query = query.whereEqualTo("assignedMandal", mandal)
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
                    val todayQuery = FirebaseService.db.collection("news")
                        .whereEqualTo("reporter.id", id)
                        .whereGreaterThanOrEqualTo("timestamp", Timestamp(todayStart))
                        .get().await()
                    
                    val weekQuery = FirebaseService.db.collection("news")
                        .whereEqualTo("reporter.id", id)
                        .whereGreaterThanOrEqualTo("timestamp", Timestamp(weekStart))
                        .get().await()
                        
                    statsMap[id] = ReporterStats(
                        todayPosts = todayQuery.size(),
                        weekPosts = weekQuery.size()
                    )
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            _reporterStats.value = statsMap
        }
    }
}
