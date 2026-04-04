package com.alfanews.telugu.utils

import android.content.Context
import android.content.SharedPreferences
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.ThemeMode

/**
 * అప్లికేషన్ యొక్క [SharedPreferences]ని నిర్వహిస్తుంది.
 */
class PreferenceManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("alfa_news_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_LANGUAGE = "key_language"
        private const val KEY_THEME_MODE = "key_theme_mode"
        private const val KEY_SELECTED_DISTRICT = "key_selected_district"
        private const val KEY_DETECTED_DISTRICT = "key_detected_district"
        private const val KEY_NEWS_INTERESTS = "key_news_interests"
        private const val KEY_SHOULD_SHOW_ONBOARDING = "key_should_show_onboarding"
        private const val KEY_APP_OPEN_COUNT = "key_app_open_count"
        private const val KEY_HAS_RATED = "key_has_rated"
        private const val KEY_NOTIFICATIONS_ENABLED = "key_notifications_enabled"

        @Volatile
        private var INSTANCE: PreferenceManager? = null

        fun getInstance(context: Context): PreferenceManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: PreferenceManager(context).also { INSTANCE = it }
            }
        }
    }

    var language: Language
        get() = try {
            val langName = prefs.getString(KEY_LANGUAGE, Language.TELUGU.name)
            if (langName != null) Language.valueOf(langName) else Language.TELUGU
        } catch (e: Exception) {
            Language.TELUGU
        }
        set(value) {
            prefs.edit().putString(KEY_LANGUAGE, value.name).apply()
        }

    var themeMode: ThemeMode
        get() = try {
            val modeName = prefs.getString(KEY_THEME_MODE, ThemeMode.SYSTEM.name)
            if (modeName != null) ThemeMode.valueOf(modeName) else ThemeMode.SYSTEM
        } catch (e: Exception) {
            ThemeMode.SYSTEM
        }
        set(value) {
            prefs.edit().putString(KEY_THEME_MODE, value.name).apply()
        }

    /** వినియోగదారు స్వయంగా ఎంచుకున్న జిల్లా. */
    var selectedDistrict: String?
        get() = prefs.getString(KEY_SELECTED_DISTRICT, null)
        set(value) {
            prefs.edit().putString(KEY_SELECTED_DISTRICT, value).apply()
        }

    /** ఆటోమేటిక్‌గా (GPS/IP) గుర్తించబడిన జిల్లా. */
    var detectedDistrict: String?
        get() = prefs.getString(KEY_DETECTED_DISTRICT, null)
        set(value) {
            prefs.edit().putString(KEY_DETECTED_DISTRICT, value).apply()
        }

    /** 
     * ప్రస్తుత జిల్లాను అందిస్తుంది. 
     * ఎంచుకున్న జిల్లా ఉంటే అది, లేకపోతే గుర్తించిన జిల్లా, అది కూడా లేకపోతే null.
     */
    fun getEffectiveDistrict(): String? {
        return selectedDistrict ?: detectedDistrict
    }

    var shouldShowOnboarding: Boolean
        get() = prefs.getBoolean(KEY_SHOULD_SHOW_ONBOARDING, true)
        set(value) {
            prefs.edit().putBoolean(KEY_SHOULD_SHOW_ONBOARDING, value).apply()
        }

    var appOpenCount: Int
        get() = prefs.getInt(KEY_APP_OPEN_COUNT, 0)
        set(value) {
            prefs.edit().putInt(KEY_APP_OPEN_COUNT, value).apply()
        }

    var hasRated: Boolean
        get() = prefs.getBoolean(KEY_HAS_RATED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_HAS_RATED, value).apply()
        }

    var isNotificationsEnabled: Boolean
        get() = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
        set(value) {
            prefs.edit().putBoolean(KEY_NOTIFICATIONS_ENABLED, value).apply()
        }

    /**
     * జిల్లాను సులభంగా సేవ్ చేయడానికి (మొబైల్ డేటా/GPS డిటెక్షన్ తర్వాత వాడవచ్చు)
     */
    fun saveDetectedDistrict(district: String) {
        prefs.edit().putString(KEY_DETECTED_DISTRICT, district).apply()
    }

    var newsInterests: Set<String>?
        get() = prefs.getStringSet(KEY_NEWS_INTERESTS, null)
        set(value) {
            prefs.edit().putStringSet(KEY_NEWS_INTERESTS, value).apply()
        }
}
