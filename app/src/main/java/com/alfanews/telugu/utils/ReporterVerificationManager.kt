package com.alfanews.telugu.utils

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.alfanews.telugu.R
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.models.mandal
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * ఏదైనా మండలానికి కేటాయించిన (Assigned Mandal) విలేకరులను గుర్తించి
 * వారి పేర్ల పక్కన X.com తరహా వెరిఫైడ్ గ్రీన్ టిక్ మార్క్ బ్యాడ్జ్ చూపించడానికి మేనేజర్.
 */
object ReporterVerificationManager {

    private val _verifiedReporterIds = MutableStateFlow<Set<String>>(emptySet())
    val verifiedReporterIds: StateFlow<Set<String>> = _verifiedReporterIds.asStateFlow()

    private val _verifiedReporterNames = MutableStateFlow<Set<String>>(emptySet())
    val verifiedReporterNames: StateFlow<Set<String>> = _verifiedReporterNames.asStateFlow()

    private var listenerRegistration: ListenerRegistration? = null
    private var isStarted = false

    /**
     * యాప్ ప్రారంభమైనప్పుడు లేదా అవసరమైనప్పుడు రిపోర్టర్ల లిజనర్‌ను ప్రారంభిస్తుంది.
     */
    fun startListening() {
        if (isStarted) return
        isStarted = true

        try {
            val roles = listOf("REPORTER", "reporter", "STAFF_REPORTER", "REGIONAL_INCHARGE", 2, 2.0, "2", 3, 3.0, "3")
            listenerRegistration = FirebaseService.db.collection("users")
                .whereIn("role", roles)
                .limit(500)
                .addSnapshotListener { snapshot, error ->
                    if (error != null || snapshot == null) {
                        return@addSnapshotListener
                    }

                    val validIds = mutableSetOf<String>()
                    val validNames = mutableSetOf<String>()

                    for (doc in snapshot.documents) {
                        val isSuspended = doc.getBoolean("suspended") == true || doc.getBoolean("previouslyDowngraded") == true
                        if (isSuspended) continue

                        val roleStr = doc.get("role")?.toString()?.uppercase() ?: ""
                        if (roleStr == "SUBSCRIBER" || roleStr == "GUEST" || roleStr == "1" || roleStr == "1.0") continue

                        val mandal = (doc.getString("assignedMandal")
                            ?: doc.getString("mandal")
                            ?: doc.getString("mandalam")
                            ?: doc.getString("selectedMandal") ?: "").trim()

                        if (mandal.isNotEmpty()) {
                            validIds.add(doc.id)
                            val name = (doc.getString("name") ?: "").trim()
                            if (name.isNotEmpty() && !isExcludedAuthorName(name)) {
                                validNames.add(name.lowercase())
                            }
                        }
                    }

                    _verifiedReporterIds.value = validIds
                    _verifiedReporterNames.value = validNames
                }
        } catch (_: Exception) {
            // Silently fallback
        }
    }

    /**
     * ప్రత్యేక వ్యవస్థ ఖాతాలు, సిటిజెన్ పోస్ట్‌లకు టిక్ రాకుండా చూస్తుంది.
     */
    fun isExcludedAuthorName(name: String): Boolean {
        val lower = name.lowercase().trim()
        return lower.contains("alfa news desk") ||
                lower.contains("admin") ||
                lower.contains("సిటిజెన్") ||
                lower.contains("citizen") ||
                lower.contains("అజ్ఞాత") ||
                lower.isEmpty()
    }

    /**
     * పోస్ట్ మెటాలో రిపోర్టర్ ఐడీ లేదా పేరు ఆధారంగా మండలానికి కేటాయించబడ్డారో లేదో తనిఖీ చేస్తుంది.
     */
    fun isReporterVerified(reporterId: String?, reporterName: String?): Boolean {
        if (!isStarted) {
            startListening()
        }

        val name = reporterName?.trim() ?: ""
        if (name.isNotEmpty() && isExcludedAuthorName(name)) {
            return false
        }

        val id = reporterId?.trim() ?: ""
        if (id.isNotEmpty() && _verifiedReporterIds.value.contains(id)) {
            return true
        }

        if (name.isNotEmpty() && _verifiedReporterNames.value.contains(name.lowercase())) {
            return true
        }

        return false
    }

    /**
     * యూజర్ ప్రొఫైల్ ఆబ్జెక్ట్ ఆధారంగా తనిఖీ చేస్తుంది.
     */
    fun isUserVerified(user: User?): Boolean {
        if (user == null) return false
        if (user.role == UserRole.SUBSCRIBER || user.role == UserRole.GUEST) return false

        val mandal = (user.assignedMandal ?: user.mandal)?.trim() ?: ""
        if (mandal.isNotEmpty()) {
            return true
        }

        return isReporterVerified(user.id, user.name)
    }
}

/**
 * X.com (Twitter) శైలిలో ఆకుపచ్చ రంగు (Green Color) వెరిఫైడ్ టిక్ బ్యాడ్జ్.
 */
@Composable
fun VerifiedBadge(
    modifier: Modifier = Modifier,
    size: Dp = 14.dp
) {
    Icon(
        painter = painterResource(id = R.drawable.ic_verified_badge),
        contentDescription = "Verified Mandal Reporter",
        tint = Color.Unspecified,
        modifier = modifier.size(size)
    )
}
