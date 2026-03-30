package com.alfanews.telugu.models

/**
 * అప్లికేషన్‌లోని వినియోగదారుల రకాలను (Roles) నిర్వచిస్తుంది.
 */
enum class UserRole {
    GUEST, SUBSCRIBER, REPORTER, REGIONAL_INCHARGE, EDITOR, ADMIN
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
    val locationScores: Map<String, Int> = emptyMap()
)
