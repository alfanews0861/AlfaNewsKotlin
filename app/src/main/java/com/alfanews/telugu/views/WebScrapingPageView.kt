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
import com.alfanews.telugu.models.ScrapingSource
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import com.alfanews.telugu.utils.Constants

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebScrapingPageView() {
    var sources by remember { mutableStateOf<List<ScrapingSource>>(emptyList()) }
    var siteUrl by remember { mutableStateOf("") }
    var siteName by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("జిల్లా వార్త") }
    var selectedState by remember { mutableStateOf("TS") }
    var selectedDistrict by remember { mutableStateOf<String?>(null) }
    var editingId by remember { mutableStateOf<String?>(null) }
    var scrapeGroup by remember { mutableStateOf("1") }
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

    fun fetchSources() {
        scope.launch {
            isFetching = true
            try {
                val snapshot = FirebaseService.db.collection("scraping_sources")
                    .orderBy("siteName", Query.Direction.ASCENDING)
                    .get()
                    .await()

                sources = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    ScrapingSource(
                        id = doc.id,
                        url = data["url"] as? String ?: "",
                        siteName = data["siteName"] as? String ?: "",
                        category = data["category"] as? String ?: "",
                        state = data["state"] as? String,
                        district = data["district"] as? String,
                        lastStatus = data["lastStatus"] as? String,
                        lastFetchTime = (data["lastFetchTime"] as? com.google.firebase.Timestamp)?.toDate()?.time,
                        lastError = data["lastError"] as? String,
                        lastFailedCount = (data["lastFailedCount"] as? Number)?.toInt(),
                        isPaused = data["isPaused"] as? Boolean ?: false,
                        group = (data["group"] as? Number)?.toInt(),
                        processed24h = (data["processed24h"] as? Number)?.toInt() ?: 0,
                        failed24h = (data["failed24h"] as? Number)?.toInt() ?: 0,
                        lastResetTime = (data["lastResetTime"] as? Number)?.toLong()
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
        fetchSources()
    }

    fun formatTime(timestamp: Long?): String {
        if (timestamp == null) return "Never"
        return SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()).format(Date(timestamp))
    }

    fun handleSubmit() {
        if (siteUrl.isEmpty() || siteName.isEmpty()) {
            Toast.makeText(context, "సరైన URL ఇవ్వండి.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                val payload = hashMapOf<String, Any?>(
                    "url" to siteUrl,
                    "siteName" to siteName,
                    "category" to category,
                    "group" to (scrapeGroup.toIntOrNull() ?: 1)
                )

                if (category == "జిల్లా వార్త") {
                    payload["state"] = selectedState
                    payload["district"] = selectedDistrict ?: ""
                    payload["meta"] = mapOf("location" to (selectedDistrict ?: selectedState))
                } else {
                    payload["state"] = null
                    payload["district"] = null
                    payload["meta"] = null
                }

                val currentId = editingId
                if (currentId != null) {
                    FirebaseService.db.collection("scraping_sources")
                        .document(currentId)
                        .update(payload)
                        .await()
                } else {
                    payload["lastStatus"] = "active"
                    payload["isPaused"] = false
                    FirebaseService.db.collection("scraping_sources")
                        .add(payload)
                        .await()
                }

                siteUrl = ""
                siteName = ""
                category = "జిల్లా వార్త"
                selectedState = "TS"
                selectedDistrict = null
                scrapeGroup = "1"
                editingId = null
                fetchSources()
            } catch (e: Exception) {
                Toast.makeText(context, "సేవ్ చేయడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSubmitting = false
            }
        }
    }

    fun handleDelete(id: String) {
        scope.launch {
            try {
                FirebaseService.db.collection("scraping_sources")
                    .document(id)
                    .delete()
                    .await()
                fetchSources()
            } catch (e: Exception) {
                Toast.makeText(context, "తొలగించడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun handleTogglePause(src: ScrapingSource) {
        scope.launch {
            try {
                FirebaseService.db.collection("scraping_sources")
                    .document(src.id)
                    .update("isPaused", !src.isPaused)
                    .await()
                fetchSources()
            } catch (e: Exception) {
                Toast.makeText(context, "స్టేటస్ మార్చడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun handleManualTrigger() {
        scope.launch {
            isProcessing = true
            statusLog = listOf("స్క్రాపింగ్ మొదలవుతోంది...")
            try {
                // Manually trigger all active sources by passing null group
                val result = FirebaseFunctionsService.processScrapingSources(null)
                if (result.isSuccess) {
                    val data = result.getOrNull() ?: emptyMap()
                    val log = data["log"] as? String
                    statusLog = if (log != null) {
                        log.split("\n")
                    } else {
                        listOf(data["message"] as? String ?: "Completed")
                    }
                } else {
                    statusLog = listOf("లోపం: ${result.exceptionOrNull()?.message}")
                }
                fetchSources()
            } catch (e: Exception) {
                statusLog = listOf("లోపం: ${e.message}")
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
                Text("వెబ్ స్క్రాపింగ్ (No RSS)", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("RSS ఫీడ్ లేని వెబ్‌సైట్‌ల నుండి వార్తలను సేకరించడానికి ఇది ఉపయోగపడుతుంది.", style = MaterialTheme.typography.bodyMedium)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { handleManualTrigger() },
                        enabled = !isProcessing,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(if (isProcessing) "స్క్రాపింగ్..." else "ఇప్పుడే రన్ చేయి")
                    }
                    Button(
                        onClick = { fetchSources() },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                    ) {
                        Text("రిఫ్రెష్")
                    }
                }

                if (isProcessing || statusLog.isNotEmpty()) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(240.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        LazyColumn(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(statusLog) { line ->
                                Text(line, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
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
                    text = if (editingId != null) "సోర్స్‌ను ఎడిట్ చేయండి" else "కొత్త వెబ్‌సైట్‌ను జోడించండి",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = siteName,
                        onValueChange = { siteName = it },
                        label = { Text("సైట్ పేరు (Site Name)") },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("ఉదా: Namasthe Telangana") }
                    )
                    OutlinedTextField(
                        value = siteUrl,
                        onValueChange = { siteUrl = it },
                        label = { Text("URL (Homepage/Section)") },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("https://ntnews.com/telangana") }
                    )
                }

                // Group Selection
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Scraping Group:", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    listOf("1", "2", "3", "4").forEach { g ->
                        FilterChip(
                            selected = scrapeGroup == g,
                            onClick = { scrapeGroup = g },
                            label = { Text(g) }
                        )
                    }
                }

                // Category Selection with ExposedDropdownMenu
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

                // Conditional Region Details
                if (category == "జిల్లా వార్త") {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text("ప్రాంతం వివరాలు (State & District)", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = { selectedState = "TS"; selectedDistrict = null },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (selectedState == "TS") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                        contentColor = if (selectedState == "TS") MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                                    ),
                                    modifier = Modifier.weight(1f)
                                ) { Text("Telangana") }
                                Button(
                                    onClick = { selectedState = "AP"; selectedDistrict = null },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (selectedState == "AP") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                        contentColor = if (selectedState == "AP") MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                                    ),
                                    modifier = Modifier.weight(1f)
                                ) { Text("Andhra Pradesh") }
                            }

                            var districtExpanded by remember { mutableStateOf(false) }
                            val currentDistricts = if (selectedState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS

                            ExposedDropdownMenuBox(
                                expanded = districtExpanded,
                                onExpandedChange = { districtExpanded = !districtExpanded },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                OutlinedTextField(
                                    value = selectedDistrict ?: "",
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("జిల్లాను ఎంచుకోండి") },
                                    placeholder = { Text("Select District") },
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) },
                                    colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                                    modifier = Modifier.menuAnchor().fillMaxWidth()
                                )
                                ExposedDropdownMenu(
                                    expanded = districtExpanded,
                                    onDismissRequest = { districtExpanded = false },
                                    modifier = Modifier.heightIn(max = 300.dp)
                                ) {
                                    currentDistricts.forEach { dist ->
                                        DropdownMenuItem(
                                            text = { Text(dist) },
                                            onClick = {
                                                selectedDistrict = dist
                                                districtExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
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
                        Text(if (isSubmitting) "సేవ్..." else "సేవ్ చేయి")
                    }
                    if (editingId != null) {
                        Button(
                            onClick = {
                                siteUrl = ""
                                siteName = ""
                                category = "జిల్లా వార్త"
                                selectedState = "TS"
                                selectedDistrict = null
                                scrapeGroup = "1"
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

        // Sources List
        if (isFetching) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (sources.isEmpty()) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("సోర్స్‌లు ఏవీ లేవు.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.height(500.dp), // Increased height for better visibility
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(sources) { src ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = if (src.isPaused) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface
                        ),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Top Row: Title, Category, District, Status Icon
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(src.siteName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        if (src.isPaused) {
                                            Surface(
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                shape = RoundedCornerShape(4.dp)
                                            ) {
                                                Text("PAUSED", modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.surface)
                                            }
                                        }
                                        Icon(
                                            if (src.lastStatus == "error") Icons.Default.Error else Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = if (src.lastStatus == "error") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Surface(
                                            color = MaterialTheme.colorScheme.secondaryContainer,
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(src.category, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSecondaryContainer)
                                        }
                                        if (src.category == "జిల్లా వార్త" && src.district != null) {
                                            Surface(
                                                color = MaterialTheme.colorScheme.tertiaryContainer,
                                                shape = RoundedCornerShape(4.dp)
                                            ) {
                                                Text("${src.state ?: ""} - ${src.district}", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                                            }
                                        }
                                        Surface(
                                            color = MaterialTheme.colorScheme.primaryContainer,
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text("Group: ${src.group ?: 1}", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                                        }

                                        Surface(
                                            color = MaterialTheme.colorScheme.secondaryContainer,
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text("24h: ✅ ${src.processed24h} | ❌ ${src.failed24h}", 
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), 
                                                style = MaterialTheme.typography.labelSmall, 
                                                color = MaterialTheme.colorScheme.onSecondaryContainer
                                            )
                                        }
                                    }
                                }
                                
                                // Action Buttons
                                Row {
                                    IconButton(onClick = { handleTogglePause(src) }, modifier = Modifier.size(32.dp)) {
                                        Icon(
                                            if (src.isPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                                            contentDescription = "Toggle Pause",
                                            tint = if (src.isPaused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary
                                        )
                                    }
                                    IconButton(onClick = {
                                        siteUrl = src.url
                                        siteName = src.siteName
                                        category = src.category
                                        src.state?.let { selectedState = it }
                                        selectedDistrict = src.district
                                        scrapeGroup = (src.group ?: 1).toString()
                                        editingId = src.id
                                    }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                                    }
                                    IconButton(onClick = { handleDelete(src.id) }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }

                            // Second Row: URL
                            Text(src.url, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                            
                            // Third Row: Stats
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Last Check: ${formatTime(src.lastFetchTime)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
                                src.lastProcessedCount?.let {
                                    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(4.dp)) {
                                        Text("Added: $it", modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                                src.lastFailedCount?.let {
                                    Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(4.dp)) {
                                        Text("Failed: $it", modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onErrorContainer)
                                    }
                                }
                            }
                            
                            src.lastError?.let {
                                Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }
        }
    }
}
