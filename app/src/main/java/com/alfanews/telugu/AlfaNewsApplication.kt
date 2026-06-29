package com.alfanews.telugu

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.utils.PreferenceManager
import com.google.firebase.messaging.FirebaseMessaging
import androidx.work.WorkManager
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import java.io.File
import java.util.concurrent.TimeUnit
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

            // 🛡️ స్టోరేజ్ గార్డ్ - పరిమితి మించకుండా చూస్తుంది
            runStorageGuard()

            // 🛑 పాత వర్కర్లను ఆపడం (Billing costs తగ్గించడానికి)
            cancelRedundantWorkers()

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

    /**
     * 🖼️ Coil ఇమేజ్ లోడర్ కాన్ఫిగరేషన్ (Coil 3).
     * యూజర్ ఎంచుకున్న స్టోరేజ్ లిమిట్ లో 70% ఇమేజెస్ కి కేటాయిస్తున్నాము.
     */
    override fun newImageLoader(context: PlatformContext): ImageLoader {
        val prefs = PreferenceManager.getInstance(context)
        val limitMB = prefs.storageLimitMB
        // ఒకవేళ అపరిమితం (0) అయితే 500MB, లేదంటే 70%
        val diskLimitBytes = if (limitMB <= 0) 500 * 1024 * 1024L else (limitMB * 0.7).toLong() * 1024 * 1024L

        return ImageLoader.Builder(context)
            .components {
                add(OkHttpNetworkFetcherFactory(callFactory = { createSafeOkHttpClient() }))
            }
            .memoryCache {
                MemoryCache.Builder()
                    .maxSizePercent(context, 0.20) // మెమరీలో 20%
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache"))
                    .maxSizeBytes(diskLimitBytes)
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
        val currentCacheVersion = 5 // Increased version
        
        if (prefs.cacheVersion < currentCacheVersion) {
            scope.launch(Dispatchers.IO) {
                try {
                    // 1. కాష్ ఫోల్డర్‌ను పూర్తిగా డిలీట్ చేయడం (Safe for non-essential data)
                    deleteDir(cacheDir)
                    
                    // 2. 'files' ఫోల్డర్‌లో ఉండే అనవసర కాష్ ఫైల్స్
                    val filesDir = filesDir
                    if (filesDir.exists()) {
                        val children = filesDir.list()
                        if (children != null) {
                            for (child in children) {
                                // Only delete non-essential files to avoid breaking active services
                                if (child.contains("cache", ignoreCase = true) || 
                                    child.contains("coil", ignoreCase = true) ||
                                    child.contains("image", ignoreCase = true)) {
                                    deleteDir(File(filesDir, child))
                                }
                            }
                        }
                    }

                    // 3. Firestore Cache ని క్లియర్ చేయడం (GBs లో ఉంటే తీసివేయడానికి)
                    val firestoreDir = File(filesDir, "app_firestore")
                    if (firestoreDir.exists()) {
                        deleteDir(firestoreDir)
                        Log.d("AlfaNewsApp", "Firestore cache folder deleted")
                    }

                    // 5. వెర్షన్ అప్‌డేట్ చేయడం
                    prefs.cacheVersion = currentCacheVersion
                    prefs.isLegacyCacheCleared = true
                    Log.d("AlfaNewsApp", "Legacy cache cleared successfully (safe mode)")
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    /**
     * 🛡️ స్టోరేజ్ గార్డ్: యూజర్ ఎంచుకున్న పరిమితిని మించకుండా చూస్తుంది.
     */
    private fun runStorageGuard() {
        val prefs = PreferenceManager.getInstance(this)
        val limitMB = prefs.storageLimitMB
        if (limitMB <= 0) return // అపరిమితం (Unlimited)

        scope.launch(Dispatchers.IO) {
            try {
                val limitBytes = limitMB * 1024 * 1024L
                val currentBytes = getDirectorySize(cacheDir) + getDirectorySize(filesDir)

                if (currentBytes > limitBytes) {
                    Log.d("StorageGuard", "Limit exceeded: ${currentBytes / 1024 / 1024}MB > $limitMB MB. Cleaning up...")
                    
                    // 1. Image Cache ని క్లియర్ చేయడం
                    val imageCache = cacheDir.resolve("image_cache")
                    if (imageCache.exists()) deleteDir(imageCache)
                    
                    // 2. Coil Cache ని క్లియర్ చేయడం
                    filesDir.listFiles()?.forEach { 
                        if (it.name.contains("coil", true) || it.name.contains("cache", true)) {
                            deleteDir(it)
                        }
                    }
                    
                    // 3. మిగిలిన కాష్ ని క్లియర్ చేయడం
                    deleteDir(cacheDir)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * 🛑 పాత వెర్షన్లలో షెడ్యూల్ అయిన redundant వర్కర్లను (FestivalGreetingWorker, etc.) ఆపుతుంది.
     * దీనివల్ల అనవసరమైన Gemini API మరియు Storage ఖర్చులు తగ్గుతాయి.
     */
    private fun cancelRedundantWorkers() {
        try {
            WorkManager.getInstance(this).cancelAllWork()
            Log.d("AlfaNewsApp", "All legacy background workers cancelled.")
        } catch (e: Exception) {
            Log.e("AlfaNewsApp", "Failed to cancel workers: ${e.message}")
        }
    }

    /**
     * 🛡️ చిత్రాల అభ్యర్థనల కోసం హెడర్‌లను (Headers) జోడించే OkHttpClientని సృష్టిస్తుంది.
     */
    private fun createSafeOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(SafeHeaderInterceptor())
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    /**
     * 🛡️ ఇమేజ్ అభ్యర్థనలకు Referer మరియు User-Agent హెడర్‌లను జోడించే ఇంటర్‌సెప్టర్.
     * బాహ్య వార్తా సంస్థల చిత్రాలను లోడ్ చేయడానికి ఇది అవసరం.
     */
    private class SafeHeaderInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val originalRequest = chain.request()
            val url = originalRequest.url.toString()

            // Firebase Storage కి హెడర్లు అవసరం లేదు
            if (url.contains("firebasestorage.googleapis.com", ignoreCase = true)) {
                return chain.proceed(originalRequest)
            }

            // URL ఆధారంగా తగిన Refererని నిర్ణయించడం
            val referer = when {
                url.contains("eenadu", ignoreCase = true) -> "https://www.eenadu.net/"
                url.contains("sakshi", ignoreCase = true) -> "https://www.sakshi.com/"
                url.contains("suryaa", ignoreCase = true) -> "https://www.suryaa.com/"
                url.contains("andhrajyothy", ignoreCase = true) -> "https://www.andhrajyothy.com/"
                url.contains("andhrabhoomi", ignoreCase = true) -> "https://www.andhrabhoomi.net/"
                url.contains("vaartha", ignoreCase = true) -> "https://www.vaartha.com/"
                url.contains("greatandhra", ignoreCase = true) -> "https://www.greatandhra.com/"
                url.contains("123telugu", ignoreCase = true) -> "https://www.123telugu.com/"
                else -> "https://www.google.com/"
            }

            val newRequest = originalRequest.newBuilder()
                .header("Referer", referer)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build()

            return chain.proceed(newRequest)
        }
    }

    private fun getDirectorySize(dir: File): Long {
        var size: Long = 0
        dir.walkTopDown().forEach { if (it.isFile) size += it.length() }
        return size
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
