package com.alfanews.telugu.models

/**
 * అప్లికేషన్‌లోని వినియోగదారుల రకాలను (Roles) నిర్వచిస్తుంది.
 */
enum class UserRole {
    GUEST, SUBSCRIBER, REPORTER, REGIONAL_INCHARGE, EDITOR, ADMIN, NEWS_DESK;

    companion object {
        /**
         * ఏదైనా వాల్యూ నుండి UserRole ను సురక్షితంగా మారుస్తుంది.
         * ఇది String, Number మరియు Null వాల్యూలను హ్యాండిల్ చేస్తుంది.
         */
        fun fromString(value: Any?): UserRole {
            return fromStringSafe(value) ?: SUBSCRIBER
        }

        /**
         * ఏదైనా వాల్యూ నుండి UserRole ను సురక్షితంగా మారుస్తుంది.
         * వాల్యూ తెలియకపోతే null ఇస్తుంది, తద్వారా పాత డేటాను ఓవర్‌రైట్ చేయకుండా ఉండవచ్చు.
         */
        fun fromStringSafe(value: Any?): UserRole? {
            if (value == null) return null
            
            // 1. నంబర్ అయితే ఇండెక్స్ ప్రకారం చూస్తాం
            if (value is Number) {
                val index = value.toInt()
                val allRoles = values()
                return if (index >= 0 && index < allRoles.size) allRoles[index] else null
            }

            val rawValue = value.toString().trim()
            if (rawValue.isEmpty()) return null
            
            // 2. స్ట్రింగ్‌లో ఉన్న నంబర్ అయితే (ఉదా: "2.0")
            try {
                // నంబర్‌తో మొదలైతేనే కన్వర్ట్ చేస్తాం
                if (rawValue.isNotEmpty() && (Character.isDigit(rawValue[0]) || rawValue.startsWith("-"))) {
                    val index = rawValue.toDouble().toInt()
                    val allRoles = values()
                    if (index >= 0 && index < allRoles.size) return allRoles[index]
                }
            } catch (e: Exception) { }
            
            // 3. స్ట్రింగ్ కంపారిజన్ (Common keys)
            val cleanValue = rawValue.uppercase()
            when (cleanValue) {
                "ADMIN" -> return ADMIN
                "NEWS_DESK", "NEWS DESK", "NEWSDESK" -> return NEWS_DESK
                "REPORTER" -> return REPORTER
                "EDITOR" -> return EDITOR
                "REGIONAL_INCHARGE", "REGIONAL INCHARGE", "REGIONAL_IN_CHARGE" -> return REGIONAL_INCHARGE
                "GUEST" -> return GUEST
                "SUBSCRIBER" -> return SUBSCRIBER
            }
            
            // 4. Fallback: Enum పేర్లతో డైరెక్ట్ చెక్ చేస్తాం
            for (role in values()) {
                if (role.name == cleanValue) return role
            }
            
            return null
        }
    }
}

/**
 * వినియోగదారు వివరాలను కలిగి ఉన్న డేటా క్లాస్.
 */
data class User(
    val id: String = "",
    val name: String = "",
    val email: String? = null,
    val phone: String? = null,
    val photoUrl: String? = null,
    val role: UserRole = UserRole.GUEST,
    val address: String? = null,
    val constituency: String? = null,
    val promotedBy: String? = null,
    val signatureUrl: String? = null,
    val idCardUrl: String? = null,
    val state: String? = null,
    val district: String? = null,
    val assignedMandal: String? = null, // రిపోర్టర్ కోసం కేటాయించిన మండలం
    val assignedDistricts: List<String> = emptyList(), // Regional Incharge కోసం కేటాయించిన జిల్లాలు
    val pushEnabled: Boolean = true,
    val fcmTokens: List<String> = emptyList(),
    val lastTokenUpdate: Long? = null,
    
    // ఆసక్తుల సమాచారం (Analytics Data - User Preferences)
    val categoryScores: Map<String, Int> = emptyMap(),
    val reporterScores: Map<String, Int> = emptyMap(),
    val tagScores: Map<String, Int> = emptyMap(),
    val peopleScores: Map<String, Int> = emptyMap(),
    val organizationScores: Map<String, Int> = emptyMap(),
    val locationScores: Map<String, Int> = emptyMap(),
    
    // ఇన్సెంటివ్ సిస్టమ్ ఫీల్డ్స్
    val points: Int = 0,
    val badges: List<String> = emptyList(),
    val referredBy: String? = null,
    val referralCount: Int = 0,
    
    // రిపోర్టర్ మానిటరింగ్ ఫీల్డ్స్
    val warningLevel: Int = 0,
    val lastWarningDate: Long? = null,
    val inProbation: Boolean = false,
    val lastPostTimestamp: Long? = null
)
