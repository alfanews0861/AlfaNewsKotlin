package com.alfanews.telugu

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.utils.PreferenceManager
import com.google.firebase.messaging.FirebaseMessaging
import androidx.work.*
import com.alfanews.telugu.workers.NewsNotificationWorker
import com.alfanews.telugu.workers.FestivalGreetingWorker
import java.io.File
import java.util.concurrent.TimeUnit
import java.util.Calendar
import kotlinx.coroutines.*
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.disk.directory
import coil3.memory.MemoryCache
import coil3.request.crossfade
import coil3.util.DebugLogger

class AlfaNewsApplication : Application(), SingletonImageLoader.Factory {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()

        try {
            // ఫైర్‌బేస్‌ను ప్రారంభించడం
            FirebaseApp.initializeApp(this)

            // 🛠️ కొత్త అప్‌డేట్ లో పాత డేటాను క్లియర్ చేయడం (GBs లో ఉన్న కాష్ ని తీసివేయడం)
            clearLegacyAppCache()

            // ఫైర్‌బేస్ యాప్ చెక్ - దీన్ని మరింత సేఫ్ గా మార్చాను
            val firebaseAppCheck = FirebaseAppCheck.getInstance()
            
            // Play Integrity ని డిఫాల్ట్ గా వాడటం మంచిది
            firebaseAppCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )

            // ఫైర్‌బేస్ అనలిటిక్స్
            FirebaseAnalytics.getInstance(this)

            // అనలిటిక్స్ సర్వీస్
            AnalyticsService.initialize(this)

            // పుష్ నోటిఫికేషన్లు
            FirebaseMessaging.getInstance().subscribeToTopic("all_users")
            
            // నోటిఫికేషన్ ఛానెల్‌లను సృష్టించడం (ముఖ్యంగా ఆండ్రాయిడ్ 13+ కోసం)
            createNotificationChannels()

            scope.launch(Dispatchers.Default) {
                scheduleNotificationWork()
            }
        } catch (e: Exception) {
            // ఏదైనా ఎర్రర్ వస్తే యాప్ క్రాష్ అవ్వకుండా ఉండటానికి
            e.printStackTrace()
        }
    }

    /**
     * ఆండ్రాయిడ్ 8.0+ కోసం నోటిఫికేషన్ ఛానెల్‌లను సృష్టిస్తుంది.
     * దీనివల్ల యాప్ సెట్టింగ్స్‌లో నోటిఫికేషన్ లిస్ట్ కనిపిస్తుంది.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            val channels = listOf(
                NotificationChannel("general_news", "General News", NotificationManager.IMPORTANCE_DEFAULT),
                NotificationChannel("breaking_news", "Breaking News", NotificationManager.IMPORTANCE_HIGH),
                NotificationChannel("local_news", "Local News", NotificationManager.IMPORTANCE_DEFAULT)
            )
            
            notificationManager.createNotificationChannels(channels)
        }
    }

    private fun scheduleNotificationWork() {
        try {
            val notificationWork = PeriodicWorkRequestBuilder<NewsNotificationWorker>(24, TimeUnit.HOURS)
                .setInitialDelay(calculateDelay(7, 0), TimeUnit.MILLISECONDS)
                .build()
            
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "DailyNewsNotifications",
                ExistingPeriodicWorkPolicy.KEEP,
                notificationWork
            )

            val festivalWork = PeriodicWorkRequestBuilder<FestivalGreetingWorker>(24, TimeUnit.HOURS)
                .setInitialDelay(calculateDelay(6, 0), TimeUnit.MILLISECONDS)
                .build()
            
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "DailyFestivalGreeting",
                ExistingPeriodicWorkPolicy.KEEP,
                festivalWork
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun calculateDelay(hour: Int, minute: Int): Long {
        val now = Calendar.getInstance()
        val nextRun = Calendar.getInstance()
        nextRun.set(Calendar.HOUR_OF_DAY, hour)
        nextRun.set(Calendar.MINUTE, minute)
        nextRun.set(Calendar.SECOND, 0)
        
        if (nextRun.before(now)) {
            nextRun.add(Calendar.DAY_OF_YEAR, 1)
        }
        
        return nextRun.timeInMillis - now.timeInMillis
    }

    /**
     * 🖼️ Coil ఇమేజ్ లోడర్ కాన్ఫిగరేషన్ (Coil 3).
     * ఇమేజ్ కాష్ పరిమితిని 50MB కి తగ్గిస్తున్నాము, తద్వారా ఫోన్ స్టోరేజ్ నిండదు.
     */
    override fun newImageLoader(context: PlatformContext): ImageLoader {
        return ImageLoader.Builder(context)
            .memoryCache {
                MemoryCache.Builder()
                    .maxSizePercent(context, 0.15) // మెమరీలో 15% మాత్రమే
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache"))
                    .maxSizeBytes(50 * 1024 * 1024) // గరిష్టంగా 50MB మాత్రమే
                    .build()
            }
            .crossfade(true)
            .build()
    }

    /**
     * 🧹 పాత వెర్షన్లలో సేవ్ అయిన భారీ కాష్ డేటా (GBs లో ఉన్నవి) క్లియర్ చేస్తుంది.
     * ఇది అప్‌డేట్ తర్వాత ఒకే ఒకసారి జరుగుతుంది.
     */
    private fun clearLegacyAppCache() {
        val prefs = PreferenceManager.getInstance(this)
        val currentCacheVersion = 3 // లూప్ సమస్య ఫిక్స్ తర్వాత క్లీన్ అప్ కోసం 3 కి పెంచాము
        
        if (prefs.cacheVersion < currentCacheVersion) {
            scope.launch(Dispatchers.IO) {
                try {
                    // 1. కాష్ ఫోల్డర్‌ను పూర్తిగా డిలీట్ చేయడం
                    deleteDir(cacheDir)
                    
                    // 2. డేటాబేస్ ఫోల్డర్‌ను క్లియర్ చేయడం (Firestore ఇక్కడే GBs డేటాను స్టోర్ చేస్తుంది)
                    val databasesDir = File(applicationInfo.dataDir, "databases")
                    if (databasesDir.exists()) {
                        deleteDir(databasesDir)
                    }
                    
                    // 3. WebView డేటా ఫోల్డర్
                    val webViewDir = File(applicationInfo.dataDir, "app_webview")
                    if (webViewDir.exists()) {
                        deleteDir(webViewDir)
                    }
                    
                    // 4. 'files' ఫోల్డర్‌లో ఉండే అనవసర ఫైల్స్
                    val filesDir = filesDir
                    if (filesDir.exists()) {
                        val children = filesDir.list()
                        if (children != null) {
                            for (child in children) {
                                if (child.contains("cache", ignoreCase = true) || 
                                    child.contains("coil", ignoreCase = true)) {
                                    deleteDir(File(filesDir, child))
                                }
                            }
                        }
                    }

                    // 5. వెర్షన్ అప్‌డేట్ చేయడం
                    prefs.cacheVersion = currentCacheVersion
                    prefs.isLegacyCacheCleared = true
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    private fun deleteDir(dir: File?): Boolean {
        if (dir != null && dir.isDirectory) {
            val children = dir.list()
            if (children != null) {
                for (i in children.indices) {
                    val success = deleteDir(File(dir, children[i]))
                    if (!success) {
                        return false
                    }
                }
            }
            return dir.delete()
        } else if (dir != null && dir.isFile) {
            return dir.delete()
        } else {
            return false
        }
    }
}
