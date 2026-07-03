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

    private val _notificationsGranted = MutableStateFlow(true)
    val notificationsGranted: StateFlow<Boolean> = _notificationsGranted.asStateFlow()

    private val _newNewsNotification = MutableStateFlow<NewsPost?>(null)
    val newNewsNotification: StateFlow<NewsPost?> = _newNewsNotification.asStateFlow()

    init {
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
            val rawHeadline = data["headline"]
            val rawContent = data["content"]
            
            val headlineTe = when (rawHeadline) {
                is Map<*, *> -> rawHeadline["telugu"]?.toString() ?: ""
                is String -> rawHeadline
                else -> ""
            }
            val headlineEn = when (rawHeadline) {
                is Map<*, *> -> rawHeadline["english"]?.toString() ?: ""
                else -> ""
            }
            
            val contentTe = when (rawContent) {
                is Map<*, *> -> rawContent["telugu"]?.toString() ?: ""
                is String -> rawContent
                else -> ""
            }
            val contentEn = when (rawContent) {
                is Map<*, *> -> rawContent["english"]?.toString() ?: ""
                else -> ""
            }

            val likesCount = (data["likes"] as? Number)?.toInt() ?: 0
            val commentsCount = (data["comments"] as? Number)?.toInt() ?: 0
            val sharesCount = (data["shares"] as? Number)?.toInt() ?: 0
            val postTimestamp = when (val ts = data["timestamp"]) {
                is Timestamp -> ts.toDate().time
                is Number -> ts.toLong()
                is Date -> ts.time
                else -> System.currentTimeMillis()
            }
            val categoryValue = data["category"]?.toString() ?: "General News"
            val categoriesList = (data["categories"] as? List<*>)?.mapNotNull { it?.toString() } ?: listOf(categoryValue)

            NewsPost(
                id = doc.id,
                headline = Headline(telugu = headlineTe, english = headlineEn),
                content = Content(telugu = contentTe, english = contentEn),
                mediaUrl = data["mediaUrl"]?.toString() ?: "",
                mediaType = if (data["mediaType"]?.toString() == "VIDEO") MediaType.VIDEO else MediaType.IMAGE,
                youtubeUrl = data["youtubeUrl"]?.toString(),
                postFormat = if (data["postFormat"]?.toString() == "16:9") PostFormat.HORIZONTAL else PostFormat.VERTICAL,
                reporter = Reporter(
                    id = (data["reporter"] as? Map<*, *>)?.get("id")?.toString() ?: "",
                    name = (data["reporter"] as? Map<*, *>)?.get("name")?.toString() ?: ""
                ),
                location = data["location"]?.toString() ?: "",
                timestamp = postTimestamp,
                categories = categoriesList,
                likes = likesCount,
                comments = commentsCount,
                shares = sharesCount,
                originalUrl = data["originalUrl"]?.toString(),
                district = data["district"]?.toString() ?: "State",
                verificationStatus = data["verificationStatus"]?.toString() ?: "UNVERIFIED",
                category = categoryValue,
                tags = (data["tags"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                entities = (data["entities"] as? Map<*, *>)?.let { entitiesMap ->
                    Entities(
                        people = (entitiesMap["people"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        organizations = (entitiesMap["organizations"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        locations = (entitiesMap["locations"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
                    )
                } ?: Entities(),
                type = data["type"]?.toString() ?: "news",
                approved = data["approved"] as? Boolean ?: false,
                aiProcessed = data["aiProcessed"] as? Boolean ?: false,
                isGlobal = data["isGlobal"] as? Boolean ?: false,
                isReporter = data["isReporter"] as? Boolean ?: (data["processingType"]?.toString() == "REPORTER_SUBMISSION")
            )
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
        val d = district?.lowercase()?.replace(" ", "_") ?: return
        
        viewModelScope.launch {
            try {
                oldInterests.forEach { category ->
                    messaging.unsubscribeFromTopic("district_${d}_${category.lowercase()}").await()
                }
                newInterests.forEach { category ->
                    messaging.subscribeToTopic("district_${d}_${category.lowercase()}").await()
                }
            } catch (e: Exception) { }
        }
    }

    fun toggleNotifications(enabled: Boolean) {
        viewModelScope.launch {
            val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()
            val user = _currentUser.value
            val district = user?.district?.lowercase()?.replace(" ", "_") ?: prefs.getEffectiveDistrict()?.lowercase()?.replace(" ", "_")
            val interests: Set<String> = user?.categoryScores?.keys ?: emptySet()
            
            try {
                if (enabled) {
                    messaging.subscribeToTopic("all_users").await()
                    messaging.subscribeToTopic("breaking_news").await()
                    district?.let { d ->
                        messaging.subscribeToTopic("district_$d").await()
                        interests.forEach { category ->
                            messaging.subscribeToTopic("district_${d}_${category.lowercase()}").await()
                        }
                    }
                } else {
                    messaging.unsubscribeFromTopic("all_users").await()
                    messaging.unsubscribeFromTopic("breaking_news").await()
                    district?.let { d ->
                        messaging.unsubscribeFromTopic("district_$d").await()
                        interests.forEach { category ->
                            messaging.unsubscribeFromTopic("district_${d}_${category.lowercase()}").await()
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
