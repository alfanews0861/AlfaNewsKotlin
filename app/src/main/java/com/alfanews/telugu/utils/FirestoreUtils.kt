package com.alfanews.telugu.utils

import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.google.firebase.firestore.DocumentSnapshot

/**
 * Safely deserializes a Firestore DocumentSnapshot to a User object.
 *
 * Explicitly handles role conversion, mixed Timestamp/Long fields,
 * and the canonical nested `reporterActivity` map so Android stays 100% consistent
 * with Cloud Functions and Web Admin.
 */
private fun parseEpochMsSafe(value: Any?): Long? {
    if (value == null) return null
    return when (value) {
        is Number -> {
            val v = value.toLong()
            if (v <= 0L) null else if (v > 100_000_000_000L) v else v * 1000L
        }
        is com.google.firebase.Timestamp -> value.toDate().time
        is java.util.Date -> value.time
        is String -> {
            val trimmed = value.trim()
            val num = trimmed.toLongOrNull()
            if (num != null && num > 0L) {
                if (num > 100_000_000_000L) num else num * 1000L
            } else null
        }
        else -> null
    }
}

private fun DocumentSnapshot.getAsLongSafe(field: String): Long? {
    return parseEpochMsSafe(this.get(field))
}

fun DocumentSnapshot.toUserObject(): User? {
    return try {
        val rawRole = this.get("role")
        val parsedRole = UserRole.fromString(rawRole)
        val mandalFallback = this.getString("assignedMandal")
            ?: this.getString("mandal")
            ?: this.getString("mandalam")
            ?: this.getString("selectedMandal")

        // Parse canonical reporterActivity map safely
        val activityMap = this.get("reporterActivity") as? Map<*, *>
        val activityTotal = (activityMap?.get("totalApprovedPosts") as? Number)?.toInt()
        val docTotal = (this.get("totalNewsCount") as? Number)?.toInt()
        val resolvedTotalNews = maxOf(activityTotal ?: 0, docTotal ?: 0)

        val activityLastPost = parseEpochMsSafe(activityMap?.get("lastApprovedPostAt"))
        val docLastPost = getAsLongSafe("lastPostTimestamp")
        val resolvedLastPost = when {
            activityLastPost != null && docLastPost != null -> maxOf(activityLastPost, docLastPost)
            activityLastPost != null -> activityLastPost
            else -> docLastPost
        }

        val parsedDailyCounts: Map<String, Int> = (activityMap?.get("dailyCounts") as? Map<*, *>)
            ?.mapNotNull { (k, v) ->
                val key = k?.toString()?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                val count = (v as? Number)?.toInt() ?: return@mapNotNull null
                if (count > 0) key to count else null
            }?.toMap() ?: emptyMap()

        val exemptFromInactivity = this.getBoolean("exemptFromInactivity") ?: false
        val parsedStage = (activityMap?.get("inactivityStage") as? String)?.takeIf { it.isNotBlank() }
            ?: if (exemptFromInactivity) "EXEMPT" else "ACTIVE"
        val lastReminderSentAt = parseEpochMsSafe(activityMap?.get("lastReminderSentAt"))
        val promotedAt = getAsLongSafe("promotedAt")
        val rejoinedAt = getAsLongSafe("rejoinedAt")
        val createdAt = getAsLongSafe("createdAt") ?: getAsLongSafe("joinedAt") ?: getAsLongSafe("timestamp")

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
                lastPostTimestamp = resolvedLastPost ?: baseUser.lastPostTimestamp,
                lastWarningDate = baseUser.lastWarningDate ?: getAsLongSafe("lastWarningDate"),
                lastTokenUpdate = baseUser.lastTokenUpdate ?: getAsLongSafe("lastTokenUpdate"),
                totalNewsCount = maxOf(resolvedTotalNews, baseUser.totalNewsCount),
                exemptFromInactivity = exemptFromInactivity,
                inactivityStage = parsedStage,
                dailyCounts = parsedDailyCounts,
                lastReminderSentAt = lastReminderSentAt,
                promotedAt = promotedAt,
                rejoinedAt = rejoinedAt,
                createdAt = createdAt
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
                pushEnabled = this.getBoolean("pushEnabled") ?: this.getBoolean("notificationsEnabled") ?: true,
                constituency = this.getString("constituency"),
                state = this.getString("state"),
                promotedBy = this.getString("promotedBy"),
                referredBy = this.getString("referredBy"),
                referralCount = (this.get("referralCount") as? Number)?.toInt() ?: 0,
                signatureUrl = this.getString("signatureUrl"),
                idCardUrl = this.getString("idCardUrl"),
                assignedMandal = mandalFallback,
                assignedDistricts = (this.get("assignedDistricts") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                fcmTokens = (this.get("fcmTokens") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                lastTokenUpdate = getAsLongSafe("lastTokenUpdate"),
                points = (this.get("points") as? Number)?.toInt() ?: 0,
                badges = (this.get("badges") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                categoryScores = (this.get("categoryScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                reporterScores = (this.get("reporterScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                tagScores = (this.get("tagScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                peopleScores = (this.get("peopleScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                organizationScores = (this.get("organizationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                locationScores = (this.get("locationScores") as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { (it.value as? Number)?.toInt() ?: 0 } ?: emptyMap(),
                warningLevel = (this.get("warningLevel") as? Number)?.toInt() ?: 0,
                lastWarningDate = getAsLongSafe("lastWarningDate"),
                inProbation = this.getBoolean("inProbation") ?: false,
                lastPostTimestamp = resolvedLastPost,
                totalNewsCount = resolvedTotalNews,
                exemptFromInactivity = exemptFromInactivity,
                inactivityStage = parsedStage,
                dailyCounts = parsedDailyCounts,
                lastReminderSentAt = lastReminderSentAt,
                promotedAt = promotedAt,
                rejoinedAt = rejoinedAt,
                createdAt = createdAt
            )
        }
    } catch (fallbackError: Exception) {
        null
    }
}
