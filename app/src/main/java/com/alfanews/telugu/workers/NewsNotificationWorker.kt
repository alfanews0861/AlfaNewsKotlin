package com.alfanews.telugu.workers

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.alfanews.telugu.R
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.PreferenceManager

import kotlinx.coroutines.tasks.await
import java.net.URL

/**
 * యూజర్ ఆసక్తి ఉన్న వార్తల కోసం నోటిఫికేషన్లను షెడ్యూల్ చేయడానికి ఉపయోగించే వర్కర్.
 */
class NewsNotificationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val preferenceManager = PreferenceManager.getInstance(applicationContext)
        val interests = preferenceManager.newsInterests
        
        Log.d("NewsNotificationWorker", "Running notification worker, interests: $interests")

        // ✅ CRITICAL FIX: Respect user notification preference
        if (!preferenceManager.isNotificationsEnabled) {
            Log.w("NewsNotificationWorker", "Notifications disabled by user. Skipping.")
            return Result.success()
        }

        if (interests.isNullOrEmpty()) {
            return Result.success()
        }

        // ఆండ్రాయిడ్ 13 (TIRAMISU) మరియు అంతకంటే పై వెర్షన్లలో నోటిఫికేషన్ పర్మిషన్ చెక్ చేయాలి
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    applicationContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.w("NewsNotificationWorker", "Notification permission not granted. Skipping.")
                return Result.success()
            }
        } else {
            // పాత వెర్షన్లలో సిస్టమ్ స్థాయిలో నోటిఫికేషన్లు బ్లాక్ చేశారేమో చెక్ చేయాలి
            if (!NotificationManagerCompat.from(applicationContext).areNotificationsEnabled()) {
                Log.w("NewsNotificationWorker", "Notifications are disabled globally. Skipping.")
                return Result.success()
            }
        }

        try {
            // Firestore Composite Index ఎర్రర్ రాకుండా ఉండటానికి, ముందుగా డేటా తెచ్చుకుని లోకల్ గా సార్ట్ చేస్తున్నాము
            val querySnapshot = FirebaseService.db.collection("news")
                .whereArrayContainsAny("categories", interests.toList())
                .limit(20) // టాప్ 20 తెచ్చుకుని..
                .get()
                .await()

            if (!querySnapshot.isEmpty) {
                // లోకల్ గా టైమ్‌స్టాంప్ ఆధారంగా డిసెండింగ్ ఆర్డర్ లో సార్ట్ చేయడం
                val latestDoc = querySnapshot.documents.maxByOrNull { 
                    it.getLong("timestamp") ?: 0L 
                }
                
                if (latestDoc != null) {
                    val newsId = latestDoc.id
                    
                    val prefs = applicationContext.getSharedPreferences("alfa_news_prefs", Context.MODE_PRIVATE)
                    val lastNotifiedId = prefs.getString("last_notified_news_id", null)

                    if (newsId != lastNotifiedId) {
                        val headlineMap = latestDoc.get("headline") as? Map<*, *>
                        val teluguHeadline = headlineMap?.get("telugu")?.toString() ?: "మీకోసం తాజా వార్త"
                        
                        // ✅ NEW: Extract image URL for rich notification
                        val imageUrl = latestDoc.getString("mediaUrl") ?: ""

                        val actionUrl = "alfanews://news/$newsId"
                        sendNotification(
                            applicationContext,
                            "మీకు నచ్చిన కేటగిరీలో అప్‌డేట్!",
                            teluguHeadline,
                            actionUrl,
                            imageUrl,
                            newsId
                        )

                        prefs.edit().putString("last_notified_news_id", newsId).apply()
                    } else {
                        Log.d("NewsNotificationWorker", "Already notified for newsId: $newsId")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("NewsNotificationWorker", "Error fetching news for notification", e)
            return Result.retry()
        }

        return Result.success()
    }

    private fun sendNotification(
        context: Context,
        title: String,
        messageBody: String,
        actionUrl: String,
        imageUrl: String = "",
        newsId: String = ""
    ) {
        val channelId = "personalized_news"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Personalized News",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            channel.description = "నిజ సమయ వార్త నోటిఫికేషన్లు"
            channel.setShowBadge(true)
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(actionUrl)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            newsId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))

        // ✅ NEW: Add large icon/image for rich notification
        if (imageUrl.isNotEmpty()) {
            try {
                val bitmap = downloadBitmap(imageUrl)
                if (bitmap != null) {
                    // Set large icon for banner notification (appears on the left)
                    notificationBuilder.setLargeIcon(bitmap)
                    
                    // ✅ NEW: Use BigPictureStyle for rich image notification
                    notificationBuilder.setStyle(
                        NotificationCompat.BigPictureStyle()
                            .bigPicture(bitmap)
                            .setBigContentTitle(title)
                            .setSummaryText(messageBody)
                    )
                    Log.d("NewsNotificationWorker", "Rich image notification created for $newsId")
                }
            } catch (e: Exception) {
                Log.e("NewsNotificationWorker", "Failed to load notification image: ${e.message}")
                // Fallback to text-only notification
                notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))
            }
        } else {
            // No image - use big text style
            notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))
        }

        notificationManager.notify(newsId.hashCode(), notificationBuilder.build())
    }

    /**
     * Download bitmap from URL with size optimization
     */
    private fun downloadBitmap(imageUrl: String): Bitmap? {
        return try {
            if (imageUrl.isEmpty()) {
                return null
            }
            
            val url = URL(imageUrl)
            val connection = url.openConnection()
            connection.doInput = true
            connection.connect()
            
            val input = connection.getInputStream()
            val bitmap = BitmapFactory.decodeStream(input)
            input.close()
            
            // ✅ Optimize bitmap size for notification (max 256x256 or resize to prevent memory issues)
            if (bitmap != null && (bitmap.width > 256 || bitmap.height > 256)) {
                val scaledBitmap = Bitmap.createScaledBitmap(bitmap, 256, 256, true)
                if (scaledBitmap != bitmap) {
                    bitmap.recycle()
                }
                scaledBitmap
            } else {
                bitmap
            }
        } catch (e: Exception) {
            Log.e("NewsNotificationWorker", "Error downloading image: ${e.message}")
            null
        }
    }
}
