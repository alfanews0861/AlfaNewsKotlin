package com.alfanews.telugu.viewmodels

import android.app.Application
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
            _loading.value = true
            try {
                val calendar = Calendar.getInstance()
                
                // Try current month first
                var year = calendar.get(Calendar.YEAR)
                var month = (calendar.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
                var monthlyId = "${year}_${month}"

                var snapshot = FirebaseService.db.collection("monthly_leaderboard")
                    .document(monthlyId)
                    .collection("reporters")
                    .orderBy("points", Query.Direction.DESCENDING)
                    .limit(10)
                    .get()
                    .await()

                // If current month is empty, try previous month
                if (snapshot.isEmpty) {
                    calendar.add(Calendar.MONTH, -1)
                    year = calendar.get(Calendar.YEAR)
                    month = (calendar.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
                    monthlyId = "${year}_${month}"
                    
                    snapshot = FirebaseService.db.collection("monthly_leaderboard")
                        .document(monthlyId)
                        .collection("reporters")
                        .orderBy("points", Query.Direction.DESCENDING)
                        .limit(10)
                        .get()
                        .await()
                }

                val entries = snapshot.documents.mapNotNull { doc ->
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
                _leaderboard.value = entries
            } catch (e: Exception) {
                e.printStackTrace()
                _leaderboard.value = emptyList()
            } finally {
                _loading.value = false
            }
        }
    }
}
