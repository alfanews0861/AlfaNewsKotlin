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
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.alfanews.telugu.R
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.PreferenceManager
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.QuerySnapshot
import kotlinx.coroutines.tasks.await
import java.net.URL
import java.io.InputStream

class NewsNotificationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val preferenceManager = PreferenceManager.getInstance(applicationContext)
        val interests = preferenceManager.newsInterests
        
        if (!preferenceManager.isNotificationsEnabled || interests == null || interests.isEmpty()) {
            return Result.success()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return Result.success()
            }
        }

        try {
            val querySnapshot: QuerySnapshot = FirebaseService.db.collection("news")
                .whereArrayContainsAny("categories", interests.toList())
                .limit(20)
                .get()
                .await()

            if (!querySnapshot.isEmpty) {
                var latestDoc: DocumentSnapshot? = null
                var maxTs = -1L
                
                for (doc in querySnapshot.documents) {
                    val ts = (doc.get("timestamp") as? Number)?.toLong() ?: 0L
                    if (ts > maxTs) {
                        maxTs = ts
                        latestDoc = doc
                    }
                }
                
                if (latestDoc != null) {
                    val newsId = latestDoc.id
                    val prefs = applicationContext.getSharedPreferences("alfa_news_prefs", Context.MODE_PRIVATE)
                    val lastNotifiedId = prefs.getString("last_notified_news_id", null)

                    if (newsId != lastNotifiedId) {
                        val headlineMap = latestDoc.get("headline") as? Map<String, Any>
                        val teluguHeadline = if (headlineMap != null) headlineMap["telugu"]?.toString() ?: "మీకోసం తాజా వార్త" else "మీకోసం తాజా వార్త"
                        val imageUrl = latestDoc.getString("mediaUrl") ?: ""

                        sendNotification(teluguHeadline, "alfanews://news/$newsId", imageUrl, newsId)
                        prefs.edit().putString("last_notified_news_id", newsId).apply()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("NewsNotificationWorker", "Error: ${e.message}")
            return Result.retry()
        }

        return Result.success()
    }

    private fun sendNotification(messageBody: String, actionUrl: String, imageUrl: String, newsId: String) {
        val channelId = "personalized_news"
        val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Personalized News", NotificationManager.IMPORTANCE_DEFAULT)
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(actionUrl)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val pendingIntent = PendingIntent.getActivity(applicationContext, newsId.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notificationBuilder = NotificationCompat.Builder(applicationContext, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("మీకు నచ్చిన కేటగిరీలో అప్‌డేట్!")
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

        if (imageUrl.isNotEmpty()) {
            val bitmap = downloadBitmap(imageUrl)
            if (bitmap != null) {
                notificationBuilder.setLargeIcon(bitmap)
                notificationBuilder.setStyle(NotificationCompat.BigPictureStyle().bigPicture(bitmap).setSummaryText(messageBody))
            } else {
                notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))
            }
        } else {
            notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(messageBody))
        }

        notificationManager.notify(newsId.hashCode(), notificationBuilder.build())
    }

    private fun downloadBitmap(imageUrl: String): Bitmap? {
        var inputStream1: InputStream? = null
        var inputStream2: InputStream? = null
        return try {
            val url = URL(imageUrl)
            val options = BitmapFactory.Options()
            options.inJustDecodeBounds = true
            
            inputStream1 = url.openStream()
            BitmapFactory.decodeStream(inputStream1, null, options)
            inputStream1.close()
            
            options.inSampleSize = calculateInSampleSize(options, 512, 512)
            options.inJustDecodeBounds = false
            
            inputStream2 = url.openStream()
            val bitmap = BitmapFactory.decodeStream(inputStream2, null, options)
            inputStream2.close()
            
            if (bitmap != null) {
                if (bitmap.getWidth() > 512 || bitmap.getHeight() > 512) {
                    val scaled = Bitmap.createScaledBitmap(bitmap, 512, 512, true)
                    if (scaled != bitmap) {
                        bitmap.recycle()
                    }
                    scaled
                } else {
                    bitmap
                }
            } else {
                null
            }
        } catch (e: Exception) {
            try { inputStream1?.close() } catch (ex: Exception) {}
            try { inputStream2?.close() } catch (ex: Exception) {}
            null
        }
    }

    private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val height = options.outHeight
        val width = options.outWidth
        var inSampleSize = 1
        if (height > reqHeight || width > reqWidth) {
            val halfHeight = height / 2
            val halfWidth = width / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }
}
