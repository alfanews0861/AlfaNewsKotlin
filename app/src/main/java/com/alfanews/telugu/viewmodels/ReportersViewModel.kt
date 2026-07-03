package com.alfanews.telugu.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.toUserObject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ReportersViewModel(application: Application) : AndroidViewModel(application) {

    private val _reporters = MutableStateFlow<List<User>>(emptyList())
    val reporters: StateFlow<List<User>> = _reporters.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

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
                _reporters.value = snapshot.documents.mapNotNull { it.toUserObject() }
            } catch (e: Exception) {
                e.printStackTrace()
                _reporters.value = emptyList()
            } finally {
                _loading.value = false
            }
        }
    }
}
