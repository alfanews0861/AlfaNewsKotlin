@file:android.annotation.SuppressLint("LocalContextGetResourceValueCall")
package com.alfanews.telugu.views

import androidx.activity.compose.BackHandler
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.alfanews.telugu.MainActivity
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.WeatherAlert
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.viewmodels.MainViewModel
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.alfanews.telugu.viewmodels.LocalNewsFeedViewModel
import com.alfanews.telugu.views.policy.*
import com.alfanews.telugu.views.WeatherAlertBanner
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    mainViewModel: MainViewModel,
    newsFeedViewModel: NewsFeedViewModel,
    localNewsFeedViewModel: LocalNewsFeedViewModel? = null,
    completeUpdate: () -> Unit = {}
) {
    val rawCurrentUser: User? by mainViewModel.currentUser.collectAsStateWithLifecycle()
    val authUser = com.alfanews.telugu.services.FirebaseService.auth.currentUser
    val cleanRawPhone = rawCurrentUser?.phone?.replace("+91", "")?.trim()
    val cleanAuthPhone = authUser?.phoneNumber?.replace("+91", "")?.trim()
    val isAdmin = rawCurrentUser?.role == UserRole.ADMIN ||
        cleanRawPhone == "9173811009" ||
        rawCurrentUser?.phone?.contains("9173811009") == true ||
        cleanAuthPhone == "9173811009" ||
        authUser?.phoneNumber?.contains("9173811009") == true ||
        rawCurrentUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true ||
        authUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true
    val isPermanentReporter = rawCurrentUser?.email?.equals("alfanewsservice@gmail.com", ignoreCase = true) == true ||
        authUser?.email?.equals("alfanewsservice@gmail.com", ignoreCase = true) == true
    val effectiveUserFromAuth = if (rawCurrentUser == null && authUser != null) {
        val prefs = com.alfanews.telugu.utils.PreferenceManager.getInstance(androidx.compose.ui.platform.LocalContext.current)
        val cachedRole = if (isAdmin) "ADMIN" else if (isPermanentReporter) "REPORTER" else (prefs.userRole ?: "SUBSCRIBER")
        User(
            id = authUser.uid,
            name = prefs.userName ?: authUser.displayName ?: if (isAdmin) "శ్రీకాంత్ రెడ్డి" else if (isPermanentReporter) "Alfa News Service" else "User",
            phone = authUser.phoneNumber ?: prefs.userPhone,
            email = authUser.email,
            role = if (isAdmin) UserRole.ADMIN else if (isPermanentReporter) UserRole.REPORTER else UserRole.fromString(cachedRole),
            district = if (isPermanentReporter) "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" else prefs.userDistrict,
            assignedMandal = if (isPermanentReporter) "నెల్లూరు అర్బన్" else prefs.userAssignedMandal
        )
    } else {
        rawCurrentUser
    }
    val user = effectiveUserFromAuth
    val hasReporterHistory = user != null && (
        !user.assignedMandal.isNullOrBlank() ||
        user.points > 0 ||
        user.badges.isNotEmpty() ||
        isPermanentReporter
    )
    val effectiveRole = when {
        isAdmin -> UserRole.ADMIN
        isPermanentReporter -> UserRole.REPORTER
        user?.role == UserRole.SUBSCRIBER && hasReporterHistory -> UserRole.REPORTER
        else -> user?.role ?: if (authUser != null) UserRole.SUBSCRIBER else UserRole.GUEST
    }
    val currentUser = if (user != null && isPermanentReporter) {
        user.copy(
            role = UserRole.REPORTER,
            district = "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
            assignedMandal = "నెల్లూరు అర్బన్"
        )
    } else if (user != null && user.role != effectiveRole) {
        user.copy(role = effectiveRole)
    } else {
        user
    }
    val language: Language by mainViewModel.language.collectAsStateWithLifecycle()
    val activeTab: String by mainViewModel.activeTab.collectAsStateWithLifecycle()
    val adminActivePage by mainViewModel.adminActivePage.collectAsStateWithLifecycle()
    val activeDistrict: String? by mainViewModel.activeDistrict.collectAsStateWithLifecycle()
    val showDistrictPicker by mainViewModel.showDistrictPicker.collectAsStateWithLifecycle()
    val themeMode: ThemeMode by mainViewModel.themeMode.collectAsStateWithLifecycle()
    val showOnboarding by mainViewModel.showOnboarding.collectAsStateWithLifecycle()
    val showRatingDialog by mainViewModel.showRatingDialog.collectAsStateWithLifecycle()
    val newNewsNotification by mainViewModel.newNewsNotification.collectAsStateWithLifecycle()
    val activeWeatherAlert by mainViewModel.activeWeatherAlert.collectAsStateWithLifecycle()
    val reporterIdToShow: String? by mainViewModel.reporterIdToShow.collectAsStateWithLifecycle()

    val news by newsFeedViewModel.news.collectAsStateWithLifecycle()
    
    var showPostNewsPage by remember { mutableStateOf(false) }
    var showPostSurveyPage by remember { mutableStateOf(false) }
    var showJoinReporterPage by remember { mutableStateOf(false) }
    var showEditProfilePage by remember { mutableStateOf(false) }
    var showIdCardPage by remember { mutableStateOf(false) }
    var editingNewsPost by remember { mutableStateOf<NewsPost?>(null) }
    
    var classifiedsInitialMode by remember { mutableStateOf(ClassifiedsViewMode.CATEGORIES) }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    val isBackHandlerEnabled = drawerState.isOpen ||
            showDistrictPicker ||
            reporterIdToShow != null ||
            showPostNewsPage ||
            showPostSurveyPage ||
            showJoinReporterPage ||
            showEditProfilePage ||
            showIdCardPage ||
            (activeTab == "profile" && adminActivePage != "profile") ||
            activeTab != "home"

    BackHandler(enabled = isBackHandlerEnabled) {
        scope.launch {
            when {
                drawerState.isOpen -> drawerState.close()
                showDistrictPicker -> mainViewModel.setShowDistrictPicker(false)
                reporterIdToShow != null -> mainViewModel.setReporterIdToShow(null)
                showPostNewsPage -> {
                    showPostNewsPage = false
                    editingNewsPost = null
                }
                showPostSurveyPage -> {
                    showPostSurveyPage = false
                    mainViewModel.setActiveTab("home")
                }
                showJoinReporterPage -> showJoinReporterPage = false
                showEditProfilePage -> showEditProfilePage = false
                showIdCardPage -> showIdCardPage = false
                activeTab == "profile" && adminActivePage != "profile" -> mainViewModel.setAdminActivePage("profile")
                activeTab != "home" -> mainViewModel.setActiveTab("home")
            }
        }
    }

    val context = LocalContext.current
    val notificationsGranted by mainViewModel.notificationsGranted.collectAsStateWithLifecycle()
    val unreadMessagesCount by mainViewModel.unreadMessagesCount.collectAsStateWithLifecycle()
    val unreadAdminNotices by mainViewModel.unreadAdminNotices.collectAsStateWithLifecycle()
    var isNoticeDismissed by remember(unreadAdminNotices) { mutableStateOf(false) }
    val showNoticePopup = unreadAdminNotices.isNotEmpty() && !isNoticeDismissed && activeTab != "messages"
    var showNotifBannerSession by remember { mutableStateOf(true) }

    val isDark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> androidx.compose.foundation.isSystemInDarkTheme()
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawerContent(
                user = currentUser,
                activePage = activeTab,
                unreadMessagesCount = unreadMessagesCount,
                onPageSelected = { page ->

                    scope.launch { drawerState.close() }
                    
                    // Reset overlay states to ensure navigation works from any sub-page
                    showPostNewsPage = false
                    showPostSurveyPage = false
                    showJoinReporterPage = false
                    showEditProfilePage = false
                    showIdCardPage = false
                    mainViewModel.setReporterIdToShow(null)
                    editingNewsPost = null
                    
                    when (page) {
                        "home", "local", "create", "classifieds", "profile", "reporters", "leaderboard", "messages" -> {
                            mainViewModel.setActiveTab(page)
                            if (page == "profile" || page == "messages") {
                                mainViewModel.setAdminActivePage(page)
                            }
                        }
                        "id-card" -> {
                            showIdCardPage = true
                        }
                        "post" -> {
                            showPostNewsPage = true
                        }
                        "survey" -> {
                            showPostSurveyPage = true
                        }
                        "manage", "manageReporters", "manageUsers", "adminNotify", "affiliate_settings", "ads", "manageSurveys" -> {
                            mainViewModel.setAdminActivePage(page)
                            mainViewModel.setActiveTab("profile")
                        }
                    }
                },
                onLogout = {
                    scope.launch { drawerState.close() }
                    // Reset overlay states on logout
                    showPostNewsPage = false
                    showPostSurveyPage = false
                    showJoinReporterPage = false
                    showEditProfilePage = false
                    showIdCardPage = false
                    mainViewModel.setReporterIdToShow(null)
                    editingNewsPost = null
                    mainViewModel.signOut()
                }
            )
        },
        gesturesEnabled = true
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = if (isDark) {
                            listOf(Color(0xFF000000), Color(0xFF121212), Color(0xFF212121))
                        } else {
                            listOf(Color(0xFFFFFFFF), Color(0xFFF5F5F5), Color(0xFFEEEEEE))
                        }
                    )
                )
        ) {
            newNewsNotification?.let { post: NewsPost ->
                InAppNotificationView(
                    post = post,
                    onDismiss = { mainViewModel.dismissInAppNotification() },
                    onClick = {
                        newsFeedViewModel.navigateToPost(post)
                        mainViewModel.setActiveTab("home")
                        mainViewModel.dismissInAppNotification()
                    }
                )
            }

            Scaffold(
                modifier = Modifier.fillMaxSize(),
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
                containerColor = Color.Transparent,
                snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
                topBar = {
                    Column {
                        LogoHeader(
                            district = activeDistrict,
                            showDistrictSelector = (activeTab == "home" || activeTab == "local") && !showPostNewsPage && !showPostSurveyPage && !showJoinReporterPage && !showEditProfilePage && !showIdCardPage && (reporterIdToShow == null),
                            onDistrictClick = { mainViewModel.setShowDistrictPicker(true) },
                            onMenuClick = { scope.launch { drawerState.open() } }
                        )

                        // ✅ RED STRIP: Always immediately below Blue Header
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .background(Color(0xFFF44336))
                        )

                        // Contextual Sub-Header Row
                        val subHeaderTitle = when {
                            reporterIdToShow != null -> if (language == Language.TELUGU) "రిపోర్టర్ ప్రొఫైల్" else "Reporter Profile"
                            showPostNewsPage -> if (language == Language.TELUGU) "వార్తను పబ్లిష్ చేయండి" else "Publish News"
                            showPostSurveyPage -> stringResource(R.string.post_survey)
                            showJoinReporterPage -> stringResource(R.string.join_reporter)
                            showEditProfilePage -> stringResource(R.string.edit_profile)
                            showIdCardPage -> stringResource(R.string.id_card)
                            activeTab == "reporters" -> stringResource(R.string.reporters)
                            activeTab == "leaderboard" -> if (language == Language.TELUGU) "మంత్లీ లీడర్ బోర్డ్" else "Monthly Leaderboard"
                            activeTab == "messages" -> if (language == Language.TELUGU) "సందేశాలు" else "Messages"
                            activeTab == "profile" -> {
                                when (adminActivePage) {
                                    "edit-profile" -> stringResource(R.string.edit_profile)
                                    "manageSurveys" -> "సర్వే నిర్వహణ"
                                    "id-card" -> stringResource(R.string.id_card)
                                    "messages" -> stringResource(R.string.messages)
                                    "post" -> stringResource(R.string.post_news)
                                    "survey" -> stringResource(R.string.post_survey)
                                    "ads" -> stringResource(R.string.ads_manager)
                                    "manage" -> stringResource(R.string.manage_news)
                                    "manageReporters" -> stringResource(R.string.manage_reporters)
                                    "manageUsers" -> stringResource(R.string.manage_users)
                                    "adminNotify" -> stringResource(R.string.push_notifications_title)
                                    "appConfig" -> "App Configuration"
                                    "affiliate_settings" -> "Affiliate News API"
                                    else -> null
                                }
                            }
                            listOf("about", "contact", "privacy-policy", "terms", "content-policy", "disclaimer", "ad-policy", "data-collection").contains(activeTab) -> {
                                when (activeTab) {
                                    "about" -> stringResource(R.string.about_us)
                                    "contact" -> stringResource(R.string.contact_us)
                                    "privacy-policy" -> stringResource(R.string.privacy_policy)
                                    "terms" -> stringResource(R.string.terms_of_service)
                                    "content-policy" -> stringResource(R.string.content_policy)
                                    "disclaimer" -> stringResource(R.string.disclaimer)
                                    "ad-policy" -> stringResource(R.string.ad_policy)
                                    "data-collection" -> stringResource(R.string.data_policy)
                                    else -> ""
                                }
                            }
                            else -> null
                        }

                        if (subHeaderTitle != null) {
                            val onBackAction = {
                                when {
                                    reporterIdToShow != null -> mainViewModel.setReporterIdToShow(null)
                                    showPostNewsPage -> {
                                        showPostNewsPage = false
                                        editingNewsPost = null
                                    }
                                    showPostSurveyPage -> {
                                        showPostSurveyPage = false
                                        mainViewModel.setActiveTab("home")
                                    }
                                    showJoinReporterPage -> showJoinReporterPage = false
                                    showEditProfilePage -> showEditProfilePage = false
                                    showIdCardPage -> showIdCardPage = false
                                    activeTab == "profile" && adminActivePage != "profile" -> mainViewModel.setAdminActivePage("profile")
                                    else -> mainViewModel.setActiveTab("profile")
                                }
                            }

                            Surface(
                                color = MaterialTheme.colorScheme.surface,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 4.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    IconButton(onClick = onBackAction) {
                                        Icon(
                                            imageVector = Icons.Default.ArrowBack,
                                            contentDescription = "Back",
                                            tint = MaterialTheme.colorScheme.onSurface
                                        )
                                    }
                                    Text(
                                        text = subHeaderTitle,
                                        fontSize = 18.sp,
                                        fontFamily = Ramabhadra,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        modifier = Modifier.padding(start = 4.dp).weight(1f)
                                    )
                                }
                            }
                        }
                    }
                },
                bottomBar = {
                    Footer(
                        activeTab = activeTab,
                        unreadMessagesCount = unreadMessagesCount,
                        language = language,
                        onTabChange = { tab: String -> 
                            if (tab == "local") {
                                if (activeTab == "local") {
                                    localNewsFeedViewModel?.loadNews(language, user, forceRefresh = true)
                                    localNewsFeedViewModel?.requestScrollToTop()
                                } else {
                                    localNewsFeedViewModel?.refreshIfStale(language, user)
                                }
                            } else if (tab == "home") {
                                if (activeTab == "home") {
                                    newsFeedViewModel.loadNews(language, user, forceRefresh = true)
                                    newsFeedViewModel.requestScrollToTop()
                                } else {
                                    newsFeedViewModel.refreshIfStale(language, user)
                                }
                            }

                            // Reset overlay states when switching tabs via footer
                            showPostNewsPage = false
                            showJoinReporterPage = false
                            showEditProfilePage = false
                            showIdCardPage = false
                            mainViewModel.setReporterIdToShow(null)
                            editingNewsPost = null
                            
                            classifiedsInitialMode = ClassifiedsViewMode.CATEGORIES
                            mainViewModel.setActiveTab(tab) 
                        }
                    )
                }
            ) { paddingValues ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    activeWeatherAlert?.let { alert: WeatherAlert ->
                        WeatherAlertBanner(
                            alert = alert,
                            onDismiss = { mainViewModel.dismissWeatherAlert() }
                        )
                    }

                    if (!notificationsGranted && showNotifBannerSession && activeTab == "home" && (reporterIdToShow == null) && !showPostNewsPage) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(8.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isDark) Color(0xFF310000) else Color(0xFFFFEBEE)
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .padding(12.dp)
                                    .fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.NotificationsOff,
                                    contentDescription = null,
                                    tint = if (isDark) Color(0xFFFF8A80) else Color(0xFFD32F2F),
                                    modifier = Modifier.size(24.dp)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = if (language == Language.TELUGU) "నోటిఫికేషన్లు ఆఫ్ చేయబడ్డాయి" else "Notifications are Off",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = if (isDark) Color.White else Color.Black
                                    )
                                    Text(
                                        text = if (language == Language.TELUGU) "వాతావరణ హెచ్చరికలు మరియు బ్రేకింగ్ న్యూస్ మిస్ కాకుండా ఉండటానికి ఆన్ చేయండి." else "Enable to receive weather alerts and breaking news.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (isDark) Color.LightGray else Color.DarkGray
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                     TextButton(
                                         onClick = {
                                             val mainAct = context as? MainActivity
                                             if (mainAct != null) {
                                                 mainAct.openNotificationSettings()
                                             } else {
                                                 try {
                                                     val intent = Intent().apply {
                                                         if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                                                             action = android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS
                                                             putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                                                         } else {
                                                             action = "android.settings.APP_NOTIFICATION_SETTINGS"
                                                             putExtra("app_package", context.packageName)
                                                             putExtra("app_uid", context.applicationInfo.uid)
                                                         }
                                                         addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                     }
                                                     context.startActivity(intent)
                                                 } catch (e: Exception) {
                                                     android.util.Log.e("MainScreen", "Could not open notifications setting fallback", e)
                                                 }
                                             }
                                         },
                                         contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                                     ) {
                                        Text(
                                            text = if (language == Language.TELUGU) "సెట్టింగ్స్" else "Settings",
                                            color = if (isDark) Color(0xFFFF8A80) else Color(0xFFD32F2F),
                                            style = MaterialTheme.typography.labelLarge
                                        )
                                    }
                                    IconButton(
                                        onClick = { showNotifBannerSession = false },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "Dismiss",
                                            modifier = Modifier.size(16.dp),
                                            tint = if (isDark) Color.Gray else Color.LightGray
                                        )
                                    }
                                }
                            }
                        }
                    }

                    val user = currentUser
                    val openNewsPost: (NewsPost) -> Unit = { post ->
                        val isDistrictStory = !post.district.isNullOrBlank() && 
                            post.district != "State" && 
                            com.alfanews.telugu.utils.Constants.isSpecificDistrict(post.district)
                        if (isDistrictStory) {
                            val targetDistrict = post.district!!
                            mainViewModel.setDistrict(targetDistrict)
                            localNewsFeedViewModel?.setDistrict(targetDistrict, initialPinnedPost = post)
                            localNewsFeedViewModel?.prependPost(post)
                            localNewsFeedViewModel?.requestScrollToTop()
                            localNewsFeedViewModel?.loadNews(language, user, forceRefresh = false, initialPost = post)
                            mainViewModel.setActiveTab("local")
                        } else {
                            newsFeedViewModel.navigateToPost(post)
                            newsFeedViewModel.requestScrollToTop()
                            newsFeedViewModel.loadNews(language, user, initialPostId = post.id, forceRefresh = false)
                            mainViewModel.setActiveTab("home")
                        }
                    }

                    val openNewsById: (String) -> Unit = { targetPostId ->
                        if (targetPostId.isNotBlank() && targetPostId != "HOME_ONLY") {
                            scope.launch {
                                var post: NewsPost? = null
                                try {
                                    val doc = try {
                                        kotlinx.coroutines.withTimeoutOrNull(4000L) {
                                            com.alfanews.telugu.services.FirebaseService.db.collection("news").document(targetPostId).get().await()
                                        } ?: com.alfanews.telugu.services.FirebaseService.db.collection("news").document(targetPostId).get(com.google.firebase.firestore.Source.CACHE).await()
                                    } catch (_: Exception) {
                                        try {
                                            com.alfanews.telugu.services.FirebaseService.db.collection("news").document(targetPostId).get(com.google.firebase.firestore.Source.CACHE).await()
                                        } catch (_: Exception) { null }
                                    }
                                    if (doc != null && doc.exists()) {
                                        post = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, doc.data ?: emptyMap(), language)
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e("MainScreen", "Error opening post by ID: ${e.message}")
                                }
                                if (post != null) {
                                    openNewsPost(post)
                                } else {
                                    newsFeedViewModel.navigateToPostId(targetPostId)
                                    localNewsFeedViewModel?.navigateToPostId(targetPostId)
                                    newsFeedViewModel.requestScrollToTop()
                                    localNewsFeedViewModel?.requestScrollToTop()
                                    mainViewModel.setActiveTab("home")
                                }
                            }
                        } else {
                            mainViewModel.setActiveTab("home")
                        }
                    }

                    val currentReporterId = reporterIdToShow
                    if (currentReporterId != null) {
                        ReporterProfileView(
                            reporterId = currentReporterId,
                            language = language,
                            currentUser = user,
                            showHeader = false,
                            onBack = { mainViewModel.setReporterIdToShow(null) }
                        )
                    } else if (showPostSurveyPage && user != null) {
                        PostSurveyPageView(
                            user = user,
                            onActionComplete = {
                                showPostSurveyPage = false
                                mainViewModel.setActiveTab("home")
                            }
                        )
                    } else if (showPostNewsPage) {
                        val postUser = user ?: User(id = com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid.orEmpty(), name = "రిపోర్టర్", role = UserRole.REPORTER)
                        PostNewsPageView(
                            user = postUser,
                            postToEdit = editingNewsPost,
                            onActionComplete = { postId: String -> 
                                showPostNewsPage = false
                                editingNewsPost = null
                                openNewsById(postId)
                            },
                            onPostReady = { post: NewsPost ->
                                showPostNewsPage = false
                                editingNewsPost = null
                                openNewsPost(post)
                            }
                        )
                    } else if (showJoinReporterPage) {
                        JoinReporterPageView(
                            onClose = { showJoinReporterPage = false },
                            onNavigateToLogin = {
                                showJoinReporterPage = false
                                mainViewModel.setActiveTab("profile")
                            },
                            onOpenChat = {
                                showJoinReporterPage = false
                                mainViewModel.setActiveTab("messages")
                            }
                        )
                    } else if (showEditProfilePage && user != null) {
                        EditProfilePageView(
                            user = user,
                            onClose = { showEditProfilePage = false },
                            onSave = { name: String, phone: String, address: String, district: String, mandal: String, photoUri: Uri?, signatureUri: Uri? ->
                                mainViewModel.updateUserProfile(name, phone, address, district, mandal, photoUri, signatureUri)
                                showEditProfilePage = false
                            },
                            saving = false
                        )
                    } else if (showIdCardPage && (user != null || com.alfanews.telugu.services.FirebaseService.auth.currentUser != null)) {
                        val authUser = com.alfanews.telugu.services.FirebaseService.auth.currentUser
                        val effectiveIdCardUser = user ?: User(
                            id = authUser?.uid ?: "user",
                            name = authUser?.displayName ?: "విలేకరి",
                            phone = authUser?.phoneNumber,
                            role = UserRole.REPORTER
                        )
                        IdCardPageView(
                            user = effectiveIdCardUser,
                            onBack = { showIdCardPage = false }
                        )
                    } else {
                        when (activeTab) {
                            "home" -> NewsFeedView(
                                language = language, 
                                currentUser = user, 
                                viewModel = newsFeedViewModel,
                                onReporterClick = { mainViewModel.setReporterIdToShow(it) },
                                onDistrictClick = { mainViewModel.setShowDistrictPicker(true) },
                                onEditClick = { post ->
                                    editingNewsPost = post
                                    showPostNewsPage = true
                                },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "local" -> {
                                if (localNewsFeedViewModel != null) {
                                    LocalNewsFeedView(
                                        language = language, 
                                        currentUser = user, 
                                        viewModel = localNewsFeedViewModel,
                                        onDistrictClick = { mainViewModel.setShowDistrictPicker(true) },
                                        onProfileClick = { mainViewModel.setActiveTab("profile") },
                                        onReporterClick = { mainViewModel.setReporterIdToShow(it) },
                                        onEditClick = { post ->
                                            editingNewsPost = post
                                            showPostNewsPage = true
                                        },
                                        onMenuClick = { scope.launch { drawerState.open() } }
                                    )
                                } else {
                                    LocalNewsFeedView(
                                        language = language, 
                                        currentUser = user, 
                                        onDistrictClick = { mainViewModel.setShowDistrictPicker(true) },
                                        onProfileClick = { mainViewModel.setActiveTab("profile") },
                                        onReporterClick = { mainViewModel.setReporterIdToShow(it) },
                                        onEditClick = { post ->
                                            editingNewsPost = post
                                            showPostNewsPage = true
                                        },
                                        onMenuClick = { scope.launch { drawerState.open() } }
                                    )
                                }
                            }
                            "create" -> {
                                var showCitizenJournalism by remember { mutableStateOf(false) }
                                if (showCitizenJournalism) {
                                    CitizenPostPageView(user = user ?: User(id = "guest", name = "Guest"), onClose = { showCitizenJournalism = false })
                                } else {
                                    CreateMenuView(
                                        currentUser = user,
                                        onAction = { action ->
                                            when (action) {
                                                "citizen" -> {
                                                    if (user == null) mainViewModel.setActiveTab("profile")
                                                    else showCitizenJournalism = true
                                                }
                                                "news" -> {
                                                    showPostNewsPage = true
                                                }
                                                "survey" -> {
                                                    showPostSurveyPage = true
                                                }
                                                "join_reporter" -> {
                                                    showJoinReporterPage = true
                                                }
                                                "classified" -> {
                                                    classifiedsInitialMode = ClassifiedsViewMode.POST
                                                    mainViewModel.setActiveTab("classifieds")
                                                }
                                            }
                                        },
                                        onClose = { mainViewModel.setActiveTab("home") }
                                    )
                                }
                            }
                            "classifieds" -> ClassifiedsView(
                                currentUser = user, 
                                initialMode = classifiedsInitialMode,
                                onNavigateToLogin = { mainViewModel.setActiveTab("profile") },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "profile" -> ProfileContainer(
                                language = language,
                                currentUser = user,
                                viewModel = mainViewModel,
                                onNavigate = { pageId ->
                                    if (pageId == "edit-profile") {
                                        showEditProfilePage = true
                                    } else if (pageId == "id-card") {
                                        showIdCardPage = true
                                    } else {
                                        val topLevelPages = listOf(
                                            "about", "contact", "privacy-policy", "terms", 
                                            "content-policy", "disclaimer", "ad-policy", 
                                            "data-collection", "reporters", "leaderboard"
                                        )
                                        if (topLevelPages.contains(pageId)) {
                                            mainViewModel.setActiveTab(pageId)
                                        } else {
                                            mainViewModel.setAdminActivePage(pageId)
                                            mainViewModel.setActiveTab("profile")
                                        }
                                    }
                                },
                                onPostPublished = { postId ->
                                    openNewsById(postId)
                                },
                                onViewPost = { post ->
                                    openNewsPost(post)
                                },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "about" -> PolicyContainer("about")
                            "contact" -> PolicyContainer("contact")
                            "privacy-policy" -> PolicyContainer("privacy-policy")
                            "terms" -> PolicyContainer("terms")
                            "content-policy" -> PolicyContainer("content-policy")
                            "disclaimer" -> PolicyContainer("disclaimer")
                            "ad-policy" -> PolicyContainer("ad-policy")
                            "data-collection" -> PolicyContainer("data-collection")
                            "reporters" -> ReportersView(
                                language = language,
                                currentUser = user,
                                onBack = { mainViewModel.setActiveTab("profile") },
                                onReporterClick = { mainViewModel.setReporterIdToShow(it) },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "leaderboard" -> LeaderboardView(
                                language = language,
                                onBack = { mainViewModel.setActiveTab("profile") },
                                onReporterClick = { mainViewModel.setReporterIdToShow(it) },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "messages" -> {
                                if (user != null && user.canAccessMessages) {
                                    if (user.role == UserRole.ADMIN || user.role == UserRole.EDITOR || user.role == UserRole.NEWS_DESK || user.role == UserRole.REGIONAL_INCHARGE) {
                                        AdminReporterMessagingView(
                                            currentUser = user,
                                            onBack = { mainViewModel.setActiveTab("profile") }
                                        )
                                    } else {
                                        ReporterDeskChatView(
                                            user = user,
                                            onBack = { mainViewModel.setActiveTab("profile") }
                                        )
                                    }
                                } else {
                                    LaunchedEffect(Unit) {
                                        mainViewModel.setActiveTab("profile")
                                    }
                                }
                            }

                            else -> NewsFeedView(
                                language = language, 
                                currentUser = user, 
                                viewModel = newsFeedViewModel,
                                onReporterClick = { mainViewModel.setReporterIdToShow(it) },
                                onEditClick = { post ->
                                    editingNewsPost = post
                                    showPostNewsPage = true
                                },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                        }
                    }
                }
            }
        }

        if (showOnboarding) {
            OnboardingTooltip(
                message = stringResource(R.string.settings_onboarding),
                onDismiss = { mainViewModel.dismissOnboarding() }
            )
        }

        if (showRatingDialog) {
            AlertDialog(
                onDismissRequest = { mainViewModel.dismissRatingDialog() },
                title = { Text(stringResource(R.string.rate_us_title)) },
                text = { Text(stringResource(R.string.rate_us_text)) },
                confirmButton = {
                    Button(
                        onClick = {
                            mainViewModel.markAsRated()
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                data = Uri.parse("market://details?id=com.alfanews.telugu")
                                setPackage("com.android.vending")
                            }
                            try {
                                context.startActivity(intent)
                            } catch (e: Exception) {
                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=com.alfanews.telugu")))
                                } catch (ex: Exception) {
                                    android.util.Log.e("MainScreen", "Could not open Play Store rating", ex)
                                }
                            }
                        }
                    ) {
                        Text(stringResource(R.string.rate_now))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { mainViewModel.dismissRatingDialog() }) {
                        Text(stringResource(R.string.later))
                    }
                }
            )
        }

        if (showDistrictPicker) {
            DistrictPickerDialog(
                activeDistrict = activeDistrict,
                onDistrictSelected = { district ->
                    mainViewModel.setDistrict(district)
                    localNewsFeedViewModel?.setDistrict(district)
                    mainViewModel.setShowDistrictPicker(false)
                },
                onDismissRequest = { mainViewModel.setShowDistrictPicker(false) }
            )
        }

        // 📢 విలేకరులు/మాజీ రిపోర్టర్లు యాప్ ఓపెన్ చేయగానే అడ్మిన్ పంపిన సందేశాల In-App Popup
        if (showNoticePopup) {
            AdminNoticePopupDialog(
                notices = unreadAdminNotices,
                onOpenAllMessages = {
                    isNoticeDismissed = true
                    mainViewModel.markAllAdminMessagesRead()
                    mainViewModel.setActiveTab("messages")
                    if (isAdmin || currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.EDITOR || currentUser?.role == UserRole.NEWS_DESK || currentUser?.role == UserRole.REGIONAL_INCHARGE) {
                        mainViewModel.setAdminActivePage("messages")
                    }
                },
                onDismiss = {
                    isNoticeDismissed = true
                }
            )
        }
    }
}

