package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.SocialFeed
import com.alfanews.telugu.models.SocialPlatform
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialMediaFeedsPageView() {
    var feeds by remember { mutableStateOf<List<SocialFeed>>(emptyList()) }
    var url by remember { mutableStateOf("") }
    var sourceName by remember { mutableStateOf("") }
    var platform by remember { mutableStateOf(SocialPlatform.Twitter) }
    var category by remember { mutableStateOf("జిల్లా వార్త") }
    var editingId by remember { mutableStateOf<String?>(null) }
    var isFetching by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var isProcessing by remember { mutableStateOf(false) }
    var statusLog by remember { mutableStateOf<List<String>>(emptyList()) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val categories = listOf(
        "జిల్లా వార్త", "రాజకీయం", "వినోదం", "క్రీడలు", "వ్యాపారం", "టెక్నాలజీ",
        "క్రైమ్", "భక్తి", "జాతీయం", "అంతర్జాతీయం", "వ్యవసాయం", "విద్య/ఉద్యోగాలు"
    )

    fun fetchFeeds() {
        scope.launch {
            isFetching = true
            try {
                val snapshot = FirebaseService.db.collection("social_feeds")
                    .orderBy("sourceName", Query.Direction.ASCENDING)
                    .get()
                    .await()

                feeds = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    SocialFeed(
                        id = doc.id,
                        url = data["url"] as? String ?: "",
                        sourceName = data["sourceName"] as? String ?: "",
                        platform = try {
                            SocialPlatform.valueOf((data["platform"] as? String ?: "Twitter").uppercase())
                        } catch (e: Exception) {
                            SocialPlatform.Twitter
                        },
                        category = data["category"] as? String ?: ""
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isFetching = false
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchFeeds()
    }

    fun handleSubmit() {
        if (url.isEmpty()) {
            Toast.makeText(context, "సరైన యూజర్ నేమ్ లేదా హ్యాండిల్ నమోదు చేయండి.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                val feedData = hashMapOf(
                    "url" to url,
                    "sourceName" to sourceName,
                    "platform" to platform.name,
                    "category" to category
                )

                if (editingId != null) {
                    FirebaseService.db.collection("social_feeds")
                        .document(editingId!!)
                        .update(feedData as Map<String, Any>)
                        .await()
                } else {
                    FirebaseService.db.collection("social_feeds")
                        .add(feedData)
                        .await()
                }

                url = ""
                sourceName = ""
                platform = SocialPlatform.Twitter
                category = "జిల్లా వార్త"
                editingId = null
                fetchFeeds()
            } catch (e: Exception) {
                Toast.makeText(context, "ఫీడ్‌ను సేవ్ చేయడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSubmitting = false
            }
        }
    }

    fun handleDelete(id: String) {
        scope.launch {
            try {
                FirebaseService.db.collection("social_feeds")
                    .document(id)
                    .delete()
                    .await()
                fetchFeeds()
            } catch (e: Exception) {
                Toast.makeText(context, "ఫీడ్‌ను తొలగించడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    suspend fun processSocialFeeds(): Result<Map<String, Any>> {
        return try {
            val result = FirebaseFunctions.getInstance().getHttpsCallable("processSocialFeeds").call().await()
            Result.success(result.getData() as Map<String, Any>)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun handleManualTrigger() {
        scope.launch {
            isProcessing = true
            statusLog = listOf("సోషల్ మీడియా స్కానింగ్ ప్రారంభమైంది... బ్రౌజర్ లోడ్ అవుతోంది.")
            try {
                val result = processSocialFeeds()
                if (result.isSuccess) {
                    val data = result.getOrNull() ?: emptyMap()
                    val log = data["log"] as? String
                    statusLog = if (log != null) {
                        log.split("\n").map { if (it.startsWith(">")) it else "> $it" }
                    } else {
                        listOf(data["message"] as? String ?: "Completed")
                    }
                } else {
                    statusLog = listOf("ప్రాసెసింగ్‌లో లోపం: ${result.exceptionOrNull()?.message}")
                }
            } catch (e: Exception) {
                statusLog = listOf("ప్రాసెసింగ్‌లో లోపం: ${e.message}")
            } finally {
                isProcessing = false
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
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("సోషల్ మీడియా మానిటర్ (Scraper)", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("ట్విట్టర్ (X) హ్యాండిల్స్ నుండి తాజా పోస్ట్‌లను సేకరించి వార్తలుగా మార్చడానికి ఈ విభాగాన్ని ఉపయోగించండి.", style = MaterialTheme.typography.bodyMedium)
                Button(
                    onClick = { handleManualTrigger() },
                    enabled = !isProcessing,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(if (isProcessing) "స్కానింగ్ జరుగుతోంది..." else "ఇప్పుడే స్కాన్ చేయి (Playwright)")
                }

                if (isProcessing || statusLog.isNotEmpty()) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(240.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.Black)
                    ) {
                        LazyColumn(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(statusLog) { line ->
                                Text(line, fontSize = 10.sp, color = Color(0xFF86EFAC), fontFamily = FontFamily.Monospace)
                            }
                        }
                    }
                }
            }
        }

        // Form
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = if (editingId != null) "ఫీడ్‌ను ఎడిట్ చేయండి" else "కొత్త సోషల్ సోర్స్‌ను జోడించండి",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = sourceName,
                        onValueChange = { sourceName = it },
                        label = { Text("సోర్స్ పేరు (Label)") },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("ఉదా: KTR (BRS)") }
                    )

                    var platformExpanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = platformExpanded,
                        onExpandedChange = { platformExpanded = !platformExpanded },
                        modifier = Modifier.weight(1f)
                    ) {
                        OutlinedTextField(
                            value = platform.name,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("ప్లాట్‌ఫారమ్") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = platformExpanded) },
                            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                            modifier = Modifier.menuAnchor().fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = platformExpanded,
                            onDismissRequest = { platformExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Twitter (X)") },
                                onClick = {
                                    platform = SocialPlatform.Twitter
                                    platformExpanded = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Facebook (Soon)") },
                                onClick = {
                                    platform = SocialPlatform.Facebook
                                    platformExpanded = false
                                }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("Twitter Handle / ID") },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("@username లేదా ID") }
                )

                var categoryExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = categoryExpanded,
                    onExpandedChange = { categoryExpanded = !categoryExpanded },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = category,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("కేటగిరి") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = categoryExpanded,
                        onDismissRequest = { categoryExpanded = false }
                    ) {
                        categories.forEach { cat ->
                            DropdownMenuItem(
                                text = { Text(cat) },
                                onClick = {
                                    category = cat
                                    categoryExpanded = false
                                }
                            )
                        }
                    }
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { handleSubmit() },
                        enabled = !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        modifier = Modifier.weight(1f)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(if (isSubmitting) "సేవ్ అవుతోంది..." else (if (editingId != null) "అప్‌డేట్ చేయి" else "జోడించు"))
                    }
                    if (editingId != null) {
                        Button(
                            onClick = {
                                url = ""
                                sourceName = ""
                                platform = SocialPlatform.Twitter
                                category = "జిల్లా వార్త"
                                editingId = null
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.outline)
                        ) {
                            Text("రద్దు")
                        }
                    }
                }
            }
        }

        // Feeds List
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("యాక్టివ్ సోషల్ మానిటర్స్", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                if (isFetching) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else if (feeds.isEmpty()) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Text("సోషల్ ఫీడ్‌లు ఏవీ లేవు.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.height(300.dp), // Avoid nested scrolling
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(feeds) { feed ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary)
                                            Text(feed.sourceName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                            Surface(
                                                color = MaterialTheme.colorScheme.secondaryContainer,
                                                shape = RoundedCornerShape(12.dp)
                                            ) {
                                                Text(feed.category, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSecondaryContainer)
                                            }
                                        }
                                        Text(feed.url, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace)
                                    }
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        IconButton(onClick = {
                                            url = feed.url
                                            sourceName = feed.sourceName
                                            platform = feed.platform
                                            category = feed.category
                                            editingId = feed.id
                                        }) {
                                            Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                                        }
                                        IconButton(onClick = { handleDelete(feed.id) }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
