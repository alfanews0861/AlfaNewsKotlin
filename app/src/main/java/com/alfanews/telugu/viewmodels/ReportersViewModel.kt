package com.alfanews.telugu.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.toUserObject
import com.google.firebase.Timestamp
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*

data class ReporterStats(
    val todayPosts: Int = 0,
    val weekPosts: Int = 0,
    val totalPosts: Int = 0,
    val daysInactive: Int = 0,
    val inactivityStage: String = "ACTIVE"
)

class ReportersViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val IST_OFFSET_MS = 19_800_000L // UTC +5:30
        private const val DAY_MS = 86_400_000L
    }

    private val _reporters = MutableStateFlow<List<User>>(emptyList())
    val reporters: StateFlow<List<User>> = _reporters.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _reporterStats = MutableStateFlow<Map<String, ReporterStats>>(emptyMap())
    val reporterStats: StateFlow<Map<String, ReporterStats>> = _reporterStats.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _sortOrder = MutableStateFlow("Total") // "Total", "Today", "Week", "Inactive", "Points", "Name", "Recent"
    val sortOrder: StateFlow<String> = _sortOrder.asStateFlow()

    private val _statusFilter = MutableStateFlow("ALL") // "ALL", "ACTIVE", "REMINDER_3_9", "ADMIN_10_PLUS", "EXEMPT"
    val statusFilter: StateFlow<String> = _statusFilter.asStateFlow()

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setSortOrder(order: String) {
        _sortOrder.value = order
    }

    fun setStatusFilter(filter: String) {
        _statusFilter.value = filter
    }

    private fun getIstDateKey(epochMs: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("Asia/Kolkata")
        }
        return sdf.format(Date(epochMs))
    }

    private fun getIstDayNumber(epochMs: Long): Long {
        return (epochMs + IST_OFFSET_MS) / DAY_MS
    }

    private fun computeCanonicalStats(user: User, nowMs: Long = System.currentTimeMillis()): ReporterStats {
        val todayKey = getIstDateKey(nowMs)
        val sevenDayCutoff = getIstDateKey(nowMs - 6L * DAY_MS)

        var todayPosts = 0
        var weekPosts = 0
        user.dailyCounts.forEach { (dateKey, count) ->
            if (count <= 0) return@forEach
            if (dateKey == todayKey) todayPosts += count
            if (dateKey >= sevenDayCutoff && dateKey <= todayKey) weekPosts += count
        }

        val totalPosts = maxOf(user.totalNewsCount, weekPosts)

        val latestPromoMs = listOfNotNull(user.promotedAt, user.rejoinedAt).maxOrNull()
        val referenceMs = when {
            user.lastPostTimestamp != null && latestPromoMs != null -> maxOf(user.lastPostTimestamp, latestPromoMs)
            user.lastPostTimestamp != null -> user.lastPostTimestamp
            latestPromoMs != null -> latestPromoMs
            else -> user.createdAt
        }

        val daysInactive = if (referenceMs != null && referenceMs > 0L) {
            maxOf(0L, getIstDayNumber(nowMs) - getIstDayNumber(referenceMs)).toInt()
        } else {
            0
        }

        val stage = when {
            user.exemptFromInactivity || user.inactivityStage == "EXEMPT" -> "EXEMPT"
            daysInactive >= 10 -> "ADMIN_ALERTED_10D"
            daysInactive >= 7 -> "REMINDED_7D"
            daysInactive >= 3 -> "REMINDED_3D"
            else -> "ACTIVE"
        }

        return ReporterStats(
            todayPosts = todayPosts,
            weekPosts = weekPosts,
            totalPosts = totalPosts,
            daysInactive = daysInactive,
            inactivityStage = stage
        )
    }

    private fun populateCanonicalStats(users: List<User>) {
        val nowMs = System.currentTimeMillis()
        val updated = _reporterStats.value.toMutableMap()
        users.forEach { user ->
            updated[user.id] = computeCanonicalStats(user, nowMs)
        }
        _reporterStats.value = updated
    }

    private fun filterReportersList(
        list: List<User>,
        currentUser: User?,
        district: String?,
        mandal: String?
    ): List<User> {
        var finalList = list
        if (!district.isNullOrEmpty()) {
            finalList = finalList.filter { it.district.equals(district, ignoreCase = true) }
        }
        if (!mandal.isNullOrEmpty()) {
            finalList = finalList.filter { it.assignedMandal.equals(mandal, ignoreCase = true) }
        }
        if (currentUser?.role == UserRole.REGIONAL_INCHARGE && currentUser.assignedDistricts.isNotEmpty()) {
            if (district == null) {
                finalList = finalList.filter { user ->
                    currentUser.assignedDistricts.any { ad -> ad.equals(user.district, ignoreCase = true) }
                }
            }
        }
        return finalList
    }

    fun fetchReporters(currentUser: User?, district: String? = null, mandal: String? = null) {
        viewModelScope.launch {
            if (_reporters.value.isEmpty()) {
                _loading.value = true
            }
            val rolesList = listOf(
                "REPORTER", "reporter", "STAFF_REPORTER", "staff_reporter",
                "REGIONAL_INCHARGE", "regional_incharge", 2, "2", 3, "3"
            )

            // 1. Instant Cache path (< 15ms)
            try {
                val cacheSnap = FirebaseService.db.collection("users")
                    .whereIn("role", rolesList)
                    .limit(300)
                    .get(Source.CACHE)
                    .await()
                if (!cacheSnap.isEmpty) {
                    val cacheUsers = cacheSnap.documents
                        .filter { it.getBoolean("suspended") != true && it.getBoolean("previouslyDowngraded") != true }
                        .mapNotNull { it.toUserObject() }
                    val filteredCache = filterReportersList(cacheUsers, currentUser, district, mandal)
                    if (filteredCache.isNotEmpty()) {
                        _reporters.value = filteredCache
                        populateCanonicalStats(filteredCache)
                        _loading.value = false
                    }
                }
            } catch (_: Exception) {
                // Cache miss, proceed to server
            }

            // 2. Fresh Server path
            try {
                val snapshot = kotlinx.coroutines.withTimeoutOrNull(3000L) {
                    FirebaseService.db.collection("users")
                        .whereIn("role", rolesList)
                        .limit(300)
                        .get(Source.SERVER)
                        .await()
                }
                if (snapshot != null && !snapshot.isEmpty) {
                    val list = snapshot.documents
                        .filter { it.getBoolean("suspended") != true && it.getBoolean("previouslyDowngraded") != true }
                        .mapNotNull { it.toUserObject() }
                    val finalList = filterReportersList(list, currentUser, district, mandal)
                    _reporters.value = finalList
                    populateCanonicalStats(finalList)

                    // Background fallback merge for recent approved posts (including cross-mandal originalReporterId)
                    if (finalList.isNotEmpty()) {
                        fetchReportersForStats(finalList.map { it.id })
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                if (_reporters.value.isEmpty()) {
                    _reporters.value = emptyList()
                }
            } finally {
                _loading.value = false
            }
        }
    }

    fun fetchReportersForStats(reporterIds: List<String>) {
        if (reporterIds.isEmpty()) return
        viewModelScope.launch {
            val nowMs = System.currentTimeMillis()
            val todayKey = getIstDateKey(nowMs)
            val weekStartMs = nowMs - 6L * DAY_MS

            try {
                val targetCollections = _reporters.value.map { rep ->
                    val st = com.alfanews.telugu.utils.EditionRegistry.resolveStateCode(rep.state, rep.district)
                    com.alfanews.telugu.utils.EditionRegistry.getCollectionForEdition(st, null)
                }.ifEmpty { listOf("news") }.distinct()

                val perColLimit = if (targetCollections.size == 1) 300L else 100L
                val allDocs = mutableListOf<com.google.firebase.firestore.DocumentSnapshot>()
                for (colName in targetCollections) {
                    val snap = kotlinx.coroutines.withTimeoutOrNull(3500L) {
                        try {
                            FirebaseService.db.collection(colName)
                                .whereEqualTo("approved", true)
                                .whereEqualTo("isReporter", true)
                                .orderBy("timestamp", Query.Direction.DESCENDING)
                                .whereGreaterThanOrEqualTo("timestamp", Timestamp(Date(weekStartMs - DAY_MS)))
                                .limit(perColLimit)
                                .get().await()
                        } catch (_: Exception) { null }
                    }
                    if (snap != null) {
                        allDocs.addAll(snap.documents)
                    }
                }
                if (allDocs.isEmpty()) return@launch

                val liveTodayCounts = mutableMapOf<String, Int>()
                val liveWeekCounts = mutableMapOf<String, Int>()

                allDocs.forEach { doc ->
                    if (doc.getBoolean("isCitizen") == true) return@forEach
                    val isRep = doc.getBoolean("isReporter") == true ||
                        doc.getString("processingType") == "REPORTER_SUBMISSION" ||
                        !doc.getString("originalReporterId").isNullOrBlank()
                    if (!isRep) return@forEach

                    // Prioritize originalReporterId so cross-mandal posts ("Alfa News Desk") count for the submitting reporter
                    val originalId = doc.getString("originalReporterId")?.trim()?.takeIf { it.isNotEmpty() }
                    val reporterMapId = (doc.get("reporter") as? Map<*, *>)?.get("id")?.toString()?.trim()?.takeIf { it.isNotEmpty() }
                    val reporterId = originalId ?: reporterMapId ?: return@forEach
                    if (reporterId.uppercase().startsWith("BOT_") || reporterId.equals("ALFA_DESK", ignoreCase = true)) {
                        return@forEach
                    }

                    val rawTs = doc.get("timestamp")
                    val ts = when (rawTs) {
                        is Timestamp -> rawTs.toDate().time
                        is Number -> {
                            val v = rawTs.toLong()
                            if (v > 100_000_000_000L) v else v * 1000L
                        }
                        else -> 0L
                    }
                    if (ts <= 0L) return@forEach

                    val postDateKey = getIstDateKey(ts)
                    val sevenDayCutoff = getIstDateKey(nowMs - 6L * DAY_MS)
                    if (postDateKey >= sevenDayCutoff && postDateKey <= todayKey) {
                        liveWeekCounts[reporterId] = (liveWeekCounts[reporterId] ?: 0) + 1
                        if (postDateKey == todayKey) {
                            liveTodayCounts[reporterId] = (liveTodayCounts[reporterId] ?: 0) + 1
                        }
                    }
                }

                val merged = _reporterStats.value.toMutableMap()
                reporterIds.forEach { id ->
                    val existing = merged[id] ?: ReporterStats()
                    val mergedToday = maxOf(existing.todayPosts, liveTodayCounts[id] ?: 0)
                    val mergedWeek = maxOf(existing.weekPosts, liveWeekCounts[id] ?: 0)
                    val mergedTotal = maxOf(existing.totalPosts, mergedWeek)
                    val mergedDaysInactive = if (mergedToday > 0) 0 else existing.daysInactive
                    val mergedStage = if (mergedToday > 0 && existing.inactivityStage != "EXEMPT") {
                        "ACTIVE"
                    } else {
                        existing.inactivityStage
                    }
                    merged[id] = existing.copy(
                        todayPosts = mergedToday,
                        weekPosts = mergedWeek,
                        totalPosts = mergedTotal,
                        daysInactive = mergedDaysInactive,
                        inactivityStage = mergedStage
                    )
                }
                _reporterStats.value = merged
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    val filteredReporters: StateFlow<List<User>> = combine(
        _reporters, _searchQuery, _sortOrder, _statusFilter, _reporterStats
    ) { reporters, query, sort, statusFilter, stats ->
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

        if (statusFilter != "ALL") {
            list = list.filter { user ->
                val stage = stats[user.id]?.inactivityStage ?: user.inactivityStage
                when (statusFilter) {
                    "ACTIVE" -> stage == "ACTIVE"
                    "REMINDER_3_9" -> stage == "REMINDED_3D" || stage == "REMINDED_7D"
                    "ADMIN_10_PLUS" -> stage == "ADMIN_ALERTED_10D"
                    "EXEMPT" -> stage == "EXEMPT" || user.exemptFromInactivity
                    else -> true
                }
            }
        }

        when (sort) {
            "Total" -> list.sortedByDescending { stats[it.id]?.totalPosts ?: it.totalNewsCount }
            "Points" -> list.sortedByDescending { it.points }
            "Today" -> list.sortedByDescending { stats[it.id]?.todayPosts ?: 0 }
            "Week" -> list.sortedByDescending { stats[it.id]?.weekPosts ?: 0 }
            "Inactive" -> list.sortedByDescending { stats[it.id]?.daysInactive ?: 0 }
            "Name" -> list.sortedBy { it.name.lowercase() }
            else -> list
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    fun toggleReporterExemption(reporterId: String, exempt: Boolean, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            try {
                val updates = mapOf<String, Any>(
                    "exemptFromInactivity" to exempt,
                    "reporterActivity.inactivityStage" to if (exempt) "EXEMPT" else "ACTIVE"
                )
                FirebaseService.db.collection("users").document(reporterId).update(updates).await()

                val updatedReporters = _reporters.value.map { u ->
                    if (u.id == reporterId) {
                        u.copy(
                            exemptFromInactivity = exempt,
                            inactivityStage = if (exempt) "EXEMPT" else "ACTIVE"
                        )
                    } else u
                }
                _reporters.value = updatedReporters
                populateCanonicalStats(updatedReporters)

                val msg = if (exempt) {
                    "పుష్ రిమైండర్లు నిలిపివేయబడ్డాయి (మినహాయింపు)."
                } else {
                    "పుష్ రిమైండర్లు తిరిగి ప్రారంభించబడ్డాయి."
                }
                onResult(true, msg)
            } catch (e: Exception) {
                onResult(false, e.message ?: "అప్‌డేట్ విఫలమైంది.")
            }
        }
    }

    fun syncReporterActivityStats(onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val result = FirebaseFunctionsService.syncReporterActivityStats(2000)
                if (result.isSuccess) {
                    val data = result.getOrNull()
                    val msg = data?.get("message")?.toString()
                        ?: "వార్తల గణాంకాలు విజయవంతంగా సింక్ చేయబడ్డాయి."
                    onResult(true, msg)
                } else {
                    onResult(false, result.exceptionOrNull()?.message ?: "సింక్ విఫలమైంది.")
                }
            } catch (e: Exception) {
                onResult(false, e.message ?: "సింక్ లోపం.")
            } finally {
                _loading.value = false
            }
        }
    }

    fun triggerReporterActivityCheck(onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val result = FirebaseFunctionsService.triggerReporterActivityCheck(dryRun = false)
                if (result.isSuccess) {
                    val data = result.getOrNull()
                    val scanned = data?.get("reportersScanned") ?: 0
                    val day3 = data?.get("day3RemindersSent") ?: 0
                    val day7 = data?.get("day7RemindersSent") ?: 0
                    val adminAlerts = data?.get("adminAlertsSent") ?: 0
                    onResult(
                        true,
                        "పుష్ రిమైండర్ తనిఖీ పూర్తయింది — పరిశీలించినవారు: $scanned · 3వ రోజు: $day3 · 7వ రోజు: $day7 · అడ్మిన్ అలర్ట్‌లు: $adminAlerts"
                    )
                } else {
                    onResult(false, result.exceptionOrNull()?.message ?: "పరిశీలన విఫలమైంది.")
                }
            } catch (e: Exception) {
                onResult(false, e.message ?: "error")
            } finally {
                _loading.value = false
            }
        }
    }
}
