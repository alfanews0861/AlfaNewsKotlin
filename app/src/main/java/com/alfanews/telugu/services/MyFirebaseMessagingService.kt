package com.alfanews.telugu.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
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
import coil3.SingletonImageLoader
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.cancel
import kotlinx.coroutines.tasks.await

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
        GENERAL("general_news_v2", "General News", NotificationManager.IMPORTANCE_HIGH),
        BREAKING("breaking_news", "Breaking News", NotificationManager.IMPORTANCE_HIGH),
        LOCAL("local_news_v2", "Local News", NotificationManager.IMPORTANCE_HIGH),
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
        val imageUrl = remoteMessage.data["imageUrl"] ?: remoteMessage.data["image"] ?: remoteMessage.notification?.imageUrl?.toString()
        val rawChannelId = remoteMessage.data["channelId"] ?: remoteMessage.notification?.channelId ?: AppNotificationChannel.GENERAL.id
        val channelId = when (rawChannelId) {
            "general_news" -> AppNotificationChannel.GENERAL.id
            "local_news" -> AppNotificationChannel.LOCAL.id
            else -> rawChannelId
        }
        val badgeCount = remoteMessage.data["badge"]?.toIntOrNull() 
            ?: remoteMessage.data["unreadCount"]?.toIntOrNull() 
            ?: if (remoteMessage.data["type"] == "REPORTER_MESSAGE" || remoteMessage.data["type"] == "REPORTER_BROADCAST") 1 else 0

        try {
            val bundle = android.os.Bundle().apply {
                putString("channel_id", channelId)
                if (!actionUrl.isNullOrBlank()) putString("action_url", actionUrl)
            }
            AnalyticsService.logAnalyticsEvent("notification_received", bundle)
        } catch (e: Exception) { }
        sendNotification(title ?: "Alfa News", body ?: "", channelId, actionUrl, imageUrl, badgeCount)
    }

    /**
     * కొత్త టోకెన్ సృష్టించబడినప్పుడు ఈ పద్ధతి పిలవబడుతుంది.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Token refresh అయినప్పుడు old topics lost అవుతాయి.
        // reSubscribeToAllTopics() చేస్తే delivery continuity maintain అవుతుంది.
        reSubscribeToAllTopics()
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
                    val prefs = PreferenceManager.getInstance(applicationContext)
                    val guestData = mutableMapOf<String, Any>(
                        "fcmToken" to token,
                        "isAnonymous" to true,
                        "notificationsEnabled" to true,
                        "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                    )
                    prefs.referredBy?.let { ref ->
                        if (ref.isNotEmpty()) {
                            guestData["referredBy"] = ref
                        }
                    }
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
                }

                // ✅ HYPER-LOCAL WEATHER: GPS grid topic (0.1° ≈ 10km cell)
                // User GPS coordinates prefs లో save అయి ఉంటే grid topic subscribe చేస్తాం.
                // ఇది district-wide alert కాదు — exact 10km area మాత్రమే.
                val lat = prefs.lastLat
                val lon = prefs.lastLon
                if (lat != 0.0 && lon != 0.0) {
                    val gridTopic = getWeatherGridTopic(lat, lon)
                    FirebaseMessaging.getInstance().subscribeToTopic(gridTopic).await()
                    // Save grid key to prefs for unsubscribe on token refresh
                    prefs.weatherGridTopic = gridTopic
                    Log.d("MyFirebaseMsgService", "Subscribed to weather grid topic: $gridTopic")

                    // active_weather_grids doc లో gridKey: true నమోదు చేయడం (backend dynamic checking కోసం)
                    try {
                        val gridMap = mapOf(gridTopic to true)
                        FirebaseService.db.collection("settings").document("active_weather_grids")
                            .set(gridMap, com.google.firebase.firestore.SetOptions.merge()).await()
                        Log.d("MyFirebaseMsgService", "Registered $gridTopic in active_weather_grids")
                    } catch (e: Exception) {
                        Log.w("MyFirebaseMsgService", "Failed to register active weather grid", e)
                    }

                    // Firestore users doc లో GPS save చేయడం (logged-in users కి)
                    val uid = FirebaseService.auth.currentUser?.uid
                    if (uid != null) {
                        try {
                            FirebaseService.db.collection("users").document(uid)
                                .update(
                                    "weatherLat", lat,
                                    "weatherLon", lon,
                                    "weatherGridKey", gridTopic
                                ).await()
                        } catch (e: Exception) {
                            Log.w("MyFirebaseMsgService", "Could not save weather GPS to Firestore", e)
                        }
                    }
                } else if (!userDistrict.isNullOrBlank()) {
                    // GPS లేకపోతే old district weather topic fallback
                    val weatherAlertTopic = NotificationHelper.getTopicName("weather_alert", userDistrict)
                    FirebaseMessaging.getInstance().subscribeToTopic(weatherAlertTopic).await()
                    Log.d("MyFirebaseMsgService", "Fallback: subscribed to district weather topic: $weatherAlertTopic")
                }

                Log.d("MyFirebaseMsgService", "Subscribed to default topics")
            } catch (e: Exception) {
                Log.e("MyFirebaseMsgService", "Failed to subscribe to topics", e)
            }
        }
    }

    /**
     * Token refresh అయినప్పుడు అన్ని topics ను re-subscribe చేస్తుంది.
     */
    private fun reSubscribeToAllTopics() {
        val prefs = PreferenceManager.getInstance(applicationContext)
        serviceScope.launch {
            try {
                // Step 1: stale subscriptions unsubscribe
                FirebaseMessaging.getInstance().unsubscribeFromTopic("all_users").await()
                FirebaseMessaging.getInstance().unsubscribeFromTopic("breaking_news").await()

                val userDistrict = prefs.userDistrict
                if (!userDistrict.isNullOrBlank()) {
                    val oldDistrictTopic = NotificationHelper.getTopicName("district", userDistrict)
                    val oldWeatherTopic  = NotificationHelper.getTopicName("weather_alert", userDistrict)
                    FirebaseMessaging.getInstance().unsubscribeFromTopic(oldDistrictTopic).await()
                    FirebaseMessaging.getInstance().unsubscribeFromTopic(oldWeatherTopic).await()
                }

                // ✅ OLD grid topic unsubscribe (token refresh తర్వాత re-subscribe చేస్తాం)
                val oldGridTopic = prefs.weatherGridTopic
                if (!oldGridTopic.isNullOrBlank()) {
                    FirebaseMessaging.getInstance().unsubscribeFromTopic(oldGridTopic).await()
                    Log.d("MyFirebaseMsgService", "Unsubscribed from old grid topic: $oldGridTopic")
                }

                // Step 2: Old category topics unsubscribe
                prefs.subscribedCategoryTopics.forEach { oldTopic ->
                    FirebaseMessaging.getInstance().unsubscribeFromTopic(oldTopic).await()
                }
                prefs.subscribedCategoryTopics = emptySet()

                // Step 3: Fresh subscribe
                subscribeToDefaultTopics()
                Log.d("MyFirebaseMsgService", "Re-subscribed to all topics after token refresh")
            } catch (e: Exception) {
                Log.e("MyFirebaseMsgService", "reSubscribeToAllTopics failed", e)
                subscribeToDefaultTopics()
            }
        }
    }

    /**
     * User చదివిన categories బట్టి FCM category topics subscribe/unsubscribe చేస్తుంది.
     * Top 3 preferred categories కి subscribe చేస్తాం.
     * ఈ method ను news detail screen లో కూడా call చేయవచ్చు.
     */
    fun updateCategorySubscriptions(prefs: PreferenceManager = PreferenceManager.getInstance(applicationContext)) {
        Companion.updateCategorySubscriptions(prefs)
    }

    companion object {
        fun updateCategorySubscriptions(prefs: PreferenceManager) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val topCategories = prefs.getTopCategories(3)
                    val newTopics = topCategories
                        .mapNotNull { CATEGORY_TOPIC_MAP[it] }
                        .toSet()

                    val currentTopics = prefs.subscribedCategoryTopics

                    // Unsubscribe తీసేసిన topics
                    (currentTopics - newTopics).forEach { oldTopic ->
                        FirebaseMessaging.getInstance().unsubscribeFromTopic(oldTopic).await()
                        Log.d("MyFirebaseMsgService", "Unsubscribed from category: $oldTopic")
                    }

                    // కొత్త topics subscribe
                    (newTopics - currentTopics).forEach { newTopic ->
                        FirebaseMessaging.getInstance().subscribeToTopic(newTopic).await()
                        Log.d("MyFirebaseMsgService", "Subscribed to category: $newTopic")
                    }

                    // Save updated set
                    prefs.subscribedCategoryTopics = newTopics
                    Log.d("MyFirebaseMsgService", "Category topics updated: $newTopics")
                } catch (e: Exception) {
                    Log.e("MyFirebaseMsgService", "updateCategorySubscriptions failed", e)
                }
            }
        }
        /**
         * Telugu category → FCM topic name mapping.
         * Backend notification_engine.ts లో getCategoryTopic() తో exactly match అవుతుంది.
         */
        val CATEGORY_TOPIC_MAP = mapOf(
            "రాజకీయం"    to "cat_politics",
            "వినోదం"     to "cat_cinema",
            "క్రైమ్"     to "cat_crime",
            "క్రీడలు"    to "cat_sports",
            "వ్యాపారం"   to "cat_business",
            "టెక్నాలజీ" to "cat_technology",
            "ఆరోగ్యం"   to "cat_health",
            "విద్య"      to "cat_education",
            "భక్తి"      to "cat_spiritual",
            "వ్యవసాయం"  to "cat_agriculture",
            "జాతీయం"    to "cat_national",
            "ప్రపంచం"   to "cat_international",
            "జీవనశైలి"  to "cat_lifestyle"
        )

        /**
         * GPS coordinates ను 0.1° grid cell కి round చేసి FCM topic name generate చేస్తుంది.
         * Backend auto_content_handler.ts లో getWeatherGridTopic() తో exactly match అవుతుంది.
         *
         * Example: lat=14.44, lon=79.98
         *   → latKey = round(14.44 × 10) = 144
         *   → lonKey = round(79.98 × 10) = 800
         *   → topic: "weather_grid_144_800"
         *
         * ఇది ≈10km × 10km area ను cover చేస్తుంది.
         * ఆ area లో ఉన్న అందరు users కి ఒకే topic subscribe అవుతుంది.
         */
        fun getWeatherGridTopic(lat: Double, lon: Double): String {
            val latKey = Math.round(lat * 10)  // 14.44 → 144
            val lonKey = Math.round(lon * 10)  // 79.98 → 800
            return "weather_grid_${latKey}_${lonKey}"
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
                ).apply {
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 100, 250)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
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
    private fun sendNotification(title: String, messageBody: String, channelId: String, actionUrl: String?, imageUrl: String?, badgeCount: Int = 0) {
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

            if (badgeCount > 0) {
                notificationBuilder.setNumber(badgeCount)
            }

            // 🖼️ Rich Notification: ఫోటో ఉంటే Coil 3 ద్వారా Safe గా లోడ్ చేసి చూపిస్తాం
            if (!imageUrl.isNullOrBlank()) {
                var bitmap: Bitmap? = null
                try {
                    val request = ImageRequest.Builder(this@MyFirebaseMessagingService)
                        .data(imageUrl)
                        .size(1024, 512)
                        .allowHardware(false) // Notification view support requires software Bitmaps
                        .memoryCachePolicy(CachePolicy.DISABLED)
                        .build()
                    val result = SingletonImageLoader.get(this@MyFirebaseMessagingService).execute(request)
                    if (result is SuccessResult) {
                        bitmap = result.image.toBitmap()
                    }
                } catch (e: Exception) {
                    Log.e("MyFirebaseMsgService", "Coil image load failed, showing text-only notification", e)
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
