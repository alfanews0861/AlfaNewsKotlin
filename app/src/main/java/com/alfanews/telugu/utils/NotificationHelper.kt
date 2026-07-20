package com.alfanews.telugu.utils

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
}
