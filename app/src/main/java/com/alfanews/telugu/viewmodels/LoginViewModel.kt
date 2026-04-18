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
import com.google.firebase.Timestamp
import java.util.concurrent.TimeUnit


data class LoginUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isLoginSuccessful: Boolean = false
)

class LoginViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun resetState() {
        _uiState.value = LoginUiState()
    }

    private suspend fun createUserProfileInFirestore(
        user: FirebaseUser,
        name: String,
        context: Context
    ) {
        val userRef = FirebaseService.db.collection("users").document(user.uid)
        val userData = hashMapOf(
            "name" to name.ifEmpty { context.getString(R.string.user_default_name) },
            "email" to user.email,
            "phone" to user.phoneNumber,
            "role" to "SUBSCRIBER",
            "createdAt" to Timestamp.now()
        )
        userRef.set(userData, SetOptions.merge()).await()
    }

    fun signInWithCredential(credential: AuthCredential, context: Context) {
        viewModelScope.launch {
            _uiState.value = LoginUiState(isLoading = true)
            try {
                val authResult = FirebaseService.auth.signInWithCredential(credential).await()
                val isNewUser = authResult.additionalUserInfo?.isNewUser ?: false
                val user = authResult.user!!

                // వర్తమాన వినియోగదారు డేటా తెలుసుకోవటానికి ప్రయత్నించండి
                val userRef = FirebaseService.db.collection("users").document(user.uid)
                val existingUserDoc = userRef.get().await()

                if (isNewUser) {
                    // కొత్త వినియోగదారు - కొత్త ప్రొఫైల్ సృష్టించండి
                    createUserProfileInFirestore(
                        user = user,
                        name = user.displayName ?: "",
                        context = context
                    )
                } else if (existingUserDoc.exists()) {
                    // ఇప్పటికే ఉన్న వినియోగదారు - తమ రోల్ సంరక్షించండి
                    // కేవలం ఆధారీకరణ సమాచారం నవీకరించండి (ఫోన్ / ఇమెయిల్ / ఫోటో)
                    val updateData = mutableMapOf<String, Any>()
                    if (!user.phoneNumber.isNullOrEmpty()) {
                        updateData["phone"] = user.phoneNumber!!
                    }
                    if (!user.email.isNullOrEmpty()) {
                        updateData["email"] = user.email!!
                    }
                    if (user.photoUrl != null) {
                        updateData["photoUrl"] = user.photoUrl!!
                    }
                    if (!user.displayName.isNullOrEmpty()) {
                        updateData["name"] = user.displayName!!
                    }
                    if (updateData.isNotEmpty()) {
                        userRef.update(updateData).await()
                    }
                } else {
                    // నిర్ధారణ లో సమస్య - ప్రొఫైల్ లేదు, కొత్త సృష్టించండి
                    createUserProfileInFirestore(
                        user = user,
                        name = user.displayName ?: "",
                        context = context
                    )
                }

                _uiState.value = LoginUiState(isLoginSuccessful = true)
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
