package com.alfanews.telugu

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.alfanews.telugu.services.AnalyticsService
import com.google.firebase.messaging.FirebaseMessaging
import com.alfanews.telugu.BuildConfig
import androidx.work.*
import com.alfanews.telugu.workers.NewsNotificationWorker
import java.util.concurrent.TimeUnit
import java.util.Calendar

/**
 * ఆల్ఫా న్యూస్ అప్లికేషన్ యొక్క ప్రధాన అప్లికేషన్ క్లాస్.
 * 
 * ఈ క్లాస్ అప్లికేషన్ ప్రారంభమైనప్పుడు ఫైర్‌బేస్ (Firebase), అనలిటిక్స్ (Analytics) 
 * మరియు ఇతర ముఖ్యమైన సేవలను ప్రారంభించడానికి బాధ్యత వహిస్తుంది.
 */
class AlfaNewsApplication : Application() {

    /**
     * అప్లికేషన్ సృష్టించబడినప్పుడు పిలవబడే పద్ధతి.
     * ఇక్కడ ఫైర్‌బేస్ మరియు నోటిఫికేషన్ సేవలు కాన్ఫిగర్ చేయబడతాయి.
     */
    override fun onCreate() {
        super.onCreate()

        // ఫైర్‌బేస్‌ను ప్రారంభించడం (Initialize Firebase)
        FirebaseApp.initializeApp(this)

        // ఫైర్‌బేస్ యాప్ చెక్‌ను ప్రారంభించడం (Initialize Firebase App Check)
        val firebaseAppCheck = FirebaseAppCheck.getInstance()
        if (BuildConfig.DEBUG) {
            // డీబగ్ మోడ్‌లో ఉన్నప్పుడు, డీబగ్ ప్రొవైడర్ ఫ్యాక్టరీని ఉపయోగించడం జరుగుతుంది.
            try {
                val debugFactoryClass = Class.forName("com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory")
                val getInstanceMethod = debugFactoryClass.getMethod("getInstance")
                val factory = getInstanceMethod.invoke(null) as com.google.firebase.appcheck.AppCheckProviderFactory
                firebaseAppCheck.installAppCheckProviderFactory(factory)
            } catch (e: Exception) {
                firebaseAppCheck.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
            }
        } else {
            firebaseAppCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }

        // ఫైర్‌బేస్ అనలిటిక్స్‌ను ప్రారంభించడం
        FirebaseAnalytics.getInstance(this)

        // అనలిటిక్స్ సర్వీస్‌ను ప్రారంభించడం
        AnalyticsService.initialize(this)

        // పుష్ నోటిఫికేషన్ల కోసం 'all_users' టాపిక్‌కు సభ్యత్వం పొందడం
        FirebaseMessaging.getInstance().subscribeToTopic("all_users")
        
        scheduleNotificationWork()
    }

    private fun scheduleNotificationWork() {
        val notificationWork = PeriodicWorkRequestBuilder<NewsNotificationWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(calculateDelay(7, 0), TimeUnit.MILLISECONDS)
            .build()
        
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "DailyNewsNotifications",
            ExistingPeriodicWorkPolicy.KEEP,
            notificationWork
        )
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
}
