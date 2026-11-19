package com.alfanews.telugu

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.viewmodels.LocalNewsFeedViewModel
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.viewmodels.MainViewModel
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.alfanews.telugu.views.MainScreen
import com.alfanews.telugu.views.SplashScreenView
import com.alfanews.telugu.views.MandatoryUpdateScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

import com.google.firebase.dynamiclinks.FirebaseDynamicLinks
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import android.content.Context
import com.alfanews.telugu.utils.LocaleHelper
import com.alfanews.telugu.utils.PreferenceManager
import com.alfanews.telugu.BuildConfig
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.android.installreferrer.api.ReferrerDetails
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import coil3.SingletonImageLoader
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.crossfade

/**
 * ఆల్ఫా న్యూస్ అప్లికేషన్ యొక్క ప్రధాన యాక్టివిటీ (Activity).
 */
class MainActivity : ComponentActivity() {

    private var showAnimatedSplash by mutableStateOf(true)

    private lateinit var appUpdateManager: AppUpdateManager
    private val immediateUpdateLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK) {
            Log.d("MainActivity", "Immediate update flow cancelled or failed: ${result.resultCode}")
            checkImmediateAppUpdate()
        }
    }

    private val mainViewModel: MainViewModel by viewModels { ViewModelFactory(application) }
    private val newsFeedViewModel: NewsFeedViewModel by viewModels { ViewModelFactory(application) }
    private val localNewsFeedViewModel: LocalNewsFeedViewModel by viewModels { ViewModelFactory(application) }
    private var coldStartInitialPostId: String? = null

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        mainViewModel.setNotificationsGranted(isGranted)
        com.alfanews.telugu.services.AnalyticsService.logNotificationPermissionStatus(isGranted)
        if (isGranted) {
            Log.d("MainActivity", "Notification permission granted")
            mainViewModel.syncUserFcmToken(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)
            mainViewModel.ensureDefaultSubscriptions()
        } else {
            Log.d("MainActivity", "Notification permission denied")
        }
    }

    override fun attachBaseContext(newBase: Context) {
        val wrappedContext = try {
            val prefs = PreferenceManager.getInstance(newBase)
            val languageCode = prefs.language.code
            LocaleHelper.wrap(newBase, languageCode)
        } catch (_: Throwable) {
            newBase
        }
        super.attachBaseContext(wrappedContext)
    }

    override fun applyOverrideConfiguration(overrideConfiguration: android.content.res.Configuration?) {
        try {
            overrideConfiguration?.fontScale = 1.0f
        } catch (_: Throwable) {}
        super.applyOverrideConfiguration(overrideConfiguration)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            installSplashScreen()
        } catch (e: Throwable) {
            Log.e("MainActivity", "installSplashScreen error: ${e.message}")
        }
        setTheme(R.style.Theme_AlfaNews)
        super.onCreate(savedInstanceState)

        try {
            appUpdateManager = AppUpdateManagerFactory.create(this)
            checkImmediateAppUpdate()
        } catch (e: Throwable) {
            Log.e("MainActivity", "AppUpdateManager init error: ${e.message}")
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val prefs = PreferenceManager.getInstance(applicationContext)
                val currentVersion = BuildConfig.VERSION_CODE
                if (prefs.lastAppVersionCode < currentVersion) {
                    prefs.lastAppVersionCode = currentVersion
                    val imgCache = applicationContext.cacheDir.resolve("image_cache")
                    if (imgCache.exists()) {
                        imgCache.deleteRecursively()
                    }
                    Log.d("MainActivity", "App updated to version $currentVersion. Image cache cleared safely.")
                }
            } catch (e: Throwable) {
                Log.e("MainActivity", "Version code check error: ${e.message}")
            }
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                checkInstallReferrer(this@MainActivity)
            } catch (e: Throwable) {
                Log.e("MainActivity", "checkInstallReferrer error: ${e.message}")
            }
        }

        // Edge-to-edge: app content extends behind system bars (Play Store required for targetSdk 35+)
        // Status bar is transparent - phone default settings handle icon colors automatically
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
        } catch (_: Throwable) {}

        // 🚀 PRE-WARM: Early trigger for Firestore network engine (gRPC/TLS warm-up)
        try {
            lifecycleScope.launch {
                try {
                    FirebaseService.db.collection("news").limit(1).get()
                } catch (_: Throwable) {}
            }
        } catch (_: Throwable) {}

        try {
            AdMobService.initialize(this)
        } catch (e: Throwable) {
            Log.e("MainActivity", "AdMob init error: ${e.message}")
        }

        // 🚀 ఇన్‌స్టాల్ అయిన ప్రతి ఒక్కరికీ (Guest లేదా Logged-in, Android 12- లేదా 13+) వెంటనే FCM టోకెన్ & టాపిక్స్ (all_users, breaking_news, జిల్లా) ఆటో-సబ్‌స్క్రైబ్
        // Note: Android 13+ OS పర్మిషన్ పాప్-అప్ స్ప్లాష్ స్క్రీన్ పూర్తయి లైవ్ వార్తలు కనిపించిన తర్వాతే వస్తుంది (Way2News శైలిలో అధిక ఆప్ట్-ఇన్ కోసం)
        try {
            mainViewModel.syncUserFcmToken(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)
            mainViewModel.ensureDefaultSubscriptions()
        } catch (e: Throwable) {
            Log.e("MainActivity", "Initial FCM auto-subscription error: ${e.message}")
        }

        try {
            mainViewModel.recordAppOpen(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)
        } catch (e: Throwable) {
            Log.e("MainActivity", "recordAppOpen error: ${e.message}")
        }

        // Preload news - if intent contains a postId (notification or deep link),
        // pass initialPostId immediately so fast path loads the target post at index 0 without delay.
        try {
            val initialPostId = extractPostIdFromIntent(intent)
            coldStartInitialPostId = initialPostId
            if (initialPostId != null) {
                newsFeedViewModel.setSharedPostId(initialPostId)
                mainViewModel.setActiveTab("home")
                AnalyticsService.logNotificationOpened(postId = initialPostId, actionUrl = intent?.getStringExtra("actionUrl"))
            }

            // 🛡️ ZERO-EGRESS FORCE UPDATE GUARD:
            // If cached minimum required version is greater than this installed app version,
            // DO NOT fetch news or local ads from Firestore! Save 100% bandwidth & egress.
            val cachedMinVersion = PreferenceManager.getInstance(this).cachedMinVersionCode
            val isUpdateMandatory = cachedMinVersion > BuildConfig.VERSION_CODE
            if (!isUpdateMandatory) {
                val language = mainViewModel.language.value
                val currentUser = mainViewModel.currentUser.value
                newsFeedViewModel.loadNews(language, currentUser, initialPostId = initialPostId)
                // Preload local news with slight delay (300ms) so Home Feed gets initial priority
                lifecycleScope.launch {
                    kotlinx.coroutines.delay(300L)
                    localNewsFeedViewModel.loadNews(language, currentUser)
                }
            } else {
                Log.w("MainActivity", "Cold start blocked news loading: cachedMinVersionCode ($cachedMinVersion) > BuildConfig.VERSION_CODE (${BuildConfig.VERSION_CODE})")
            }
        } catch (e: Throwable) {
            Log.e("MainActivity", "Initial news load error: ${e.message}", e)
        }

        // Handle Firebase Dynamic Links (for deferred deep links when app wasn't installed)
        // This must be done BEFORE handleDeepLink() to catch dynamic links properly
        try {
            FirebaseDynamicLinks.getInstance()
                .getDynamicLink(intent)
                .addOnSuccessListener(this) { pendingDynamicLinkData ->
                    try {
                        var deepLink: Uri? = null
                        if (pendingDynamicLinkData != null) {
                            deepLink = pendingDynamicLinkData.link
                            Log.d("DynamicLinks", "Dynamic link received: ${deepLink?.toString() ?: "null"}")
                        }

                        if (deepLink != null) {
                            val dynamicIntent = Intent(Intent.ACTION_VIEW)
                            dynamicIntent.data = deepLink
                            handleDeepLink(dynamicIntent)
                        } else {
                            handleDeepLink(intent)
                        }
                    } catch (e: Throwable) {
                        Log.w("DynamicLinks", "Error processing dynamic link", e)
                        handleDeepLink(intent)
                    }
                }
                .addOnFailureListener(this) { e ->
                    Log.w("DynamicLinks", "getDynamicLink failed", e)
                    handleDeepLink(intent)
                }
        } catch (e: Throwable) {
            Log.w("DynamicLinks", "DynamicLinks setup failed: ${e.message}")
            try { handleDeepLink(intent) } catch (_: Throwable) {}
        }

        // Intent డేటాను ఇక్కడే ప్రాసెస్ చేయడం
        // This handles custom scheme deeplinks (alfanews://news/POST_ID)
        // Regular HTTPS links will be handled above via FirebaseDynamicLinks

        setContent {
            val minVersionCode by mainViewModel.minVersionCode.collectAsStateWithLifecycle()
            val isForceUpdateMandatory = minVersionCode > BuildConfig.VERSION_CODE

            val themeMode by mainViewModel.themeMode.collectAsState()
            val isDarkTheme = when (themeMode) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
            }

            AlfaNewsTheme(darkTheme = isDarkTheme) {
                if (isForceUpdateMandatory) {
                    MandatoryUpdateScreen(
                        currentVersionName = BuildConfig.VERSION_NAME,
                        onUpdateClick = { launchPlayStoreUpdate() }
                    )
                } else if (showAnimatedSplash) {
                val newsLoaded by newsFeedViewModel.news.collectAsState()
                val localNewsLoaded by localNewsFeedViewModel.news.collectAsState()
                val isLoading by newsFeedViewModel.loading.collectAsState()
                val localAds by newsFeedViewModel.localAds.collectAsState()

                // 🚀 PRELOAD IMAGES & ADS DURING SPLASH ANIMATION:
                // While splash screen animates (2-3 seconds), pre-fetch images for top 5 home news + top 5 local news + 5th card local ad into Coil cache
                LaunchedEffect(newsLoaded, localNewsLoaded, localAds) {
                    try {
                        if (newsLoaded.isNotEmpty()) {
                            newsLoaded.take(5).forEach { post ->
                                if (post.mediaUrl.isNotEmpty()) {
                                    val request = ImageRequest.Builder(this@MainActivity)
                                        .data(post.mediaUrl)
                                        .allowHardware(true)
                                        .crossfade(false)
                                        .memoryCachePolicy(CachePolicy.ENABLED)
                                        .diskCachePolicy(CachePolicy.ENABLED)
                                        .build()
                                    SingletonImageLoader.get(this@MainActivity).enqueue(request)
                                }
                            }
                        }
                        if (localNewsLoaded.isNotEmpty()) {
                            localNewsLoaded.take(5).forEach { post ->
                                if (post.mediaUrl.isNotEmpty()) {
                                    val request = ImageRequest.Builder(this@MainActivity)
                                        .data(post.mediaUrl)
                                        .allowHardware(true)
                                        .crossfade(false)
                                        .memoryCachePolicy(CachePolicy.ENABLED)
                                        .diskCachePolicy(CachePolicy.ENABLED)
                                        .build()
                                    SingletonImageLoader.get(this@MainActivity).enqueue(request)
                                }
                            }
                        }
                        if (localAds.isNotEmpty()) {
                            localAds.take(2).forEach { ad ->
                                if (ad.bannerUrl.isNotEmpty()) {
                                    val adRequest = ImageRequest.Builder(this@MainActivity)
                                        .data(ad.bannerUrl)
                                        .allowHardware(true)
                                        .crossfade(false)
                                        .memoryCachePolicy(CachePolicy.ENABLED)
                                        .diskCachePolicy(CachePolicy.ENABLED)
                                        .build()
                                    SingletonImageLoader.get(this@MainActivity).enqueue(adRequest)
                                }
                            }
                        }
                    } catch (e: Throwable) {
                        Log.e("MainActivity", "Error during splash image preloading: ${e.message}")
                    }
                }
                
                SplashScreenView(
                    isReady = newsLoaded.isNotEmpty(),
                    onFinished = { showAnimatedSplash = false }
                )
            } else {
                Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        MaterialTheme.colorScheme.background,
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                                        MaterialTheme.colorScheme.background
                                    )
                                )
                            )
                    ) {
                        Surface(
                            modifier = Modifier.fillMaxSize(),
                            color = Color.Transparent
                        ) {
                            // స్ప్లాష్ స్క్రీన్ పూర్తయి లైవ్ తెలుగు వార్తలు కనిపించిన 1.2 సెకన్ల తర్వాత Android 13+ OS పర్మిషన్ స్మార్ట్‌గా అడగడం
                            LaunchedEffect(Unit) {
                                kotlinx.coroutines.delay(1200L)
                                try {
                                    askNotificationPermission()
                                } catch (e: Throwable) {
                                    Log.e("MainActivity", "Deferred notification perm error: ${e.message}")
                                }
                            }
                            MainScreen(
                                mainViewModel = mainViewModel, 
                                newsFeedViewModel = newsFeedViewModel,
                                localNewsFeedViewModel = localNewsFeedViewModel
                            )
                        }
                    }
                }
            }
        }
    }

    private fun askNotificationPermission() {
        val prefs = PreferenceManager.getInstance(this)
        // Android 12 & below (API < 33): No runtime popup needed — notifications work automatically on install!
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            mainViewModel.setNotificationsGranted(NotificationManagerCompat.from(this).areNotificationsEnabled())
            mainViewModel.syncUserFcmToken(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)
            mainViewModel.ensureDefaultSubscriptions()
            return
        }

        // Android 13+ (API >= 33):
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            mainViewModel.setNotificationsGranted(true)
            mainViewModel.syncUserFcmToken(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)
            mainViewModel.ensureDefaultSubscriptions()
            return
        }

        val now = System.currentTimeMillis()
        val promptCount = prefs.notificationPromptCount
        val hoursSinceLastPrompt = (now - prefs.lastNotificationPromptTime) / (1000L * 60L * 60L)

        // Smart Way2News-style timing:
        // 1st launch (after splash): ask natively once while live headlines are visible.
        // 2nd chance: only if Android still permits the dialog AND >= 24h have elapsed, so we never burn both chances back-to-back.
        val shouldAskNow = promptCount == 0 || (
            promptCount == 1 &&
                hoursSinceLastPrompt >= 24L &&
                shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS)
        )

        if (shouldAskNow) {
            prefs.notificationPromptCount = promptCount + 1
            prefs.lastNotificationPromptTime = now
            requestPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /**
     * 1-tap notification enable helper for UI banners:
     * Uses native Android 13+ OS popup whenever permitted; falls back to App Notification Settings only if permanently denied.
     */
    fun requestOrOpenNotificationPermission() {
        val prefs = PreferenceManager.getInstance(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (granted) {
                mainViewModel.setNotificationsGranted(true)
                mainViewModel.syncUserFcmToken(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)
                mainViewModel.ensureDefaultSubscriptions()
                return
            }
            if (prefs.notificationPromptCount == 0 || shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS)) {
                prefs.notificationPromptCount = prefs.notificationPromptCount + 1
                prefs.lastNotificationPromptTime = System.currentTimeMillis()
                requestPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        openNotificationSettings()
    }

    fun openNotificationSettings() {
        val intent = Intent().apply {
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O -> {
                    action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                }
                else -> {
                    action = "android.settings.APP_NOTIFICATION_SETTINGS"
                    putExtra("app_package", packageName)
                    putExtra("app_uid", applicationInfo.uid)
                }
            }
        }
        startActivity(intent)
    }

    private fun checkImmediateAppUpdate() {
        try {
            if (!::appUpdateManager.isInitialized) return
            val appUpdateInfoTask = appUpdateManager.appUpdateInfo
            appUpdateInfoTask.addOnSuccessListener { appUpdateInfo ->
                if (isFinishing || isDestroyed) return@addOnSuccessListener
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                    appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
                ) {
                    try {
                        appUpdateManager.startUpdateFlowForResult(
                            appUpdateInfo,
                            immediateUpdateLauncher,
                            AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
                        )
                    } catch (e: Throwable) {
                        Log.w("MainActivity", "startUpdateFlowForResult error: ${e.message}")
                    }
                }
            }.addOnFailureListener { e ->
                Log.w("MainActivity", "AppUpdateInfo check failed: ${e.message}")
            }
        } catch (e: Throwable) {
            Log.e("MainActivity", "Error in checkImmediateAppUpdate", e)
        }
    }

    override fun onResume() {
        super.onResume()
        
        try {
            if (::appUpdateManager.isInitialized) {
                appUpdateManager.appUpdateInfo.addOnSuccessListener { appUpdateInfo ->
                    if (isFinishing || isDestroyed) return@addOnSuccessListener
                    if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ||
                        (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                         appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
                    ) {
                        try {
                            appUpdateManager.startUpdateFlowForResult(
                                appUpdateInfo,
                                immediateUpdateLauncher,
                                AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
                            )
                        } catch (e: Throwable) {
                            Log.w("MainActivity", "startUpdateFlowForResult onResume error: ${e.message}")
                        }
                    }
                }
            }
        } catch (_: Throwable) {}

        // 🚀 WAKE UP FIRESTORE SOCKETS:
        // When app returns to foreground from Doze mode / background sleep,
        // explicitly invoke enableNetwork() to reset exponential backoff and restore connection instantly.
        try {
            FirebaseService.db.enableNetwork()
        } catch (_: Throwable) {}

        // నోటిఫికేషన్ పర్మిషన్ స్టేటస్ ని చెక్ చేయడం
        val isEnabled = NotificationManagerCompat.from(this).areNotificationsEnabled()
        mainViewModel.setNotificationsGranted(isEnabled)
        com.alfanews.telugu.services.AnalyticsService.logNotificationPermissionStatus(isEnabled)
        if (isEnabled) {
            mainViewModel.syncUserFcmToken(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)
            mainViewModel.ensureDefaultSubscriptions()
        }
        mainViewModel.recordAppOpen(com.alfanews.telugu.services.FirebaseService.auth.currentUser?.uid)

        val language = mainViewModel.language.value
        val currentUser = mainViewModel.currentUser.value
        newsFeedViewModel.refreshIfStale(language, currentUser)
        localNewsFeedViewModel.refreshIfStale(language, currentUser)
    }

    // యాప్ రన్ అవుతున్నప్పుడు కొత్త ఇంటెంట్ వస్తే
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)

        // Handle Firebase Dynamic Links when app is already running (app resumed from background)
        FirebaseDynamicLinks.getInstance()
            .getDynamicLink(intent)
            .addOnSuccessListener(this) { pendingDynamicLinkData ->
                try {
                    var deepLink: Uri? = null
                    if (pendingDynamicLinkData != null) {
                        deepLink = pendingDynamicLinkData.link
                        Log.d("DynamicLinks", "Dynamic link received in foreground: ${deepLink?.toString() ?: "null"}")
                    }

                    if (deepLink != null) {
                        val dynamicIntent = Intent(Intent.ACTION_VIEW)
                        dynamicIntent.data = deepLink
                        handleDeepLink(dynamicIntent)
                    } else {
                        handleDeepLink(intent)
                    }
                } catch (e: Exception) {
                    Log.w("DynamicLinks", "Error processing dynamic link in onNewIntent", e)
                    handleDeepLink(intent)
                }
            }
            .addOnFailureListener(this) { e ->
                Log.w("DynamicLinks", "getDynamicLink failed in onNewIntent", e)
                handleDeepLink(intent)
            }
    }

    private fun extractPostIdFromIntent(intent: Intent?): String? {
        if (intent == null) return null
        
        // 1. Direct extras check (from notifications or custom intents)
        val extraPostId = intent.getStringExtra("postId") 
            ?: intent.getStringExtra("newsId") 
            ?: intent.getStringExtra("news_id")
        if (!extraPostId.isNullOrEmpty() && extraPostId != "news") {
            return extraPostId
        }

        // 2. URI check (from data, actionUrl, or Hybrid webUrl fallback)
        val fcmActionUrl = intent.getStringExtra("actionUrl") ?: intent.getStringExtra("webUrl")
        val intentData = intent.data
        val uri = intentData ?: fcmActionUrl?.let { Uri.parse(it) } ?: return null

        return parsePostIdFromUri(uri)
    }

    private fun parsePostIdFromUri(u: Uri): String? {
        return when (u.scheme) {
            "alfanews" -> {
                when (u.host) {
                    "news", "share" -> u.lastPathSegment
                    else -> null
                }
            }
            "http", "https" -> {
                val host = u.host
                if (host == "alfanews.app" || host == "www.alfanews.app") {
                    val pathSegments = u.pathSegments
                    if (pathSegments.size >= 2 && (pathSegments[0] == "news" || pathSegments[0] == "share")) {
                        pathSegments[1]
                    } else null
                } else null
            }
            else -> null
        }
    }

    private fun parseReporterIdFromUri(u: Uri): String? {
        return when (u.scheme) {
            "alfanews" -> {
                when (u.host) {
                    "reporter", "verify" -> u.lastPathSegment
                    else -> null
                }
            }
            "http", "https" -> {
                val host = u.host
                if (host == "alfanews.app" || host == "www.alfanews.app") {
                    val pathSegments = u.pathSegments
                    if (pathSegments.size >= 2 && (pathSegments[0] == "reporter" || pathSegments[0] == "verify")) {
                        pathSegments[1]
                    } else null
                } else null
            }
            else -> null
        }
    }

    private fun handleDeepLink(intent: Intent?) {
        try {
            val fcmActionUrl = intent?.getStringExtra("actionUrl")
            val intentData = intent?.data
            val uri = intentData ?: fcmActionUrl?.let { Uri.parse(it) }

            val postId = extractPostIdFromIntent(intent)
            val reporterId = uri?.let { parseReporterIdFromUri(it) }

            if (postId != null) {
                AnalyticsService.logNotificationOpened(postId = postId, actionUrl = fcmActionUrl)
                // 🔗 CRITICAL: Set sharedPostId so UI knows to scroll to this post
                newsFeedViewModel.setSharedPostId(postId)
                mainViewModel.setActiveTab("home")
                val alreadyLoadedFirst = newsFeedViewModel.news.value.firstOrNull()?.id == postId
                val isAlreadyLoadingInitial = (postId == coldStartInitialPostId && newsFeedViewModel.loading.value)
                // Only load if the post isn't already the first item in the list and not already being loaded from cold start
                if (!alreadyLoadedFirst && !isAlreadyLoadingInitial) {
                    newsFeedViewModel.loadNews(mainViewModel.language.value, mainViewModel.currentUser.value, initialPostId = postId)
                }
                coldStartInitialPostId = null
            }

            if (reporterId != null) {
                AnalyticsService.logNotificationOpened(actionUrl = fcmActionUrl)
                mainViewModel.setReporterIdToShow(reporterId)
            }
        } catch (e: Exception) {
            // Silent error handling - deeplink processing should never crash the app
            // In production, this could be logged to analytics
        }
    }

    private fun checkInstallReferrer(context: Context) {
        val prefs = PreferenceManager.getInstance(context)
        if (prefs.isReferrerProcessed) {
            Log.d("InstallReferrer", "Install Referrer already processed")
            return
        }

        try {
            val referrerClient = InstallReferrerClient.newBuilder(context).build()
            referrerClient.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    when (responseCode) {
                        InstallReferrerClient.InstallReferrerResponse.OK -> {
                            try {
                                val response: ReferrerDetails = referrerClient.installReferrer
                                val referrerUrl: String = response.installReferrer
                                Log.d("InstallReferrer", "Referrer URL: $referrerUrl")
                                
                                // 1. User Referral Tracking
                                val referrerUid = parseReferrerUid(referrerUrl)
                                if (!referrerUid.isNullOrEmpty()) {
                                    prefs.referredBy = referrerUid
                                    Log.d("InstallReferrer", "Saved referrer UID: $referrerUid")

                                    // Immediately trigger backend Cloud Function to record install & credit points
                                    val installId = prefs.getOrCreateInstallId()
                                    val referralPayload = hashMapOf(
                                        "referrerUid" to referrerUid,
                                        "installId" to installId,
                                        "platform" to "android",
                                        "appVersion" to BuildConfig.VERSION_NAME
                                    )
                                    FirebaseService.functions
                                        .getHttpsCallable("recordAppInstallReferral")
                                        .call(referralPayload)
                                        .addOnSuccessListener { result ->
                                            Log.d("InstallReferrer", "Backend install referral recorded: ${result.getData()}")
                                            prefs.isReferrerProcessed = true
                                        }
                                        .addOnFailureListener { err ->
                                            Log.e("InstallReferrer", "Failed to record install referral on backend: ${err.message}")
                                            // Keep isReferrerProcessed = false on transient error so it retries on next launch
                                        }
                                } else {
                                    prefs.isReferrerProcessed = true
                                }

                                // 2. Deferred Deep Link Processing (Auto-open shared news after installation)
                                val deferredPostId = parseReferrerPostId(referrerUrl)
                                if (!deferredPostId.isNullOrEmpty()) {
                                    Log.d("InstallReferrer", "Deferred post ID found: $deferredPostId")
                                    runOnUiThread {
                                        newsFeedViewModel.setSharedPostId(deferredPostId)
                                        mainViewModel.setActiveTab("home")
                                        newsFeedViewModel.loadNews(
                                            mainViewModel.language.value,
                                            mainViewModel.currentUser.value,
                                            initialPostId = deferredPostId
                                        )
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e("InstallReferrer", "Error getting referrer details: ${e.message}")
                            } finally {
                                try {
                                    referrerClient.endConnection()
                                } catch (e: Exception) {}
                            }
                        }
                        InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> {
                            Log.d("InstallReferrer", "Install Referrer not supported")
                        }
                        InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> {
                            Log.d("InstallReferrer", "Install Referrer service unavailable")
                        }
                    }
                }

                override fun onInstallReferrerServiceDisconnected() {
                    Log.d("InstallReferrer", "Install Referrer disconnected")
                }
            })
        } catch (e: Exception) {
            Log.e("InstallReferrer", "Error building/starting referrer client: ${e.message}")
        }
    }

    private fun parseReferrerPostId(referrer: String?): String? {
        if (referrer.isNullOrEmpty()) return null
        
        try {
            var decoded = Uri.decode(referrer)
            if (decoded.contains("%3D", ignoreCase = true) || decoded.contains("%26", ignoreCase = true)) {
                decoded = Uri.decode(decoded)
            }
            Log.d("InstallReferrer", "Decoded for PostId: $decoded")
            
            // Match news_id, post_id, postId, article_id
            val postRegex = Regex("(?:news_id|post_id|postId|newsId|article_id)=([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE)
            val match = postRegex.find(decoded)
            if (match != null) {
                val candidate = match.groupValues[1].trim()
                if (candidate.isNotEmpty() && candidate != "news") {
                    return candidate
                }
            }
            
            val params = decoded.split("&")
            for (param in params) {
                val keyValue = param.split("=")
                if (keyValue.size == 2) {
                    val key = keyValue[0].trim().lowercase()
                    val value = keyValue[1].trim()
                    if (key in listOf("news_id", "post_id", "postid", "newsid", "article_id") && value.isNotEmpty() && value != "news") {
                        return value
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("InstallReferrer", "Error parsing referrer PostId: ${e.message}")
        }
        
        return null
    }

    private fun parseReferrerUid(referrer: String?): String? {
        if (referrer.isNullOrEmpty()) return null
        
        try {
            var decodedReferrer = Uri.decode(referrer)
            if (decodedReferrer.contains("%3D", ignoreCase = true) || 
                decodedReferrer.contains("%26", ignoreCase = true) || 
                decodedReferrer.contains("%5F", ignoreCase = true)) {
                decodedReferrer = Uri.decode(decodedReferrer)
            }
            Log.d("InstallReferrer", "Decoded Referrer: $decodedReferrer")
            
            val prefixMatch = Regex("(?:ref|referral)_([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE).find(decodedReferrer)
            if (prefixMatch != null) {
                val candidate = prefixMatch.groupValues[1].trim()
                if (candidate.isNotEmpty()) return candidate
            }
            
            val params = decodedReferrer.split("&")
            for (param in params) {
                val keyValue = param.split("=")
                if (keyValue.size == 2) {
                    val key = keyValue[0].trim().lowercase()
                    val value = keyValue[1].trim()
                    if (key in listOf("utm_campaign", "referrer_uid", "referrer", "ref", "referral")) {
                        val subMatch = Regex("(?:ref|referral)_([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE).find(value)
                        if (subMatch != null) {
                            return subMatch.groupValues[1].trim()
                        }
                        if (value.isNotEmpty() && value.length >= 10 && !value.contains("google", ignoreCase = true)) {
                            return value
                        }
                    }
                }
            }
            
            val trimmed = decodedReferrer.trim()
            if (trimmed.length in 20..40 && trimmed.matches(Regex("[a-zA-Z0-9_-]+"))) {
                return trimmed
            }
        } catch (e: Exception) {
            Log.e("InstallReferrer", "Error parsing referrer UID: ${e.message}")
        }
        
        return null
    }

    /**
     * 🚀 Launch Google Play Store directly to the Alfa News app update listing.
     */
    fun launchPlayStoreUpdate() {
        val pkgName = packageName
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkgName")).apply {
                setPackage("com.android.vending")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (_: Exception) {
            try {
                startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkgName")).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            } catch (ex: Exception) {
                Log.e("MainActivity", "Could not open Play Store for update", ex)
            }
        }
    }
}

class ViewModelFactory(private val application: Application) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(NewsFeedViewModel::class.java) -> {
                @Suppress("UNCHECKED_CAST")
                NewsFeedViewModel(application) as T
            }
            modelClass.isAssignableFrom(MainViewModel::class.java) -> {
                @Suppress("UNCHECKED_CAST")
                MainViewModel(application) as T
            }
            modelClass.isAssignableFrom(LocalNewsFeedViewModel::class.java) -> {
                @Suppress("UNCHECKED_CAST")
                LocalNewsFeedViewModel(application) as T
            }
            modelClass.isAssignableFrom(com.alfanews.telugu.viewmodels.ReportersViewModel::class.java) -> {
                @Suppress("UNCHECKED_CAST")
                com.alfanews.telugu.viewmodels.ReportersViewModel(application) as T
            }
            modelClass.isAssignableFrom(com.alfanews.telugu.viewmodels.LeaderboardViewModel::class.java) -> {
                @Suppress("UNCHECKED_CAST")
                com.alfanews.telugu.viewmodels.LeaderboardViewModel(application) as T
            }
            else -> throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
