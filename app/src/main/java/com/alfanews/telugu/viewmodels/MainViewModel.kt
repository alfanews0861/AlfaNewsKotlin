package com.alfanews.telugu.viewmodels

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.PreferenceManager
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

enum class ThemeMode {
    SYSTEM, LIGHT, DARK
}

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    private var userListener: ListenerRegistration? = null

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _language = MutableStateFlow(prefs.language)
    val language: StateFlow<Language> = _language.asStateFlow()

    private val _activeTab = MutableStateFlow("home")
    val activeTab: StateFlow<String> = _activeTab.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _themeMode = MutableStateFlow(prefs.themeMode)
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    private val _showOnboarding = MutableStateFlow(prefs.shouldShowOnboarding)
    val showOnboarding: StateFlow<Boolean> = _showOnboarding.asStateFlow()

    private val _showRatingDialog = MutableStateFlow(false)
    val showRatingDialog: StateFlow<Boolean> = _showRatingDialog.asStateFlow()

    init {
        FirebaseService.auth.addAuthStateListener { auth ->
            userListener?.remove() 
            val firebaseUser = auth.currentUser
            if (firebaseUser == null) {
                _currentUser.value = null
                AnalyticsService.onUserLogout()
                return@addAuthStateListener
            }

            userListener = FirebaseService.db.collection("users").document(firebaseUser.uid)
                .addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        _currentUser.value = null
                        return@addSnapshotListener
                    }

                    if (snapshot != null && snapshot.exists()) {
                        val user = snapshot.toObject(User::class.java)?.copy(id = snapshot.id)
                        _currentUser.value = user
                        if (user != null) {
                            AnalyticsService.onUserLogin(user)
                        }
                    } else {
                        viewModelScope.launch {
                            try {
                                val newUser = User(
                                    id = firebaseUser.uid,
                                    name = firebaseUser.displayName ?: "User",
                                    email = firebaseUser.email,
                                    photoUrl = firebaseUser.photoUrl?.toString()
                                )
                                FirebaseService.db.collection("users").document(firebaseUser.uid).set(newUser).await()
                            } catch (creationError: Exception) {
                                _currentUser.value = null
                            }
                        }
                    }
                }
        }

        if (!prefs.hasRated) {
            prefs.appOpenCount += 1
            if (prefs.appOpenCount >= 10) {
                _showRatingDialog.value = true
                AnalyticsService.logAnalyticsEvent("rating_dialog_shown")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        userListener?.remove()
    }

    fun setActiveTab(tab: String) {
        _activeTab.value = tab
    }

    fun setLanguage(newLanguage: Language) {
        _language.value = newLanguage
        prefs.language = newLanguage
    }

    fun setThemeMode(mode: ThemeMode) {
        _themeMode.value = mode
        prefs.themeMode = mode
    }

    fun dismissOnboarding() {
        _showOnboarding.value = false
        prefs.shouldShowOnboarding = false
    }

    fun markAsRated() {
        prefs.hasRated = true
        _showRatingDialog.value = false
        AnalyticsService.logAnalyticsEvent("app_rated")
    }

    fun dismissRatingDialog() {
        _showRatingDialog.value = false
        prefs.appOpenCount = 0
        AnalyticsService.logAnalyticsEvent("rating_dialog_dismissed")
    }

    fun signOut() {
        viewModelScope.launch {
            FirebaseService.auth.signOut()
            _currentUser.value = null
            userListener?.remove()
            AnalyticsService.onUserLogout()
        }
    }

    fun updateUserProfile(
        name: String,
        phone: String,
        address: String,
        district: String,
        photoUri: Uri?,
        signatureUri: Uri?,
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val user = _currentUser.value ?: throw IllegalStateException("User not logged in")
                val updates = mutableMapOf<String, Any>(
                    "name" to name,
                    "phone" to phone,
                    "address" to address,
                    "district" to district,
                )

                photoUri?.let {
                    val photoRef = FirebaseStorage.getInstance().reference.child("profile_images/${user.id}")
                    val uploadTask = photoRef.putFile(it).await()
                    val downloadUrl = uploadTask.storage.downloadUrl.await()
                    updates["photoUrl"] = downloadUrl.toString()
                }

                signatureUri?.let {
                    val signatureRef = FirebaseStorage.getInstance().reference.child("signatures/${user.id}")
                    val uploadTask = signatureRef.putFile(it).await()
                    val downloadUrl = uploadTask.storage.downloadUrl.await()
                    updates["signatureUrl"] = downloadUrl.toString()
                }

                // ఒకవేళ అడ్మిన్ ప్రొఫైల్ అప్‌డేట్ చేస్తుంటే, గ్లోబల్ సంతకాన్ని కూడా అప్‌డేట్ చేయడం
                if (user.role == UserRole.ADMIN) {
                    val finalSignature = (updates["signatureUrl"] as? String) ?: user.signatureUrl
                    if (!finalSignature.isNullOrBlank()) {
                        try {
                            FirebaseService.db.collection("settings").document("android_config")
                                .update("authorized_signature", finalSignature).await()
                        } catch (e: Exception) {
                            FirebaseService.db.collection("settings").document("android_config")
                                .set(mapOf("authorized_signature" to finalSignature), SetOptions.merge()).await()
                        }
                    }
                }

                FirebaseService.db.collection("users").document(user.id).update(updates).await()
            } catch (e: Exception) {
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updateInterestSubscriptions(oldInterests: Set<String>, newInterests: Set<String>, district: String?) {
        val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()
        val d = district?.lowercase()?.replace(" ", "_") ?: return
        
        viewModelScope.launch {
            try {
                // Unsubscribe from old interest-based topics
                oldInterests.forEach { category ->
                    messaging.unsubscribeFromTopic("district_${d}_${category.lowercase()}").await()
                }
                // Subscribe to new interest-based topics
                newInterests.forEach { category ->
                    messaging.subscribeToTopic("district_${d}_${category.lowercase()}").await()
                }
            } catch (e: Exception) {
                // Log or handle error appropriately
            }
        }
    }

    fun toggleNotifications(enabled: Boolean) {
        viewModelScope.launch {
            val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()
            val user = _currentUser.value
            val district = user?.district?.lowercase()?.replace(" ", "_") ?: prefs.getEffectiveDistrict()?.lowercase()?.replace(" ", "_")
            
            // User interests tracked via categoryScores in User model
            val interests: Set<String> = user?.categoryScores?.keys ?: emptySet()
            
            try {
                if (enabled) {
                    messaging.subscribeToTopic("all_users").await()
                    
                    district?.let { d ->
                        messaging.subscribeToTopic("district_$d").await()
                        // Subscribe to interest-based topics
                        interests.forEach { category: String ->
                            messaging.subscribeToTopic("district_${d}_${category.lowercase()}").await()
                        }
                    }
                    prefs.isNotificationsEnabled = true
                } else {
                    messaging.unsubscribeFromTopic("all_users").await()
                    
                    district?.let { d ->
                        messaging.unsubscribeFromTopic("district_$d").await()
                        // Unsubscribe from interest-based topics
                        interests.forEach { category: String ->
                            messaging.unsubscribeFromTopic("district_${d}_${category.lowercase()}").await()
                        }
                    }
                    prefs.isNotificationsEnabled = false
                }
            } catch (e: Exception) {
                // Log or handle error appropriately
            }
        }
    }
}
