package com.alfanews.telugu.views

import android.widget.Toast
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.NotificationHelper
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminNotificationsPageView(showTitle: Boolean = true) {
    var latestPosts by remember { mutableStateOf<List<NewsPost>>(emptyList()) }
    var selectedPostId by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var loadingPosts by remember { mutableStateOf(true) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Live Notification Engine Health & Controls state (settings/notifications + settings/notif_daily_breaking)
    var scheduledEnabled by remember { mutableStateOf(true) }
    var breakingEnabled by remember { mutableStateOf(true) }
    var pauseScheduledUntil by remember { mutableLongStateOf(0L) }
    var pauseBreakingUntil by remember { mutableLongStateOf(0L) }
    var dailyBreakingCount by remember { mutableIntStateOf(0) }
    var lastScheduledHeadline by remember { mutableStateOf("") }
    var lastBreakingHeadline by remember { mutableStateOf("") }
    var loadingHealth by remember { mutableStateOf(true) }
    var updatingSettings by remember { mutableStateOf(false) }

    // Modern Notification Channels
    val channels = linkedMapOf(
        "general_news_v2" to "General News (సాధారణ వార్తలు)",
        "breaking_news" to "Breaking News (బ్రేకింగ్ అలర్ట్)",
        "local_news_v2" to "Local District News (జిల్లా వార్తలు)"
    )
    var selectedChannelId by remember { mutableStateOf("general_news_v2") }
    var channelExpanded by remember { mutableStateOf(false) }

    // Audience Scope (All Users vs Specific Canonical District)
    var targetScope by remember { mutableStateOf("all") } // "all" or "district"
    var selectedDistrict by remember { mutableStateOf(Constants.ALL_DISTRICTS.firstOrNull() ?: "హైదరాబాద్") }
    var districtExpanded by remember { mutableStateOf(false) }

    // Explicit Alert vs Silent toggle
    var isSilentMode by remember { mutableStateOf(false) }

    suspend fun refreshHealth() {
        loadingHealth = true
        try {
            val todayIst = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("Asia/Kolkata")
            }.format(Date())

            val settingsDoc = FirebaseService.db.collection("settings").document("notifications").get().await()
            val data = settingsDoc.data ?: emptyMap<String, Any>()
            scheduledEnabled = data["scheduledNotificationsEnabled"] as? Boolean ?: true
            breakingEnabled = data["breakingNotificationsEnabled"] as? Boolean ?: true
            pauseScheduledUntil = (data["pauseScheduledUntil"] as? Number)?.toLong() ?: 0L
            pauseBreakingUntil = (data["pauseBreakingUntil"] as? Number)?.toLong() ?: 0L

            val schedSummary = data["lastScheduledSummary"] as? Map<*, *>
            lastScheduledHeadline = schedSummary?.get("headline") as? String ?: ""

            val breakSummary = data["lastBreakingSummary"] as? Map<*, *>
            lastBreakingHeadline = breakSummary?.get("headline") as? String ?: ""

            val quotaDoc = FirebaseService.db.collection("settings").document("notif_daily_breaking").get().await()
            val qData = quotaDoc.data
            dailyBreakingCount = if (qData != null && qData["date"] == todayIst) {
                (qData["count"] as? Number)?.toInt() ?: 0
            } else {
                0
            }
        } catch (e: Exception) {
            android.util.Log.e("AdminNotifications", "Error loading notification health: ${e.message}")
        } finally {
            loadingHealth = false
        }
    }

    fun updateNotificationToggle(field: String, enabled: Boolean) {
        scope.launch {
            updatingSettings = true
            try {
                val payload = mutableMapOf<String, Any>(field to enabled)
                if (enabled) {
                    if (field == "scheduledNotificationsEnabled") payload["pauseScheduledUntil"] = 0L
                    if (field == "breakingNotificationsEnabled") payload["pauseBreakingUntil"] = 0L
                }
                FirebaseService.db.collection("settings").document("notifications")
                    .set(payload, SetOptions.merge()).await()
                if (field == "scheduledNotificationsEnabled") {
                    scheduledEnabled = enabled
                    if (enabled) pauseScheduledUntil = 0L
                } else {
                    breakingEnabled = enabled
                    if (enabled) pauseBreakingUntil = 0L
                }
                Toast.makeText(context, "నోటిఫికేషన్ సెట్టింగ్ అప్‌డేట్ అయింది", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "అప్‌డేట్ విఫలమైంది: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                updatingSettings = false
            }
        }
    }

    fun resumeAllNotifications() {
        scope.launch {
            updatingSettings = true
            try {
                val todayIst = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("Asia/Kolkata")
                }.format(Date())

                FirebaseService.db.collection("settings").document("notifications").set(
                    mapOf(
                        "scheduledNotificationsEnabled" to true,
                        "breakingNotificationsEnabled" to true,
                        "pauseScheduledUntil" to 0L,
                        "pauseBreakingUntil" to 0L
                    ),
                    SetOptions.merge()
                ).await()

                if (dailyBreakingCount >= 6) {
                    FirebaseService.db.collection("settings").document("notif_daily_breaking").set(
                        mapOf("date" to todayIst, "count" to 0),
                        SetOptions.merge()
                    ).await()
                    dailyBreakingCount = 0
                }

                scheduledEnabled = true
                breakingEnabled = true
                pauseScheduledUntil = 0L
                pauseBreakingUntil = 0L
                Toast.makeText(context, "అన్ని నోటిఫికేషన్లు తిరిగి ప్రారంభించబడ్డాయి!", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "లోపం: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                updatingSettings = false
            }
        }
    }

    LaunchedEffect(Unit) {
        launch { refreshHealth() }
        loadingPosts = true
        try {
            val snapshot = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                FirebaseService.db.collection("news")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(100)
                    .get()
                    .await()
            }

            if (snapshot != null) {
                latestPosts = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val headlineData = data["headline"] as? Map<*, *> ?: emptyMap<Any, Any>()

                    NewsPost(
                        id = doc.id,
                        headline = com.alfanews.telugu.models.Headline(
                            telugu = headlineData["telugu"] as? String ?: "",
                            english = headlineData["english"] as? String ?: ""
                        ),
                        content = com.alfanews.telugu.models.Content(),
                        mediaUrl = data["mediaUrl"] as? String ?: "",
                        categories = listOf(data["category"] as? String ?: ""),
                        district = data["district"] as? String
                    )
                }
            }
        } catch (e: Exception) {
            val isCancellation = e is kotlinx.coroutines.CancellationException ||
                e.toString().contains("CancellationException") ||
                e.message?.contains("left the composition") == true
            if (isCancellation) throw e as Throwable
            android.util.Log.e("AdminNotifications", "Error loading posts: ${e.message}")
        } finally {
            loadingPosts = false
        }
    }

    var customTitle by remember { mutableStateOf("") }
    var customBody by remember { mutableStateOf("") }
    var useCustomMessage by remember { mutableStateOf(false) }

    fun handleSend() {
        if (!useCustomMessage && selectedPostId.isEmpty()) {
            Toast.makeText(context, "దయచేసి ఒక వార్తను ఎంచుకోండి లేదా కస్టమ్ మెసేజ్ టైప్ చేయండి.", Toast.LENGTH_SHORT).show()
            return
        }
        if (useCustomMessage && (customTitle.isEmpty() || customBody.isEmpty())) {
            Toast.makeText(context, "శీర్షిక మరియు వివరణ తప్పనిసరి.", Toast.LENGTH_SHORT).show()
            return
        }

        val selectedPost = latestPosts.find { it.id == selectedPostId }
        val resolvedTopic = if (targetScope == "district") {
            NotificationHelper.getTopicName("district", selectedDistrict)
        } else {
            "all_users"
        }
        val resolvedDistrict = if (targetScope == "district") {
            NotificationHelper.getCanonicalDistrict(selectedDistrict)
        } else {
            null
        }

        scope.launch {
            isSending = true
            try {
                val finalTitle = if (useCustomMessage) customTitle else {
                    if (selectedChannelId == "breaking_news") {
                        "🔴 బ్రేకింగ్: ${selectedPost?.headline?.telugu ?: ""}"
                    } else if (targetScope == "district") {
                        "📍 $selectedDistrict: ${selectedPost?.headline?.telugu ?: ""}"
                    } else {
                        selectedPost?.headline?.telugu ?: ""
                    }
                }

                val finalBody = if (useCustomMessage) customBody else selectedPost?.headline?.telugu ?: ""
                val resolvedNewsId = if (useCustomMessage) null else selectedPost?.id
                val actionUrl = if (resolvedNewsId != null) "alfanews://news/$resolvedNewsId" else ""
                val imageUrl = if (useCustomMessage) "" else selectedPost?.mediaUrl ?: ""

                val result = FirebaseFunctionsService.triggerPushBroadcast(
                    title = finalTitle,
                    body = finalBody,
                    actionUrl = actionUrl,
                    topic = resolvedTopic,
                    silent = isSilentMode,
                    channelId = selectedChannelId,
                    imageUrl = imageUrl.ifBlank { null },
                    newsId = resolvedNewsId,
                    district = resolvedDistrict
                )

                if (result.isSuccess) {
                    AnalyticsService.logAdminMessageSent("push_broadcast")
                    Toast.makeText(context, "నోటిఫికేషన్ విజయవంతంగా పంపబడింది!", Toast.LENGTH_SHORT).show()
                    if (!useCustomMessage) selectedPostId = "" else {
                        customTitle = ""
                        customBody = ""
                    }
                } else {
                    Toast.makeText(
                        context,
                        "లోపం: ${result.exceptionOrNull()?.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                val isCancellation = e is kotlinx.coroutines.CancellationException ||
                    e.toString().contains("CancellationException") ||
                    e.message?.contains("left the composition") == true
                if (!isCancellation) {
                    Toast.makeText(context, "లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                isSending = false
            }
        }
    }

    val nowMs = System.currentTimeMillis()
    val scheduledPaused = pauseScheduledUntil > nowMs
    val breakingPaused = pauseBreakingUntil > nowMs
    val isAnyStopped = !scheduledEnabled || !breakingEnabled || scheduledPaused || breakingPaused || dailyBreakingCount >= 6

    ElevatedCard(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        shape = RoundedCornerShape(8.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (showTitle) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("📢", fontSize = 24.sp)
                    Text(
                        text = "Notification Control & Broadcast",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // 1. Live Notification Engine Health & Controls Card
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (isAnyStopped) Color(0xFFFFF7ED) else Color(0xFFF0FDF4)
                ),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "నోటిఫికేషన్ సిస్టమ్ స్థితి",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = if (loadingHealth) "లోడ్ అవుతోంది..." else "నేటి బ్రేకింగ్: $dailyBreakingCount / 6",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (dailyBreakingCount >= 6) Color(0xFFDC2626) else Color(0xFF16A34A)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("షెడ్యూల్డ్ వార్తలు (8AM, 1PM, 6PM, 9PM)", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF0F172A))
                            if (scheduledPaused) {
                                Text("తాత్కాలిక పాజ్‌లో ఉంది", fontSize = 12.sp, color = Color(0xFFD97706))
                            }
                        }
                        Switch(
                            checked = scheduledEnabled && !scheduledPaused,
                            enabled = !updatingSettings,
                            onCheckedChange = { updateNotificationToggle("scheduledNotificationsEnabled", it) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("బ్రేకింగ్ న్యూస్ అలర్ట్స్ (రోజుకు 6 స్టేట్ / 3 జిల్లా)", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF0F172A))
                            if (breakingPaused) {
                                Text("తాత్కాలిక పాజ్‌లో ఉంది", fontSize = 12.sp, color = Color(0xFFD97706))
                            }
                        }
                        Switch(
                            checked = breakingEnabled && !breakingPaused,
                            enabled = !updatingSettings,
                            onCheckedChange = { updateNotificationToggle("breakingNotificationsEnabled", it) }
                        )
                    }

                    if (lastScheduledHeadline.isNotBlank()) {
                        Text(
                            text = "చివరి షెడ్యూల్డ్: $lastScheduledHeadline",
                            fontSize = 12.sp,
                            color = Color(0xFF475569),
                            maxLines = 2
                        )
                    }
                    if (lastBreakingHeadline.isNotBlank()) {
                        Text(
                            text = "చివరి బ్రేకింగ్: $lastBreakingHeadline",
                            fontSize = 12.sp,
                            color = Color(0xFF475569),
                            maxLines = 2
                        )
                    }

                    if (isAnyStopped) {
                        OutlinedButton(
                            onClick = { resumeAllNotifications() },
                            enabled = !updatingSettings,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("అన్ని నోటిఫికేషన్లు తిరిగి ప్రారంభించు (Resume All)", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            HorizontalDivider()

            // 2. Manual Broadcast Channel & Audience
            Text(
                text = "నోటిఫికేషన్ ఛానెల్ (Channel)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            ExposedDropdownMenuBox(
                expanded = channelExpanded,
                onExpandedChange = { channelExpanded = !channelExpanded },
            ) {
                OutlinedTextField(
                    value = channels[selectedChannelId] ?: "",
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    label = { Text("ఛానెల్") },
                    shape = RoundedCornerShape(8.dp),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = channelExpanded) }
                )
                ExposedDropdownMenu(
                    expanded = channelExpanded,
                    onDismissRequest = { channelExpanded = false }
                ) {
                    channels.forEach { (id, name) ->
                        DropdownMenuItem(
                            text = { Text(name) },
                            onClick = {
                                selectedChannelId = id
                                if (id == "breaking_news") isSilentMode = false
                                channelExpanded = false
                            }
                        )
                    }
                }
            }

            // Target Audience Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { targetScope = "all" },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (targetScope == "all") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = if (targetScope == "all") MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                ) {
                    Text("అందరు (All Users)")
                }
                Button(
                    onClick = {
                        targetScope = "district"
                        selectedChannelId = "local_news_v2"
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (targetScope == "district") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = if (targetScope == "district") MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                ) {
                    Text("నిర్దిష్ట జిల్లా")
                }
            }

            if (targetScope == "district") {
                ExposedDropdownMenuBox(
                    expanded = districtExpanded,
                    onExpandedChange = { districtExpanded = !districtExpanded },
                ) {
                    OutlinedTextField(
                        value = selectedDistrict,
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        label = { Text("జిల్లాను ఎంచుకోండి") },
                        shape = RoundedCornerShape(8.dp),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) }
                    )
                    ExposedDropdownMenu(
                        expanded = districtExpanded,
                        onDismissRequest = { districtExpanded = false }
                    ) {
                        Constants.ALL_DISTRICTS.forEach { dist ->
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

            // Explicit Sound/Alert Toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isSilentMode) "సైలెంట్ నోటిఫికేషన్ (శబ్దం లేకుండా)" else "అలర్ట్ సౌండ్‌తో పంపు (Alert)",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
                Switch(
                    checked = !isSilentMode,
                    onCheckedChange = { alertEnabled -> isSilentMode = !alertEnabled }
                )
            }

            // Toggle between Custom and Post-based
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (useCustomMessage) "✍️ కస్టమ్ మెసేజ్ పంపు" else "📰 వార్తను ఎంచుకో",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Button(
                    onClick = { useCustomMessage = !useCustomMessage },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                ) {
                    Text(if (useCustomMessage) "వార్తకు మారు" else "కస్టమ్ కి మారు")
                }
            }

            if (useCustomMessage) {
                OutlinedTextField(
                    value = customTitle,
                    onValueChange = { customTitle = it },
                    label = { Text("నోటిఫికేషన్ శీర్షిక (Title)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = customBody,
                    onValueChange = { customBody = it },
                    label = { Text("నోటిఫికేషన్ వివరణ (Body)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    minLines = 3
                )
            } else {
                if (loadingPosts) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else {
                    var postExpanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = postExpanded,
                        onExpandedChange = { postExpanded = !postExpanded },
                    ) {
                        OutlinedTextField(
                            value = latestPosts.find { it.id == selectedPostId }?.headline?.telugu ?: "-- వార్తను ఎంచుకోండి --",
                            onValueChange = { },
                            readOnly = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            label = { Text("వార్త") },
                            shape = RoundedCornerShape(8.dp),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = postExpanded) }
                        )
                        ExposedDropdownMenu(
                            expanded = postExpanded,
                            onDismissRequest = { postExpanded = false }
                        ) {
                            latestPosts.forEach { post ->
                                DropdownMenuItem(
                                    text = { Text(post.headline.telugu, maxLines = 2) },
                                    onClick = {
                                        selectedPostId = post.id
                                        postExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { handleSend() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                enabled = !isSending && (useCustomMessage || selectedPostId.isNotEmpty()),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedChannelId == "breaking_news") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                )
            ) {
                if (isSending) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("📢 SEND BROADCAST", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
