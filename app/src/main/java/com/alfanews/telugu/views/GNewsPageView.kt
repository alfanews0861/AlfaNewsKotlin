package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@Composable
fun GNewsPageView() {
    var apiKey by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("general") }
    var loading by remember { mutableStateOf(false) }
    var logs by remember { mutableStateOf<List<String>>(emptyList()) }

    var savedApiKey by remember { mutableStateOf("") }
    var savedCategory by remember { mutableStateOf("general") }
    var isAutoFetchEnabled by remember { mutableStateOf(false) }
    var isSavingSettings by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val categories = listOf(
        "general" to "General (సాధారణం)",
        "world" to "World (ప్రపంచం)",
        "nation" to "Nation (దేశం)",
        "business" to "Business (వ్యాపారం)",
        "technology" to "Technology (టెక్నాలజీ)",
        "entertainment" to "Entertainment (వినోదం)",
        "sports" to "Sports (క్రీడలు)",
        "science" to "Science (సైన్స్)",
        "health" to "Health (ఆరోగ్యం)"
    )

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val doc = FirebaseService.db.collection("system_settings")
                    .document("gnews_config")
                    .get()
                    .await()

                if (doc.exists()) {
                    val data = doc.data ?: return@launch
                    savedApiKey = data["apiKey"] as? String ?: ""
                    savedCategory = data["category"] as? String ?: "general"
                    isAutoFetchEnabled = data["isEnabled"] as? Boolean ?: false
                    if (apiKey.isEmpty()) {
                        apiKey = savedApiKey
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun handleSaveSettings() {
        if (savedApiKey.isEmpty()) {
            Toast.makeText(context, "API Key is required to save settings.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSavingSettings = true
            try {
                FirebaseService.db.collection("system_settings")
                    .document("gnews_config")
                    .set(mapOf(
                        "apiKey" to savedApiKey,
                        "category" to savedCategory,
                        "isEnabled" to isAutoFetchEnabled
                    ))
                    .await()
                Toast.makeText(context, "Settings saved successfully!", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to save settings: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSavingSettings = false
            }
        }
    }

    suspend fun fetchGNews(apiKey: String, category: String): Result<Map<String, Any>> {
        return try {
            val data = hashMapOf(
                "apiKey" to apiKey,
                "category" to category
            )
            val result = FirebaseFunctions.getInstance().getHttpsCallable("fetchGNews").call(data).await()
            Result.success(result.getData() as Map<String, Any>)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun handleFetch() {
        if (apiKey.isEmpty()) {
            Toast.makeText(context, "Please enter a GNews API Key.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            loading = true
            logs = listOf("Initializing fetch request...", "Target: ${category.uppercase()} news in Telugu...")
            try {
                val result = fetchGNews(apiKey, category)
                if (result.isSuccess) {
                    val data = result.getOrNull() ?: emptyMap()
                    val log = data["log"] as? List<*> ?: emptyList<Any>()
                    val processed = data["processed"] as? Int ?: 0
                    logs = logs + log.mapNotNull { it as? String } + "----------------" + "COMPLETED: Processed $processed new articles."
                } else {
                    logs = logs + "ERROR: ${result.exceptionOrNull()?.message}"
                }
            } catch (e: Exception) {
                logs = logs + "ERROR: ${e.message}"
            } finally {
                loading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFE0E7FF))
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("GNews API Integration", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("GNews API ద్వారా ప్రపంచవ్యాప్తంగా ఉన్న తాజా వార్తలను పొందండి.", fontSize = 14.sp)
            }
        }

        // Settings Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7))
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Settings, contentDescription = null)
                    Text("ఆటోమేటిక్ న్యూస్ సెట్టింగ్స్ (Scheduled Fetch)", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = savedApiKey,
                            onValueChange = { savedApiKey = it },
                            label = { Text("Default API Key") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        var categoryExpanded by remember { mutableStateOf(false) }
                        Box {
                            OutlinedTextField(
                                value = categories.find { it.first == savedCategory }?.second ?: "",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Default Category") },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { categoryExpanded = true },
                                trailingIcon = { Icon(Icons.Default.ArrowDropDown, "select category") }
                            )
                            DropdownMenu(
                                expanded = categoryExpanded,
                                onDismissRequest = { categoryExpanded = false }
                            ) {
                                categories.forEach { (value, label) ->
                                    DropdownMenuItem(
                                        text = { Text(label) },
                                        onClick = {
                                            savedCategory = value
                                            categoryExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Checkbox(
                                checked = isAutoFetchEnabled,
                                onCheckedChange = { isAutoFetchEnabled = it }
                            )
                            Text("Enable Auto Fetch (Every 30 Mins)", fontSize = 14.sp)
                        }
                        Text("ఎనేబుల్ చేస్తే, సిస్టమ్ ప్రతి 30 నిమిషాలకు ఆటోమేటిక్‌గా వార్తలను చెక్ చేసి, కొత్తవి ఉంటే పబ్లిష్ చేస్తుంది.", fontSize = 12.sp, color = Color.Gray)
                        Button(
                            onClick = { handleSaveSettings() },
                            enabled = !isSavingSettings,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B))
                        ) {
                            if (isSavingSettings) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text(if (isSavingSettings) "Saving..." else "Save Configuration")
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Manual Controls
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Manual Trigger", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = apiKey,
                        onValueChange = { apiKey = it },
                        label = { Text("GNews API Key") },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Paste your API key here...") }
                    )

                    var categoryExpanded by remember { mutableStateOf(false) }
                    Box {
                        OutlinedTextField(
                            value = categories.find { it.first == category }?.second ?: "",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Category") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { categoryExpanded = true },
                            trailingIcon = { Icon(Icons.Default.ArrowDropDown, "select category") }
                        )
                        DropdownMenu(
                            expanded = categoryExpanded,
                            onDismissRequest = { categoryExpanded = false }
                        ) {
                            categories.forEach { (value, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        category = value
                                        categoryExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    Button(
                        onClick = { handleFetch() },
                        enabled = !loading,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6366F1))
                    ) {
                        if (loading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(if (loading) "Fetching & Processing..." else "Fetch News Now")
                    }
                }
            }

            // Logs
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(500.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF111827))
            ) {
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Operation Logs", fontSize = 12.sp, color = Color(0xFFD1D5DB), fontFamily = FontFamily.Monospace)
                        TextButton(onClick = { logs = emptyList() }) {
                            Text("Clear", fontSize = 10.sp, color = Color(0xFF9CA3AF))
                        }
                    }
                    Divider(color = Color(0xFF374151))
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (logs.isEmpty()) {
                            item {
                                Text("Waiting for input...", fontSize = 12.sp, color = Color(0xFF6B7280), fontStyle = FontStyle.Italic)
                            }
                        } else {
                            items(logs) { log ->
                                val color = when {
                                    log.startsWith("ERROR:") || log.contains("Failed") -> Color(0xFFF87171)
                                    log.startsWith("COMPLETED:") -> Color(0xFF34D399)
                                    log.startsWith("Skipping") -> Color(0xFFFBBF24)
                                    log.startsWith("Processed") -> Color(0xFF93C5FD)
                                    else -> Color(0xFFD1D5DB)
                                }
                                Text(
                                    "> $log",
                                    fontSize = 12.sp,
                                    color = color,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
