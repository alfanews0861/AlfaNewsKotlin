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
     * Maps town/city names, regional aliases, and alternative spellings to official district names.
     * Keeps topic naming 100% in sync with backend notification_engine.ts.
     */
    fun getCanonicalDistrict(district: String?): String {
        if (district.isNullOrBlank()) return "default"
        val clean = district.trim()
        return when {
            clean.contains("విజయవాడ") || clean.equals("NTR", ignoreCase = true) || clean.equals("Vijayawada", ignoreCase = true) -> "ఎన్టీఆర్"
            clean.contains("రాజమండ్రి") || clean.contains("రాజమహేంద్రవరం") || clean.contains("తూర్పుగోదావరి") || clean.equals("East Godavari", ignoreCase = true) -> "తూర్పు గోదావరి"
            clean.contains("అమలాపురం") || clean.contains("కోనసీమ") || clean.contains("Konaseema", ignoreCase = true) -> "కోనసీమ"
            clean.contains("నెల్లూరు") || clean.contains("Nellore", ignoreCase = true) -> "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు"
            clean.contains("కడప") || clean.contains("Kadapa", ignoreCase = true) -> "వైఎస్ఆర్ కడప"
            clean.contains("రాయచోటి") || clean.contains("Annamayya", ignoreCase = true) -> "అన్నమయ్య"
            clean.contains("సత్యసాయి") || clean.contains("పుట్టపర్తి") || clean.contains("Sathya Sai", ignoreCase = true) -> "శ్రీ సత్యసాయి"
            clean.contains("ఒంగోలు") || clean.contains("Prakasam", ignoreCase = true) -> "ప్రకాశం"
            clean.contains("పాడేరు") || clean.contains("అల్లూరి") || clean.contains("Alluri", ignoreCase = true) -> "అల్లూరి సీతారామరాజు"
            clean.contains("నరసరావుపేట") || clean.contains("Palnadu", ignoreCase = true) -> "పల్నాడు"
            clean.contains("మన్యం") || clean.contains("పార్వతీపురం") || clean.contains("Parvathipuram", ignoreCase = true) -> "పార్వతీపురం మన్యం"
            clean.contains("మచిలీపట్నం") || clean.contains("Krishna", ignoreCase = true) -> "కృష్ణా"
            clean.contains("భీమవరం") || clean.contains("పశ్చిమగోదావరి") || clean.equals("West Godavari", ignoreCase = true) -> "పశ్చిమ గోదావరి"
            clean.contains("తిరుమల") || clean.contains("Tirupati", ignoreCase = true) -> "తిరుపతి"
            clean.contains("విశాఖ") || clean.contains("వైజాగ్") || clean.contains("Vizag", ignoreCase = true) || clean.contains("Visakhapatnam", ignoreCase = true) -> "విశాఖపట్నం"
            clean.contains("హైదరాబాద్") || clean.contains("సికింద్రాబాద్") || clean.contains("సైబరాబాద్") || clean.equals("Hyderabad", ignoreCase = true) -> "హైదరాబాద్"
            clean.contains("కొత్తగూడెం") || clean.contains("భద్రాద్రి") || clean.contains("Kothagudem", ignoreCase = true) -> "భద్రాద్రి కొత్తగూడెం"
            clean.contains("భూపాలపల్లి") || clean.contains("జయశంకర్") || clean.contains("Bhupalpally", ignoreCase = true) -> "జయశంకర్ భూపాలపల్లి"
            clean.contains("గద్వాల") || clean.contains("జోగులాంబ") || clean.contains("Gadwal", ignoreCase = true) -> "జోగులాంబ గద్వాల"
            clean.contains("ఆసిఫాబాద్") || clean.contains("కుమ్రం") || clean.contains("Asifabad", ignoreCase = true) -> "కుమ్రం భీమ్ ఆసిఫాబాద్"
            clean.contains("మహబూబ్‌నగర్") || clean.contains("Mahabubnagar", ignoreCase = true) -> "మహబూబ్ నగర్"
            clean.contains("సిరిసిల్ల") || clean.contains("రాజన్న") || clean.contains("Sircilla", ignoreCase = true) -> "రాజన్న సిరిసిల్ల"
            clean.contains("హనుమకొండ") || clean.contains("వరంగల్ అర్బన్") || clean.contains("Hanamkonda", ignoreCase = true) -> "హన్మకొండ"
            clean.contains("వరంగల్ రూరల్") || clean.contains("Warangal", ignoreCase = true) -> "వరంగల్"
            clean.contains("భువనగిరి") || clean.contains("యాదాద్రి") || clean.contains("Yadadri", ignoreCase = true) -> "యాదాద్రి భువనగిరి"
            clean.contains("నల్లగొండ") || clean.contains("Nalgonda", ignoreCase = true) -> "నల్గొండ"
            clean.contains("నాగర్‌కర్నూల్") || clean.contains("Nagarkurnool", ignoreCase = true) -> "నాగర్ కర్నూల్"
            clean.contains("మేడ్చల్") || clean.contains("మల్కాజిగిరి") || clean.contains("Medchal", ignoreCase = true) -> "మేడ్చల్ మల్కాజిగిరి"
            else -> clean
        }
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
        val resolvedValue = when (prefix) {
            "weather_alert" -> getWeatherDistrictKey(value)
            "district" -> getCanonicalDistrict(value)
            else -> value
        }
        return "${prefix}_${slugify(resolvedValue)}"
    }

    /**
     * యూజర్ ప్రస్తుత జిల్లాకు మాత్రమే FCM జిల్లా టాపిక్ సబ్‌స్క్రయిబ్ అయ్యేలా చేస్తుంది.
     * పాత జిల్లా టాపిక్స్ మరియు హిస్టారికల్ జోంబీ టాపిక్స్ అన్నింటినీ అన్‌సబ్‌స్క్రయిబ్ చేస్తుంది.
     */
    suspend fun syncDistrictTopic(context: Context, newDistrict: String?) {
        val prefs = PreferenceManager.getInstance(context)
        val messaging = FirebaseMessaging.getInstance()
        val canonicalDistrict = if (!newDistrict.isNullOrBlank()) getCanonicalDistrict(newDistrict) else null
        val targetTopic = if (!canonicalDistrict.isNullOrBlank()) getTopicName("district", canonicalDistrict) else null
        val targetWeatherTopic = if (!canonicalDistrict.isNullOrBlank()) getTopicName("weather_alert", canonicalDistrict) else null
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
                android.util.Log.d("NotificationHelper", "One-time sweep: cleanly unsubscribed from all stale district topics")
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
                android.util.Log.d("NotificationHelper", "Strictly subscribed to canonical district topic: $targetTopic ($canonicalDistrict)")
            } else {
                prefs.subscribedDistrictTopic = null
            }
        } catch (e: Exception) {
            android.util.Log.e("NotificationHelper", "Error in syncDistrictTopic: ${e.message}")
        }
    }
}
