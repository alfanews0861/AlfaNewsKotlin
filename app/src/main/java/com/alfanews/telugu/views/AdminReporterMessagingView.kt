package com.alfanews.telugu.views

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.ReporterConversation
import com.alfanews.telugu.models.ReporterMessage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.DateTimeUtils
import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminReporterMessagingView(
    currentUser: User,
    initialReporterId: String? = null,
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var conversations by remember { mutableStateOf<List<ReporterConversation>>(emptyList()) }
    var allReporters by remember { mutableStateOf<List<User>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf(0) } // 0: Conversations, 1: All Reporters, 2: Warnings

    // Active 1-on-1 Chat with selected reporter
    var activeChatReporter by remember { mutableStateOf<ReporterConversation?>(null) }
    var showBroadcastDialog by remember { mutableStateOf(false) }
    var isRunningInactivityScan by remember { mutableStateOf(false) }

    // Real-time conversations list listener
    DisposableEffect(Unit) {
        val convRef = FirebaseService.db.collection("reporter_conversations")
            .orderBy("updatedAt", Query.Direction.DESCENDING)

        val listener: ListenerRegistration = convRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                loading = false
                return@addSnapshotListener
            }

            if (snapshot != null) {
                val list = snapshot.documents.mapNotNull { doc ->
                    try {
                        val data = doc.data ?: return@mapNotNull null
                        val updatedTs = when (val t = data["updatedAt"] ?: data["lastMessageTime"]) {
                            is Timestamp -> t.toDate().time
                            is Number -> t.toLong()
                            else -> 0L
                        }
                        val lastMsgTs = when (val t = data["lastMessageTime"]) {
                            is Timestamp -> t.toDate().time
                            is Number -> t.toLong()
                            else -> 0L
                        }

                        ReporterConversation(
                            reporterId = doc.id,
                            reporterName = data["reporterName"] as? String ?: "Reporter",
                            reporterPhone = data["reporterPhone"] as? String ?: "",
                            reporterDistrict = data["reporterDistrict"] as? String ?: "",
                            reporterMandal = data["reporterMandal"] as? String ?: "",
                            reporterPhotoUrl = data["reporterPhotoUrl"] as? String ?: "",
                            lastMessage = data["lastMessage"] as? String ?: "",
                            lastMessageTime = lastMsgTs,
                            lastSenderRole = data["lastSenderRole"] as? String ?: "",
                            lastSenderId = data["lastSenderId"] as? String ?: "",
                            unreadCountForAdmin = (data["unreadCountForAdmin"] as? Number)?.toInt() ?: 0,
                            unreadCountForReporter = (data["unreadCountForReporter"] as? Number)?.toInt() ?: 0,
                            updatedAt = updatedTs
                        )
                    } catch (_: Exception) {
                        null
                    }
                }
                conversations = list
                loading = false
            }
        }

        onDispose {
            listener.remove()
        }
    }

    // Fetch all active reporters for comprehensive picker & fallback
    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val snapshot = FirebaseService.db.collection("users")
                    .whereIn("role", listOf("REPORTER", "reporter", 2, 2.0, "2"))
                    .get()
                    .await()

                allReporters = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    User(
                        id = doc.id,
                        name = data["name"] as? String ?: "Reporter",
                        phone = data["phone"] as? String,
                        district = data["district"] as? String,
                        assignedMandal = data["assignedMandal"] as? String ?: data["mandal"] as? String,
                        photoUrl = data["photoUrl"] as? String,
                        points = (data["points"] as? Number)?.toInt() ?: 0
                    )
                }

                // If initial reporter ID was passed, open their chat directly
                if (!initialReporterId.isNullOrBlank()) {
                    val existing = conversations.find { it.reporterId == initialReporterId }
                    if (existing != null) {
                        activeChatReporter = existing
                    } else {
                        val rep = allReporters.find { it.id == initialReporterId }
                        if (rep != null) {
                            activeChatReporter = ReporterConversation(
                                reporterId = rep.id,
                                reporterName = rep.name,
                                reporterPhone = rep.phone ?: "",
                                reporterDistrict = rep.district ?: "",
                                reporterMandal = rep.assignedMandal ?: "",
                                reporterPhotoUrl = rep.photoUrl ?: ""
                            )
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    // Filtered lists
    val filteredConversations = remember(conversations, searchQuery, selectedTab) {
        val q = searchQuery.trim().lowercase()
        val base = when (selectedTab) {
            2 -> conversations.filter { it.lastMessage.contains("⚠️") || it.lastMessage.contains("హెచ్చరిక") }
            else -> conversations
        }
        if (q.isBlank()) base else {
            base.filter {
                it.reporterName.lowercase().contains(q) ||
                it.reporterPhone.contains(q) ||
                it.reporterDistrict.lowercase().contains(q) ||
                it.reporterMandal.lowercase().contains(q) ||
                it.lastMessage.lowercase().contains(q)
            }
        }
    }

    val filteredAllReporters = remember(allReporters, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isBlank()) allReporters else {
            allReporters.filter {
                it.name.lowercase().contains(q) ||
                (it.phone?.contains(q) == true) ||
                (it.district?.lowercase()?.contains(q) == true) ||
                (it.assignedMandal?.lowercase()?.contains(q) == true)
            }
        }
    }

    // If chat is open with a reporter, show the 1-on-1 Chat Screen
    if (activeChatReporter != null) {
        AdminOneOnOneChatView(
            reporter = activeChatReporter!!,
            currentUser = currentUser,
            onBack = { activeChatReporter = null }
        )
        return
    }

    Scaffold(
        topBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shadowElevation = 2.dp,
                color = MaterialTheme.colorScheme.surface
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("💬", fontSize = 24.sp)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "రిపోర్టర్ కమ్యూనికేషన్స్",
                                fontFamily = Ramabhadra,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            // Run Inactivity Check button
                            IconButton(
                                onClick = {
                                    scope.launch {
                                        isRunningInactivityScan = true
                                        try {
                                            val res = FirebaseFunctionsService.triggerReporterActivityCheck()
                                            if (res.isSuccess) {
                                                val data = res.getOrNull()
                                                val scanned = data?.get("reportersScanned") ?: 0
                                                val acted = data?.get("inactiveActedOn") ?: 0
                                                Toast.makeText(context, "స్కాన్ పూర్తయింది! మొత్తం: $scanned, హెచ్చరికలు: $acted", Toast.LENGTH_LONG).show()
                                            } else {
                                                Toast.makeText(context, "స్కాన్ లోపం: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                            }
                                        } catch (e: Exception) {
                                            Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                                        } finally {
                                            isRunningInactivityScan = false
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .size(38.dp)
                                    .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape)
                            ) {
                                if (isRunningInactivityScan) {
                                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                } else {
                                    Icon(Icons.Default.HourglassBottom, contentDescription = "Run Inactivity Check", tint = Color(0xFFF57C00), modifier = Modifier.size(20.dp))
                                }
                            }

                            // Broadcast Button
                            Button(
                                onClick = { showBroadcastDialog = true },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.height(38.dp)
                            ) {
                                Icon(Icons.Default.Campaign, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("అందరికీ ప్రకటన", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    // Search Bar
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("రిపోర్టర్ పేరు, ఫోన్, జిల్లా, మండలం వెతుకు...", fontSize = 13.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(18.dp))
                                }
                            }
                        },
                        shape = RoundedCornerShape(24.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                        )
                    )

                    Spacer(Modifier.height(8.dp))

                    // Tabs
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = MaterialTheme.colorScheme.surface,
                        contentColor = MaterialTheme.colorScheme.primary
                    ) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            text = { Text("సంభాషణలు (${conversations.size})", fontSize = 12.sp, fontFamily = Ramabhadra) }
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 },
                            text = { Text("అందరు రిపోర్టర్లు (${allReporters.size})", fontSize = 12.sp, fontFamily = Ramabhadra) }
                        )
                        Tab(
                            selected = selectedTab == 2,
                            onClick = { selectedTab = 2 },
                            text = { Text("హెచ్చరికలు", fontSize = 12.sp, fontFamily = Ramabhadra) }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            if (loading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (selectedTab == 1) {
                // All Reporters Tab
                if (filteredAllReporters.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("రిపోర్టర్లు ఎవరూ కనుగొనబడలేదు.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredAllReporters, key = { it.id }) { reporter ->
                            val existingConv = conversations.find { it.reporterId == reporter.id }
                            ReporterPickerCard(
                                user = reporter,
                                conv = existingConv,
                                onClick = {
                                    activeChatReporter = existingConv ?: ReporterConversation(
                                        reporterId = reporter.id,
                                        reporterName = reporter.name,
                                        reporterPhone = reporter.phone ?: "",
                                        reporterDistrict = reporter.district ?: "",
                                        reporterMandal = reporter.assignedMandal ?: "",
                                        reporterPhotoUrl = reporter.photoUrl ?: ""
                                    )
                                }
                            )
                        }
                    }
                }
            } else {
                // Conversations / Warnings Tab
                if (filteredConversations.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("📭", fontSize = 48.sp)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = if (selectedTab == 2) "ఎటువంటి హెచ్చరికలు లేవు." else "సందేశాలు ఇంకా ప్రారంభం కాలేదు.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 14.sp
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = "'అందరు రిపోర్టర్లు' ట్యాబ్ నుండి కొత్త చాట్ ప్రారంభించండి.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredConversations, key = { it.reporterId }) { conv ->
                            ConversationCard(
                                conv = conv,
                                onClick = { activeChatReporter = conv }
                            )
                        }
                    }
                }
            }
        }
    }

    // Broadcast Announcement Dialog
    if (showBroadcastDialog) {
        var broadcastTitle by remember { mutableStateOf("అల్ఫా న్యూస్ రిపోర్టర్లకు ముఖ్య ప్రకటన 📢") }
        var broadcastBody by remember { mutableStateOf("") }
        var isBroadcasting by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!isBroadcasting) showBroadcastDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Campaign, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(8.dp))
                    Text("అందరు రిపోర్టర్లకు ప్రకటన (Broadcast)", fontSize = 16.sp, fontWeight = FontWeight.Bold, fontFamily = Ramabhadra)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "ఈ సందేశం యాక్టివ్‌గా ఉన్న అందరు రిపోర్టర్ల చాట్‌లోకి వెళ్తుంది మరియు పుష్ నోటిఫికేషన్ రూపంలో డెలివరీ అవుతుంది.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = broadcastTitle,
                        onValueChange = { broadcastTitle = it },
                        label = { Text("ప్రకటన శీర్షిక (Title)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp)
                    )
                    OutlinedTextField(
                        value = broadcastBody,
                        onValueChange = { broadcastBody = it },
                        label = { Text("సందేశం వివరాలు (Body)") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 4,
                        maxLines = 8,
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (broadcastBody.trim().isEmpty()) {
                            Toast.makeText(context, "సందేశం నమోదు చేయండి", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        scope.launch {
                            isBroadcasting = true
                            try {
                                val res = FirebaseFunctionsService.broadcastToAllReporters(broadcastTitle, broadcastBody)
                                if (res.isSuccess) {
                                    val count = res.getOrNull()?.get("count") ?: 0
                                    Toast.makeText(context, "$count మంది రిపోర్టర్లకు ప్రకటన విజయవంతంగా పంపబడింది!", Toast.LENGTH_LONG).show()
                                    showBroadcastDialog = false
                                } else {
                                    Toast.makeText(context, "లోపం: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isBroadcasting = false
                            }
                        }
                    },
                    enabled = broadcastBody.isNotBlank() && !isBroadcasting,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    if (isBroadcasting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text("📢 బ్రాడ్‌కాస్ట్ చేయి")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showBroadcastDialog = false },
                    enabled = !isBroadcasting
                ) {
                    Text("రద్దు చేయి (Cancel)")
                }
            }
        )
    }
}

@Composable
fun ConversationCard(conv: ReporterConversation, onClick: () -> Unit) {
    val dateStr = remember(conv.lastMessageTime) {
        if (conv.lastMessageTime > 0) DateTimeUtils.formatTimestamp(conv.lastMessageTime, "dd MMM, hh:mm a") else ""
    }

    val hasUnread = conv.unreadCountForAdmin > 0
    val isWarning = conv.lastMessage.contains("⚠️") || conv.lastMessage.contains("హెచ్చరిక")

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (hasUnread) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surface
        ),
        border = BorderStroke(1.dp, if (hasUnread) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outlineVariant)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AsyncImage(
                model = conv.reporterPhotoUrl.ifBlank { "https://ui-avatars.com/api/?name=${conv.reporterName}&background=random" },
                contentDescription = conv.reporterName,
                modifier = Modifier.size(50.dp).clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = conv.reporterName,
                        fontWeight = if (hasUnread) FontWeight.ExtraBold else FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = dateStr,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Medium
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${conv.reporterDistrict} • ${conv.reporterMandal}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium
                    )
                    if (conv.reporterPhone.isNotBlank()) {
                        Text(
                            text = " • ${conv.reporterPhone}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(Modifier.height(4.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = conv.lastMessage.ifBlank { "చాట్ ప్రారంభించండి..." },
                        fontSize = 13.sp,
                        color = if (isWarning) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.Normal,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )

                    if (hasUnread) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 6.dp)
                        ) {
                            Text(
                                text = "${conv.unreadCountForAdmin}",
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReporterPickerCard(user: User, conv: ReporterConversation?, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AsyncImage(
                model = user.photoUrl ?: "https://ui-avatars.com/api/?name=${user.name}&background=random",
                contentDescription = user.name,
                modifier = Modifier.size(46.dp).clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = user.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${user.district ?: "జిల్లా లేదు"} - ${user.assignedMandal ?: "మండలం లేదు"}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (!user.phone.isNullOrBlank()) {
                    Text(
                        text = "Ph: ${user.phone}",
                        fontSize = 11.sp,
                        color = Color(0xFF4CAF50),
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Button(
                onClick = onClick,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                modifier = Modifier.height(34.dp)
            ) {
                Icon(Icons.Default.Chat, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(if (conv != null) "ఓపెన్" else "సందేశం", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * 1-on-1 Chat View for Admin with a selected reporter
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminOneOnOneChatView(
    reporter: ReporterConversation,
    currentUser: User,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var messages by remember { mutableStateOf<List<ReporterMessage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var inputText by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }

    val reporterId = reporter.reporterId

    // Real-time listener for messages
    DisposableEffect(reporterId) {
        // Reset unread count for Admin on open
        scope.launch {
            try {
                FirebaseService.db.collection("reporter_conversations")
                    .document(reporterId)
                    .update("unreadCountForAdmin", 0)
                    .await()
            } catch (_: Exception) {}
        }

        val messagesRef = FirebaseService.db.collection("reporter_conversations")
            .document(reporterId)
            .collection("messages")
            .orderBy("timestamp", Query.Direction.ASCENDING)

        val listener: ListenerRegistration = messagesRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                loading = false
                return@addSnapshotListener
            }

            if (snapshot != null) {
                val items = snapshot.documents.mapNotNull { doc ->
                    try {
                        val data = doc.data ?: return@mapNotNull null
                        val ts = when (val t = data["timestamp"]) {
                            is Timestamp -> t.toDate().time
                            is Number -> t.toLong()
                            else -> System.currentTimeMillis()
                        }
                        ReporterMessage(
                            id = doc.id,
                            senderId = data["senderId"] as? String ?: "",
                            senderName = data["senderName"] as? String ?: "Admin",
                            senderRole = data["senderRole"] as? String ?: "ADMIN",
                            text = data["text"] as? String ?: "",
                            type = data["type"] as? String ?: "CHAT",
                            read = data["read"] as? Boolean ?: false,
                            timestamp = ts
                        )
                    } catch (_: Exception) {
                        null
                    }
                }
                messages = items
                loading = false
            }
        }

        onDispose {
            listener.remove()
        }
    }

    // Auto-scroll to bottom
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    fun sendMessage(customType: String = "CHAT", customText: String? = null) {
        val text = (customText ?: inputText).trim()
        if (text.isEmpty() || isSending) return

        scope.launch {
            isSending = true
            try {
                val result = FirebaseFunctionsService.sendAdminReporterMessage(
                    reporterId = reporterId,
                    text = text,
                    type = customType
                )
                if (result.isSuccess) {
                    if (customText == null) inputText = ""
                } else {
                    Toast.makeText(context, "సందేశం పంపడం విఫలమైంది: ${result.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSending = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AsyncImage(
                            model = reporter.reporterPhotoUrl.ifBlank { "https://ui-avatars.com/api/?name=${reporter.reporterName}&background=random" },
                            contentDescription = reporter.reporterName,
                            modifier = Modifier.size(38.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                        Column {
                            Text(
                                text = reporter.reporterName,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "${reporter.reporterDistrict} • ${reporter.reporterMandal}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (reporter.reporterPhone.isNotBlank()) {
                        IconButton(onClick = {
                            try {
                                val intent = Intent(Intent.ACTION_DIAL).apply {
                                    data = Uri.parse("tel:${reporter.reporterPhone}")
                                }
                                context.startActivity(intent)
                            } catch (_: Exception) {}
                        }) {
                            Icon(Icons.Default.Phone, contentDescription = "Call", tint = Color(0xFF4CAF50))
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .background(MaterialTheme.colorScheme.surface)
            ) {
                // Quick Action Chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    SuggestionChip(
                        onClick = { sendMessage("NOTICE", "దయచేసి మీ ప్రాంత తాజా వార్తలను వెంటనే అప్‌డేట్ చేయండి.") },
                        label = { Text("వార్తలు పంపండి", fontSize = 11.sp) }
                    )
                    SuggestionChip(
                        onClick = { sendMessage("CHAT", "మీరు పంపిన వార్త చాలా బాగుంది. అభినందనలు! 👏") },
                        label = { Text("అభినందనలు 👏", fontSize = 11.sp) }
                    )
                    SuggestionChip(
                        onClick = { sendMessage("WARNING", "గమనిక: వార్తల్లో సరైన ఫోటోలు మరియు పూర్తి వివరాలు పొందుపరచండి.") },
                        label = { Text("హెచ్చరిక ⚠️", fontSize = 11.sp, color = MaterialTheme.colorScheme.error) }
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("రిపోర్టర్‌కు సందేశం టైప్ చేయండి...", fontSize = 13.sp) },
                        shape = RoundedCornerShape(24.dp),
                        maxLines = 4,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                        )
                    )

                    IconButton(
                        onClick = { sendMessage() },
                        enabled = inputText.isNotBlank() && !isSending,
                        modifier = Modifier
                            .size(48.dp)
                            .background(
                                if (inputText.isNotBlank() && !isSending) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                CircleShape
                            )
                    ) {
                        if (isSending) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                        } else {
                            Icon(
                                Icons.Default.Send,
                                contentDescription = "Send",
                                tint = if (inputText.isNotBlank()) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            if (loading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (messages.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("💬", fontSize = 48.sp)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "${reporter.reporterName} తో సంభాషణను ప్రారంభించండి.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 14.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(messages, key = { it.id }) { msg ->
                        val isMe = msg.senderRole == "ADMIN"
                        AdminChatBubble(msg = msg, isMe = isMe)
                    }
                }
            }
        }
    }
}

@Composable
fun AdminChatBubble(msg: ReporterMessage, isMe: Boolean) {
    val dateStr = remember(msg.timestamp) {
        DateTimeUtils.formatTimestamp(msg.timestamp, "dd MMM, hh:mm a")
    }

    val isWarning = msg.type == "WARNING"
    val isBroadcast = msg.type == "BROADCAST"

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = when {
            isWarning || isBroadcast -> Alignment.CenterHorizontally
            isMe -> Alignment.End
            else -> Alignment.Start
        }
    ) {
        if (isWarning) {
            Card(
                modifier = Modifier.fillMaxWidth(0.92f).padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.85f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(24.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("హెచ్చరిక సందేశం (Warning Notice)", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(4.dp))
                        Text(msg.text, fontSize = 13.sp, color = MaterialTheme.colorScheme.onErrorContainer, lineHeight = 18.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(dateStr, fontSize = 10.sp, color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f), fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else if (isBroadcast) {
            Card(
                modifier = Modifier.fillMaxWidth(0.92f).padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.85f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.Campaign, contentDescription = null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(24.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("బ్రాడ్‌కాస్ట్ సందేశం (Broadcast Announcement)", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.tertiary)
                        Spacer(Modifier.height(4.dp))
                        Text(msg.text, fontSize = 13.sp, color = MaterialTheme.colorScheme.onTertiaryContainer, lineHeight = 18.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(dateStr, fontSize = 10.sp, color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f), fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else {
            Surface(
                modifier = Modifier.widthIn(max = 280.dp),
                shape = RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (isMe) 16.dp else 2.dp,
                    bottomEnd = if (isMe) 2.dp else 16.dp
                ),
                color = if (isMe) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                shadowElevation = 1.dp
            ) {
                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    if (!isMe) {
                        Text(
                            text = msg.senderName,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }

                    Text(
                        text = msg.text,
                        fontSize = 14.sp,
                        color = if (isMe) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                        lineHeight = 20.sp
                    )

                    Spacer(Modifier.height(4.dp))

                    Text(
                        text = dateStr,
                        fontSize = 9.sp,
                        color = (if (isMe) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant).copy(alpha = 0.7f),
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.align(Alignment.End)
                    )
                }
            }
        }
    }
}
