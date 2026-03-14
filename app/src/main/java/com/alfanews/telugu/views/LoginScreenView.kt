package com.alfanews.telugu.views

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.FirebaseException
import com.google.firebase.auth.AuthResult
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.auth.userProfileChangeRequest
import com.google.firebase.auth.FirebaseUser
import java.util.concurrent.TimeUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreenView(
    onLoginSuccess: () -> Unit,
    onClose: () -> Unit
) {
    var activeTab by remember { mutableStateOf("phone") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)
    ) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopAppBar(
                    title = { Text("ఆల్ఫా న్యూస్") },
                    navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.Default.Close, "Close") } }
                )

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 24.dp)
                        .verticalScroll(rememberScrollState())
                        .imePadding(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Top
                ) {
                    Spacer(modifier = Modifier.height(40.dp))
                    Text("స్వాగతం!", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                    Text(
                        "వార్తా ప్రపంచంలోకి అడుగుపెట్టండి",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        modifier = Modifier.padding(top = 4.dp, bottom = 32.dp)
                    )

                    TabRow(
                        selectedTabIndex = if (activeTab == "phone") 0 else 1,
                        containerColor = Color.Transparent,
                        divider = {}
                    ) {
                        Tab(
                            selected = activeTab == "phone",
                            onClick = { activeTab = "phone" },
                            selectedContentColor = MaterialTheme.colorScheme.primary,
                            unselectedContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        ) {
                            Text("మొబైల్", modifier = Modifier.padding(16.dp), fontWeight = if (activeTab == "phone") FontWeight.Bold else FontWeight.Normal)
                        }
                        Tab(
                            selected = activeTab == "email",
                            onClick = { activeTab = "email" },
                            selectedContentColor = MaterialTheme.colorScheme.primary,
                            unselectedContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        ) {
                            Text("ఈమెయిల్", modifier = Modifier.padding(16.dp), fontWeight = if (activeTab == "email") FontWeight.Bold else FontWeight.Normal)
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    if (errorMessage != null) {
                        Text(
                            text = errorMessage!!,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )
                    }

                    if (activeTab == "phone") {
                        PhoneAuthSection(onLoginSuccess, { isLoading = it }, { errorMessage = it }, isLoading)
                    } else {
                        EmailAuthSection(onLoginSuccess, { isLoading = it }, { errorMessage = it })
                    }
                }

                Text(
                    text = "© 2024 Alfa News. All rights reserved.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun PhoneAuthSection(
    onLoginSuccess: () -> Unit,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    isLoading: Boolean
) {
    var phoneNumber by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var isOtpSent by remember { mutableStateOf(false) }
    var verificationId by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (!isOtpSent) {
            OutlinedTextField(
                value = phoneNumber,
                onValueChange = { phoneNumber = it },
                label = { Text("Phone Number") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    setLoading(true)
                    setError(null)
                    context.findActivity()?.let {
                        sendOtp(it, phoneNumber) { result ->
                            setLoading(false)
                            result.onSuccess { id -> verificationId = id; isOtpSent = true }
                            result.onFailure { setError("OTP పంపడం విఫలమైంది.") }
                        }
                    } ?: setError("An unexpected error occurred.")
                },
                enabled = phoneNumber.length >= 10 && !isLoading,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error // Bright Google Red for OTP
                )
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("OTP పంపుతోంది...", fontSize = 18.sp)
                } else {
                    Text("OTP పంపండి", fontSize = 18.sp)
                }
            }
        } else {
            OutlinedTextField(
                value = otp,
                onValueChange = { if (it.length <= 6) otp = it },
                label = { Text("Enter OTP") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    setLoading(true)
                    setError(null)
                    verificationId?.let {
                        verifyOtp(it, otp) { result ->
                            setLoading(false)
                            result.onSuccess { onLoginSuccess() }
                            result.onFailure { setError("OTP తప్పుగా ఉంది.") }
                        }
                    }
                },
                enabled = otp.length == 6,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = MaterialTheme.shapes.medium
            ) {
                Text("లాగిన్ అవ్వండి", fontSize = 18.sp)
            }
            TextButton(onClick = { isOtpSent = false; otp = "" }) {
                Text("నెంబర్ మార్చండి")
            }
        }
    }
}

