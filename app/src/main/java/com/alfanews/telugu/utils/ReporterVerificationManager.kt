package com.alfanews.telugu.utils

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
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
import com.alfanews.telugu.services.FirebaseService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * ఏదైనా మండలానికి కేటాయించిన (Assigned Mandal) విలేకరులను గుర్తించి
 * వారి పేర్ల పక్కన X.com తరహా వెరిఫైడ్ గ్రీన్ టిక్ మార్క్ బ్యాడ్జ్ చూపించడానికి మేనేజర్.
 *
 * ⚡ బిల్లింగ్ ఆప్టిమైజేషన్:
 * ప్రతి యాప్ లాంచ్ లో సర్వర్ నుండి 200 డాక్యుమెంట్లు చదవకుండా (నెలకు లక్షల రీడ్స్ ఆపడానికి),
 * విలేకరుల ఐడీలు & పేర్లను SharedPreferences లో భద్రపరుస్తుంది.
 * కేవలం 24 గంటలకు ఒకసారి మాత్రమే బ్యాక్‌గ్రౌండ్‌లో సర్వర్ నుండి తాజా లిస్ట్ తెస్తుంది.
 */
object ReporterVerificationManager {

    private val _verifiedReporterIds = MutableStateFlow<Set<String>>(emptySet())
    val verifiedReporterIds: StateFlow<Set<String>> = _verifiedReporterIds.asStateFlow()

    private val _verifiedReporterNames = MutableStateFlow<Set<String>>(emptySet())
    val verifiedReporterNames: StateFlow<Set<String>> = _verifiedReporterNames.asStateFlow()

    private var isStarted = false
    private var appContext: Context? = null

    private const val PREFS_NAME = "reporter_verification_cache"
    private const val KEY_VERIFIED_IDS = "verified_reporter_ids"
    private const val KEY_VERIFIED_NAMES = "verified_reporter_names"
    private const val KEY_LAST_FETCH_TIME = "last_fetch_time"
    private const val FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000L // 24 గంటలకు ఒకసారి మాత్రమే సర్వర్ రీడ్

    /**
     * అప్లికేషన్ ప్రారంభంలోనే కాంటెక్స్ట్‌ను రిజిస్టర్ చేసి లోకల్ కాష్ లోడ్ చేస్తుంది.
     */
    fun initialize(context: Context) {
        appContext = context.applicationContext
        loadFromPrefs()
    }

    private fun loadFromPrefs() {
        val ctx = appContext ?: return
        try {
            val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val ids = prefs.getStringSet(KEY_VERIFIED_IDS, null)
            val names = prefs.getStringSet(KEY_VERIFIED_NAMES, null)
            if (!ids.isNullOrEmpty()) {
                _verifiedReporterIds.value = ids
            }
            if (!names.isNullOrEmpty()) {
                _verifiedReporterNames.value = names
            }
        } catch (e: Exception) {
            Log.w("ReporterVerif", "Error loading from prefs: ${e.message}")
        }
    }

    /**
     * యాప్ ప్రారంభమైనప్పుడు లేదా అవసరమైనప్పుడు విలేకరుల లిస్ట్‌ను లోడ్ చేస్తుంది.
     * కాష్ అందుబాటులో ఉండి 24 గంటలు దాటకపోతే సర్వర్ కాల్ ను పూర్తిగా దాటవేస్తుంది (0 reads).
     */
    fun startListening(context: Context? = null) {
        if (context != null) {
            appContext = context.applicationContext
        }
        loadFromPrefs()

        if (isStarted) return
        isStarted = true

        val ctx = appContext
        if (ctx != null) {
            try {
                val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val lastFetch = prefs.getLong(KEY_LAST_FETCH_TIME, 0L)
                val now = System.currentTimeMillis()
                // లోకల్ కాష్ లో డేటా ఉండి, 24 గంటలు దాటకపోతే సర్వర్ రీడ్ ను నివారించడం
                if (_verifiedReporterIds.value.isNotEmpty() && (now - lastFetch < FETCH_INTERVAL_MS)) {
                    return
                }
            } catch (_: Exception) {}
        }

        fetchFromServer()
    }

    /**
     * అవసరమైనప్పుడు లేదా 24 గంటల తర్వాత సర్వర్ నుండి తాజా రిపోర్టర్ల లిస్ట్‌ను తెస్తుంది.
     */
    fun refresh(context: Context? = null) {
        if (context != null) {
            appContext = context.applicationContext
        }
        fetchFromServer()
    }

    private fun fetchFromServer() {
        try {
            val roles = listOf("REPORTER", "reporter", "STAFF_REPORTER", "REGIONAL_INCHARGE", 2, 2.0, "2", 3, 3.0, "3")
            FirebaseService.db.collection("users")
                .whereIn("role", roles)
                .limit(200)
                .get()
                .addOnSuccessListener { snapshot ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        parseAndSaveVerifiedReporters(snapshot.documents)
                    }
                }
                .addOnFailureListener { e ->
                    Log.w("ReporterVerif", "Server fetch failed, retained local cache: ${e.message}")
                }
        } catch (_: Exception) {}
    }

    private fun parseAndSaveVerifiedReporters(documents: List<com.google.firebase.firestore.DocumentSnapshot>) {
        val validIds = mutableSetOf<String>()
        val validNames = mutableSetOf<String>()

        for (doc in documents) {
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

        if (validIds.isNotEmpty()) {
            _verifiedReporterIds.value = validIds
        }
        if (validNames.isNotEmpty()) {
            _verifiedReporterNames.value = validNames
        }

        // 💾 SharedPreferences లో భద్రపరచడం (భవిష్యత్ యాప్ లాంచ్‌లలో 0 రీడ్స్ కోసం)
        try {
            appContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)?.edit()?.apply {
                putStringSet(KEY_VERIFIED_IDS, validIds)
                putStringSet(KEY_VERIFIED_NAMES, validNames)
                putLong(KEY_LAST_FETCH_TIME, System.currentTimeMillis())
                apply()
            }
        } catch (e: Exception) {
            Log.w("ReporterVerif", "Error saving to prefs: ${e.message}")
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

        val mandal = user.assignedMandal?.trim() ?: ""
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
