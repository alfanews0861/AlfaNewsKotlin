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
import com.alfanews.telugu.models.ThemeMode
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

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
                        // Extract role explicitly as a string first to avoid deserialization issues
                        val roleStr = snapshot.getString("role") ?: "SUBSCRIBER"
                        val parsedRole = try {
                            UserRole.valueOf(roleStr.uppercase())
                        } catch (e: Exception) {
                            UserRole.SUBSCRIBER
                        }

                        val userObj = try {
                            // First attempt: Automatic mapping with explicit role conversion
                            val baseUser = snapshot.toObject(User::class.java)
                            baseUser?.copy(
                                id = snapshot.id,
                                role = parsedRole  // Use the explicitly parsed role
                            )
                        } catch (e: Exception) {
                            // Second attempt: Manual mapping if automatic fails (Resilience)
                            // This ensures we always get the correct role from Firestore
                            User(
                                id = snapshot.id,
                                name = snapshot.getString("name") ?: "User",
                                email = snapshot.getString("email"),
                                phone = snapshot.getString("phone"),
                                photoUrl = snapshot.getString("photoUrl"),
                                role = parsedRole,  // Use the explicitly parsed role
                                address = snapshot.getString("address"),
                                district = snapshot.getString("district"),
                                pushEnabled = snapshot.getBoolean("pushEnabled") ?: true,
                                constituency = snapshot.getString("constituency"),
                                state = snapshot.getString("state"),
                                promotedBy = snapshot.getString("promotedBy"),
                                signatureUrl = snapshot.getString("signatureUrl"),
                                idCardUrl = snapshot.getString("idCardUrl"),
                                assignedMandal = snapshot.getString("assignedMandal"),
                                assignedDistricts = (snapshot.get("assignedDistricts") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                                fcmTokens = (snapshot.get("fcmTokens") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                                lastTokenUpdate = snapshot.getLong("lastTokenUpdate"),
                                categoryScores = (snapshot.get("categoryScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                                reporterScores = (snapshot.get("reporterScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                                tagScores = (snapshot.get("tagScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                                peopleScores = (snapshot.get("peopleScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                                organizationScores = (snapshot.get("organizationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                                locationScores = (snapshot.get("locationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap()
                            )
                        }
                        
                        val oldUser = _currentUser.value
                        _currentUser.value = userObj
                        
                        if (userObj != null) {
                            AnalyticsService.onUserLogin(userObj)
                            
                            // ఒకవేళ యూజర్ ఆసక్తులు లేదా జిల్లా మారితే, నోటిఫికేషన్ సబ్‌స్క్రిప్షన్లను అప్‌డేట్ చేయడం
                            if (prefs.isNotificationsEnabled) {
                                val oldInterests = oldUser?.categoryScores?.keys ?: emptySet()
                                val newInterests = userObj.categoryScores.keys
                                val oldDistrict = oldUser?.district
                                val newDistrict = userObj.district
                                
                                if (oldInterests != newInterests || oldDistrict != newDistrict) {
                                    updateInterestSubscriptions(oldInterests, newInterests, newDistrict)
                                }
                            }
                        }
                    } else {
                        viewModelScope.launch {
                            try {
                                val newUser = User(
                                    id = firebaseUser.uid,
                                    name = firebaseUser.displayName ?: "User",
                                    email = firebaseUser.email,
                                    photoUrl = firebaseUser.photoUrl?.toString(),
                                    role = UserRole.SUBSCRIBER
                                )
                                // Use merge to avoid overwriting if the document was just created by another process
                                FirebaseService.db.collection("users").document(firebaseUser.uid)
                                    .set(newUser, SetOptions.merge()).await()
                            } catch (creationError: Exception) {
                                _currentUser.value = null
                            }
                        }
                    }
                }
        }

        if (!prefs.hasRated && prefs.ratingDialogShownCount < 5) {
            prefs.appOpenCount += 1
            if (prefs.appOpenCount > 10) {
                val currentTime = System.currentTimeMillis()
                val fiveDaysInMillis = 5L * 24 * 60 * 60 * 1000
                
                if (prefs.ratingDialogShownCount == 0 || (currentTime - prefs.lastRatingDialogTime) >= fiveDaysInMillis) {
                    _showRatingDialog.value = true
                    prefs.ratingDialogShownCount += 1
                    prefs.lastRatingDialogTime = currentTime
                    AnalyticsService.logAnalyticsEvent("rating_dialog_shown")
                }
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
        val user = _currentUser.value ?: return
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val updates = mutableMapOf<String, Any>(
                    "name" to name,
                    "phone" to phone,
                    "address" to address,
                    "district" to district,
                )

                val photoDeferred = photoUri?.let {
                    async {
                        val photoRef = FirebaseStorage.getInstance().reference.child("profile_images/${user.id}")
                        val uploadTask = photoRef.putFile(it).await()
                        uploadTask.storage.downloadUrl.await().toString()
                    }
                }

                val signatureDeferred = signatureUri?.let {
                    async {
                        val signatureRef = FirebaseStorage.getInstance().reference.child("signatures/${user.id}")
                        val uploadTask = signatureRef.putFile(it).await()
                        uploadTask.storage.downloadUrl.await().toString()
                    }
                }

                photoDeferred?.await()?.let { updates["photoUrl"] = it }
                signatureDeferred?.await()?.let { updates["signatureUrl"] = it }

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
                    messaging.subscribeToTopic("breaking_news").await()
                    
                    district?.let { d ->
                        messaging.subscribeToTopic("district_$d").await()
                        // Subscribe to interest-based topics
                        interests.forEach { category: String ->
                            messaging.subscribeToTopic("district_${d}_${category.lowercase()}").await()
                        }
                    }
                } else {
                    messaging.unsubscribeFromTopic("all_users").await()
                    messaging.unsubscribeFromTopic("breaking_news").await()
                    
                    district?.let { d ->
                        messaging.unsubscribeFromTopic("district_$d").await()
                        // Unsubscribe from interest-based topics
                        interests.forEach { category: String ->
                            messaging.unsubscribeFromTopic("district_${d}_${category.lowercase()}").await()
                        }
                    }
                }

                // Firestore మరియు Preferences అప్‌డేట్
                prefs.isNotificationsEnabled = enabled
                user?.id?.let { uid ->
                    FirebaseService.db.collection("users").document(uid).update("pushEnabled", enabled).await()
                }
            } catch (e: Exception) {
                // Log or handle error appropriately
            }
        }
    }
}