@Composable
private fun EmailAuthSection(
    onLoginSuccess: () -> Unit,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (isSignUp) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = {
                setLoading(true)
                setError(null)
                if (isSignUp) {
                    signUpWithEmail(email, password, name) { result ->
                        setLoading(false)
                        result.onSuccess { onLoginSuccess() }
                        result.onFailure { e -> setError(e.message) }
                    }
                } else {
                    signInWithEmail(email, password) { result ->
                        setLoading(false)
                        result.onSuccess { onLoginSuccess() }
                        result.onFailure { setError("లాగిన్ విఫలమైంది.") }
                    }
                }
            },
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = MaterialTheme.shapes.medium
        ) {
            Text(if (isSignUp) "ఖాతా సృష్టించండి" else "లాగిన్ అవ్వండి", fontSize = 18.sp)
        }
        TextButton(onClick = { isSignUp = !isSignUp; setError(null) }) {
            Text(if (isSignUp) "ఇప్పటికే ఖాతా ఉందా? లాగిన్ అవ్వండి" else "కొత్త ఖాతా సృష్టించండి")
        }
    }
}

private fun sendOtp(activity: Activity, phoneNumber: String, callback: (Result<String>) -> Unit) {
    if (!phoneNumber.matches(Regex("^\\d{10}$"))) {
        callback(Result.failure(Exception("దయచేసి సరైన 10-అంకెల ఫోన్ నంబర్‌ను నమోదు చేయండి.")))
        return
    }
    val options = PhoneAuthOptions.newBuilder(FirebaseService.auth)
        .setPhoneNumber("+91$phoneNumber")
        .setTimeout(60L, TimeUnit.SECONDS)
        .setActivity(activity)
        .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
            override fun onVerificationCompleted(credential: PhoneAuthCredential) {}
            override fun onVerificationFailed(e: FirebaseException) { callback(Result.failure(e)) }
            override fun onCodeSent(id: String, token: PhoneAuthProvider.ForceResendingToken) { callback(Result.success(id)) }
        })
        .build()
    PhoneAuthProvider.verifyPhoneNumber(options)
}

private fun handleAuthResult(authResult: AuthResult, name: String, callback: (Result<Unit>) -> Unit) {
    val isNewUser = authResult.additionalUserInfo?.isNewUser ?: false
    if (isNewUser) {
        val user = authResult.user!!
        user.updateProfile(userProfileChangeRequest { displayName = name }).addOnCompleteListener {
            createUserProfileInFirestore(user, name, callback)
        }
    } else {
        callback(Result.success(Unit))
    }
}

private fun verifyOtp(verificationId: String, code: String, callback: (Result<Unit>) -> Unit) {
    FirebaseService.auth.signInWithCredential(PhoneAuthProvider.getCredential(verificationId, code))
        .addOnSuccessListener { authResult ->
            handleAuthResult(authResult, "", callback)
        }
        .addOnFailureListener { callback(Result.failure(it)) }
}

private fun signInWithEmail(email: String, password: String, callback: (Result<Unit>) -> Unit) {
    FirebaseService.auth.signInWithEmailAndPassword(email, password)
        .addOnCompleteListener { task ->
            if (task.isSuccessful) callback(Result.success(Unit))
            else callback(Result.failure(task.exception ?: Exception("ఇమెయిల్ లేదా పాస్‌వర్డ్ తప్పు")))
        }
}

private fun signUpWithEmail(email: String, password: String, name: String, callback: (Result<Unit>) -> Unit) {
    FirebaseService.auth.createUserWithEmailAndPassword(email, password)
        .addOnSuccessListener { authResult ->
            handleAuthResult(authResult, name, callback)
        }
        .addOnFailureListener { callback(Result.failure(it)) }
}

private fun createUserProfileInFirestore(user: FirebaseUser, name: String, callback: (Result<Unit>) -> Unit) {
    val userRef = FirebaseService.db.collection("users").document(user.uid)
    val userData = hashMapOf(
        "name" to name,
        "email" to user.email,
        "phone" to user.phoneNumber,
        "role" to "SUBSCRIBER",
        "createdAt" to com.google.firebase.Timestamp.now()
    )
    userRef.set(userData)
        .addOnSuccessListener { callback(Result.success(Unit)) }
        .addOnFailureListener { callback(Result.failure(it)) }
}

fun Context.findActivity(): Activity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is Activity) return context
        context = context.baseContext
    }
    return null
}
