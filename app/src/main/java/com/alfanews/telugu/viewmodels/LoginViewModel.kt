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

    fun resetState() {
        _uiState.value = LoginUiState()
    }

    private suspend fun createNewUserProfile(
        user: FirebaseUser,
        name: String,
        context: Context
    ) {
        val userRef = FirebaseService.db.collection("users").document(user.uid)
        val userData = hashMapOf(
            "name" to name.ifEmpty { context.getString(R.string.user_default_name) },
            "email" to user.email,
            "phone" to user.phoneNumber,
            "role" to "SUBSCRIBER", // Only new users get this
            "createdAt" to Timestamp.now()
        )
        userRef.set(userData).await()
    }

    fun signInWithCredential(credential: AuthCredential, context: Context) {
        val prefs = com.alfanews.telugu.utils.PreferenceManager.getInstance(context)
        viewModelScope.launch {
            _uiState.value = LoginUiState(isLoading = true)
            try {
                val authResult = FirebaseService.auth.signInWithCredential(credential).await()
                val user = authResult.user!!

                val userRef = FirebaseService.db.collection("users").document(user.uid)
                val existingUserDoc = userRef.get().await()

                if (!existingUserDoc.exists()) {
                    // 🔍 RESILIENCE Check: Look for user by phone before creating new one
                    val phone = user.phoneNumber
                    var foundLegacyUser = false
                    var legacyRole = "SUBSCRIBER"
                    
                    if (!phone.isNullOrEmpty()) {
                        val legacyDocs = FirebaseService.db.collection("users")
                            .whereEqualTo("phone", phone)
                            .get().await()
                        
                        if (!legacyDocs.isEmpty) {
                        val legacyDoc = legacyDocs.documents.first()
                        val legacyData = legacyDoc.data
                        val rawLegacyRole = legacyData?.get("role")
                        val parsedLegacyRole = UserRole.fromStringSafe(rawLegacyRole) ?: UserRole.SUBSCRIBER
                        legacyRole = parsedLegacyRole.name
                        
                        val updatedLegacyData = legacyData?.toMutableMap() ?: mutableMapOf()
                        updatedLegacyData["lastLogin"] = Timestamp.now()
                        userRef.set(updatedLegacyData, com.google.firebase.firestore.SetOptions.merge()).await()
                        foundLegacyUser = true
                        }
                    }

                    if (!foundLegacyUser) {
                        createNewUserProfile(user = user, name = user.displayName ?: "", context = context)
                    }
                    
                    // 🚀 CACHE for offline persistence
                    prefs.userId = user.uid
                    prefs.userName = user.displayName ?: "User"
                    prefs.userRole = legacyRole

                    _uiState.value = LoginUiState(isLoginSuccessful = true, isNewUser = true)
                } else {
                    // EXISTING USER: Only update metadata, NEVER touch the "role" field
                    val rawRole = existingUserDoc.get("role")
                    val roleFromDb = (UserRole.fromStringSafe(rawRole) ?: UserRole.SUBSCRIBER).name
                    
                    // 🚀 CACHE immediately for offline persistence
                    prefs.userId = user.uid
                    prefs.userName = existingUserDoc.getString("name") ?: user.displayName ?: "User"
                    prefs.userRole = roleFromDb
                    prefs.userDistrict = existingUserDoc.getString("district")

                    val updateData = mutableMapOf<String, Any>(
                        "lastLogin" to Timestamp.now()
                    )
                    
                    // Update profile info only if it was provided by the auth provider
                    if (!user.phoneNumber.isNullOrEmpty()) updateData["phone"] = user.phoneNumber!!
                    if (!user.email.isNullOrEmpty()) updateData["email"] = user.email!!
                    if (user.photoUrl != null) updateData["photoUrl"] = user.photoUrl!!.toString()
                    if (!user.displayName.isNullOrEmpty()) updateData["name"] = user.displayName!!
                    
                    userRef.update(updateData).await()
                    _uiState.value = LoginUiState(isLoginSuccessful = true, isNewUser = false)
                }
            } catch (e: Exception) {
                _uiState.value = LoginUiState(errorMessage = e.localizedMessage)
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
}
