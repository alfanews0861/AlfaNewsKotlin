package com.alfanews.telugu.views

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.Constants
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun GNewsDashboardView() {
    var stats by remember { mutableStateOf<GNewsStats?>(null) }
    var logs by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var recentNews by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var manualTriggerLoading by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    fun fetchData() {
        scope.launch {
            loading = true
            try {
                // Fetch stats
                val newsCount = FirebaseService.db.collection("news")
                    .whereArrayContains("categories", "National")
                    .get().await().size()

                val stateDoc = FirebaseService.db.collection("system_settings").document("gnews_state").get().await()
                val lastIdx = (stateDoc.data?.get("lastDistrictIndex") as? Long ?: 0).toInt()

                stats = GNewsStats(
                    totalNationalNews = newsCount,
                    lastDistrictIndex = lastIdx,
                    lastRun = (stateDoc.data?.get("lastRun") as? com.google.firebase.Timestamp)?.toDate()
                )

                // Fetch logs
                val logSnapshot = FirebaseService.db.collection("gnews_fetch_logs")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(20)
                    .get().await()
                logs = logSnapshot.documents.map { it.data ?: mapOf() }

                // Fetch recent GNews
                val newsSnapshot = FirebaseService.db.collection("news")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(15)
                    .get().await()
                recentNews = newsSnapshot.documents.map { it.data ?: mapOf() }

            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("GNews డ్యాష్‌బోర్డ్", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { fetchData() }) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh")
            }
        }

        if (loading && stats == null) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            // Stats Row
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("నేషనల్ వార్తలు", stats?.totalNationalNews.toString(), Modifier.weight(1f))
                StatCard("చివరి ఇండెక్స్", stats?.lastDistrictIndex.toString(), Modifier.weight(1f))
            }

            stats?.let { s ->
                val nextAp = Constants.AP_DISTRICTS.getOrNull(s.lastDistrictIndex % Constants.AP_DISTRICTS.size) ?: "Unknown"
                val nextTs = Constants.TS_DISTRICTS.getOrNull(s.lastDistrictIndex % Constants.TS_DISTRICTS.size) ?: "Unknown"

                Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                    Column(Modifier.padding(12.dp)) {
                        Text("తదుపరి జిల్లాలు (Next Batch):", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        Text("AP: $nextAp, $nextTs", style = MaterialTheme.typography.bodySmall)
                        s.lastRun?.let {
                            Text(
                                "చివరి రన్: ${SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()).format(it)}",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }

            Button(
                onClick = {
                    scope.launch {
                        manualTriggerLoading = true
                        FirebaseFunctionsService.fetchGNews(null)
                        fetchData()
                        manualTriggerLoading = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !manualTriggerLoading
            ) {
                if (manualTriggerLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(Modifier.width(8.dp))
                }
                Text("ఇప్పుడే రన్ చేయి (Manual Trigger)")
            }

            // Recent News
            Text("తాజా వార్తలు", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            recentNews.forEach { news ->
                val headline = (news["headline"] as? Map<*, *>)?.get("telugu") as? String ?: "No Title"
                val content = (news["content"] as? Map<*, *>)?.get("telugu") as? String ?: ""
                val category = news["category"] as? String ?: "General"
                val district = news["district"] as? String ?: "General"
                val mediaUrl = news["mediaUrl"] as? String ?: ""

                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (mediaUrl.isNotEmpty()) {
                                // Simple text placeholder for image status
                                Text("🖼️", modifier = Modifier.padding(end = 8.dp))
                            }
                            Text(headline, fontWeight = FontWeight.Bold, maxLines = 2, modifier = Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(content, style = MaterialTheme.typography.bodySmall, maxLines = 3, color = Color.Gray)
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(
                                color = MaterialTheme.colorScheme.primaryContainer,
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    category,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                            Surface(
                                color = MaterialTheme.colorScheme.secondaryContainer,
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    district,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                }
            }

            // Logs
            Text("ఫెచ్ లాగ్స్", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            logs.forEach { log ->
                val ts = (log["timestamp"] as? com.google.firebase.Timestamp)?.toDate()
                val count = log["districtsFetched"] as? Long ?: 0
                val start = log["startIndex"] as? Long ?: 0

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(Modifier.padding(8.dp)) {
                        Text(
                            ts?.let { SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(it) } ?: "N/A",
                            style = MaterialTheme.typography.labelSmall
                        )
                        Text(
                            "Districts Fetched: $count (Started from $start)",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, style = MaterialTheme.typography.labelSmall)
            Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        }
    }
}

data class GNewsStats(
    val totalNationalNews: Int,
    val lastDistrictIndex: Int,
    val lastRun: Date?
)
