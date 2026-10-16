package com.alfanews.telugu.viewmodels

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.Query
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.*

class LeaderboardViewModel(application: Application) : AndroidViewModel(application) {

    private val _leaderboard = MutableStateFlow<List<User>>(emptyList())
    val leaderboard: StateFlow<List<User>> = _leaderboard.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init {
        fetchLeaderboard()
    }

    fun fetchLeaderboard() {
        viewModelScope.launch {
            _loading.value = _leaderboard.value.isEmpty()
            try {
                val calendar = Calendar.getInstance()
                val year = calendar.get(Calendar.YEAR)
                val month = (calendar.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
                val monthlyId = "${year}_${month}"

                val reportersColl = FirebaseService.db.collection("monthly_leaderboard")
                    .document(monthlyId)
                    .collection("reporters")
                    .orderBy("points", Query.Direction.DESCENDING)
                    .limit(10)

                // 1. ⚡ INSTANT CACHE DISPLAY (< 15ms)
                if (_leaderboard.value.isEmpty()) {
                    try {
                        val cachedSnap = reportersColl.get(com.google.firebase.firestore.Source.CACHE).await()
                        val cachedEntries = cachedSnap.documents.mapNotNull { doc ->
                            val data = doc.data ?: return@mapNotNull null
                            User(
                                id = doc.id,
                                name = data["name"] as? String ?: "Reporter",
                                photoUrl = data["photoUrl"] as? String,
                                district = data["district"] as? String,
                                assignedMandal = data["assignedMandal"] as? String,
                                points = (data["points"] as? Number)?.toInt() ?: 0
                            )
                        }
                        if (cachedEntries.isNotEmpty()) {
                            _leaderboard.value = cachedEntries
                            _loading.value = false
                        }
                    } catch (_: Exception) {}
                }

                // 2. ⚡ LIVE SERVER QUERY (2.5s lean timeout)
                var snapshot = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                    try {
                        reportersColl.get().await()
                    } catch (_: Exception) { null }
                }

                // If current month is empty, try previous month
                if (snapshot == null || snapshot.isEmpty) {
                    calendar.add(Calendar.MONTH, -1)
                    val prevYear = calendar.get(Calendar.YEAR)
                    val prevMonth = (calendar.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
                    val prevMonthlyId = "${prevYear}_${prevMonth}"
                    
                    snapshot = kotlinx.coroutines.withTimeoutOrNull(2500L) {
                        try {
                            FirebaseService.db.collection("monthly_leaderboard")
                                .document(prevMonthlyId)
                                .collection("reporters")
                                .orderBy("points", Query.Direction.DESCENDING)
                                .limit(10)
                                .get()
                                .await()
                        } catch (_: Exception) { null }
                    }
                }

                var entries = snapshot?.documents?.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    User(
                        id = doc.id,
                        name = data["name"] as? String ?: "Reporter",
                        photoUrl = data["photoUrl"] as? String,
                        district = data["district"] as? String,
                        assignedMandal = data["assignedMandal"] as? String,
                        points = (data["points"] as? Number)?.toInt() ?: 0
                    )
                } ?: emptyList()

                // 🚀 FALLBACK: If monthly leaderboard is still empty, load top reporters directly from users collection
                if (entries.isEmpty() && _leaderboard.value.isEmpty()) {
                    try {
                        val usersSnap = kotlinx.coroutines.withTimeoutOrNull(3000L) {
                            FirebaseService.db.collection("users")
                                .whereEqualTo("role", "REPORTER")
                                .limit(100)
                                .get()
                                .await()
                        }
                        if (usersSnap != null && !usersSnap.isEmpty) {
                            entries = usersSnap.documents.mapNotNull { doc ->
                                val data = doc.data ?: return@mapNotNull null
                                val pts = (data["points"] as? Number)?.toInt() ?: 0
                                if (pts <= 0) return@mapNotNull null
                                User(
                                    id = doc.id,
                                    name = data["name"] as? String ?: "Reporter",
                                    photoUrl = data["photoUrl"] as? String,
                                    district = data["district"] as? String,
                                    assignedMandal = data["assignedMandal"] as? String,
                                    points = pts
                                )
                            }.sortedByDescending { it.points }.take(10)
                        }
                    } catch (e: Exception) {
                        Log.e("LeaderboardVM", "Fallback users query failed: ${e.message}")
                    }
                }

                if (entries.isNotEmpty()) {
                    _leaderboard.value = entries
                }
            } catch (e: Exception) {
                e.printStackTrace()
                if (_leaderboard.value.isEmpty()) {
                    _leaderboard.value = emptyList()
                }
            } finally {
                _loading.value = false
            }
        }
    }
}
