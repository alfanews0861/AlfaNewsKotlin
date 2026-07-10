package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.BuildConfig
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@Composable
fun AppConfigPageView() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var minVersionCode by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val snapshot = FirebaseService.db.collection("settings").document("android_config").get().await()
            if (snapshot.exists()) {
                minVersionCode = (snapshot.get("min_version_code") as? Number)?.toInt()?.toString() ?: ""
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            loading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "App Configuration (Mandatory Update)",
            fontSize = 20.sp,
            fontFamily = Ramabhadra,
            fontWeight = FontWeight.Bold
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Current App Version: ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                    style = MaterialTheme.typography.bodyLarge
                )

                if (loading) {
                    CircularProgressIndicator(modifier = Modifier.align(androidx.compose.ui.Alignment.CenterHorizontally))
                } else {
                    OutlinedTextField(
                        value = minVersionCode,
                        onValueChange = { if (it.all { char -> char.isDigit() }) minVersionCode = it },
                        label = { Text("Minimum Required Version Code") },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("e.g. 590") },
                        supportingText = {
                            Text("Users on a version lower than this will be forced to update.")
                        }
                    )

                    Button(
                        onClick = {
                            scope.launch {
                                saving = true
                                try {
                                    val code = minVersionCode.toIntOrNull() ?: 0
                                    FirebaseService.db.collection("settings").document("android_config")
                                        .set(mapOf("min_version_code" to code), SetOptions.merge()).await()
                                    Toast.makeText(context, "Config updated successfully", Toast.LENGTH_SHORT).show()
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Failed to update: ${e.message}", Toast.LENGTH_LONG).show()
                                } finally {
                                    saving = false
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !saving
                    ) {
                        if (saving) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                        } else {
                            Text("Save Configuration")
                        }
                    }
                }
            }
        }
        
        Text(
            text = "Note: Immediate updates only work if the new version is already available in the Play Store for the user. Testing this requires publishing a new version or using internal testing tracks.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
