package com.alfanews.telugu.viewmodels

import android.app.Application
import android.content.Context
import android.net.Uri
import android.provider.Settings
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.models.*
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.NotificationHelper
import com.alfanews.telugu.utils.PreferenceManager
import com.alfanews.telugu.utils.uploadImageToStorage
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.Date

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PreferenceManager.getInstance(application)
    private var userListener: ListenerRegistration? = null
    private var newsListener: ListenerRegistration? = null
    private val appStartTime = System.currentTimeMillis()

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _language = MutableStateFlow(prefs.language)
    val language: StateFlow<Language> = _language.asStateFlow()

    private val _activeTab = MutableStateFlow("home")
    val activeTab: StateFlow<String> = _activeTab.asStateFlow()

    private val _adminActivePage = MutableStateFlow("profile")
    val adminActivePage: StateFlow<String> = _adminActivePage.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _themeMode = MutableStateFlow(prefs.themeMode)
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    private val _showOnboarding = MutableStateFlow(prefs.shouldShowOnboarding)
    val showOnboarding: StateFlow<Boolean> = _showOnboarding.asStateFlow()

    private val _showRatingDialog = MutableStateFlow(false)
    val showRatingDialog: StateFlow<Boolean> = _showRatingDialog.asStateFlow()

    private val _isUpdateDownloaded = MutableStateFlow(false)
    val isUpdateDownloaded: StateFlow<Boolean> = _isUpdateDownloaded.asStateFlow()

    private val _minVersionCode = MutableStateFlow(0)
    val minVersionCode: StateFlow<Int> = _minVersionCode.asStateFlow()

    private val _notificationsGranted = MutableStateFlow(true)
    val notificationsGranted: StateFlow<Boolean> = _notificationsGranted.asStateFlow()

    private val _activeDistrict = MutableStateFlow(prefs.getEffectiveDistrict())
    val activeDistrict: StateFlow<String?> = _activeDistrict.asStateFlow()

    private val _showDistrictPicker = MutableStateFlow(false)
    val showDistrictPicker: StateFlow<Boolean> = _showDistrictPicker.asStateFlow()

    private val _newNewsNotification = MutableStateFlow<NewsPost?>(null)
    val newNewsNotification: StateFlow<NewsPost?> = _newNewsNotification.asStateFlow()

    private val _reporterIdToShow = MutableStateFlow<String?>(null)
    val reporterIdToShow: StateFlow<String?> = _reporterIdToShow.asStateFlow()

    private val _activeWeatherAlert = MutableStateFlow<WeatherAlert?>(null)
    val activeWeatherAlert: StateFlow<WeatherAlert?> = _activeWeatherAlert.asStateFlow()

    private var weatherAlertListener: ListenerRegistration? = null

    init {
        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                _activeDistrict.value = district
            }
        }

        // 🧪 TEST LAB BRIDGE: Firebase Test Lab లో టెస్టింగ్ కోసం మారుపేరు (Mock) యూజర్ ని సెట్ చేయడం.
        val isTestLab = Settings.System.getString(application.contentResolver, "firebase.test.lab") == "true"
        if (isTestLab) {
            val testRoleSetting = Settings.System.getString(application.contentResolver, "firebase.test.lab.role") ?: "REPORTER"
            val mockUser = when (testRoleSetting) {
                "REPORTER" -> User(
                    id = "ftl_reporter",
                    name = "Test Reporter (FTL)",
                    role = UserRole.REPORTER,
                    district = "Guntur"
                )
                "AVID_USER" -> User(
                    id = "ftl_avid_user",
                    name = "Avid Reader (FTL)",
                    role = UserRole.SUBSCRIBER,
                    categoryScores = mapOf("politics" to 100, "cinema" to 80, "sports" to 50),
                    district = "Nizamabad"
                )
                else -> null
            }
            if (mockUser != null) {
                _currentUser.value = mockUser
            }
        }

        val cachedId = prefs.userId
        val cachedRole = prefs.userRole ?: "SUBSCRIBER"
        if (cachedId != null) {
            _currentUser.value = User(
                id = cachedId,
                name = prefs.userName ?: "User",
                role = UserRole.fromString(cachedRole),
                district = prefs.userDistrict
            )
        }

        FirebaseService.auth.addAuthStateListener { auth ->
            if (isTestLab && _currentUser.value?.id?.startsWith("ftl_") == true) return@addAuthStateListener

            userListener?.remove() 
            val firebaseUser = auth.currentUser
            if (firebaseUser == null) {
                _currentUser.value = null
                AnalyticsService.onUserLogout()
                return@addAuthStateListener
            }

            userListener = FirebaseService.db.collection("users").document(firebaseUser.uid)
                .addSnapshotListener { snapshot, e ->
                    if (e != null) return@addSnapshotListener

                    if (snapshot != null && snapshot.exists()) {
                        val rawRole = snapshot.get("role")
                        val parsedRole = UserRole.fromStringSafe(rawRole) ?: _currentUser.value?.role ?: UserRole.SUBSCRIBER

                        val userObj = try {
                            val baseUser = snapshot.toObject(User::class.java)
                            baseUser?.copy(id = snapshot.id, role = parsedRole)
                        } catch (ex: Exception) {
                            User(
                                id = snapshot.id,
                                name = snapshot.getString("name") ?: "User",
                                email = snapshot.getString("email"),
                                phone = snapshot.getString("phone"),
                                photoUrl = snapshot.getString("photoUrl"),
                                role = parsedRole,
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
                            prefs.userId = userObj.id
                            prefs.userName = snapshot.getString("name") ?: userObj.name
                            prefs.userRole = userObj.role.name
                            prefs.userDistrict = snapshot.getString("district") ?: userObj.district

                            AnalyticsService.onUserLogin(userObj)
                            
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
                        _currentUser.value = null
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

        startNewsListener()
        startWeatherAlertListener()
        startAppConfigListener()
        ensureDefaultSubscriptions()
    }

    private fun startAppConfigListener() {
        FirebaseService.db.collection("settings").document("android_config")
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                
                val minCode = (snapshot.get("min_version_code") as? Number)?.toInt() ?: 0
                _minVersionCode.value = minCode
            }
    }

    private fun startWeatherAlertListener() {
        weatherAlertListener?.remove()
        weatherAlertListener = FirebaseService.db.collection("settings").document("weather_alerts")
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                
                val district = _activeDistrict.value
                if (district == null) {
                    _activeWeatherAlert.value = null
                    return@addSnapshotListener
                }

                val data = snapshot.data ?: return@addSnapshotListener
                @Suppress("UNCHECKED_CAST")
                val districtData = data[district] as? Map<String, Any>
                
                if (districtData != null) {
                    val lastSent = districtData["lastAlertSentAt"] as? Timestamp
                    val lastSentTime = lastSent?.toDate()?.time ?: 0L
                    val now = System.currentTimeMillis()
                    val diff = now - lastSentTime
                    val threshold = 6 * 60 * 60 * 1000L
                    
                    // Show alert if sent in the last 6 hours
                    if (lastSentTime > 0 && diff < threshold) {
                        _activeWeatherAlert.value = WeatherAlert(
                            title = districtData["lastAlertTitle"]?.toString() ?: "Weather Alert",
                            body = districtData["lastAlertBody"]?.toString() ?: "",
                            district = district,
                            timestamp = lastSentTime,
                            severity = districtData["severity"]?.toString() ?: "WARNING"
                        )
                    } else {
                        _activeWeatherAlert.value = null
                    }
                } else {
                    _activeWeatherAlert.value = null
                }
            }
    }

    fun dismissWeatherAlert() {
        _activeWeatherAlert.value = null
    }

    private fun ensureDefaultSubscriptions() {
        if (prefs.isNotificationsEnabled) {
            viewModelScope.launch {
                try {
                    val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()
                    messaging.subscribeToTopic("all_users").await()
                    messaging.subscribeToTopic("breaking_news").await()
                    
                    val district = prefs.getEffectiveDistrict()
                    if (!district.isNullOrBlank()) {
                        val topicName = NotificationHelper.getTopicName("district", district)
                        messaging.subscribeToTopic(topicName).await()
                    }
                    
                    // సబ్‌స్క్రయిబ్ అయినట్లు అనలిటిక్స్ లో లాగ్ చేయడం
                    AnalyticsService.logAnalyticsEvent("default_topics_subscribed")
                } catch (e: Exception) {
                    // Fail silently, retry on next launch
                }
            }
        }
    }

    private fun startNewsListener() {
        newsListener?.remove()
        newsListener = FirebaseService.db.collection("news")
            .whereEqualTo("approved", true)
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(1)
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || snapshot.isEmpty) return@addSnapshotListener
                
                val doc = snapshot.documents.firstOrNull() ?: return@addSnapshotListener
                val post = mapDocumentToNewsPost(doc) ?: return@addSnapshotListener
                
                if (post.timestamp <= appStartTime) return@addSnapshotListener
                if (_newNewsNotification.value?.id == post.id) return@addSnapshotListener

                val userDist = _currentUser.value?.district ?: prefs.getEffectiveDistrict()
                val isDistrictSpecific = Constants.ALL_DISTRICTS.contains(post.district)
                
                if (isDistrictSpecific) {
                    if (post.district == userDist) {
                        _newNewsNotification.value = post
                    }
                } else {
                    _newNewsNotification.value = post
                }
            }
    }

    fun dismissInAppNotification() {
        _newNewsNotification.value = null
    }

    private fun mapDocumentToNewsPost(doc: com.google.firebase.firestore.DocumentSnapshot): NewsPost? {
        return try {
            val data = doc.data ?: return null
            com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
        } catch (ex: Exception) { null }
    }


    override fun onCleared() {
        super.onCleared()
        userListener?.remove()
        newsListener?.remove()
    }

    fun setActiveTab(tab: String) {
        _activeTab.value = tab
    }

    fun setAdminActivePage(page: String) {
        _adminActivePage.value = page
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

    fun setUpdateDownloaded(downloaded: Boolean) {
        _isUpdateDownloaded.value = downloaded
    }

    fun setNotificationsGranted(granted: Boolean) {
        _notificationsGranted.value = granted
    }

    fun setShowDistrictPicker(show: Boolean) {
        _showDistrictPicker.value = show
    }

    fun setReporterIdToShow(id: String?) {
        _reporterIdToShow.value = id
    }

    fun setDistrict(district: String) {
        prefs.selectedDistrict = district
        _activeDistrict.value = district
        // Trigger news refresh if needed, or rely on ViewModels observing prefs/activeDistrict
        viewModelScope.launch {
            _currentUser.value?.id?.let { uid ->
                FirebaseService.db.collection("users").document(uid).update("district", district)
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            FirebaseService.auth.signOut()
            prefs.clearUserData()
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

                if (photoUri != null) {
                    val url = uploadImageToStorage(getApplication(), photoUri, "profile_images")
                    updates["photoUrl"] = url
                }

                if (signatureUri != null) {
                    val url = uploadImageToStorage(getApplication(), signatureUri, "signatures")
                    updates["signatureUrl"] = url
                }

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
        val d = district ?: return
        
        viewModelScope.launch {
            try {
                oldInterests.forEach { category ->
                    val topic = NotificationHelper.getTopicName("interest_${NotificationHelper.slugify(d)}", category)
                    messaging.unsubscribeFromTopic(topic).await()
                }
                newInterests.forEach { category ->
                    val topic = NotificationHelper.getTopicName("interest_${NotificationHelper.slugify(d)}", category)
                    messaging.subscribeToTopic(topic).await()
                }
            } catch (e: Exception) { }
        }
    }

    fun toggleNotifications(enabled: Boolean) {
        viewModelScope.launch {
            val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()
            val user = _currentUser.value
            val district = user?.district ?: prefs.getEffectiveDistrict()
            val interests: Set<String> = user?.categoryScores?.keys ?: emptySet()
            
            try {
                if (enabled) {
                    messaging.subscribeToTopic("all_users").await()
                    messaging.subscribeToTopic("breaking_news").await()
                    district?.let { d ->
                        val districtTopic = NotificationHelper.getTopicName("district", d)
                        messaging.subscribeToTopic(districtTopic).await()
                        interests.forEach { category ->
                            val interestTopic = NotificationHelper.getTopicName("interest_${NotificationHelper.slugify(d)}", category)
                            messaging.subscribeToTopic(interestTopic).await()
                        }
                    }
                } else {
                    messaging.unsubscribeFromTopic("all_users").await()
                    messaging.unsubscribeFromTopic("breaking_news").await()
                    district?.let { d ->
                        val districtTopic = NotificationHelper.getTopicName("district", d)
                        messaging.unsubscribeFromTopic(districtTopic).await()
                        interests.forEach { category ->
                            val interestTopic = NotificationHelper.getTopicName("interest_${NotificationHelper.slugify(d)}", category)
                            messaging.unsubscribeFromTopic(interestTopic).await()
                        }
                    }
                }

                prefs.isNotificationsEnabled = enabled
                user?.id?.let { uid ->
                    FirebaseService.db.collection("users").document(uid).update("pushEnabled", enabled).await()
                }
            } catch (e: Exception) { }
        }
    }
}
