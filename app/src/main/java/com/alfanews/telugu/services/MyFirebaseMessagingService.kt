package com.alfanews.telugu.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.alfanews.telugu.MainActivity
import com.alfanews.telugu.R
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * ఫైర్‌బేస్ క్లౌడ్ మెసేజింగ్ (FCM) ద్వారా నోటిఫికేషన్లను స్వీకరించడానికి మరియు 
 * ప్రదర్శించడానికి ఉపయోగించే సర్వీస్.
 */
class MyFirebaseMessagingService : FirebaseMessagingService() {

    /**
     * అప్లికేషన్‌లో ఉపయోగించే నోటిఫికేషన్ ఛానెల్‌ల రకాలు.
     */
    private enum class AppNotificationChannel(val id: String, val channelName: String, val importance: Int) {
        GENERAL("general_news", "General News", NotificationManager.IMPORTANCE_DEFAULT),
        BREAKING("breaking_news", "Breaking News", NotificationManager.IMPORTANCE_HIGH),
        LOCAL("local_news", "Local News", NotificationManager.IMPORTANCE_DEFAULT)
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        subscribeToDefaultTopics()
    }

    /**
     * కొత్త నోటిఫికేషన్ సందేశం వచ్చినప్పుడు ఈ పద్ధతి పిలవబడుతుంది.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.data["title"] ?: remoteMessage.notification?.title
        val body = remoteMessage.data["body"] ?: remoteMessage.notification?.body
        val actionUrl = remoteMessage.data["actionUrl"]
        val channelId = remoteMessage.data["channelId"] ?: AppNotificationChannel.GENERAL.id

        if (title != null && body != null) {
            sendNotification(title, body, channelId, actionUrl)
        }
    }

    /**
     * కొత్త టోకెన్ సృష్టించబడినప్పుడు ఈ పద్ధతి పిలవబడుతుంది.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        subscribeToDefaultTopics()
    }

    /**
     * ముఖ్యమైన టాపిక్‌లకు (Topics) సభ్యత్వం పొందుతుంది, తద్వారా ఆ టాపిక్ నోటిఫికేషన్లు అందుతాయి.
     */
    private fun subscribeToDefaultTopics() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                FirebaseMessaging.getInstance().subscribeToTopic("all_users").await()
                FirebaseMessaging.getInstance().subscribeToTopic("breaking_news").await()
                Log.d("MyFirebaseMsgService", "Subscribed to default topics")
            } catch (e: Exception) {
                Log.e("MyFirebaseMsgService", "Failed to subscribe to topics", e)
            }
        }
    }

    /**
     * ఆండ్రాయిడ్ 8.0 (Oreo) మరియు అంతకంటే పై వెర్షన్ల కోసం నోటిఫికేషన్ ఛానెల్‌లను సృష్టిస్తుంది.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            AppNotificationChannel.entries.forEach { channelInfo ->
                val channel = NotificationChannel(
                    channelInfo.id,
                    channelInfo.channelName,
                    channelInfo.importance
                )
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    /**
     * సిస్టమ్ ట్రేలో నోటిఫికేషన్‌ను ప్రదర్శిస్తుంది.
     * 
     * @param title నోటిఫికేషన్ శీర్షిక.
     * @param messageBody నోటిఫికేషన్ సందేశం.
     * @param channelId ఛానెల్ ID.
     * @param actionUrl నోటిఫికేషన్ క్లిక్ చేసినప్పుడు తెరవవలసిన URL (ఉంటే).
     */
    private fun sendNotification(title: String, messageBody: String, channelId: String, actionUrl: String?) {
        val intent = if (actionUrl != null && actionUrl.isNotEmpty()) {
            Intent(Intent.ACTION_VIEW, Uri.parse(actionUrl))
        } else {
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // పాత ఆండ్రాయిడ్ వెర్షన్ల కోసం ప్రయారిటీ సెట్ చేయడం
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            val priority = if (channelId == AppNotificationChannel.BREAKING.id) {
                NotificationCompat.PRIORITY_HIGH
            } else {
                NotificationCompat.PRIORITY_DEFAULT
            }
            notificationBuilder.priority = priority
        }

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
}
