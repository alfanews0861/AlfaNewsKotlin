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
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.viewmodels.MainViewModel
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.alfanews.telugu.views.policy.AboutUsPageView
import com.alfanews.telugu.views.policy.AdPolicyPageView
import com.alfanews.telugu.views.policy.ContactUsPageView
import com.alfanews.telugu.views.policy.ContentPolicyPageView
import com.alfanews.telugu.views.policy.DataCollectionPolicyPageView
import com.alfanews.telugu.views.policy.DisclaimerPageView
import com.alfanews.telugu.views.policy.PrivacyPolicyPageView
import com.alfanews.telugu.views.policy.TermsOfServicePageView
import kotlinx.coroutines.launch
import androidx.lifecycle.compose.collectAsStateWithLifecycle

import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.alfanews.telugu.R
import com.alfanews.telugu.MainActivity
import com.alfanews.telugu.utils.glassmorphism

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
    val themeMode by mainViewModel.themeMode.collectAsStateWithLifecycle()
    val showOnboarding by mainViewModel.showOnboarding.collectAsStateWithLifecycle()
    val showRatingDialog by mainViewModel.showRatingDialog.collectAsStateWithLifecycle()

    val news by newsFeedViewModel.news.collectAsStateWithLifecycle()
    val isNewsLoading by newsFeedViewModel.loading.collectAsStateWithLifecycle()
    
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
        Scaffold(
            containerColor = Color.Transparent,
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            bottomBar = {
                if (!showPostNewsPage && !showJoinReporterPage && !showEditProfilePage && reporterIdToShow == null) {
                    Footer(
                        activeTab = activeTab,
                        onTabChange = { 
                            classifiedsInitialMode = ClassifiedsViewMode.CATEGORIES
                            mainViewModel.setActiveTab(it) 
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
                // 🔔 నోటిఫికేషన్ బ్యానర్ - పర్మిషన్ లేకపోతే చూపిస్తాం
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

                if (reporterIdToShow != null) {
                    ReporterProfileView(
                        reporterId = reporterIdToShow!!,
                        language = language,
                        currentUser = user,
                        onBack = { reporterIdToShow = null }
                    )
                } else if (showPostNewsPage && user != null) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        PostNewsPageView(
                            user = user,
                            postToEdit = editingNewsPost,
                            onActionComplete = { postId -> 
                                showPostNewsPage = false
                                editingNewsPost = null
                                if (postId == "HOME_ONLY") {
                                    // Go to Home but don't filter for a specific post (Video flow)
                                    mainViewModel.setActiveTab("home")
                                } else if (postId.isNotBlank()) {
                                    // Go to specific post (Image flow)
                                    mainViewModel.setActiveTab("home")
                                    newsFeedViewModel.setSharedPostId(postId)
                                    newsFeedViewModel.loadNews(language, user, initialPostId = postId)
                                }
                            }
                        )
                        
                        // Custom Top Bar since we are already inside a Scaffold content
                        Surface(
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            color = MaterialTheme.colorScheme.primary,
                            tonalElevation = 4.dp
                        ) {
                            Row(
                                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 4.dp)
                            ) {
                                IconButton(onClick = { 
                                    showPostNewsPage = false
                                    editingNewsPost = null
                                }) {
                                    Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.back), tint = MaterialTheme.colorScheme.onPrimary)
                                }
                                Text(
                                    text = stringResource(R.string.post_news),
                                    style = MaterialTheme.typography.titleLarge,
                                    modifier = Modifier.padding(start = 8.dp),
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                            }
                        }
                    }
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
                        onSave = { name, phone, address, district, photoUri, signatureUri ->
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
                            onEditClick = { post ->
                                editingNewsPost = post
                                showPostNewsPage = true
                            }
                        )
                        "local" -> LocalNewsFeedView(
                            language = language, 
                            currentUser = user, 
                            onProfileClick = { mainViewModel.setActiveTab("profile") },
                            onReporterClick = { reporterIdToShow = it },
                            onEditClick = { post ->
                                editingNewsPost = post
                                showPostNewsPage = true
                            }
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
                            onNavigateToLogin = { mainViewModel.setActiveTab("profile") }
                        )
                        "profile" -> ProfileContainer(
                            language = language,
                            currentUser = user,
                            viewModel = mainViewModel,
                            onNavigate = { pageId ->
                                if (pageId == "edit-profile") {
                                    showEditProfilePage = true
                                } else {
                                    mainViewModel.setActiveTab(pageId)
                                }
                            },
                            onPostPublished = { postId ->
                                if (postId.isNotBlank()) {
                                    mainViewModel.setActiveTab("home")
                                    newsFeedViewModel.setSharedPostId(postId)
                                    newsFeedViewModel.loadNews(language, user, initialPostId = postId)
                                }
                            }
                        )
                        "about" -> PolicyContainer("about")
                        "contact" -> PolicyContainer("contact")
                        "privacy-policy" -> PolicyContainer("privacy-policy")
                        "terms" -> PolicyContainer("terms")
                        "content-policy" -> PolicyContainer("content-policy")
                        "disclaimer" -> PolicyContainer("disclaimer")
                        "ad-policy" -> PolicyContainer("ad-policy")
                        "data-collection" -> PolicyContainer("data-collection")
                        else -> NewsFeedView(
                            language = language, 
                            currentUser = user, 
                            viewModel = newsFeedViewModel,
                            onReporterClick = { reporterIdToShow = it },
                            onEditClick = { post ->
                                editingNewsPost = post
                                showPostNewsPage = true
                            }
                        )
                    }
                }
            }
        }

        // Onboarding for new users
        if (showOnboarding) {
            OnboardingTooltip(
                message = stringResource(R.string.settings_onboarding),
                onDismiss = { mainViewModel.dismissOnboarding() }
            )
        }

        // Rating Dialog
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
    }
}

@Composable
fun ProfileContainer(
    language: com.alfanews.telugu.models.Language,
    currentUser: com.alfanews.telugu.models.User?,
    viewModel: MainViewModel,
    onNavigate: (String) -> Unit,
    onPostPublished: (String) -> Unit = {}
) {
    var showLogin by remember { mutableStateOf(false) }
    val themeMode by viewModel.themeMode.collectAsState()
    val user = currentUser

    val isStaff = user != null && (user.role == UserRole.ADMIN || user.role == UserRole.EDITOR || user.role == UserRole.REGIONAL_INCHARGE || user.role == UserRole.REPORTER)
    
    if (isStaff) {
        AdminPanelView(
            user = user!!,
            onClose = { viewModel.setActiveTab("home") },
            language = language,
            setLanguage = { newLanguage -> viewModel.setLanguage(newLanguage) },
            themeMode = themeMode,
            onThemeModeChange = { viewModel.setThemeMode(it) },
            onLogout = { viewModel.signOut() },
            onLoginRequest = { showLogin = true },
            isModal = false,
            onNavigate = onNavigate,
            onPostPublished = onPostPublished
        )
    } else {
        UserProfilePageView(
            user = user ?: com.alfanews.telugu.models.User(id = "guest", name = "Guest", role = UserRole.GUEST),
            language = language,
            setLanguage = { newLanguage -> viewModel.setLanguage(newLanguage) },
            themeMode = themeMode,
            onThemeModeChange = { viewModel.setThemeMode(it) },
            onNavigate = onNavigate,
            onLoginRequest = { showLogin = true },
            onToggleNotifications = { viewModel.toggleNotifications(it) }
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
