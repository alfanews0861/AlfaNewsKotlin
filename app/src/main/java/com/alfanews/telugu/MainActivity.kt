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
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.viewmodels.LocalNewsFeedViewModel
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.viewmodels.MainViewModel
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.alfanews.telugu.views.MainScreen
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

/**
 * ఆల్ఫా న్యూస్ అప్లికేషన్ యొక్క ప్రధాన యాక్టివిటీ (Activity).
 */
class MainActivity : ComponentActivity() {

    private lateinit var appUpdateManager: AppUpdateManager
    private val updateRequestCode = 123
    
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

        appUpdateManager = AppUpdateManagerFactory.create(this)
        appUpdateManager.registerListener(installStateUpdatedListener)
        checkAppUpdate()

        // Keep the splash screen on screen until news is loaded
        splashScreen.setKeepOnScreenCondition {
            newsFeedViewModel.news.value.isEmpty() && newsFeedViewModel.loading.value
        }

        WindowCompat.setDecorFitsSystemWindows(window, true)
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
                            checkForUpdate = this@MainActivity::checkAppUpdate,
                            completeUpdate = this@MainActivity::completeUpdate
                        )
                    }
                }
            }
        }
    }

    private fun checkAppUpdate() {
        val appUpdateInfoTask = appUpdateManager.appUpdateInfo
        appUpdateInfoTask.addOnSuccessListener { appUpdateInfo ->
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                
                try {
                    appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo,
                        this,
                        AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
                        updateRequestCode
                    )
                } catch (e: Exception) {
                    Log.e("MainActivity", "Failed to start update flow", e)
                }
            }
        }
    }

    private fun completeUpdate() {
        appUpdateManager.completeUpdate()
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

        appUpdateManager.appUpdateInfo.addOnSuccessListener { appUpdateInfo ->
            // అప్‌డేట్ ఇప్పటికే డౌన్‌లోడ్ అయి ఉంటే, ఆటోమేటిక్‌గా ఇన్‌స్టాల్ చేయి
            if (appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                appUpdateManager.completeUpdate()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        appUpdateManager.unregisterListener(installStateUpdatedListener)
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
                val postId = when (u.scheme) {
                    "alfanews" -> {
                        // alfanews://news/POST_ID
                        if (u.host == "news") u.lastPathSegment else null
                    }
                    "http", "https" -> {
                        // https://alfanews.app/news/POST_ID or https://www.alfanews.app/news/POST_ID
                        val host = u.host
                        if (host == "alfanews.app" || host == "www.alfanews.app") {
                            val pathSegments = u.pathSegments
                            if (pathSegments.size >= 2 && pathSegments[0] == "news") pathSegments[1] else null
                        } else null
                    }
                    else -> null
                }

                postId?.let { id ->
                    // 🔗 CRITICAL: Set sharedPostId so UI knows to scroll to this post
                    // This must happen BEFORE or alongside loadNews
                    newsFeedViewModel.setSharedPostId(id)
                    mainViewModel.setActiveTab("home")
                    newsFeedViewModel.loadNews(mainViewModel.language.value, mainViewModel.currentUser.value, initialPostId = id)
                }
            }
        } catch (e: Exception) {
            // Silent error handling - deeplink processing should never crash the app
            // In production, this could be logged to analytics
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
            else -> throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
