package com.alfanews.telugu

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.alfanews.telugu.services.AnalyticsService
import com.google.firebase.messaging.FirebaseMessaging
import androidx.work.*
import com.alfanews.telugu.workers.NewsNotificationWorker
import java.util.concurrent.TimeUnit
import java.util.Calendar

class AlfaNewsApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        try {
            // ఫైర్‌బేస్‌ను ప్రారంభించడం
            FirebaseApp.initializeApp(this)

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
            
            scheduleNotificationWork()
        } catch (e: Exception) {
            // ఏదైనా ఎర్రర్ వస్తే యాప్ క్రాష్ అవ్వకుండా ఉండటానికి
            e.printStackTrace()
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
}
