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
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
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
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

/**
 * ఆల్ఫా న్యూస్ అప్లికేషన్ యొక్క ప్రధాన యాక్టివిటీ (Activity).
 */
class MainActivity : ComponentActivity() {

    private var showAnimatedSplash by mutableStateOf(true)

    private lateinit var appUpdateManager: AppUpdateManager
    private val updateActivityResultLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK) {
            Log.d("MainActivity", "Flexible update flow cancelled or failed: ${result.resultCode}")
        }
    }
    
    private val installStateUpdatedListener = InstallStateUpdatedListener { state ->
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            mainViewModel.setUpdateDownloaded(true)
        }
    }

    private val mainViewModel: MainViewModel by viewModels { ViewModelFactory(application) }
    private val newsFeedViewModel: NewsFeedViewModel by viewModels { ViewModelFactory(application) }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d("MainActivity", "Notification permission granted")
            // Permission granted, FCM token will be generated/refreshed automatically
        } else {
            Log.d("MainActivity", "Notification permission denied")
        }
    }

    override fun attachBaseContext(newBase: Context) {
        val prefs = PreferenceManager.getInstance(newBase)
        val languageCode = prefs.language.code
        val context = LocaleHelper.wrap(newBase, languageCode)
        super.attachBaseContext(context)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        checkInstallReferrer(this)

        appUpdateManager = AppUpdateManagerFactory.create(this)
        appUpdateManager.registerListener(installStateUpdatedListener)
        
        // Silent / Flexible In-App Update check (Background download, non-blocking)
        checkFlexibleAppUpdate()

        // Hand over control to our custom Animated Splash Screen immediately
        splashScreen.setKeepOnScreenCondition { false }

        // Edge-to-edge: app content extends behind system bars (Play Store required for targetSdk 35+)
        // Status bar is transparent - phone default settings handle icon colors automatically
        WindowCompat.setDecorFitsSystemWindows(window, false)
        AdMobService.initialize(this)

        // ఆండ్రాయిడ్ 13+ కోసం నోటిఫికేషన్ పర్మిషన్ అడగడం
        askNotificationPermission()

        // Preload news to avoid delay after splash screen
        val language = mainViewModel.language.value
        val currentUser = mainViewModel.currentUser.value
        newsFeedViewModel.loadNews(language, currentUser)

        // Handle Firebase Dynamic Links (for deferred deep links when app wasn't installed)
        // This must be done BEFORE handleDeepLink() to catch dynamic links properly
        FirebaseDynamicLinks.getInstance()
            .getDynamicLink(intent)
            .addOnSuccessListener(this) { pendingDynamicLinkData ->
                try {
                    var deepLink: Uri? = null
                    if (pendingDynamicLinkData != null) {
                        deepLink = pendingDynamicLinkData.link

                        // Log for analytics/debugging
                        // This shows whether the link came from a share (deferred deep link)
                        Log.d("DynamicLinks", "Dynamic link received: ${deepLink?.toString() ?: "null"}")
                    }

                    // Handle the deeplink using the same handler
                    if (deepLink != null) {
                        val dynamicIntent = Intent(Intent.ACTION_VIEW)
                        dynamicIntent.data = deepLink
                        handleDeepLink(dynamicIntent)
                    } else {
                        // No dynamic link or it's a regular deep link
                        handleDeepLink(intent)
                    }
                } catch (e: Exception) {
                    Log.w("DynamicLinks", "Error processing dynamic link", e)
                    handleDeepLink(intent)
                }
            }
            .addOnFailureListener(this) { e ->
                Log.w("DynamicLinks", "getDynamicLink failed", e)
                // Fallback to regular deep link handling
                handleDeepLink(intent)
            }

        // Intent డేటాను ఇక్కడే ప్రాసెస్ చేయడం
        // This handles custom scheme deeplinks (alfanews://news/POST_ID)
        // Regular HTTPS links will be handled above via FirebaseDynamicLinks

        setContent {
            if (showAnimatedSplash) {
                val newsLoaded by newsFeedViewModel.news.collectAsState()
                val isLoading by newsFeedViewModel.loading.collectAsState()
                
                SplashScreenView(
                    isReady = newsLoaded.isNotEmpty() || !isLoading,
                    onFinished = { showAnimatedSplash = false }
                )
            } else {
                val themeMode by mainViewModel.themeMode.collectAsState()
                
                val isDarkTheme = when (themeMode) {
                    ThemeMode.LIGHT -> false
                    ThemeMode.DARK -> true
                    ThemeMode.SYSTEM -> isSystemInDarkTheme()
                }

                AlfaNewsTheme(darkTheme = isDarkTheme) {
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
                            MainScreen(
                                mainViewModel = mainViewModel, 
                                newsFeedViewModel = newsFeedViewModel,
                                completeUpdate = this@MainActivity::completeAppUpdate
                            )
                        }
                    }
                }
            }
        }
    }

    private fun checkFlexibleAppUpdate() {
        if (this@MainActivity.isFinishing || this@MainActivity.isDestroyed) return
        
        try {
            val appUpdateInfoTask = appUpdateManager.appUpdateInfo
            appUpdateInfoTask.addOnSuccessListener { appUpdateInfo ->
                if (this@MainActivity.isFinishing || this@MainActivity.isDestroyed) return@addOnSuccessListener
                
                // Silent / Flexible Update only - Never force/immediate update
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                    appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                    
                    try {
                        appUpdateManager.startUpdateFlowForResult(
                            appUpdateInfo,
                            updateActivityResultLauncher,
                            AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build()
                        )
                    } catch (e: Throwable) {
                        Log.e("MainActivity", "Failed to start flexible update flow", e)
                    }
                }
            }.addOnFailureListener { e ->
                Log.w("MainActivity", "Failed to check appUpdateInfo", e)
            }
        } catch (e: Throwable) {
            Log.e("MainActivity", "Error in checkFlexibleAppUpdate", e)
        }
    }

    private fun completeAppUpdate() {
        try {
            appUpdateManager.completeUpdate()
        } catch (e: Throwable) {
            Log.e("MainActivity", "Failed to complete app update", e)
        }
    }

    private fun askNotificationPermission() {
        // This is only necessary for API level >= 33 (Android 13)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            ) {
                // Permission is already granted
            } else {
                // Directly ask for the permission
                requestPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }
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

    override fun onResume() {
        super.onResume()
        
        // నోటిఫికేషన్ పర్మిషన్ స్టేటస్ ని చెక్ చేయడం
        val isEnabled = NotificationManagerCompat.from(this).areNotificationsEnabled()
        mainViewModel.setNotificationsGranted(isEnabled)
        com.alfanews.telugu.services.AnalyticsService.logNotificationPermissionStatus(isEnabled)

        try {
            appUpdateManager.appUpdateInfo.addOnSuccessListener { appUpdateInfo ->
                if (this@MainActivity.isFinishing || this@MainActivity.isDestroyed) return@addOnSuccessListener
                
                if (appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                    mainViewModel.setUpdateDownloaded(true)
                }
            }.addOnFailureListener { e ->
                Log.w("MainActivity", "Failed to check update info onResume", e)
            }
        } catch (e: Throwable) {
            Log.e("MainActivity", "Error checking update onResume", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            appUpdateManager.unregisterListener(installStateUpdatedListener)
        } catch (e: Exception) {
            Log.w("MainActivity", "Error unregistering update listener", e)
        }
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

    private fun handleDeepLink(intent: Intent?) {
        try {
            val fcmActionUrl = intent?.getStringExtra("actionUrl")
            val intentData = intent?.data

            val uri = intentData ?: fcmActionUrl?.let { Uri.parse(it) }

            uri?.let { u ->
                var postId: String? = null
                var reporterId: String? = null

                when (u.scheme) {
                    "alfanews" -> {
                        // alfanews://news/POST_ID or alfanews://share/POST_ID or alfanews://reporter/REPORTER_ID
                        when (u.host) {
                            "news", "share" -> postId = u.lastPathSegment
                            "reporter", "verify" -> reporterId = u.lastPathSegment
                        }
                    }
                    "http", "https" -> {
                        // https://alfanews.app/news/POST_ID or https://alfanews.app/verify/REPORTER_ID
                        val host = u.host
                        if (host == "alfanews.app" || host == "www.alfanews.app") {
                            val pathSegments = u.pathSegments
                            if (pathSegments.size >= 2) {
                                when (pathSegments[0]) {
                                    "news", "share" -> postId = pathSegments[1]
                                    "reporter", "verify" -> reporterId = pathSegments[1]
                                }
                            }
                        }
                    }
                }

                if (postId != null) {
                    val id = postId!!
                    AnalyticsService.logNotificationOpened(postId = id, actionUrl = fcmActionUrl)
                    // 🔗 CRITICAL: Set sharedPostId so UI knows to scroll to this post
                    newsFeedViewModel.setSharedPostId(id)
                    mainViewModel.setActiveTab("home")
                    newsFeedViewModel.loadNews(mainViewModel.language.value, mainViewModel.currentUser.value, initialPostId = id)
                }

                if (reporterId != null) {
                    AnalyticsService.logNotificationOpened(actionUrl = fcmActionUrl)
                    mainViewModel.setReporterIdToShow(reporterId)
                }
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
                                            prefs.isReferrerProcessed = true
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
