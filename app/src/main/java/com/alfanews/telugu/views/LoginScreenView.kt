package com.alfanews.telugu.views

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.ui.graphics.Brush
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.alfanews.telugu.R
import com.alfanews.telugu.services.FirebaseService
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.FirebaseException
import com.google.firebase.Timestamp
import com.google.firebase.auth.*
import com.google.firebase.firestore.SetOptions
import java.util.concurrent.TimeUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreenView(
    onLoginSuccess: () -> Unit,
    onClose: () -> Unit
) {
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)!!
                val idToken: String? = account.idToken
                if (idToken != null) {
                    val credential = GoogleAuthProvider.getCredential(idToken, null)
                    isLoading = true
                    FirebaseService.auth.signInWithCredential(credential)
                        .addOnCompleteListener { authTask ->
                            if (authTask.isSuccessful) {
                                val user = authTask.result?.user
                                if (user != null) {
                                    if (authTask.result?.additionalUserInfo?.isNewUser == true) {
                                        createUserProfileInFirestore(
                                            user = user, 
                                            name = user.displayName ?: "User",
                                            onComplete = { success, error ->
                                                isLoading = false
                                                if (success) onLoginSuccess()
                                                else errorMessage = context.getString(R.string.technical_error) + ": " + (error?.localizedMessage ?: "Firestore Error")
                                            }
                                        )
                                    } else {
                                        isLoading = false
                                        onLoginSuccess()
                                    }
                                } else {
                                    isLoading = false
                                    errorMessage = "Firebase user is null"
                                }
                            } else {
                                isLoading = false
                                errorMessage = context.getString(R.string.google_login_failed, authTask.exception?.localizedMessage ?: "Unknown Error")
                            }
                        }
                } else {
                    isLoading = false
                    errorMessage = context.getString(R.string.google_id_token_missing)
                }
            } catch (e: ApiException) {
                isLoading = false
                errorMessage = context.getString(R.string.google_login_failed, "Status Code: ${e.statusCode}")
            } catch (e: Exception) {
                isLoading = false
                errorMessage = context.getString(R.string.google_login_failed, e.localizedMessage ?: "Unknown Exception")
            }
        } else {
            isLoading = false
            if (result.resultCode != Activity.RESULT_CANCELED) {
                errorMessage = "Google Sign In Failed. Result Code: ${result.resultCode}"
            }
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Scaffold(
                topBar = {
                    TopAppBar(
                        title = { Text(stringResource(R.string.app_name)) },
                        navigationIcon = {
                            IconButton(onClick = onClose) {
                                Icon(Icons.Default.Close, stringResource(R.string.close))
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                            titleContentColor = MaterialTheme.colorScheme.onSurface,
                            navigationIconContentColor = MaterialTheme.colorScheme.onSurface
                        )
                    )
                },
                containerColor = Color.Transparent // Surface provides the background
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    MaterialTheme.colorScheme.background,
                                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.1f),
                                    MaterialTheme.colorScheme.background
                                )
                            )
                        )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 24.dp)
                            .verticalScroll(rememberScrollState())
                            .imePadding(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Top
                    ) {
                        Spacer(modifier = Modifier.height(24.dp))
                        Text(
                            stringResource(R.string.welcome_back),
                            style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            stringResource(R.string.explore_news_world),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                            modifier = Modifier.padding(top = 4.dp, bottom = 32.dp)
                        )

                        if (errorMessage != null) {
                            Surface(
                                color = MaterialTheme.colorScheme.errorContainer,
                                shape = MaterialTheme.shapes.medium,
                                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)
                            ) {
                                Text(
                                    text = errorMessage!!,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                    modifier = Modifier.padding(12.dp),
                                    textAlign = TextAlign.Center,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }

                        // Google Login Button
                        Button(
                            onClick = {
                                isLoading = true
                                errorMessage = null
                                try {
                                    val webClientId = context.getString(R.string.default_web_client_id)
                                    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                        .requestIdToken(webClientId)
                                        .requestEmail()
                                        .build()
                                    val googleSignInClient = GoogleSignIn.getClient(context, gso)
                                    googleSignInLauncher.launch(googleSignInClient.signInIntent)
                                } catch (e: Exception) {
                                    isLoading = false
                                    errorMessage = context.getString(R.string.technical_error) + ": " + e.localizedMessage
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = MaterialTheme.shapes.medium,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFD93025) // Google Red
                            ),
                            enabled = !isLoading
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                            } else {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("G", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Text(stringResource(R.string.google_login), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                            HorizontalDivider(modifier = Modifier.weight(1f), thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
                            Text(
                                text = stringResource(R.string.or_separator),
                                modifier = Modifier.padding(horizontal = 16.dp),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            HorizontalDivider(modifier = Modifier.weight(1f), thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        // Phone Auth Section
                        PhoneAuthSection(onLoginSuccess, { isLoading = it }, { errorMessage = it }, isLoading)
                        
                        Spacer(modifier = Modifier.height(40.dp))
                        
                        Text(
                            text = "© 2024 Alfa News. All rights reserved.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }
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
                onValueChange = { input -> 
                    val filtered = input.filter { it.isDigit() }
                    if (filtered.length <= 10) phoneNumber = filtered 
                },
                label = { Text(stringResource(R.string.phone_number_label)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(stringResource(R.string.mobile_placeholder)) },
                shape = MaterialTheme.shapes.medium,
                singleLine = true
            )
            Button(
                onClick = {
                    val activity = context.findActivity()
                    if (activity != null) {
                        setLoading(true)
                        setError(null)
                        sendOtp(
                            activity = activity,
                            phoneNumber = phoneNumber,
                            context = context,
                            onAutoVerify = { credential ->
                                signInWithPhoneCredential(
                                    credential = credential,
                                    onSuccess = { onLoginSuccess() },
                                    onFailure = { error ->
                                        setError(context.getString(R.string.login_error, error.localizedMessage ?: "Auto-verification failed"))
                                    }
                                )
                            },
                            onCodeSent = { id ->
                                setLoading(false)
                                verificationId = id
                                isOtpSent = true
                            },
                            onOtpError = { error ->
                                setLoading(false)
                                setError(context.getString(R.string.otp_send_failed) + ": " + (error.localizedMessage ?: ""))
                            }
                        )
                    } else {
                        setError(context.getString(R.string.technical_error))
                    }
                },
                enabled = phoneNumber.length == 10 && !isLoading,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = MaterialTheme.shapes.medium
            ) {
                if (isLoading && !isOtpSent) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text(stringResource(R.string.send_otp), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
        } else {
            OutlinedTextField(
                value = otp,
                onValueChange = { input ->
                    val filtered = input.filter { it.isDigit() }
                    if (filtered.length <= 6) otp = filtered 
                },
                label = { Text(stringResource(R.string.enter_otp)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                singleLine = true
            )
            Button(
                onClick = {
                    setLoading(true)
                    setError(null)
                    verificationId?.let { id ->
                        val credential = PhoneAuthProvider.getCredential(id, otp)
                        signInWithPhoneCredential(
                            credential = credential,
                            onSuccess = { onLoginSuccess() },
                            onFailure = { error ->
                                setLoading(false)
                                setError(context.getString(R.string.invalid_otp) + ": " + (error.localizedMessage ?: ""))
                            }
                        )
                    }
                },
                enabled = otp.length == 6 && !isLoading,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = MaterialTheme.shapes.medium
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text(stringResource(R.string.login), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
            TextButton(
                onClick = { 
                    isOtpSent = false
                    otp = "" 
                },
                modifier = Modifier.align(Alignment.End)
            ) {
                Text(stringResource(R.string.change_mobile_number))
            }
        }
    }
}

private fun sendOtp(
    activity: Activity, 
    phoneNumber: String, 
    context: Context, 
    onAutoVerify: (PhoneAuthCredential) -> Unit,
    onCodeSent: (String) -> Unit,
    onOtpError: (Exception) -> Unit
) {
    if (!phoneNumber.matches(Regex("^\\d{10}$"))) {
        onOtpError(Exception(context.getString(R.string.enter_valid_phone)))
        return
    }
    val options = PhoneAuthOptions.newBuilder(FirebaseService.auth)
        .setPhoneNumber("+91$phoneNumber")
        .setTimeout(60L, TimeUnit.SECONDS)
        .setActivity(activity)
        .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                onAutoVerify(credential)
            }
            override fun onVerificationFailed(e: FirebaseException) { 
                onOtpError(e) 
            }
            override fun onCodeSent(
                verificationId: String,
                forceResendingToken: PhoneAuthProvider.ForceResendingToken
            ) {
                onCodeSent(verificationId)
            }
        })
        .build()
    PhoneAuthProvider.verifyPhoneNumber(options)
}

private fun signInWithPhoneCredential(
    credential: PhoneAuthCredential, 
    onSuccess: () -> Unit,
    onFailure: (Exception) -> Unit
) {
    FirebaseService.auth.signInWithCredential(credential)
        .addOnSuccessListener { authResult ->
            val isNewUser = authResult.additionalUserInfo?.isNewUser ?: false
            if (isNewUser) {
                val user = authResult.user!!
                createUserProfileInFirestore(
                    user = user, 
                    name = user.displayName ?: "",
                    onComplete = { success, error ->
                        if (success) onSuccess()
                        else onFailure(error ?: Exception("Firestore profile creation failed"))
                    }
                )
            } else {
                onSuccess()
            }
        }
        .addOnFailureListener { onFailure(it) }
}

private fun createUserProfileInFirestore(
    user: FirebaseUser, 
    name: String, 
    onComplete: (Boolean, Exception?) -> Unit
) {
    val userRef = FirebaseService.db.collection("users").document(user.uid)
    val userData = hashMapOf(
        "name" to name.ifEmpty { "User" },
        "email" to user.email,
        "phone" to user.phoneNumber,
        "role" to "SUBSCRIBER",
        "createdAt" to Timestamp.now()
    )
    userRef.set(userData, SetOptions.merge())
        .addOnSuccessListener { onComplete(true, null) }
        .addOnFailureListener { onComplete(false, it) }
}

fun Context.findActivity(): Activity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is Activity) return context
        context = context.baseContext
    }
    return null
}
