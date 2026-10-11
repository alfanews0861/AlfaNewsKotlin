@file:android.annotation.SuppressLint("LocalContextGetResourceValueCall")
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
import androidx.compose.ui.res.colorResource
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
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alfanews.telugu.viewmodels.LoginViewModel
import java.util.concurrent.TimeUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreenView(
    onLoginSuccess: (isNewUser: Boolean) -> Unit,
    onClose: () -> Unit,
    loginViewModel: LoginViewModel = viewModel()
) {
    val loginUiState by loginViewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(loginUiState.isLoginSuccessful) {
        if (loginUiState.isLoginSuccessful) {
            onLoginSuccess(loginUiState.isNewUser)
            onClose()
            loginViewModel.resetState()
        }
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)
                val idToken: String? = account?.idToken
                if (idToken != null) {
                    val credential = GoogleAuthProvider.getCredential(idToken, null)
                    loginViewModel.signInWithCredential(credential, context)
                }
            } catch (e: ApiException) {
                // Handled in ViewModel
            } catch (e: Exception) {
                // Handled in ViewModel
            }
        } else {
            if (result.resultCode != Activity.RESULT_CANCELED) {
                // Handled in ViewModel
            }
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(
            usePlatformDefaultWidth = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.55f))
                .padding(horizontal = 20.dp, vertical = 24.dp)
                .imePadding(),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 420.dp)
                    .wrapContentHeight(),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 6.dp,
                shadowElevation = 12.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Header Row with App Name & Close button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.app_name),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        IconButton(
                            onClick = onClose,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = stringResource(R.string.close),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        stringResource(R.string.welcome_back),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        stringResource(R.string.explore_news_world),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        modifier = Modifier.padding(top = 2.dp, bottom = 14.dp)
                    )

                    loginUiState.errorMessage?.let { errorMsg ->
                        Surface(
                            color = MaterialTheme.colorScheme.errorContainer,
                            shape = MaterialTheme.shapes.small,
                            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
                        ) {
                            Text(
                                text = errorMsg,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.padding(10.dp),
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }

                    // Google Login Button
                    Button(
                        onClick = {
                            try {
                                val webClientId = context.getString(R.string.default_web_client_id)
                                val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                    .requestIdToken(webClientId)
                                    .requestEmail()
                                    .build()
                                val googleSignInClient = GoogleSignIn.getClient(context, gso)
                                googleSignInLauncher.launch(googleSignInClient.signInIntent)
                            } catch (e: Exception) {
                                // Handled in ViewModel
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = MaterialTheme.shapes.medium,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = colorResource(R.color.google_red)
                        ),
                        enabled = !loginUiState.isLoading
                    ) {
                        if (loginUiState.isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = colorResource(R.color.white), strokeWidth = 2.dp)
                        } else {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(stringResource(R.string.google_logo_text), color = colorResource(R.color.white), fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(stringResource(R.string.google_login), fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colorResource(R.color.white))
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                        HorizontalDivider(modifier = Modifier.weight(1f), thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
                        Text(
                            text = stringResource(R.string.or_separator),
                            modifier = Modifier.padding(horizontal = 12.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f), thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Phone Auth Section
                    PhoneAuthSection(loginViewModel)
                }
            }
        }
    }
}


@Composable
private fun PhoneAuthSection(
    loginViewModel: LoginViewModel
) {
    var phoneNumber by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var isOtpSent by remember { mutableStateOf(false) }
    var verificationId by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val loginUiState by loginViewModel.uiState.collectAsState()


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
                        loginViewModel.sendOtp(
                            activity = activity,
                            phoneNumber = phoneNumber,
                            context = context,
                            onCodeSent = { id ->
                                verificationId = id
                                isOtpSent = true
                            }
                        )
                    } else {
                        // Handled in ViewModel
                    }
                },
                enabled = phoneNumber.length == 10 && !loginUiState.isLoading,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = MaterialTheme.shapes.medium
            ) {
                if (loginUiState.isLoading && !isOtpSent) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Text(stringResource(R.string.send_otp), fontSize = 16.sp, fontWeight = FontWeight.Bold)
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
                    verificationId?.let { id ->
                        val credential = PhoneAuthProvider.getCredential(id, otp)
                        loginViewModel.signInWithCredential(credential, context)
                    }
                },
                enabled = otp.length == 6 && !loginUiState.isLoading,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = MaterialTheme.shapes.medium
            ) {
                if (loginUiState.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Text(stringResource(R.string.login), fontSize = 16.sp, fontWeight = FontWeight.Bold)
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







fun Context.findActivity(): Activity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is Activity) return context
        context = context.baseContext
    }
    return null
}
