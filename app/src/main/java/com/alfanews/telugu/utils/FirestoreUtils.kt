package com.alfanews.telugu.utils

import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.google.firebase.firestore.DocumentSnapshot

/**
 * Safely deserializes a Firestore DocumentSnapshot to a User object.
 *
 * This function explicitly handles the role field conversion from String to Enum,
 * preventing deserialization failures that could result in incorrect role defaults.
 *
 * ✅ Fixes issue: Admins being shown as Guests
 */
private fun DocumentSnapshot.getAsLongSafe(field: String): Long? {
    val value = this.get(field) ?: return null
    return when (value) {
        is Number -> value.toLong()
        is com.google.firebase.Timestamp -> value.toDate().time
        is String -> value.toLongOrNull()
        else -> null
    }
}

fun DocumentSnapshot.toUserObject(): User? {
    return try {
        val rawRole = this.get("role")
        val parsedRole = UserRole.fromString(rawRole)
        val mandalFallback = this.getString("assignedMandal") 
            ?: this.getString("mandal") 
            ?: this.getString("mandalam") 
            ?: this.getString("selectedMandal")

        // Try automatic deserialization
        val baseUser = try {
            this.toObject(User::class.java)
        } catch (e: Exception) {
            null
        }

        if (baseUser != null) {
            baseUser.copy(
                id = this.id,
                role = parsedRole,
                assignedMandal = baseUser.assignedMandal ?: mandalFallback,
                lastPostTimestamp = baseUser.lastPostTimestamp ?: getAsLongSafe("lastPostTimestamp"),
                lastWarningDate = baseUser.lastWarningDate ?: getAsLongSafe("lastWarningDate"),
                lastTokenUpdate = baseUser.lastTokenUpdate ?: getAsLongSafe("lastTokenUpdate")
            )
        } else {
            User(
                id = this.id,
                name = this.getString("name") ?: this.getString("displayName") ?: "User",
                email = this.getString("email"),
                phone = this.getString("phone"),
                photoUrl = this.getString("photoUrl"),
                role = parsedRole,
                address = this.getString("address"),
                district = this.getString("district"),
                pushEnabled = this.getBoolean("pushEnabled") ?: true,
                constituency = this.getString("constituency"),
                state = this.getString("state"),
                promotedBy = this.getString("promotedBy"),
                referredBy = this.getString("referredBy"),
                referralCount = getAsLongSafe("referralCount")?.toInt() ?: 0,
                signatureUrl = this.getString("signatureUrl"),
                idCardUrl = this.getString("idCardUrl"),
                assignedMandal = mandalFallback,
                assignedDistricts = (this.get("assignedDistricts") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                fcmTokens = (this.get("fcmTokens") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                lastTokenUpdate = getAsLongSafe("lastTokenUpdate"),
                points = getAsLongSafe("points")?.toInt() ?: 0,
                badges = (this.get("badges") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                categoryScores = (this.get("categoryScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                reporterScores = (this.get("reporterScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                tagScores = (this.get("tagScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                peopleScores = (this.get("peopleScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                organizationScores = (this.get("organizationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                locationScores = (this.get("locationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                warningLevel = getAsLongSafe("warningLevel")?.toInt() ?: 0,
                lastWarningDate = getAsLongSafe("lastWarningDate"),
                inProbation = this.getBoolean("inProbation") ?: false,
                lastPostTimestamp = getAsLongSafe("lastPostTimestamp")
            )
        }
    } catch (fallbackError: Exception) {
        null
    }
}

