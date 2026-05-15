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
        private const val KEY_RATING_DIALOG_SHOWN_COUNT = "key_rating_dialog_shown_count"
        private const val KEY_LAST_RATING_DIALOG_TIME = "key_last_rating_dialog_time"
        private const val KEY_NOTIFICATIONS_ENABLED = "key_notifications_enabled"
        private const val KEY_IS_LEGACY_CACHE_CLEARED = "key_is_legacy_cache_cleared"
        private const val KEY_CACHE_VERSION = "key_cache_version"
        private const val KEY_LOCAL_PLACE = "key_local_place"
        private const val KEY_LAST_LAT = "key_last_lat"
        private const val KEY_LAST_LON = "key_last_lon"
        private const val KEY_USER_ID = "key_user_id"
        private const val KEY_USER_NAME = "key_user_name"
        private const val KEY_USER_ROLE = "key_user_role"
        private const val KEY_USER_DISTRICT = "key_user_district"

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

    var ratingDialogShownCount: Int
        get() = prefs.getInt(KEY_RATING_DIALOG_SHOWN_COUNT, 0)
        set(value) {
            prefs.edit().putInt(KEY_RATING_DIALOG_SHOWN_COUNT, value).apply()
        }

    var lastRatingDialogTime: Long
        get() = prefs.getLong(KEY_LAST_RATING_DIALOG_TIME, 0L)
        set(value) {
            prefs.edit().putLong(KEY_LAST_RATING_DIALOG_TIME, value).apply()
        }

    var isNotificationsEnabled: Boolean
        get() = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
        set(value) {
            prefs.edit().putBoolean(KEY_NOTIFICATIONS_ENABLED, value).apply()
        }

    /** పాత (Legacy) కాష్ డేటా క్లియర్ అయిందో లేదో తనిఖీ చేస్తుంది. */
    var isLegacyCacheCleared: Boolean
        get() = prefs.getBoolean(KEY_IS_LEGACY_CACHE_CLEARED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_IS_LEGACY_CACHE_CLEARED, value).apply()
        }

    /** కాష్ వెర్షన్ - దీన్ని పెంచడం ద్వారా అందరికీ కాష్ క్లియర్ చేయవచ్చు. */
    var cacheVersion: Int
        get() = prefs.getInt(KEY_CACHE_VERSION, 0)
        set(value) {
            prefs.edit().putInt(KEY_CACHE_VERSION, value).apply()
        }

    /** యూజర్ ప్రస్తుత స్థానం (మండలం/ఊరు) - వాతావరణం కోసం. */
    var localPlace: String?
        get() = prefs.getString(KEY_LOCAL_PLACE, null)
        set(value) {
            prefs.edit().putString(KEY_LOCAL_PLACE, value).apply()
        }

    var lastLat: Double
        get() = prefs.getFloat(KEY_LAST_LAT, 0f).toDouble()
        set(value) {
            prefs.edit().putFloat(KEY_LAST_LAT, value.toFloat()).apply()
        }

    var lastLon: Double
        get() = prefs.getFloat(KEY_LAST_LON, 0f).toDouble()
        set(value) {
            prefs.edit().putFloat(KEY_LAST_LON, value.toFloat()).apply()
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

    /** యూజర్ ప్రొఫైల్ వివరాలను లోకల్‌గా సేవ్ చేయడం (Offline Persistence కోసం) */
    var userId: String?
        get() = prefs.getString(KEY_USER_ID, null)
        set(value) = prefs.edit().putString(KEY_USER_ID, value).apply()

    var userName: String?
        get() = prefs.getString(KEY_USER_NAME, null)
        set(value) = prefs.edit().putString(KEY_USER_NAME, value).apply()

    var userRole: String?
        get() = prefs.getString(KEY_USER_ROLE, "SUBSCRIBER")
        set(value) = prefs.edit().putString(KEY_USER_ROLE, value).apply()

    var userDistrict: String?
        get() = prefs.getString(KEY_USER_DISTRICT, null)
        set(value) = prefs.edit().putString(KEY_USER_DISTRICT, value).apply()

    fun clearUserData() {
        prefs.edit().remove(KEY_USER_ID).remove(KEY_USER_NAME).remove(KEY_USER_ROLE).remove(KEY_USER_DISTRICT).apply()
    }
}
