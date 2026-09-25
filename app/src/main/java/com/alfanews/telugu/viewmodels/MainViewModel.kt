package com.alfanews.telugu.viewmodels

import android.app.Application
import android.content.Context
import android.net.Uri
import android.provider.Settings
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
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
    private var appConfigListener: ListenerRegistration? = null
    private var authStateListener: com.google.firebase.auth.FirebaseAuth.AuthStateListener? = null
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

    private val _unreadMessagesCount = MutableStateFlow(0)
    val unreadMessagesCount: StateFlow<Int> = _unreadMessagesCount.asStateFlow()

    private val _unreadAdminNotices = MutableStateFlow<List<AdminNotice>>(emptyList())
    val unreadAdminNotices: StateFlow<List<AdminNotice>> = _unreadAdminNotices.asStateFlow()

    private var weatherAlertListener: ListenerRegistration? = null
    private var reporterConvListener: ListenerRegistration? = null
    private var reporterUnreadMessagesListener: ListenerRegistration? = null
    private var userMessagesListener: ListenerRegistration? = null
    private var unreadConvCount = 0
    private var unreadUserMsgCount = 0
    private var reporterNoticesList: List<AdminNotice> = emptyList()
    private var userNoticesList: List<AdminNotice> = emptyList()
    private var cachedWeatherAlertsData: Map<String, Any>? = null


    init {
        viewModelScope.launch {
            prefs.districtChanges.collectLatest { district ->
                _activeDistrict.value = district
                updateActiveWeatherAlert()
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

        val firebaseAuthUser = FirebaseService.auth.currentUser
        val cachedId = prefs.userId ?: firebaseAuthUser?.uid
        val cachedPhone = firebaseAuthUser?.phoneNumber ?: prefs.userPhone
        val cachedEmail = firebaseAuthUser?.email
        val isAdminCached = (cachedPhone?.contains("9173811009") == true) ||
                            (cachedEmail?.equals("alfanews0861@gmail.com", ignoreCase = true) == true) ||
                            (prefs.userRole == "ADMIN")
        val effectiveCachedRole = if (isAdminCached) "ADMIN" else (prefs.userRole ?: "SUBSCRIBER")
        if (isAdminCached) {
            prefs.userRole = "ADMIN"
        }

        if (cachedId != null) {
            _currentUser.value = User(
                id = cachedId,
                name = prefs.userName ?: firebaseAuthUser?.displayName ?: "User",
                role = if (isAdminCached) UserRole.ADMIN else UserRole.fromString(effectiveCachedRole),
                district = prefs.userDistrict,
                phone = cachedPhone,
                email = cachedEmail
            )
        }

        authStateListener = com.google.firebase.auth.FirebaseAuth.AuthStateListener { auth ->
            if (isTestLab && _currentUser.value?.id?.startsWith("ftl_") == true) return@AuthStateListener

            userListener?.remove() 
            val firebaseUser = auth.currentUser
            if (firebaseUser == null) {
                _currentUser.value = null
                prefs.clearUserData()
                AnalyticsService.onUserLogout()
                startUnreadMessagesListener(null)
                return@AuthStateListener
            }

            val isAdminAccount = (firebaseUser.phoneNumber?.contains("9173811009") == true) ||
                                 (firebaseUser.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true) ||
                                 (prefs.userPhone?.contains("9173811009") == true) ||
                                 (prefs.userRole == "ADMIN")

            userListener = FirebaseService.db.collection("users").document(firebaseUser.uid)
                .addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        Log.e("MainViewModel", "userListener error: ${e.message}", e)
                        if (isAdminAccount && (_currentUser.value == null || _currentUser.value?.role != UserRole.ADMIN)) {
                            _currentUser.value = User(
                                id = firebaseUser.uid,
                                name = firebaseUser.displayName ?: "శ్రీకాంత్ రెడ్డి",
                                phone = firebaseUser.phoneNumber ?: "+919173811009",
                                role = UserRole.ADMIN,
                                email = firebaseUser.email
                            )
                            prefs.userId = firebaseUser.uid
                            prefs.userRole = "ADMIN"
                        }
                        return@addSnapshotListener
                    }

                    if (snapshot != null && !snapshot.exists()) {
                        if (isAdminAccount) {
                            val adminUser = User(
                                id = firebaseUser.uid,
                                name = firebaseUser.displayName ?: "శ్రీకాంత్ రెడ్డి",
                                phone = firebaseUser.phoneNumber ?: "+919173811009",
                                role = UserRole.ADMIN,
                                email = firebaseUser.email
                            )
                            _currentUser.value = adminUser
                            prefs.userId = firebaseUser.uid
                            prefs.userRole = "ADMIN"
                            return@addSnapshotListener
                        }
                        _currentUser.value = null
                        prefs.clearUserData()
                        return@addSnapshotListener
                    }

                    if (snapshot != null && snapshot.exists()) {
                        val rawRole = snapshot.get("role")
                        val nameFromDb = snapshot.getString("name")
                        val phoneFromDb = snapshot.getString("phone")
                        val emailFromDb = snapshot.getString("email")
                        val photoUrlFromDb = snapshot.getString("photoUrl")
                        val effectiveName = nameFromDb?.ifBlank { null } ?: firebaseUser.displayName?.ifBlank { null } ?: "User"
                        val effectivePhone = phoneFromDb?.ifBlank { null } ?: firebaseUser.phoneNumber ?: prefs.userPhone
                        val effectiveEmail = emailFromDb ?: firebaseUser.email
                        val effectivePhoto = photoUrlFromDb ?: firebaseUser.photoUrl?.toString()

                        val isAdminDoc = isAdminAccount ||
                                         (effectivePhone?.contains("9173811009") == true) ||
                                         (effectiveEmail?.equals("alfanews0861@gmail.com", ignoreCase = true) == true)

                        val parsedRole = if (isAdminDoc) {
                            UserRole.ADMIN
                        } else {
                            UserRole.fromStringSafe(rawRole) ?: _currentUser.value?.role ?: UserRole.SUBSCRIBER
                        }

                        val pushEnabledVal = snapshot.getBoolean("pushEnabled") ?: snapshot.getBoolean("notificationsEnabled") ?: true
                        val assignedDistList = (snapshot.get("assignedDistricts") as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                        val fcmTokensList = (snapshot.get("fcmTokens") as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                        val badgesList = (snapshot.get("badges") as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                        val pts = (snapshot.get("points") as? Number)?.toInt() ?: 0
                        val refCount = (snapshot.get("referralCount") as? Number)?.toInt() ?: 0

                        val userObj = User(
                            id = snapshot.id,
                            name = effectiveName,
                            email = effectiveEmail,
                            phone = effectivePhone,
                            photoUrl = effectivePhoto,
                            role = parsedRole,
                            address = snapshot.getString("address"),
                            district = snapshot.getString("district"),
                            pushEnabled = pushEnabledVal,
                            constituency = snapshot.getString("constituency"),
                            state = snapshot.getString("state"),
                            promotedBy = snapshot.getString("promotedBy"),
                            referredBy = snapshot.getString("referredBy"),
                            referralCount = refCount,
                            signatureUrl = snapshot.getString("signatureUrl"),
                            idCardUrl = snapshot.getString("idCardUrl"),
                            assignedMandal = snapshot.getString("assignedMandal"),
                            assignedDistricts = assignedDistList,
                            fcmTokens = fcmTokensList,
                            lastTokenUpdate = snapshot.getLong("lastTokenUpdate"),
                            points = pts,
                            badges = badgesList,
                            categoryScores = (snapshot.get("categoryScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                            reporterScores = (snapshot.get("reporterScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                            tagScores = (snapshot.get("tagScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                            peopleScores = (snapshot.get("peopleScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                            organizationScores = (snapshot.get("organizationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                            locationScores = (snapshot.get("locationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap()
                        )
                        
                        val oldUser = _currentUser.value
                        _currentUser.value = userObj
                        
                        prefs.userId = userObj.id
                        prefs.userName = snapshot.getString("name") ?: userObj.name
                        prefs.userRole = userObj.role.name
                        prefs.userDistrict = snapshot.getString("district") ?: userObj.district
                        if (!effectivePhone.isNullOrBlank()) {
                            prefs.userPhone = effectivePhone
                        }

                        if (isAdminDoc && rawRole?.toString()?.uppercase() != "ADMIN") {
                            try {
                                FirebaseService.db.collection("users").document(snapshot.id).update("role", "ADMIN")
                            } catch (err: Exception) {
                                Log.w("MainViewModel", "Could not sync ADMIN role to Firestore", err)
                            }
                        }

                        AnalyticsService.onUserLogin(userObj)
                        startUnreadMessagesListener(userObj)
                        syncUserFcmToken(userObj.id)
                        
                        if (prefs.isNotificationsEnabled) {
                            val oldInterests = oldUser?.categoryScores?.keys ?: emptySet()
                            val newInterests = userObj.categoryScores.keys
                            val oldDistrict = oldUser?.district
                            val newDistrict = userObj.district
                            
                            if (oldInterests != newInterests || oldDistrict != newDistrict) {
                                updateInterestSubscriptions(oldInterests, newInterests, newDistrict)
                            }
                            // ✅ cat_* topics కి auto-subscribe (backend scheduler వాడే topics)
                            if (oldInterests != newInterests) {
                                updateCategoryTopicSubscriptions(oldInterests, newInterests)
                            }
                        }
                    } else {
                        _currentUser.value = null
                        startUnreadMessagesListener(null)
                    }
                }
        }
        authStateListener?.let { FirebaseService.auth.addAuthStateListener(it) }


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
        syncUserFcmToken(FirebaseService.auth.currentUser?.uid)
        recordAppOpen(FirebaseService.auth.currentUser?.uid)
    }

    private fun startAppConfigListener() {
        appConfigListener?.remove()
        appConfigListener = FirebaseService.db.collection("settings").document("android_config")
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                
                val minCode = (snapshot.get("min_version_code") as? Number)?.toInt() ?: 0
                _minVersionCode.value = minCode
            }
    }

    private fun updateActiveWeatherAlert() {
        val district = _activeDistrict.value
        val data = cachedWeatherAlertsData
        
        if (district == null || data == null) {
            _activeWeatherAlert.value = null
            return
        }

        val weatherKey = NotificationHelper.getWeatherDistrictKey(district)
        @Suppress("UNCHECKED_CAST")
        val districtData = data[weatherKey] as? Map<String, Any>
        
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

    private fun startWeatherAlertListener() {
        weatherAlertListener?.remove()
        weatherAlertListener = FirebaseService.db.collection("settings").document("weather_alerts")
            .addSnapshotListener { snapshot, e ->
                if (e != null || snapshot == null || !snapshot.exists()) {
                    cachedWeatherAlertsData = null
                    updateActiveWeatherAlert()
                    return@addSnapshotListener
                }
                
                cachedWeatherAlertsData = snapshot.data
                updateActiveWeatherAlert()
            }
    }

    fun dismissWeatherAlert() {
        _activeWeatherAlert.value = null
    }

    fun ensureDefaultSubscriptions() {
        if (prefs.isNotificationsEnabled) {
            viewModelScope.launch {
                try {
                    val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()
                    messaging.subscribeToTopic("all_users").await()
                    messaging.subscribeToTopic("breaking_news").await()
                    
                    val district = prefs.getEffectiveDistrict()
                    NotificationHelper.syncDistrictTopic(getApplication(), district)
                    
                    // సబ్‌స్క్రయిబ్ అయినట్లు అనలిటిక్స్ లో లాగ్ చేయడం
                    AnalyticsService.logAnalyticsEvent("default_topics_subscribed")
                } catch (e: Exception) {
                    // Fail silently, retry on next launch
                }
            }
        }
    }

    private var lastInAppNotificationTime: Long = 0L

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

                // 🛡️ 15-నిమిషాల కూల్‌డౌన్: యూజర్ వార్తలు చదువుతున్నప్పుడు మాటిమాటికీ బ్యానర్ రాకుండా నియంత్రణ
                val now = System.currentTimeMillis()
                if (now - lastInAppNotificationTime < 15 * 60 * 1000L) return@addSnapshotListener

                val userDist = _currentUser.value?.district ?: prefs.getEffectiveDistrict()
                val isDistrictSpecific = Constants.ALL_DISTRICTS.contains(post.district)
                
                if (isDistrictSpecific) {
                    if (post.district == userDist) {
                        _newNewsNotification.value = post
                        lastInAppNotificationTime = now
                    }
                } else {
                    _newNewsNotification.value = post
                    lastInAppNotificationTime = now
                }
            }
    }

    fun dismissInAppNotification() {
        _newNewsNotification.value = null
    }

    private fun mapDocumentToNewsPost(doc: com.google.firebase.firestore.DocumentSnapshot): NewsPost? {
        return try {
            val data = doc.data ?: return null
            com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data, language.value)
        } catch (ex: Exception) { null }
    }


    private fun startUnreadMessagesListener(user: User?) {
        reporterConvListener?.remove()
        reporterConvListener = null
        reporterUnreadMessagesListener?.remove()
        reporterUnreadMessagesListener = null
        userMessagesListener?.remove()
        userMessagesListener = null
        unreadConvCount = 0
        unreadUserMsgCount = 0
        reporterNoticesList = emptyList()
        userNoticesList = emptyList()

        if (user == null || user.id.isBlank() || user.id == "guest") {
            _unreadMessagesCount.value = 0
            _unreadAdminNotices.value = emptyList()
            return
        }

        val isAdminStaff = listOf(
            UserRole.ADMIN,
            UserRole.EDITOR,
            UserRole.NEWS_DESK,
            UserRole.REGIONAL_INCHARGE
        ).contains(user.role)
        val isReporter = user.role == UserRole.REPORTER || user.role == UserRole.NEWS_DESK

        fun updateNoticesAndBadge() {
            val allNotices = (reporterNoticesList + userNoticesList)
                .distinctBy { it.id }
                .sortedByDescending { it.timestamp }
            _unreadAdminNotices.value = allNotices
            _unreadMessagesCount.value = unreadConvCount + unreadUserMsgCount
        }

        // 1. Admin Staff: monitor overall conversations needing admin attention
        if (isAdminStaff && !isReporter) {
            reporterConvListener = FirebaseService.db.collection("reporter_conversations")
                .whereGreaterThan("unreadCountForAdmin", 0)
                .addSnapshotListener { snapshot, e ->
                    if (e != null || snapshot == null) return@addSnapshotListener
                    unreadConvCount = snapshot.documents.sumOf { (it.getLong("unreadCountForAdmin") ?: 0L).toInt() }
                    _unreadMessagesCount.value = unreadConvCount + unreadUserMsgCount
                }
        } else {
            // 2. Active Reporters, Former Reporters (మాజీ రిపోర్టర్లు), Applicants, & General Users:
            // A. Listen to reporter_conversations/{user.id} summary
            reporterConvListener = FirebaseService.db.collection("reporter_conversations")
                .document(user.id)
                .addSnapshotListener { snapshot, e ->
                    if (e != null || snapshot == null || !snapshot.exists()) {
                        unreadConvCount = 0
                    } else {
                        unreadConvCount = (snapshot.getLong("unreadCountForReporter") ?: 0L).toInt()
                    }
                    updateNoticesAndBadge()
                }

            // B. Real-time listener for incoming unread Admin messages to show In-App Popup
            // 🎯 అడ్మిన్ పంపిన అన్ని ముఖ్య సందేశాలు, హెచ్చరికలు, బ్రాడ్‌కాస్ట్‌లు పాపప్ అవుతాయి
            reporterUnreadMessagesListener = FirebaseService.db.collection("reporter_conversations")
                .document(user.id)
                .collection("messages")
                .whereEqualTo("read", false)
                .whereEqualTo("senderRole", "ADMIN")
                .addSnapshotListener { snapshot, e ->
                    if (e != null || snapshot == null) return@addSnapshotListener
                    reporterNoticesList = snapshot.documents.mapNotNull { doc ->
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            val rawType = (data["type"] as? String ?: "NOTICE").trim().uppercase()
                            val fullText = data["text"] as? String ?: ""
                            if (fullText.isBlank()) return@mapNotNull null

                            val senderName = data["senderName"] as? String ?: "ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్"
                            val ts = when (val t = data["timestamp"]) {
                                is Timestamp -> t.toDate().time
                                is Number -> t.toLong()
                                else -> System.currentTimeMillis()
                            }
                            val (title, body) = if (fullText.contains("\n\n")) {
                                val parts = fullText.split("\n\n", limit = 2)
                                Pair(parts[0].trim(), parts[1].trim())
                            } else {
                                val fallbackTitle = when (rawType) {
                                    "WARNING" -> "హెచ్చరిక సందేశం (Warning Notice)"
                                    "BROADCAST" -> "బ్రాడ్‌కాస్ట్ ప్రకటన (Broadcast Announcement)"
                                    "NOTICE" -> "ఎడిటోరియల్ డెస్క్ ముఖ్య ప్రకటన"
                                    else -> "అడ్మిన్ డెస్క్ సందేశం"
                                }
                                Pair(fallbackTitle, fullText)
                            }
                            AdminNotice(
                                id = doc.id,
                                title = title,
                                text = body,
                                senderName = senderName,
                                senderRole = "ADMIN",
                                type = rawType,
                                timestamp = ts,
                                source = "REPORTER_CONV"
                            )
                        } catch (_: Exception) {
                            null
                        }
                    }
                    updateNoticesAndBadge()
                }
        }

        // 3. Also listen to users/{userId}/messages for personal messages/notices across all non-admin roles
        if (!isAdminStaff) {
            userMessagesListener = FirebaseService.db.collection("users")
                .document(user.id)
                .collection("messages")
                .whereEqualTo("read", false)
                .addSnapshotListener { snapshot, e ->
                    if (e != null || snapshot == null) return@addSnapshotListener
                    val unreadDocs = snapshot.documents
                    unreadUserMsgCount = unreadDocs.size

                    userNoticesList = unreadDocs.mapNotNull { doc ->
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            val rawType = (data["type"] as? String ?: "NOTICE").trim().uppercase()
                            val title = data["title"] as? String ?: "ముఖ్య గమనిక"
                            val body = data["body"] as? String ?: (data["text"] as? String ?: "")
                            if (body.isBlank() && title.isBlank()) return@mapNotNull null

                            val senderName = data["senderName"] as? String ?: "ఆల్ఫా న్యూస్"
                            val ts = when (val t = data["timestamp"]) {
                                is Timestamp -> t.toDate().time
                                is Number -> t.toLong()
                                else -> System.currentTimeMillis()
                            }
                            AdminNotice(
                                id = doc.id,
                                title = title,
                                text = body,
                                senderName = senderName,
                                senderRole = data["senderRole"] as? String ?: "ADMIN",
                                type = rawType,
                                timestamp = ts,
                                source = "USER_MSG"
                            )
                        } catch (_: Exception) {
                            null
                        }
                    }
                    updateNoticesAndBadge()
                }
        }
    }

    /**
     * విలేకరి లేదా వినియోగదారుడు అడ్మిన్ ముఖ్య సందేశాలను చదివినట్లు నిర్ధారించి,
     * Firestore లో read: true చేసి, ప్రొఫైల్ ఐకాన్ మీది అన్‌రీడ్ బ్యాడ్జ్‌ను 0 చేస్తుంది.
     */
    fun markAllAdminMessagesRead() {
        val user = _currentUser.value ?: return
        if (user.id.isBlank() || user.id == "guest") return

        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            try {
                // 1. Mark unread admin messages in reporter_conversations thread (for reporters and former reporters)
                try {
                    FirebaseService.db.collection("reporter_conversations")
                        .document(user.id)
                        .update("unreadCountForReporter", 0)
                        .await()
                } catch (_: Exception) {}

                val unreadReporterMsgs = try {
                    FirebaseService.db.collection("reporter_conversations")
                        .document(user.id)
                        .collection("messages")
                        .whereEqualTo("read", false)
                        .whereEqualTo("senderRole", "ADMIN")
                        .get()
                        .await()
                } catch (_: Exception) { null }

                if (unreadReporterMsgs != null && !unreadReporterMsgs.isEmpty) {
                    val batch = FirebaseService.db.batch()
                    for (doc in unreadReporterMsgs.documents) {
                        batch.update(doc.reference, "read", true)
                    }
                    batch.commit().await()
                }

                // 2. Mark unread messages in users/{userId}/messages
                val unreadUserMsgs = try {
                    FirebaseService.db.collection("users")
                        .document(user.id)
                        .collection("messages")
                        .whereEqualTo("read", false)
                        .get()
                        .await()
                } catch (_: Exception) { null }

                if (unreadUserMsgs != null && !unreadUserMsgs.isEmpty) {
                    val batch = FirebaseService.db.batch()
                    for (doc in unreadUserMsgs.documents) {
                        batch.update(doc.reference, "read", true)
                    }
                    batch.commit().await()
                }

                // 3. In-memory state clean-up
                reporterNoticesList = emptyList()
                userNoticesList = emptyList()
                unreadConvCount = 0
                unreadUserMsgCount = 0
                _unreadMessagesCount.value = 0
                _unreadAdminNotices.value = emptyList()
            } catch (e: Exception) {
                Log.e("MainViewModel", "Error marking admin messages read: ${e.message}", e)
            }
        }
    }

 
    fun syncUserFcmToken(userId: String?) {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    if (!token.isNullOrBlank()) {
                        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
                            try {
                                val isGuest = userId.isNullOrBlank() || userId == "guest"
                                val uid = userId
                                if (!isGuest && !uid.isNullOrBlank()) {
                                    try {
                                        FirebaseService.db.collection("users").document(uid).update(
                                            "fcmToken", token,
                                            "fcmTokens", com.google.firebase.firestore.FieldValue.arrayUnion(token),
                                            "lastActive", com.google.firebase.firestore.FieldValue.serverTimestamp()
                                        ).await()
                                        Log.d("MainViewModel", "Synced FCM token for user $uid")
                                    } catch (e: Exception) {
                                        val data = mapOf(
                                            "fcmToken" to token,
                                            "fcmTokens" to listOf(token),
                                            "notificationsEnabled" to true,
                                            "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                                        )
                                        FirebaseService.db.collection("users").document(uid).set(data, com.google.firebase.firestore.SetOptions.merge()).await()
                                        Log.d("MainViewModel", "Set FCM token for user $uid with merge")
                                    }
                                } else {
                                    val installId = prefs.getOrCreateInstallId()
                                    val guestData = mutableMapOf<String, Any>(
                                        "fcmToken" to token,
                                        "installId" to installId,
                                        "isAnonymous" to true,
                                        "notificationsEnabled" to true,
                                        "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                                        "platform" to "android",
                                        "appVersion" to com.alfanews.telugu.BuildConfig.VERSION_NAME
                                    )
                                    prefs.selectedDistrict?.let { guestData["district"] = it }
                                    prefs.detectedDistrict?.let { guestData["detectedDistrict"] = it }
                                    prefs.localPlace?.let { guestData["place"] = it }
                                    prefs.referredBy?.let { ref ->
                                        if (ref.isNotEmpty()) {
                                            guestData["referredBy"] = ref
                                        }
                                    }
                                    val tokenId = token.take(30).replace("/", "_")
                                    FirebaseService.db.collection("anonymous_devices").document(tokenId)
                                        .set(guestData, com.google.firebase.firestore.SetOptions.merge()).await()
                                    Log.d("MainViewModel", "Synced anonymous device FCM token: $tokenId (installId: $installId)")
                                }

                                ensureDefaultSubscriptions()
                            } catch (e: Exception) {
                                Log.w("MainViewModel", "Failed to sync FCM token: ${e.message}")
                            }
                        }
                    }
                }
        } catch (e: Exception) {
            Log.w("MainViewModel", "Could not get FCM token: ${e.message}")
        }
    }

    private var lastRecordedAppOpenMs = 0L

    /**
     * యాప్ ఓపెన్ అయినప్పుడు యూజర్ లేదా గెస్ట్ యొక్క మొదటి ఓపెన్ సమయం, చివరి యాక్టివ్ సమయం, డైలీ యాక్టివిటీని ఫైర్‌స్టోర్‌లో నమోదు చేస్తుంది.
     */
    fun recordAppOpen(userId: String? = null) {
        val now = System.currentTimeMillis()
        // 3 నిమిషాల థ్రోట్లింగ్ (రిపీటెడ్ స్క్రీన్ రెస్యూమ్‌లలో అనవసర ఫైర్‌స్టోర్ రైట్స్ తగ్గించడానికి)
        if (now - lastRecordedAppOpenMs < 3 * 60 * 1000L) {
            return
        }
        lastRecordedAppOpenMs = now

        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val uid = userId ?: FirebaseService.auth.currentUser?.uid ?: prefs.userId
                val isGuest = uid.isNullOrBlank() || uid == "guest"

                val istFormatter = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("Asia/Kolkata")
                }
                val todayDateStr = istFormatter.format(java.util.Date(now))

                if (!isGuest && !uid.isNullOrBlank()) {
                    val userDocRef = FirebaseService.db.collection("users").document(uid)
                    
                    val userSnap = try { userDocRef.get().await() } catch (e: Exception) { null }
                    val currentTodayDate = userSnap?.getString("todayDate")
                    val isFirstOpenToday = (currentTodayDate != todayDateStr)

                    val updates = mutableMapOf<String, Any>(
                        "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "todayDate" to todayDateStr,
                        "todayOpenCount" to com.google.firebase.firestore.FieldValue.increment(1)
                    )
                    if (isFirstOpenToday) {
                        updates["todayFirstOpen"] = com.google.firebase.firestore.FieldValue.serverTimestamp()
                    }

                    userDocRef.set(updates, com.google.firebase.firestore.SetOptions.merge()).await()

                    // రోజువారీ చరిత్ర కోసం daily_activity సబ్-కలెక్షన్‌లో రికార్డ్
                    val dailyActivityDoc = userDocRef.collection("daily_activity").document(todayDateStr)
                    val dailyUpdates = mutableMapOf<String, Any>(
                        "date" to todayDateStr,
                        "lastOpenTime" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "openCount" to com.google.firebase.firestore.FieldValue.increment(1)
                    )
                    if (isFirstOpenToday) {
                        dailyUpdates["firstOpenTime"] = com.google.firebase.firestore.FieldValue.serverTimestamp()
                    }
                    dailyActivityDoc.set(dailyUpdates, com.google.firebase.firestore.SetOptions.merge()).await()

                    Log.d("MainViewModel", "Updated app open for user $uid (firstOpen: $isFirstOpenToday, date: $todayDateStr)")
                } else {
                    val installId = prefs.getOrCreateInstallId()
                    val guestData = mutableMapOf<String, Any>(
                        "installId" to installId,
                        "isAnonymous" to true,
                        "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "platform" to "android",
                        "appVersion" to com.alfanews.telugu.BuildConfig.VERSION_NAME
                    )
                    prefs.selectedDistrict?.let { guestData["district"] = it }
                    prefs.detectedDistrict?.let { guestData["detectedDistrict"] = it }
                    prefs.localPlace?.let { guestData["place"] = it }

                    FirebaseService.db.collection("anonymous_devices").document(installId).set(
                        guestData,
                        com.google.firebase.firestore.SetOptions.merge()
                    ).await()
                    Log.d("MainViewModel", "Updated lastActive for guest $installId on app open")
                }
            } catch (e: Exception) {
                Log.w("MainViewModel", "recordAppOpen failed: ${e.message}")
            }
        }
    }

    fun setActiveTab(tab: String) {
        _activeTab.value = tab
        AnalyticsService.logTabSelected(tab, _activeDistrict.value)
    }

    fun setAdminActivePage(page: String) {
        _adminActivePage.value = page
    }

    fun setLanguage(newLanguage: Language) {
        _language.value = newLanguage
        prefs.language = newLanguage
        AnalyticsService.setAppLanguage(newLanguage.name)
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
        val oldDistrict = prefs.selectedDistrict ?: prefs.detectedDistrict
        prefs.selectedDistrict = district
        _activeDistrict.value = district
        updateActiveWeatherAlert()
        AnalyticsService.logDistrictSelected(district, oldDistrict)
        viewModelScope.launch {
            // Update Firestore user record
            val uid = _currentUser.value?.id
            if (!uid.isNullOrBlank() && uid != "guest") {
                try {
                    FirebaseService.db.collection("users").document(uid).update("district", district)
                } catch (e: Exception) { }
            } else {
                syncUserFcmToken(null)
            }
            // ✅ FIX: Update FCM topic subscriptions when district changes
            if (prefs.isNotificationsEnabled) {
                NotificationHelper.syncDistrictTopic(getApplication(), district)
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
                if (district.isNotBlank() && district != user.district) {
                    prefs.userDistrict = district
                    prefs.selectedDistrict = district
                    _activeDistrict.value = district
                    NotificationHelper.syncDistrictTopic(getApplication(), district)
                }
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

    /**
     * ✅ User Firestore categoryScores బట్టి cat_* FCM topics కి auto-subscribe చేస్తుంది.
     * Backend scheduler (notification_engine.ts) మరియు breaking news ఇవే topics వాడతాయి.
     * 
     * నోటిఫికేషన్ బరస్ట్ (spam) నివారించడానికి కేవలం టాప్ 2 కేటగిరీలకు మాత్రమే సబ్‌స్క్రయిబ్ చేస్తాం.
     * మిగిలిన పాత కేటగిరీలు అన్‌సబ్‌స్క్రయిబ్ అవుతాయి.
     */
    private fun updateCategoryTopicSubscriptions(oldCategories: Set<String>, newCategories: Set<String>) {
        val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()

        viewModelScope.launch {
            try {
                val user = _currentUser.value
                val topCategories = user?.categoryScores
                    ?.filter { it.value > 0 }
                    ?.entries
                    ?.sortedByDescending { it.value }
                    ?.take(2)
                    ?.map { it.key }
                    ?.toSet() ?: newCategories.take(2).toSet()

                // టాప్ 2 పరిధిలో లేని అన్ని పాత కేటగిరీలను అన్‌సబ్‌స్క్రయిబ్ చేయడం
                val toUnsubscribe = (oldCategories + newCategories) - topCategories
                toUnsubscribe.forEach { category ->
                    val topic = categoryTopicMap[category] ?: return@forEach
                    try { messaging.unsubscribeFromTopic(topic).await() } catch (e: Exception) {}
                    android.util.Log.d("MainViewModel", "Cat unsubscribed: $topic")
                }

                // టాప్ 2 కేటగిరీలకు మాత్రమే సబ్‌స్క్రయిబ్ చేయడం
                topCategories.forEach { category ->
                    val topic = categoryTopicMap[category] ?: return@forEach
                    try { messaging.subscribeToTopic(topic).await() } catch (e: Exception) {}
                    android.util.Log.d("MainViewModel", "Cat subscribed: $topic")
                }
            } catch (e: Exception) {
                android.util.Log.e("MainViewModel", "updateCategoryTopicSubscriptions failed", e)
            }
        }
    }

    fun toggleNotifications(enabled: Boolean) {
        viewModelScope.launch {
            val messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance()
            val user = _currentUser.value
            val district = user?.district ?: prefs.getEffectiveDistrict()
            // నోటిఫికేషన్ బరస్ట్ రాకుండా గరిష్టంగా టాప్ 2 కేటగిరీలు మాత్రమే
            val interests: Set<String> = user?.categoryScores
                ?.filter { it.value > 0 }
                ?.entries
                ?.sortedByDescending { it.value }
                ?.take(2)
                ?.map { it.key }
                ?.toSet() ?: emptySet()
            
            try {
                if (enabled) {
                    messaging.subscribeToTopic("all_users").await()
                    messaging.subscribeToTopic("breaking_news").await()
                    NotificationHelper.syncDistrictTopic(getApplication(), district)
                    interests.forEach { category ->
                        val catTopic = categoryTopicMap[category]
                        if (catTopic != null) {
                            messaging.subscribeToTopic(catTopic).await()
                        }
                    }
                } else {
                    messaging.unsubscribeFromTopic("all_users").await()
                    messaging.unsubscribeFromTopic("breaking_news").await()
                    NotificationHelper.syncDistrictTopic(getApplication(), null)
                    interests.forEach { category ->
                        val catTopic = categoryTopicMap[category]
                        if (catTopic != null) {
                            messaging.unsubscribeFromTopic(catTopic).await()
                        }
                    }
                }

                prefs.isNotificationsEnabled = enabled
                user?.id?.let { uid ->
                    FirebaseService.db.collection("users").document(uid).update(
                        mapOf(
                            "pushEnabled" to enabled,
                            "notificationsEnabled" to enabled
                        )
                    ).await()
                }
            } catch (e: Exception) { }
        }
    }

    override fun onCleared() {
        super.onCleared()
        try {
            newsListener?.remove()
            newsListener = null
            weatherAlertListener?.remove()
            weatherAlertListener = null
            userMessagesListener?.remove()
            userMessagesListener = null
            reporterConvListener?.remove()
            reporterConvListener = null
            reporterUnreadMessagesListener?.remove()
            reporterUnreadMessagesListener = null
            userListener?.remove()
            userListener = null
            appConfigListener?.remove()
            appConfigListener = null
            authStateListener?.let {
                FirebaseService.auth.removeAuthStateListener(it)
            }
            authStateListener = null
        } catch (_: Exception) {}
    }

    companion object {
        val categoryTopicMap: Map<String, String> = mapOf(
            "రాజకీయం"    to "cat_politics",
            "వినోదం"     to "cat_cinema",
            "క్రైమ్"     to "cat_crime",
            "క్రీడలు"    to "cat_sports",
            "వ్యాపారం"   to "cat_business",
            "టెక్నాలజీ" to "cat_technology",
            "ఆరోగ్యం"   to "cat_health",
            "విద్య"      to "cat_education",
            "భక్తి"      to "cat_spiritual",
            "వ్యవసాయం"  to "cat_agriculture",
            "జాతీయం"    to "cat_national",
            "ప్రపంచం"   to "cat_international",
            "జీవనశైలి"  to "cat_lifestyle"
        )
    }
}
