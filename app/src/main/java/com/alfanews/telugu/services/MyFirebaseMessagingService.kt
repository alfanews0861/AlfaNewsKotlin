package com.alfanews.telugu.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.alfanews.telugu.MainActivity
import com.alfanews.telugu.R
import com.alfanews.telugu.utils.NotificationHelper
import com.alfanews.telugu.utils.PreferenceManager
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.alfanews.telugu.services.NotificationActionReceiver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.cancel
import kotlinx.coroutines.tasks.await
import java.net.HttpURLConnection
import java.net.URL

/**
 * ఫైర్‌బేస్ క్లౌడ్ మెసేజింగ్ (FCM) ద్వారా నోటిఫికేషన్లను స్వీకరించడానికి మరియు 
 * ప్రదర్శించడానికి ఉపయోగించే సర్వీస్.
 */
class MyFirebaseMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.IO)

    /**
     * అప్లికేషన్‌లో ఉపయోగించే నోటిఫికేషన్ ఛానెల్‌ల రకాలు.
     */
    private enum class AppNotificationChannel(val id: String, val channelName: String, val importance: Int) {
        GENERAL("general_news", "General News", NotificationManager.IMPORTANCE_DEFAULT),
        BREAKING("breaking_news", "Breaking News", NotificationManager.IMPORTANCE_HIGH),
        LOCAL("local_news", "Local News", NotificationManager.IMPORTANCE_DEFAULT),
        WEATHER("weather_alerts", "Weather Alerts", NotificationManager.IMPORTANCE_HIGH)
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
        val imageUrl = remoteMessage.data["imageUrl"] ?: remoteMessage.notification?.imageUrl?.toString()
        val channelId = remoteMessage.data["channelId"] ?: AppNotificationChannel.GENERAL.id

        if (title != null && body != null) {
            sendNotification(title, body, channelId, actionUrl, imageUrl)
        }
    }

    /**
     * కొత్త టోకెన్ సృష్టించబడినప్పుడు ఈ పద్ధతి పిలవబడుతుంది.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        subscribeToDefaultTopics()
        saveTokenToFirestore(token)
    }

    /**
     * FCM టోకెన్‌ను ఫైర్‌స్టోర్ (Firestore) డేటాబేస్‌లో సేవ్ చేస్తుంది.
     * రిజిస్టర్డ్ మరియు గెస్ట్ యూజర్లు ఇద్దరికీ ఇది పనిచేస్తుంది.
     */
    private fun saveTokenToFirestore(token: String) {
        val uid = FirebaseService.auth.currentUser?.uid
        val db = FirebaseService.db
        
        if (uid != null) {
            // రిజిస్టర్డ్ యూజర్ కోసం
            serviceScope.launch {
                try {
                    db.collection("users").document(uid)
                        .update(
                            "fcmToken", token,
                            "fcmTokens", com.google.firebase.firestore.FieldValue.arrayUnion(token),
                            "lastActive", com.google.firebase.firestore.FieldValue.serverTimestamp()
                        ).await()
                } catch (e: Exception) {
                    val data = mapOf(
                        "fcmToken" to token,
                        "fcmTokens" to listOf(token),
                        "notificationsEnabled" to true,
                        "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                    )
                    db.collection("users").document(uid).set(data, com.google.firebase.firestore.SetOptions.merge()).await()
                }
            }
        } else {
            // గెస్ట్ యూజర్ (Anonymous) కోసం - 'anonymous_devices' లో సేవ్ చేస్తాం
            serviceScope.launch {
                try {
                    val guestData = mapOf(
                        "fcmToken" to token,
                        "isAnonymous" to true,
                        "notificationsEnabled" to true,
                        "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                    )
                    val tokenId = token.take(30).replace("/", "_") 
                    db.collection("anonymous_devices").document(tokenId).set(guestData, com.google.firebase.firestore.SetOptions.merge()).await()
                } catch (e: Exception) {
                    Log.e("MyFirebaseMsgService", "Failed to save guest token", e)
                }
            }
        }
    }

    /**
     * ముఖ్యమైన టాపిక్‌లకు (Topics) సభ్యత్వం పొందుతుంది, తద్వారా ఆ టాపిక్ నోటిఫికేషన్లు అందుతాయి.
     */
    private fun subscribeToDefaultTopics() {
        val prefs = PreferenceManager.getInstance(applicationContext)
        if (!prefs.isNotificationsEnabled) return

        serviceScope.launch {
            try {
                // అందరు యూజర్ల కోసం
                FirebaseMessaging.getInstance().subscribeToTopic("all_users").await()
                FirebaseMessaging.getInstance().subscribeToTopic("breaking_news").await()
                
                // ✅ జిల్లా ఆధారిత టాపిక్ కి సబ్‌స్క్రయిబ్ చేయడం (సురక్షితమైన పేరుతో)
                val userDistrict = prefs.userDistrict
                if (!userDistrict.isNullOrBlank()) {
                    val districtTopic = NotificationHelper.getTopicName("district", userDistrict)
                    FirebaseMessaging.getInstance().subscribeToTopic(districtTopic).await()
                    Log.d("MyFirebaseMsgService", "Subscribed to district topic: $districtTopic")

                    // ✅ FIX: Subscribe to weather_alert topic.
                    // Cloud Function sends to "weather_alert_{district}", NOT "district_{district}".
                    // Without this, weather alert push notifications NEVER reach the user!
                    val weatherAlertTopic = NotificationHelper.getTopicName("weather_alert", userDistrict)
                    FirebaseMessaging.getInstance().subscribeToTopic(weatherAlertTopic).await()
                    Log.d("MyFirebaseMsgService", "Subscribed to weather alert topic: $weatherAlertTopic")
                }

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
     * @param imageUrl నోటిఫికేషన్‌లో చూపించాల్సిన చిత్రం URL.
     */
    private fun sendNotification(title: String, messageBody: String, channelId: String, actionUrl: String?, imageUrl: String?) {
        // ✅ FIX: Image download తప్పనిసరిగా Background thread లో జరగాలి.
        // NetworkOnMainThreadException వల్ల notification అస్సలు రాకపోవడం fix అవుతుంది.
        serviceScope.launch {
            val notificationId = (System.currentTimeMillis() and 0xfffffffL).toInt()
            val newsId = Uri.parse(actionUrl ?: "").lastPathSegment ?: ""

            // 1. ప్రధాన క్లిక్ యాక్షన్: వార్తను చదవడం
            val intent = if (!actionUrl.isNullOrEmpty()) {
                Intent(Intent.ACTION_VIEW, Uri.parse(actionUrl))
            } else {
                Intent(this@MyFirebaseMessagingService, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
            }

            // ✅ FIX: requestCode unique గా ఉండాలి, లేకపోతే PendingIntent override అవుతుంది
            val pendingIntent = PendingIntent.getActivity(
                this@MyFirebaseMessagingService,
                notificationId,
                intent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )

            // 2. షేర్ బటన్ యాక్షన్
            val shareIntent = Intent(this@MyFirebaseMessagingService, NotificationActionReceiver::class.java).apply {
                action = "com.alfanews.telugu.ACTION_SHARE"
                putExtra("title", title)
                putExtra("body", messageBody)
                putExtra("url", actionUrl ?: "https://play.google.com/store/apps/details?id=com.alfanews.telugu")
                putExtra("newsId", newsId)
            }
            val sharePendingIntent = PendingIntent.getBroadcast(
                this@MyFirebaseMessagingService,
                notificationId + 1, // unique requestCode
                shareIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notificationBuilder = NotificationCompat.Builder(this@MyFirebaseMessagingService, channelId)
                .setSmallIcon(R.drawable.app_icon_new)
                .setContentTitle(title)
                .setContentText(messageBody)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .addAction(R.drawable.ic_launcher_foreground, "చదవండి", pendingIntent)
                .addAction(R.drawable.ic_launcher_foreground, "షేర్ చేయండి", sharePendingIntent)

            // 🖼️ Rich Notification: ఫోటో ఉంటే Background లో డౌన్‌లోడ్ చేసి చూపిస్తాం
            if (!imageUrl.isNullOrBlank()) {
                var bitmap: Bitmap? = null
                try {
                    val url = URL(imageUrl)
                    val connection = url.openConnection() as HttpURLConnection
                    connection.doInput = true
                    connection.connectTimeout = 10_000  // ✅ FIX: timeout add చేయడం
                    connection.readTimeout = 10_000
                    connection.connect()
                    bitmap = BitmapFactory.decodeStream(connection.inputStream)
                } catch (e: Exception) {
                    Log.e("MyFirebaseMsgService", "Image download failed, showing text-only notification", e)
                }

                if (bitmap != null) {
                    notificationBuilder
                        .setLargeIcon(bitmap)
                        .setStyle(
                            NotificationCompat.BigPictureStyle()
                                .bigPicture(bitmap)
                                .setBigContentTitle(title)
                                .setSummaryText(messageBody)
                                .bigLargeIcon(null as Bitmap?)
                        )
                } else {
                    // Image load fail అయినా notification వస్తుంది
                    notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))
                }
            } else {
                // చిత్రం లేకపోతే BigTextStyle ఉపయోగిస్తాం
                notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))
            }

            // పాత ఆండ్రాయిడ్ వెర్షన్ల కోసం ప్రయారిటీ సెట్ చేయడం
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                val priority = if (channelId == AppNotificationChannel.BREAKING.id) {
                    NotificationCompat.PRIORITY_HIGH
                } else {
                    NotificationCompat.PRIORITY_DEFAULT
                }
                notificationBuilder.priority = priority
            }

            // ✅ Main thread లో notify చేయాలి
            withContext(Dispatchers.Main) {
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.notify(notificationId, notificationBuilder.build())
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}
