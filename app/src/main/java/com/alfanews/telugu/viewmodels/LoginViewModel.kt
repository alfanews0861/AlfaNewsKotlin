package com.alfanews.telugu.viewmodels

import android.app.Activity
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.R
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.FirebaseException
import com.google.firebase.auth.AuthCredential
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.utils.PreferenceManager
import com.google.firebase.Timestamp
import java.util.concurrent.TimeUnit


data class LoginUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isLoginSuccessful: Boolean = false,
    val isNewUser: Boolean = false
)

class LoginViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private var verificationId: String? = null
    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null

    private suspend fun createNewUserProfile(
        user: FirebaseUser,
        name: String,
        context: Context
    ) {
        val userRef = FirebaseService.db.collection("users").document(user.uid)
        val prefs = PreferenceManager.getInstance(context)
        val referredBy = prefs.referredBy

        val isAdmin = (user.phoneNumber?.contains("9173811009") == true) ||
                      (user.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true)
        val defaultRole = if (isAdmin) "ADMIN" else "SUBSCRIBER"
        val defaultName = if (isAdmin) "శ్రీకాంత్ రెడ్డి" else context.getString(R.string.user_default_name)

        val userData = hashMapOf<String, Any?>(
            "name" to name.ifEmpty { defaultName },
            "email" to user.email,
            "phone" to user.phoneNumber,
            "role" to defaultRole,
            "createdAt" to Timestamp.now()
        )
        if (!referredBy.isNullOrEmpty() && referredBy != user.uid) {
            userData["referredBy"] = referredBy
        }
        userRef.set(userData, com.google.firebase.firestore.SetOptions.merge()).await()
    }

    fun signInWithCredential(credential: AuthCredential, context: Context) {
        val prefs = com.alfanews.telugu.utils.PreferenceManager.getInstance(context)
        viewModelScope.launch {
            _uiState.value = LoginUiState(isLoading = true)
            try {
                val authResult = FirebaseService.auth.signInWithCredential(credential).await()
                val user = authResult.user ?: throw Exception("అథెంటికేషన్ విఫలమైంది: యూజర్ దొరకలేదు.")

                val phone = user.phoneNumber
                val email = user.email
                val isAdmin = (phone?.contains("9173811009") == true) ||
                              (email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true)

                // 🚀 PRE-CACHE immediately for instant offline persistence & login UX
                prefs.userId = user.uid
                if (user.displayName?.isNotEmpty() == true) prefs.userName = user.displayName
                if (isAdmin) prefs.userRole = "ADMIN"
                if (!phone.isNullOrEmpty()) prefs.userPhone = phone

                var isNewUser = false
                try {
                    val userRef = FirebaseService.db.collection("users").document(user.uid)
                    var existingUserDoc = kotlinx.coroutines.withTimeoutOrNull(10000L) {
                        try {
                            userRef.get().await()
                        } catch (e: Exception) {
                            null
                        }
                    }
                    if (existingUserDoc == null) {
                        try {
                            val cached = userRef.get(com.google.firebase.firestore.Source.CACHE).await()
                            if (cached.exists()) existingUserDoc = cached
                        } catch (_: Exception) {}
                    }

                    if (existingUserDoc != null && !existingUserDoc.exists()) {
                        isNewUser = true
                        // 🔍 RESILIENCE Check: Look for user by phone (both +91 and 10-digit formats) or email
                        var foundLegacyUser = false
                        var legacyRole = if (isAdmin) "ADMIN" else "SUBSCRIBER"
                        
                        val clean10Digit = phone?.replace("+91", "")?.trim()
                        val fullWith91 = if (phone != null && phone.startsWith("+91")) phone else if (!clean10Digit.isNullOrEmpty()) "+91$clean10Digit" else null
                        
                        // 1. Search by 10-digit phone and +91 phone across both phone & phoneNumber fields
                        val searchPhones = listOfNotNull(clean10Digit, fullWith91).filter { it.length >= 10 }.distinct()
                        for (p in searchPhones) {
                            if (foundLegacyUser) break
                            try {
                                val legacyDocs = kotlinx.coroutines.withTimeoutOrNull(8000L) {
                                    val snap1 = FirebaseService.db.collection("users").whereEqualTo("phone", p).get().await()
                                    if (!snap1.isEmpty) snap1 else FirebaseService.db.collection("users").whereEqualTo("phoneNumber", p).get().await()
                                }
                                if (legacyDocs != null && !legacyDocs.isEmpty) {
                                    val legacyDoc = legacyDocs.documents.first()
                                    val legacyData = legacyDoc.data
                                    val rawLegacyRole = legacyData?.get("role")
                                    val legacyMandal = legacyData?.get("assignedMandal") as? String
                                    val legacyLastKnown = legacyData?.get("lastKnownMandal") as? String
                                    val hasReporterAttrs = legacyMandal?.isNotBlank() == true ||
                                            legacyLastKnown?.isNotBlank() == true ||
                                            legacyData?.get("previouslyDowngraded") == true ||
                                            legacyData?.get("downgradedReason") != null ||
                                            ((legacyData?.get("points") as? Number)?.toInt() ?: 0) > 0 ||
                                            legacyDoc.getBoolean("isProtectedSenior") == true
                                    val parsedLegacyRole = if (isAdmin) {
                                        UserRole.ADMIN
                                    } else if (hasReporterAttrs) {
                                        UserRole.REPORTER
                                    } else {
                                        UserRole.fromStringSafe(rawLegacyRole) ?: UserRole.SUBSCRIBER
                                    }
                                    legacyRole = parsedLegacyRole.name
                                    
                                    val updatedLegacyData = legacyData?.toMutableMap() ?: mutableMapOf()
                                    updatedLegacyData["lastLogin"] = Timestamp.now()
                                    updatedLegacyData["role"] = legacyRole
                                    if (hasReporterAttrs) {
                                        updatedLegacyData["previouslyDowngraded"] = false
                                        updatedLegacyData["suspended"] = false
                                        updatedLegacyData["warningLevel"] = 0
                                        updatedLegacyData.remove("downgradedReason")
                                        updatedLegacyData.remove("downgradedAt")
                                        updatedLegacyData.remove("downgradedBy")
                                        if (legacyMandal.isNullOrBlank() && !legacyLastKnown.isNullOrBlank() && legacyLastKnown.contains("|")) {
                                            val parts = legacyLastKnown.split("|")
                                            if (parts.size >= 2) {
                                                updatedLegacyData["district"] = parts[0]
                                                updatedLegacyData["assignedMandal"] = parts[1]
                                                updatedLegacyData["mandal"] = parts[1]
                                            }
                                        }
                                    }
                                    userRef.set(updatedLegacyData, com.google.firebase.firestore.SetOptions.merge()).await()
                                    val legacyName = legacyDoc.getString("name")?.trim()
                                    if (!legacyName.isNullOrBlank() && !legacyName.equals("User", ignoreCase = true) && !legacyName.equals("యూజర్", ignoreCase = true)) {
                                        prefs.userName = legacyName
                                    } else if (hasReporterAttrs) {
                                        prefs.userName = "విలేకరి"
                                    }
                                    foundLegacyUser = true
                                }
                            } catch (e: Exception) {
                                android.util.Log.e("LoginViewModel", "Legacy search by phone failed: ${e.message}")
                            }
                        }

                        // 1b. Check reporter_applications if user profile not found
                        if (!foundLegacyUser) {
                            for (p in searchPhones) {
                                if (foundLegacyUser) break
                                try {
                                    val appDocs = kotlinx.coroutines.withTimeoutOrNull(8000L) {
                                        val snapApp1 = FirebaseService.db.collection("reporter_applications").whereEqualTo("phone", p).get().await()
                                        if (!snapApp1.isEmpty) snapApp1 else FirebaseService.db.collection("reporter_applications").whereEqualTo("phoneNumber", p).get().await()
                                    }
                                    val validApp = appDocs?.documents?.firstOrNull { 
                                        val status = it.getString("status")?.uppercase()
                                        status == "JOINED" || status == "APPROVED" || status == "SUSPENDED"
                                    }
                                    if (validApp != null) {
                                        legacyRole = "REPORTER"
                                        val appDist = validApp.getString("district") ?: ""
                                        val appMandal = validApp.getString("assignedMandal") ?: validApp.getString("mandal") ?: ""
                                        val resolvedRepName = validApp.getString("fullName") ?: validApp.getString("name") ?: user.displayName ?: "విలేకరి"
                                        val repData = mutableMapOf<String, Any?>(
                                            "name" to resolvedRepName,
                                            "phone" to (user.phoneNumber ?: p),
                                            "role" to "REPORTER",
                                            "district" to appDist,
                                            "assignedMandal" to appMandal,
                                            "mandal" to appMandal,
                                            "warningLevel" to 0,
                                            "inProbation" to false,
                                            "previouslyDowngraded" to false,
                                            "lastLogin" to Timestamp.now()
                                        )
                                        userRef.set(repData, com.google.firebase.firestore.SetOptions.merge()).await()
                                        prefs.userName = resolvedRepName
                                        foundLegacyUser = true
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e("LoginViewModel", "Reporter application search failed: ${e.message}")
                                }
                            }
                        }

                        // 2. Search by email if not found yet
                        if (!foundLegacyUser && !email.isNullOrBlank()) {
                            try {
                                val emailDocs = kotlinx.coroutines.withTimeoutOrNull(8000L) {
                                    FirebaseService.db.collection("users")
                                        .whereEqualTo("email", email.trim().lowercase())
                                        .get().await()
                                }
                                if (emailDocs != null && !emailDocs.isEmpty) {
                                    val legacyDoc = emailDocs.documents.first()
                                    val legacyData = legacyDoc.data
                                    val rawLegacyRole = legacyData?.get("role")
                                    val parsedLegacyRole = if (isAdmin) UserRole.ADMIN else (UserRole.fromStringSafe(rawLegacyRole) ?: UserRole.SUBSCRIBER)
                                    legacyRole = parsedLegacyRole.name
                                    
                                    val updatedLegacyData = legacyData?.toMutableMap() ?: mutableMapOf()
                                    updatedLegacyData["lastLogin"] = Timestamp.now()
                                    if (isAdmin) {
                                        updatedLegacyData["role"] = "ADMIN"
                                    }
                                    userRef.set(updatedLegacyData, com.google.firebase.firestore.SetOptions.merge()).await()
                                    val legacyName = legacyDoc.getString("name")?.trim()
                                    if (!legacyName.isNullOrBlank() && !legacyName.equals("User", ignoreCase = true)) {
                                        prefs.userName = legacyName
                                    }
                                    foundLegacyUser = true
                                }
                            } catch (e: Exception) {
                                android.util.Log.e("LoginViewModel", "Legacy search by email failed: ${e.message}")
                            }
                        }

                        if (!foundLegacyUser) {
                            try {
                                createNewUserProfile(user = user, name = user.displayName ?: "", context = context)
                            } catch (e: Exception) {
                                android.util.Log.e("LoginViewModel", "Create profile failed: ${e.message}")
                            }
                        }
                        
                        // Update cache with resolved legacy role
                        prefs.userRole = legacyRole
                    } else if (existingUserDoc != null && existingUserDoc.exists()) {
                        // EXISTING USER: Only update metadata, NEVER downgrade role
                        val rawRole = existingUserDoc.get("role")
                        val assignedMandal = existingUserDoc.getString("assignedMandal")?.takeIf { it.isNotBlank() }
                            ?: existingUserDoc.getString("mandal")?.takeIf { it.isNotBlank() }
                        val points = (existingUserDoc.get("points") as? Number)?.toLong() ?: 0L
                        val badges = (existingUserDoc.get("badges") as? List<*>) ?: emptyList<Any>()
                        val isProtectedSenior = existingUserDoc.getBoolean("isProtectedSenior") == true
                        val hasReporterPast = !assignedMandal.isNullOrBlank() || points > 0L || badges.isNotEmpty() || isProtectedSenior

                        var parsedRole = UserRole.fromStringSafe(rawRole) ?: UserRole.SUBSCRIBER
                        if (parsedRole == UserRole.SUBSCRIBER && hasReporterPast) {
                            parsedRole = UserRole.REPORTER
                        }
                        val roleFromDb = if (isAdmin) "ADMIN" else parsedRole.name
                        
                        val dbName = existingUserDoc.getString("name")?.trim()
                        val resolvedName = when {
                            !dbName.isNullOrBlank() && !dbName.equals("User", ignoreCase = true) && !dbName.equals("యూజర్", ignoreCase = true) -> dbName
                            !user.displayName.isNullOrBlank() -> user.displayName
                            isAdmin -> "శ్రీకాంత్ రెడ్డి"
                            hasReporterPast || parsedRole == UserRole.REPORTER -> "విలేకరి"
                            else -> "User"
                        }
                        
                        prefs.userName = resolvedName
                        prefs.userRole = roleFromDb
                        val dist = existingUserDoc.getString("district")
                        prefs.userDistrict = dist
                        if (!dist.isNullOrBlank()) {
                            prefs.selectedDistrict = dist
                            com.alfanews.telugu.utils.NotificationHelper.syncDistrictTopic(context, dist)
                        }

                        val updateData = mutableMapOf<String, Any>(
                            "lastLogin" to Timestamp.now()
                        )
                        if (isAdmin && rawRole?.toString()?.uppercase() != "ADMIN") {
                            updateData["role"] = "ADMIN"
                        } else if (roleFromDb == "REPORTER" && (rawRole?.toString()?.uppercase() == "SUBSCRIBER" || rawRole == null)) {
                            updateData["role"] = "REPORTER"
                        }
                        
                        user.phoneNumber?.let { if (it.isNotEmpty()) updateData["phone"] = it }
                        user.email?.let { if (it.isNotEmpty()) updateData["email"] = it }
                        user.photoUrl?.let { updateData["photoUrl"] = it.toString() }
                        user.displayName?.let { if (it.isNotEmpty()) updateData["name"] = it }
                        
                        try {
                            userRef.update(updateData).await()
                        } catch (e: Exception) {
                            android.util.Log.e("LoginViewModel", "Profile update failed: ${e.message}")
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("LoginViewModel", "Firestore sync failed: ${e.message}")
                }

                _uiState.value = LoginUiState(isLoginSuccessful = true, isNewUser = isNewUser)
            } catch (e: Exception) {
                _uiState.value = LoginUiState(errorMessage = e.localizedMessage ?: "లాగిన్ విఫలమైంది.")
            }
        }
    }

    fun sendOtp(
        activity: Activity,
        phoneNumber: String,
        context: Context,
        onCodeSent: (String) -> Unit
    ) {
        if (!phoneNumber.matches(Regex("^\\d{10}$"))) {
            _uiState.value = LoginUiState(errorMessage = context.getString(R.string.enter_valid_phone))
            return
        }
        _uiState.value = LoginUiState(isLoading = true)
        val options = PhoneAuthOptions.newBuilder(FirebaseService.auth)
            .setPhoneNumber(context.getString(R.string.phone_country_code) + phoneNumber)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    signInWithCredential(credential, context)
                }
                override fun onVerificationFailed(e: FirebaseException) {
                    _uiState.value = LoginUiState(errorMessage = e.localizedMessage)
                }
                override fun onCodeSent(
                    verificationId: String,
                    forceResendingToken: PhoneAuthProvider.ForceResendingToken
                ) {
                    _uiState.value = LoginUiState(isLoading = false)
                    onCodeSent(verificationId)
                }
            })
            .build()
        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    fun resetState() {
        _uiState.value = LoginUiState()
        verificationId = null
        resendToken = null
    }
}
