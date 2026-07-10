package com.alfanews.telugu.utils

import java.text.SimpleDateFormat
import java.util.*

/**
 * సమయం మరియు తేదీలకు సంబంధించిన ఉపయోగకరమైన ఫంక్షన్లు.
 * అన్ని సమయాలను IST (Asia/Kolkata) లో చూపిస్తుంది.
 */
object DateTimeUtils {
    
    private const val IST_TIMEZONE = "Asia/Kolkata"
    
    /**
     * కావలసిన ఫార్మాట్ లో SimpleDateFormat ని రిటర్న్ చేస్తుంది (IST Timezone తో).
     */
    fun getSimpleDateFormat(pattern: String, locale: Locale = Locale.getDefault()): SimpleDateFormat {
        return SimpleDateFormat(pattern, locale).apply {
            timeZone = TimeZone.getTimeZone(IST_TIMEZONE)
        }
    }

    /**
     * టైమ్‌స్టాంప్‌ను ఫార్మాట్ చేసిన స్ట్రింగ్‌గా మారుస్తుంది.
     */
    fun formatTimestamp(timestamp: Long, pattern: String, locale: Locale = Locale.getDefault()): String {
        return getSimpleDateFormat(pattern, locale).format(Date(timestamp))
    }
}