@Composable
fun ProfileContainer(
    language: Language,
    currentUser: User?,
    viewModel: MainViewModel,
    onNavigate: (String) -> Unit,
    onPostPublished: (String) -> Unit = {},
    onViewPost: (NewsPost) -> Unit = {},
    onMenuClick: (() -> Unit)? = null
) {
    var showLogin by remember { mutableStateOf(false) }
    val themeMode by viewModel.themeMode.collectAsState()
    val adminActivePage by viewModel.adminActivePage.collectAsState()
    val unreadMessagesCount by viewModel.unreadMessagesCount.collectAsState()
    val authUser = com.alfanews.telugu.services.FirebaseService.auth.currentUser
    val cleanCurrentPhone = currentUser?.phone?.replace("+91", "")?.trim()
    val cleanAuthPhone = authUser?.phoneNumber?.replace("+91", "")?.trim()
    val isAdmin = (currentUser?.role == UserRole.ADMIN) ||
        (cleanCurrentPhone == "9173811009") ||
        (currentUser?.phone?.contains("9173811009") == true) ||
        (cleanAuthPhone == "9173811009") ||
        (authUser?.phoneNumber?.contains("9173811009") == true) ||
        (currentUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true) ||
        (authUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true)
    val isPermanentReporter = (currentUser?.email?.equals("alfanewsservice@gmail.com", ignoreCase = true) == true) ||
        (authUser?.email?.equals("alfanewsservice@gmail.com", ignoreCase = true) == true)
    val effectiveCurrentUser = if (currentUser == null && authUser != null) {
        val prefs = com.alfanews.telugu.utils.PreferenceManager.getInstance(androidx.compose.ui.platform.LocalContext.current)
        val cachedRole = if (isAdmin) "ADMIN" else if (isPermanentReporter) "REPORTER" else (prefs.userRole ?: "SUBSCRIBER")
        User(
            id = authUser.uid,
            name = prefs.userName ?: authUser.displayName ?: if (isAdmin) "శ్రీకాంత్ రెడ్డి" else if (isPermanentReporter) "Alfa News Service" else "User",
            phone = authUser.phoneNumber ?: prefs.userPhone,
            email = authUser.email,
            role = if (isAdmin) UserRole.ADMIN else if (isPermanentReporter) UserRole.REPORTER else UserRole.fromString(cachedRole),
            district = if (isPermanentReporter) "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" else prefs.userDistrict,
            assignedMandal = if (isPermanentReporter) "నెల్లూరు అర్బన్" else prefs.userAssignedMandal
        )
    } else {
        currentUser
    }
    val hasReporterHistory = effectiveCurrentUser != null && (
        !effectiveCurrentUser.assignedMandal.isNullOrBlank() ||
        effectiveCurrentUser.points > 0 ||
        effectiveCurrentUser.badges.isNotEmpty() ||
        isPermanentReporter
    )
    val effectiveUserRole = when {
        isAdmin -> UserRole.ADMIN
        isPermanentReporter -> UserRole.REPORTER
        effectiveCurrentUser?.role == UserRole.SUBSCRIBER && hasReporterHistory -> UserRole.REPORTER
        else -> effectiveCurrentUser?.role ?: if (authUser != null) UserRole.SUBSCRIBER else UserRole.GUEST
    }
    val user = if (effectiveCurrentUser != null && isPermanentReporter) {
        effectiveCurrentUser.copy(
            role = UserRole.REPORTER,
            district = "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
            assignedMandal = "నెల్లూరు అర్బన్"
        )
    } else if (effectiveCurrentUser != null && effectiveCurrentUser.role != effectiveUserRole) {
        effectiveCurrentUser.copy(
            role = effectiveUserRole
        )
    } else {
        effectiveCurrentUser
    }

    val isStaff = user != null && (effectiveUserRole == UserRole.ADMIN || effectiveUserRole == UserRole.EDITOR || effectiveUserRole == UserRole.REGIONAL_INCHARGE || effectiveUserRole == UserRole.REPORTER || effectiveUserRole == UserRole.NEWS_DESK)
    
    if (isStaff && user != null) {
        AdminPanelView(
            user = user,
            onClose = { viewModel.setActiveTab("home") },
            language = language,
            setLanguage = { newLanguage -> viewModel.setLanguage(newLanguage) },
            themeMode = themeMode,
            onThemeModeChange = { viewModel.setThemeMode(it) },
            unreadMessagesCount = unreadMessagesCount,
            onLogout = { viewModel.signOut() },
            onLoginRequest = { showLogin = true },
            isModal = false,
            initialPage = adminActivePage,
            onNavigate = onNavigate,
            onPostPublished = onPostPublished,
            onViewPost = onViewPost,
            onMenuClick = onMenuClick,
            onPageChange = { viewModel.setAdminActivePage(it) }
        )
    } else {
        UserProfilePageView(
            user = user ?: User(id = authUser?.uid ?: "guest", name = if (authUser != null) "User" else "Guest", role = if (authUser != null) UserRole.SUBSCRIBER else UserRole.GUEST),
            language = language,
            setLanguage = { newLanguage -> viewModel.setLanguage(newLanguage) },
            themeMode = themeMode,
            onThemeModeChange = { viewModel.setThemeMode(it) },
            unreadMessagesCount = unreadMessagesCount,
            onNavigate = onNavigate,
            onLoginRequest = { showLogin = true },
            onLogout = { viewModel.signOut() },
            onToggleNotifications = { viewModel.toggleNotifications(it) },
            onMenuClick = onMenuClick
        )
    }


    if (showLogin) {
        LoginScreenView(
            onLoginSuccess = { isNewUser ->
                showLogin = false 
                if (isNewUser) {
                    onNavigate("edit-profile")
                }
            },
            onClose = { showLogin = false }
        )
    }
}

@Composable
fun PolicyContainer(pageId: String) {
    Box(modifier = Modifier.fillMaxSize()) {
        when (pageId) {
            "about" -> AboutUsPageView()
            "contact" -> ContactUsPageView()
            "privacy-policy" -> PrivacyPolicyPageView()
            "terms" -> TermsOfServicePageView()
            "content-policy" -> ContentPolicyPageView()
            "disclaimer" -> DisclaimerPageView()
            "ad-policy" -> AdPolicyPageView()
            "data-collection" -> DataCollectionPolicyPageView()
            else -> {}
        }
    }
}
