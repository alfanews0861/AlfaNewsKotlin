package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.RssFeed
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import com.alfanews.telugu.utils.Constants

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RssFeedsPageView() {
    var feeds by remember { mutableStateOf<List<RssFeed>>(emptyList()) }
    var rssUrl by remember { mutableStateOf("") }
    var rssCategory by remember { mutableStateOf("జిల్లా వార్త") }
    var selectedState by remember { mutableStateOf("TS") }
    var selectedDistrict by remember { mutableStateOf<String?>(null) }
    var editingRssId by remember { mutableStateOf<String?>(null) }
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

    fun fetchRssFeeds() {
        scope.launch {
            isFetching = true
            try {
                val snapshot = FirebaseService.db.collection("rss_feeds")
                    .orderBy("category", Query.Direction.ASCENDING)
                    .get()
                    .await()

                feeds = snapshot.documents.mapNotNull { doc ->
                    doc.toObject(RssFeed::class.java)?.copy(id = doc.id)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isFetching = false
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchRssFeeds()
    }

    fun formatTime(timestamp: Long?): String {
        if (timestamp == null) return "Never"
        return SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()).format(Date(timestamp))
    }

    fun handleRssSubmit() {
        if (rssUrl.isEmpty() || (rssCategory == "జిల్లా వార్త" && selectedDistrict == null)) {
            Toast.makeText(context, "URL మరియు జిల్లాను నమోదు చేయండి.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                val feedData = mutableMapOf<String, Any?>(
                    "url" to rssUrl,
                    "category" to rssCategory
                )

                if (rssCategory == "జిల్లా వార్త") {
                    feedData["state"] = selectedState
                    feedData["district"] = selectedDistrict
                } else {
                    feedData["state"] = null
                    feedData["district"] = null
                }

                if (editingRssId != null) {
                    FirebaseService.db.collection("rss_feeds").document(editingRssId!!).update(feedData).await()
                } else {
                    feedData["lastStatus"] = "active"
                    feedData["isPaused"] = false
                    FirebaseService.db.collection("rss_feeds").add(feedData).await()
                }

                rssUrl = ""
                rssCategory = "జిల్లా వార్త"
                selectedState = "TS"
                selectedDistrict = null
                editingRssId = null
                fetchRssFeeds()
            } catch (e: Exception) {
                Toast.makeText(context, "ఫీడ్‌ను సేవ్ చేయడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSubmitting = false
            }
        }
    }
    
    fun handleRssDelete(id: String) {
        scope.launch {
            try {
                FirebaseService.db.collection("rss_feeds").document(id).delete().await()
                fetchRssFeeds()
            } catch (e: Exception) {
                Toast.makeText(context, "ఫీడ్‌ను తొలగించడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun handleTogglePause(feed: RssFeed) {
        scope.launch {
            try {
                FirebaseService.db.collection("rss_feeds").document(feed.id).update("isPaused", !feed.isPaused).await()
                fetchRssFeeds()
            } catch (e: Exception) {
                Toast.makeText(context, "స్టేటస్ మార్చడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    suspend fun processRssFeeds(): Result<Map<String, Any>> {
        return try {
            val result = FirebaseFunctions.getInstance().getHttpsCallable("processRssFeeds").call().await()
            Result.success(result.getData() as Map<String, Any>)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun handleManualTrigger() {
        scope.launch {
            isProcessing = true
            statusLog = listOf("సర్వర్‌ను సంప్రదిస్తోంది... దయచేసి వేచి ఉండండి.")
            try {
                val result = processRssFeeds()
                if (result.isSuccess) {
                    val data = result.getOrNull() ?: emptyMap()
                    val log = data["log"] as? String
                    statusLog = log?.split("\n") ?: listOf(data["message"] as? String ?: "Completed")
                } else {
                    statusLog = listOf("లోపం: ${result.exceptionOrNull()?.message}")
                }
                fetchRssFeeds()
            } catch (e: Exception) {
                statusLog = listOf("లోపం: ${e.message}")
            } finally {
                isProcessing = false
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Manual Actions and Form
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(if (editingRssId != null) "RSS ఫీడ్‌ను ఎడిట్ చేయండి" else "కొత్త RSS ఫీడ్‌ను జోడించండి", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                OutlinedTextField(value = rssUrl, onValueChange = { rssUrl = it }, label = { Text("RSS ఫీడ్ URL") }, modifier = Modifier.fillMaxWidth())
                
                var categoryExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(expanded = categoryExpanded, onExpandedChange = { categoryExpanded = !categoryExpanded }) {
                    OutlinedTextField(value = rssCategory, onValueChange = {}, readOnly = true, label = { Text("కేటగిరి") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) }, modifier = Modifier.menuAnchor().fillMaxWidth())
                    ExposedDropdownMenu(expanded = categoryExpanded, onDismissRequest = { categoryExpanded = false }) {
                        categories.forEach { cat ->
                            DropdownMenuItem(text = { Text(cat) }, onClick = { rssCategory = cat; categoryExpanded = false })
                        }
                    }
                }

                if (rssCategory == "జిల్లా వార్త") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        var stateExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(expanded = stateExpanded, onExpandedChange = { stateExpanded = !stateExpanded }, modifier = Modifier.weight(1f)) {
                            OutlinedTextField(value = selectedState, onValueChange = {}, readOnly = true, label = { Text("రాష్ట్రం") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = stateExpanded) }, modifier = Modifier.menuAnchor())
                            ExposedDropdownMenu(expanded = stateExpanded, onDismissRequest = { stateExpanded = false }) {
                                listOf("TS", "AP").forEach { state ->
                                    DropdownMenuItem(text = { Text(state) }, onClick = { selectedState = state; selectedDistrict = null; stateExpanded = false })
                                }
                            }
                        }

                        var districtExpanded by remember { mutableStateOf(false) }
                        val districts = if (selectedState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
                        ExposedDropdownMenuBox(expanded = districtExpanded, onExpandedChange = { districtExpanded = !districtExpanded }, modifier = Modifier.weight(1f)) {
                            OutlinedTextField(value = selectedDistrict ?: "", onValueChange = {}, readOnly = true, label = { Text("జిల్లా") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) }, modifier = Modifier.menuAnchor())
                            ExposedDropdownMenu(expanded = districtExpanded, onDismissRequest = { districtExpanded = false }) {
                                districts.forEach { district ->
                                    DropdownMenuItem(text = { Text(district) }, onClick = { selectedDistrict = district; districtExpanded = false })
                                }
                            }
                        }
                    }
                }
                
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { handleRssSubmit() }, enabled = !isSubmitting, modifier = Modifier.weight(1f)) {
                        Text(if (editingRssId != null) "అప్‌డేట్" else "జోడించు")
                    }
                    if (editingRssId != null) {
                        Button(onClick = {
                            editingRssId = null; rssUrl = ""; rssCategory = "జిల్లా వార్త"; selectedState = "TS"; selectedDistrict = null
                        }) {
                            Text("రద్దు")
                        }
                    }
                }
            }
        }

        // Feeds List
        LazyColumn(modifier = Modifier.height(600.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
             items(feeds) { feed ->
                Card(border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(feed.url, fontWeight = FontWeight.Bold)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)){
                                Text("Category: ${feed.category}", style = MaterialTheme.typography.bodySmall)
                                if (feed.category == "జిల్లా వార్త") {
                                    Text("Location: ${feed.district ?: ""}, ${feed.state ?: ""}", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            Text("Last Check: ${formatTime(feed.lastFetchTime)}", style = MaterialTheme.typography.bodySmall)
                            feed.lastError?.let { Text("Error: $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        }
                        IconButton(onClick = { handleTogglePause(feed) }) {
                            Icon(if (feed.isPaused) Icons.Default.PlayArrow else Icons.Default.Pause, "Toggle Pause")
                        }
                        IconButton(onClick = {
                             editingRssId = feed.id; rssUrl = feed.url; rssCategory = feed.category
                             if(feed.category == "జిల్లా వార్త") { selectedState = feed.state ?: "TS"; selectedDistrict = feed.district }
                        }) {
                            Icon(Icons.Default.Edit, "Edit")
                        }
                        IconButton(onClick = { handleRssDelete(feed.id) }) {
                            Icon(Icons.Default.Delete, "Delete")
                        }
                    }
                }
            }
        }
    }
}
