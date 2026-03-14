package com.alfanews.telugu

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.viewmodels.LocalNewsFeedViewModel
import com.alfanews.telugu.viewmodels.MainViewModel
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.alfanews.telugu.viewmodels.ThemeMode
import com.alfanews.telugu.views.MainScreen
import com.alfanews.telugu.views.SplashScreenView
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * ఆల్ఫా న్యూస్ అప్లికేషన్ యొక్క ప్రధాన యాక్టివిటీ (Activity).
 */
class MainActivity : ComponentActivity() {

    private lateinit var appUpdateManager: AppUpdateManager
    private val updateRequestCode = 123
    private val mainViewModel: MainViewModel by viewModels { ViewModelFactory(application) }
    private val newsFeedViewModel: NewsFeedViewModel by viewModels { ViewModelFactory(application) }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        var showSplash by mutableStateOf(true)

        appUpdateManager = AppUpdateManagerFactory.create(this)
        checkAppUpdate()

        WindowCompat.setDecorFitsSystemWindows(window, true)
        AdMobService.initialize(this)

        // Preload news to avoid delay after splash screen
        val language = mainViewModel.language.value
        val currentUser = mainViewModel.currentUser.value
        newsFeedViewModel.loadNews(language, currentUser)

        setContent {
            val themeMode by mainViewModel.themeMode.collectAsState()

            val isDarkTheme = when (themeMode) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
            }

            AlfaNewsTheme(darkTheme = isDarkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (showSplash) {
                        SplashScreenView { showSplash = false }
                    } else {
                        // యాప్ ఓపెన్ అయినప్పుడు డీప్ లింక్ చెక్ చేయడం
                        LaunchedEffect(Unit) {
                            intent?.data?.let { uri ->
                                handleDeepLink(uri)
                            }
                        }

                        MainScreen(
                            mainViewModel = mainViewModel, 
                            newsFeedViewModel = newsFeedViewModel,
                            checkForUpdate = this::checkAppUpdate,
                            completeUpdate = this::completeUpdate
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
                appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                
                appUpdateManager.startUpdateFlowForResult(
                    appUpdateInfo,
                    this,
                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                    updateRequestCode)
            }
        }
    }

    private fun completeUpdate() {
        appUpdateManager.completeUpdate()
    }

    override fun onResume() {
        super.onResume()
        appUpdateManager.appUpdateInfo.addOnSuccessListener { appUpdateInfo ->
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                appUpdateManager.startUpdateFlowForResult(
                    appUpdateInfo,
                    this,
                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                    updateRequestCode)
            }
        }

        val language = mainViewModel.language.value
        val currentUser = mainViewModel.currentUser.value
        newsFeedViewModel.refreshIfStale(language, currentUser)
    }

    // యాప్ రన్ అవుతున్నప్పుడు కొత్త ఇంటెంట్ వస్తే
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.data?.let { uri ->
            handleDeepLink(uri)
        }
    }

    private fun handleDeepLink(uri: Uri) {
        val pathSegments = uri.pathSegments
        if (pathSegments.size >= 2 && pathSegments[0] == "news") {
            val postId = pathSegments[1]
            mainViewModel.setActiveTab("home")
            newsFeedViewModel.loadNews(mainViewModel.language.value, mainViewModel.currentUser.value, initialPostId = postId)
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
