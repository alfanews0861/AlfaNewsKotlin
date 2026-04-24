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
fun DocumentSnapshot.toUserObject(): User? {
    return try {
        // Extract role explicitly as a string first to avoid enum deserialization issues
        val roleStr = this.getString("role") ?: "SUBSCRIBER"
        val parsedRole = try {
            UserRole.valueOf(roleStr.uppercase())
        } catch (e: Exception) {
            UserRole.SUBSCRIBER
        }

        // Attempt automatic deserialization first
        val baseUser = this.toObject(User::class.java)
        baseUser?.copy(
            id = this.id,
            role = parsedRole
        )
    } catch (e: Exception) {
        // Fallback to manual mapping if automatic deserialization fails
        try {
            val roleStr = this.getString("role") ?: "SUBSCRIBER"
            val parsedRole = try {
                UserRole.valueOf(roleStr.uppercase())
            } catch (ex: Exception) {
                UserRole.SUBSCRIBER
            }

            User(
                id = this.id,
                name = this.getString("name") ?: "User",
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
                signatureUrl = this.getString("signatureUrl"),
                idCardUrl = this.getString("idCardUrl"),
                assignedMandal = this.getString("assignedMandal"),
                assignedDistricts = (this.get("assignedDistricts") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                fcmTokens = (this.get("fcmTokens") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                lastTokenUpdate = this.getLong("lastTokenUpdate"),
                categoryScores = (this.get("categoryScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                reporterScores = (this.get("reporterScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                tagScores = (this.get("tagScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                peopleScores = (this.get("peopleScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                organizationScores = (this.get("organizationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                locationScores = (this.get("locationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap()
            )
        } catch (fallbackError: Exception) {
            null
        }
    }
}

