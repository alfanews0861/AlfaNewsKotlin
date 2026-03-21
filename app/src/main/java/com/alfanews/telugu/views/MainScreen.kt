package com.alfanews.telugu.views

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    mainViewModel: MainViewModel,
    newsFeedViewModel: NewsFeedViewModel,
    checkForUpdate: () -> Unit,
    completeUpdate: () -> Unit
) {
    val currentUser by mainViewModel.currentUser.collectAsState()
    val language by mainViewModel.language.collectAsState()
    val activeTab by mainViewModel.activeTab.collectAsState()
    val themeMode by mainViewModel.themeMode.collectAsState()
    val showOnboarding by mainViewModel.showOnboarding.collectAsState()
    val showRatingDialog by mainViewModel.showRatingDialog.collectAsState()

    val news by newsFeedViewModel.news.collectAsState()
    val isNewsLoading by newsFeedViewModel.loading.collectAsState()
    
    // We want the splash screen to stay until news is ready
    var showSplash by remember { mutableStateOf(true) }
    
    var showPostNewsPage by remember { mutableStateOf(false) }
    var showJoinReporterPage by remember { mutableStateOf(false) }
    var showEditProfilePage by remember { mutableStateOf(false) }
    var reporterIdToShow by remember { mutableStateOf<String?>(null) }
    
    var classifiedsInitialMode by remember { mutableStateOf(ClassifiedsViewMode.CATEGORIES) }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        checkForUpdate()
    }

    val context = LocalContext.current
    val appUpdateManager = remember { com.google.android.play.core.appupdate.AppUpdateManagerFactory.create(context) }

    LaunchedEffect(appUpdateManager) {
        appUpdateManager.appUpdateInfo.addOnSuccessListener { appUpdateInfo ->
            if (appUpdateInfo.installStatus() == com.google.android.play.core.install.model.InstallStatus.DOWNLOADED) {
                scope.launch {
                    val result = snackbarHostState.showSnackbar(
                        message = "అందరూ ఈ కొత్త వెర్షన్ కి అప్‌డేట్ అవ్వాలి",
                        actionLabel = "ఇప్పుడే అప్‌డేట్ చేయండి",
                        duration = SnackbarDuration.Indefinite
                    )
                    if (result == SnackbarResult.ActionPerformed) {
                        completeUpdate()
                    }
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            bottomBar = {
                if (!showSplash && !showPostNewsPage && !showJoinReporterPage && !showEditProfilePage && reporterIdToShow == null) {
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
                val user = currentUser

                if (reporterIdToShow != null) {
                    ReporterProfileView(
                        reporterId = reporterIdToShow!!,
                        language = language,
                        currentUser = user,
                        onBack = { reporterIdToShow = null }
                    )
                } else if (showPostNewsPage && user != null) {
                    Scaffold(
                        topBar = {
                            TopAppBar(
                                title = { Text("వార్తను పోస్ట్ చేయండి") },
                                navigationIcon = {
                                    IconButton(onClick = { showPostNewsPage = false }) {
                                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                                    }
                                }
                            )
                        }
                    ) { innerPadding: PaddingValues ->
                        Box(modifier = Modifier.padding(innerPadding)) {
                            PostNewsPageView(
                                user = user,
                                postToEdit = null,
                                onActionComplete = { postId -> 
                                    showPostNewsPage = false
                                    mainViewModel.setActiveTab("home")
                                    newsFeedViewModel.setSharedPostId(postId)
                                    newsFeedViewModel.loadNews(language, currentUser, initialPostId = postId)
                                }
                            )
                        }
                    }
                } else if (showJoinReporterPage) {
                    JoinReporterPageView(
                        onClose = { showJoinReporterPage = false }
                    )
                } else if (showEditProfilePage && user != null) {
                    EditProfilePageView(
                        user = user,
                        onClose = { showEditProfilePage = false },
                        onSave = { name, address, district, photoUri, signatureUri ->
                            mainViewModel.updateUserProfile(name, address, district, photoUri, signatureUri)
                            showEditProfilePage = false
                        }
                    )
                } else {
                    when (activeTab) {
                        "home" -> NewsFeedView(
                            language = language, 
                            currentUser = user, 
                            viewModel = newsFeedViewModel,
                            onReporterClick = { reporterIdToShow = it }
                        )
                        "local" -> LocalNewsFeedView(
                            language = language, 
                            currentUser = user, 
                            onProfileClick = { mainViewModel.setActiveTab("profile") },
                            onReporterClick = { reporterIdToShow = it }
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
                            onReporterClick = { reporterIdToShow = it }
                        )
                    }
                }
            }
        }

        // Show splash screen on top
        if (showSplash) {
            SplashScreenView(
                isReady = news.isNotEmpty() && !isNewsLoading,
                onFinished = { showSplash = false }
            )
        }

        // Onboarding for new users
        if (showOnboarding && !showSplash) {
            OnboardingTooltip(
                message = "ఇక్కడ మీరు మీకు కావలసిన విధంగా సెట్టింగ్స్ మార్చుకోవచ్చు",
                onDismiss = { mainViewModel.dismissOnboarding() }
            )
        }

        // Rating Dialog
        if (showRatingDialog && !showSplash) {
            AlertDialog(
                onDismissRequest = { mainViewModel.dismissRatingDialog() },
                title = { Text("మా యాప్‌ను రేట్ చేయండి") },
                text = { Text("మీకు మా యాప్ నచ్చితే, దయచేసి ప్లే స్టోర్‌లో రేటింగ్ ఇవ్వండి. మీ అభిప్రాయం మాకు ఎంతో విలువైనది.") },
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
                        Text("రేట్ చేయండి")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { mainViewModel.dismissRatingDialog() }) {
                        Text("తర్వాత")
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
    onNavigate: (String) -> Unit
) {
    var showLogin by remember { mutableStateOf(false) }
    val themeMode by viewModel.themeMode.collectAsState()
    val user = currentUser

    if (user != null && (user.role == UserRole.ADMIN || user.role == UserRole.EDITOR || user.role == UserRole.REPORTER)) {
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
            onNavigate = onNavigate
        )
    } else {
        UserProfilePageView(
            user = user ?: com.alfanews.telugu.models.User(id = "guest", name = "Guest", role = UserRole.GUEST),
            language = language,
            setLanguage = { newLanguage -> viewModel.setLanguage(newLanguage) },
            themeMode = themeMode,
            onThemeModeChange = { viewModel.setThemeMode(it) },
            onNavigate = onNavigate,
            onLoginRequest = { showLogin = true }
        )
    }

    if (showLogin && user == null) {
        LoginScreenView(
            onLoginSuccess = { showLogin = false },
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
