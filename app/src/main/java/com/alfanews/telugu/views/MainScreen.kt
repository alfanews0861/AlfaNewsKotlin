package com.alfanews.telugu.views

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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.alfanews.telugu.MainActivity
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.viewmodels.MainViewModel
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.alfanews.telugu.views.policy.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    mainViewModel: MainViewModel,
    newsFeedViewModel: NewsFeedViewModel,
    checkForUpdate: () -> Unit,
    completeUpdate: () -> Unit
) {
    val currentUser by mainViewModel.currentUser.collectAsStateWithLifecycle()
    val language by mainViewModel.language.collectAsStateWithLifecycle()
    val activeTab by mainViewModel.activeTab.collectAsStateWithLifecycle()
    val activeDistrict by mainViewModel.activeDistrict.collectAsStateWithLifecycle()
    val showDistrictPicker by mainViewModel.showDistrictPicker.collectAsStateWithLifecycle()
    val themeMode by mainViewModel.themeMode.collectAsStateWithLifecycle()
    val showOnboarding by mainViewModel.showOnboarding.collectAsStateWithLifecycle()
    val showRatingDialog by mainViewModel.showRatingDialog.collectAsStateWithLifecycle()
    val newNewsNotification by mainViewModel.newNewsNotification.collectAsStateWithLifecycle()

    val news by newsFeedViewModel.news.collectAsStateWithLifecycle()
    
    var showPostNewsPage by remember { mutableStateOf(false) }
    var showJoinReporterPage by remember { mutableStateOf(false) }
    var showEditProfilePage by remember { mutableStateOf(false) }
    var editingNewsPost by remember { mutableStateOf<NewsPost?>(null) }
    var reporterIdToShow by remember { mutableStateOf<String?>(null) }
    
    var classifiedsInitialMode by remember { mutableStateOf(ClassifiedsViewMode.CATEGORIES) }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        checkForUpdate()
    }

    val context = LocalContext.current
    val isUpdateDownloaded by mainViewModel.isUpdateDownloaded.collectAsStateWithLifecycle()
    
    val notificationsGranted by mainViewModel.notificationsGranted.collectAsStateWithLifecycle()
    var showNotifBannerSession by remember { mutableStateOf(true) }

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    LaunchedEffect(isUpdateDownloaded) {
        if (isUpdateDownloaded) {
            scope.launch {
                val result = snackbarHostState.showSnackbar(
                    message = context.getString(R.string.update_downloaded),
                    actionLabel = context.getString(R.string.update_now),
                    duration = SnackbarDuration.Indefinite
                )
                if (result == SnackbarResult.ActionPerformed) {
                    completeUpdate()
                }
            }
        }
    }

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
                onPageSelected = { page ->
                    scope.launch { drawerState.close() }
                    when (page) {
                        "home", "local", "create", "classifieds", "profile", "reporters", "leaderboard", "messages" -> {
                            mainViewModel.setActiveTab(page)
                            if (page == "profile" || page == "messages") {
                                mainViewModel.setAdminActivePage(page)
                            }
                        }
                        "post" -> {
                            showPostNewsPage = true
                        }
                        "manage", "manageReporters", "manageUsers", "adminNotify", "affiliate_settings", "ads" -> {
                            mainViewModel.setAdminActivePage(page)
                            mainViewModel.setActiveTab("profile")
                        }
                    }
                },
                onLogout = {
                    scope.launch { drawerState.close() }
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
                        newsFeedViewModel.setSharedPostId(post.id)
                        mainViewModel.setActiveTab("home")
                        newsFeedViewModel.loadNews(language, currentUser, initialPostId = post.id)
                        mainViewModel.dismissInAppNotification()
                    }
                )
            }

            Scaffold(
                containerColor = Color.Transparent,
                snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
                topBar = {
                    val user = currentUser
                    val role = user?.role

                    when {
                        showPostNewsPage -> {
                            LogoHeader(
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                        }
                        showJoinReporterPage -> {
                            LogoHeader(
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                        }
                        showEditProfilePage -> {
                            LogoHeader(
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                        }
                        else -> {
                            LogoHeader(
                                district = activeDistrict,
                                showDistrictSelector = true,
                                onDistrictClick = { mainViewModel.setShowDistrictPicker(true) },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                        }
                    }
                },
                bottomBar = {
                    if (!showPostNewsPage && !showJoinReporterPage && !showEditProfilePage && reporterIdToShow == null) {
                        Footer(
                            activeTab = activeTab,
                            onTabChange = { tab: String -> 
                                classifiedsInitialMode = ClassifiedsViewMode.CATEGORIES
                                mainViewModel.setActiveTab(tab) 
                            }
                        )
                    }
                }
            ) { paddingValues ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    if (!notificationsGranted && showNotifBannerSession && activeTab == "home" && reporterIdToShow == null && !showPostNewsPage) {
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
                                        onClick = { (context as? MainActivity)?.openNotificationSettings() },
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
                    val currentReporterId = reporterIdToShow
                    if (currentReporterId != null) {
                        ReporterProfileView(
                            reporterId = currentReporterId,
                            language = language,
                            currentUser = user,
                            onBack = { reporterIdToShow = null }
                        )
                    } else if (showPostNewsPage && user != null) {
                        PostNewsPageView(
                            user = user,
                            postToEdit = editingNewsPost,
                            onActionComplete = { postId: String -> 
                                showPostNewsPage = false
                                editingNewsPost = null
                                if (postId == "HOME_ONLY") {
                                    mainViewModel.setActiveTab("home")
                                } else if (postId.isNotBlank()) {
                                    mainViewModel.setActiveTab("home")
                                    newsFeedViewModel.setSharedPostId(postId)
                                    newsFeedViewModel.loadNews(language, user, initialPostId = postId)
                                }
                            }
                        )
                    } else if (showJoinReporterPage) {
                        JoinReporterPageView(
                            onClose = { showJoinReporterPage = false },
                            onNavigateToLogin = {
                                showJoinReporterPage = false
                                mainViewModel.setActiveTab("profile")
                            }
                        )
                    } else if (showEditProfilePage && user != null) {
                        EditProfilePageView(
                            user = user,
                            onClose = { showEditProfilePage = false },
                            onSave = { name: String, phone: String, address: String, district: String, photoUri: Uri?, signatureUri: Uri? ->
                                mainViewModel.updateUserProfile(name, phone, address, district, photoUri, signatureUri)
                                showEditProfilePage = false
                            },
                            saving = false
                        )
                    } else {
                        when (activeTab) {
                            "home" -> NewsFeedView(
                                language = language, 
                                currentUser = user, 
                                viewModel = newsFeedViewModel,
                                onReporterClick = { reporterIdToShow = it },
                                onDistrictClick = { mainViewModel.setShowDistrictPicker(true) },
                                onEditClick = { post ->
                                    editingNewsPost = post
                                    showPostNewsPage = true
                                },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "local" -> LocalNewsFeedView(
                                language = language, 
                                currentUser = user, 
                                onDistrictClick = { mainViewModel.setShowDistrictPicker(true) },
                                onProfileClick = { mainViewModel.setActiveTab("profile") },
                                onReporterClick = { reporterIdToShow = it },
                                onEditClick = { post ->
                                    editingNewsPost = post
                                    showPostNewsPage = true
                                },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
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
                                    if (postId.isNotBlank()) {
                                        mainViewModel.setActiveTab("home")
                                        newsFeedViewModel.setSharedPostId(postId)
                                        newsFeedViewModel.loadNews(language, user, initialPostId = postId)
                                    }
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
                                onReporterClick = { reporterIdToShow = it },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "leaderboard" -> LeaderboardView(
                                language = language,
                                onBack = { mainViewModel.setActiveTab("profile") },
                                onReporterClick = { reporterIdToShow = it },
                                onMenuClick = { scope.launch { drawerState.open() } }
                            )
                            "messages" -> if (user != null) {
                                MessagesPageView(
                                    user = user,
                                    onBack = { mainViewModel.setActiveTab("profile") },
                                    onMenuClick = { scope.launch { drawerState.open() } }
                                )
                            }
                            else -> NewsFeedView(
                                language = language, 
                                currentUser = user, 
                                viewModel = newsFeedViewModel,
                                onReporterClick = { reporterIdToShow = it },
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
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=com.alfanews.telugu")))
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
                    mainViewModel.setShowDistrictPicker(false)
                },
                onDismissRequest = { mainViewModel.setShowDistrictPicker(false) }
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
    onMenuClick: (() -> Unit)? = null
) {
    var showLogin by remember { mutableStateOf(false) }
    val themeMode by viewModel.themeMode.collectAsState()
    val adminActivePage by viewModel.adminActivePage.collectAsState()
    val user = currentUser

    val isStaff = user != null && (user.role == UserRole.ADMIN || user.role == UserRole.EDITOR || user.role == UserRole.REGIONAL_INCHARGE || user.role == UserRole.REPORTER)
    
    if (isStaff && user != null) {
        AdminPanelView(
            user = user,
            onClose = { viewModel.setActiveTab("home") },
            language = language,
            setLanguage = { newLanguage -> viewModel.setLanguage(newLanguage) },
            themeMode = themeMode,
            onThemeModeChange = { viewModel.setThemeMode(it) },
            onLogout = { viewModel.signOut() },
            onLoginRequest = { showLogin = true },
            isModal = false,
            initialPage = adminActivePage,
            onNavigate = onNavigate,
            onPostPublished = onPostPublished,
            onMenuClick = onMenuClick,
            onPageChange = { viewModel.setAdminActivePage(it) }
        )
    } else {
        UserProfilePageView(
            user = user ?: User(id = "guest", name = "Guest", role = UserRole.GUEST),
            language = language,
            setLanguage = { newLanguage -> viewModel.setLanguage(newLanguage) },
            themeMode = themeMode,
            onThemeModeChange = { viewModel.setThemeMode(it) },
            onNavigate = onNavigate,
            onLoginRequest = { showLogin = true },
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
