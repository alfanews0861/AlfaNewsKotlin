package com.alfanews.telugu.utils

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await

/**
 * నోటిఫికేషన్ టాపిక్ పేర్లను (FCM Topics) సురక్షితంగా మార్చడానికి ఉపయోగించే హెల్పర్.
 * 
 * FCM టాపిక్ పేర్లలో కేవలం [a-zA-Z0-9-_.~%]+ మాత్రమే ఉండాలి. 
 * తెలుగు అక్షరాలను ఇంగ్లీష్ సురక్షిత కోడ్ (Hex) లోకి మారుస్తుంది.
 */
object NotificationHelper {

    /**
     * ఏదైనా స్ట్రింగ్‌ను FCM టాపిక్ కి సరిపోయేలా మారుస్తుంది.
     */
    fun slugify(text: String?): String {
        if (text.isNullOrBlank()) return "default"

        val sb = StringBuilder()
        for (char in text) {
            val code = char.code
            // Safe ASCII: a-z, A-Z, 0-9
            if (code in 48..57 || code in 65..90 || code in 97..122) {
                sb.append(char)
            } else {
                // Encode everything else as 4-digit hex
                sb.append(code.toString(16).padStart(4, '0'))
            }
        }
        
        val result = sb.toString()
        // FCM limit is 900, but we keep it shorter for efficiency
        return if (result.length > 80) result.substring(0, 80) else result
    }

    /**
     * Maps full/official district names used in the app to the short district names 
     * used by the weather alert system in Firestore / FCM topics.
     */
    fun getWeatherDistrictKey(district: String?): String {
        if (district.isNullOrBlank()) return "default"
        return when (district) {
            "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" -> "నెల్లూరు"
            "వైఎస్ఆర్ కడప" -> "కడప"
            "తూర్పు గోదావరి" -> "రాజమహేంద్రవరం"
            "ఎన్టీఆర్", "కృష్ణా" -> "విజయవాడ"
            else -> district
        }
    }

    fun getTopicName(prefix: String, value: String): String {
        val resolvedValue = if (prefix == "weather_alert") getWeatherDistrictKey(value) else value
        return "${prefix}_${slugify(resolvedValue)}"
    }

    /**
     * యూజర్ ప్రస్తుత జిల్లాకు మాత్రమే FCM జిల్లా టాపిక్ సబ్‌స్క్రయిబ్ అయ్యేలా చేస్తుంది.
     * పాత జిల్లా టాపిక్స్ మరియు హిస్టారికల్ జోంబీ టాపిక్స్ అన్నింటినీ అన్‌సబ్‌స్క్రయిబ్ చేస్తుంది.
     */
    suspend fun syncDistrictTopic(context: Context, newDistrict: String?) {
        val prefs = PreferenceManager.getInstance(context)
        if (!prefs.isNotificationsEnabled) return

        val messaging = FirebaseMessaging.getInstance()
        val targetTopic = if (!newDistrict.isNullOrBlank()) getTopicName("district", newDistrict) else null
        val targetWeatherTopic = if (!newDistrict.isNullOrBlank()) getTopicName("weather_alert", newDistrict) else null
        val currentSubscribedTopic = prefs.subscribedDistrictTopic

        try {
            // 1. వన్-టైమ్ స్వీప్: గతంలో యూజర్లు మార్చిన/పేరుకుపోయిన 2-3 జిల్లాల పాత టాపిక్స్ అన్నింటినీ తొలగించడం
            if (!prefs.hasCleanedStaleDistricts) {
                Constants.ALL_DISTRICTS.forEach { district ->
                    val distTopic = getTopicName("district", district)
                    val wTopic = getTopicName("weather_alert", district)
                    if (distTopic != targetTopic) {
                        try { messaging.unsubscribeFromTopic(distTopic).await() } catch (e: Exception) {}
                    }
                    if (wTopic != targetWeatherTopic) {
                        try { messaging.unsubscribeFromTopic(wTopic).await() } catch (e: Exception) {}
                    }
                }
                prefs.hasCleanedStaleDistricts = true
                android.util.Log.d("NotificationHelper", "One-time sweep: unsubscribed from all stale district topics")
            }

            // 2. యూజర్ జిల్లా మారినప్పుడు మునుపటి టాపిక్ నుండి అన్‌సబ్‌స్క్రయిబ్ చేయడం
            if (!currentSubscribedTopic.isNullOrBlank() && currentSubscribedTopic != targetTopic) {
                try { messaging.unsubscribeFromTopic(currentSubscribedTopic).await() } catch (e: Exception) {}
                android.util.Log.d("NotificationHelper", "Unsubscribed from old district topic: $currentSubscribedTopic")
            }

            // 3. ప్రస్తుత జిల్లాకు మాత్రమే సబ్‌స్క్రయిబ్ చేయడం
            if (!targetTopic.isNullOrBlank()) {
                messaging.subscribeToTopic(targetTopic).await()
                if (!targetWeatherTopic.isNullOrBlank()) {
                    try { messaging.subscribeToTopic(targetWeatherTopic).await() } catch (e: Exception) {}
                }
                prefs.subscribedDistrictTopic = targetTopic
                android.util.Log.d("NotificationHelper", "Strictly subscribed to single district topic: $targetTopic")
            } else {
                prefs.subscribedDistrictTopic = null
            }
        } catch (e: Exception) {
            android.util.Log.e("NotificationHelper", "Error in syncDistrictTopic: ${e.message}")
        }
    }
}
