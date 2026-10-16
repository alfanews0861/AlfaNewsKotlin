package com.alfanews.telugu.views

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.ReporterMessage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.AnalyticsService
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
fun ReporterDeskChatView(
    user: User,
    onBack: () -> Unit = {}
) {
    BackHandler { onBack() }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var messages by remember { mutableStateOf<List<ReporterMessage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var inputText by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }

    val reporterId = user.id

    // Safety watchdog: After 2.5s, turn off loading spinner if snapshot listener hasn't finished yet
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(2500L)
        loading = false
    }

    // Reset unread count for reporter on open and batch mark incoming admin messages as read
    LaunchedEffect(reporterId) {
        if (reporterId.isBlank()) return@LaunchedEffect
        try {
            FirebaseService.db.collection("reporter_conversations")
                .document(reporterId)
                .set(mapOf("unreadCountForReporter" to 0), com.google.firebase.firestore.SetOptions.merge())
                .await()

            val unreadSnap = FirebaseService.db.collection("reporter_conversations")
                .document(reporterId)
                .collection("messages")
                .whereEqualTo("read", false)
                .get()
                .await()

            val unreadMsgs = unreadSnap.documents.filter { (it.getString("senderRole") ?: "ADMIN") == "ADMIN" }
            if (unreadMsgs.isNotEmpty()) {
                val batch = FirebaseService.db.batch()
                for (doc in unreadMsgs) {
                    batch.update(doc.reference, "read", true)
                }
                batch.commit().await()
            }
        } catch (_: Exception) {}
    }

    // Real-time listener for reporter's conversation with Admin
    DisposableEffect(reporterId) {
        if (reporterId.isBlank()) {
            loading = false
            return@DisposableEffect onDispose {}
        }

        val messagesRef = FirebaseService.db.collection("reporter_conversations")
            .document(reporterId)
            .collection("messages")
            .orderBy("timestamp", Query.Direction.ASCENDING)
            .limitToLast(100)

        val listener: ListenerRegistration = messagesRef.addSnapshotListener { snapshot, error ->
            loading = false
            if (error != null) {
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

    // Auto-scroll to bottom on new message
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    fun sendMessage(customText: String? = null) {
        val text = (customText ?: inputText).trim()
        if (text.isEmpty() || isSending) return

        scope.launch {
            isSending = true
            try {
                var sentViaFunction = false
                try {
                    val result = FirebaseFunctionsService.sendAdminReporterMessage(
                        reporterId = reporterId,
                        text = text,
                        type = "CHAT"
                    )
                    if (result.isSuccess) {
                        sentViaFunction = true
                        AnalyticsService.logReporterMessageSent("CHAT")
                    }
                } catch (_: Exception) {}

                // Direct Firestore fallback if Cloud Function times out or fails
                if (!sentViaFunction) {
                    val nowTs = com.google.firebase.firestore.FieldValue.serverTimestamp()
                    val msgData = mapOf(
                        "senderId" to reporterId,
                        "senderName" to user.name.ifBlank { "Reporter" },
                        "senderRole" to "REPORTER",
                        "text" to text,
                        "type" to "CHAT",
                        "read" to false,
                        "isManual" to false,
                        "timestamp" to nowTs
                    )
                    FirebaseService.db.collection("reporter_conversations")
                        .document(reporterId)
                        .collection("messages")
                        .add(msgData)
                        .await()

                    val convData = mapOf(
                        "reporterId" to reporterId,
                        "reporterName" to user.name.ifBlank { "Reporter" },
                        "reporterPhone" to (user.phone ?: ""),
                        "reporterDistrict" to (user.district ?: ""),
                        "reporterMandal" to (user.assignedMandal ?: ""),
                        "reporterPhotoUrl" to (user.photoUrl ?: ""),
                        "lastMessage" to text,
                        "lastMessageTime" to nowTs,
                        "lastSenderRole" to "REPORTER",
                        "lastSenderId" to reporterId,
                        "unreadCountForAdmin" to com.google.firebase.firestore.FieldValue.increment(1),
                        "updatedAt" to nowTs
                    )
                    FirebaseService.db.collection("reporter_conversations")
                        .document(reporterId)
                        .set(convData, com.google.firebase.firestore.SetOptions.merge())
                        .await()

                    AnalyticsService.logReporterMessageSent("CHAT")
                }

                if (customText == null) {
                    inputText = ""
                }
            } catch (e: Exception) {
                if (e !is kotlinx.coroutines.CancellationException) {
                    Toast.makeText(context, "సందేశం పంపడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                isSending = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "అడ్మిన్ డెస్క్ (Admin Desk)",
                            fontFamily = Ramabhadra,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "ప్రత్యక్ష సంభాషణ • ఆన్‌లైన్",
                            fontSize = 11.sp,
                            color = Color(0xFF4CAF50),
                            fontWeight = FontWeight.Medium
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth().imePadding(),
                shadowElevation = 8.dp,
                color = MaterialTheme.colorScheme.surface
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Quick Action Chips to easily send messages to Admin
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        SuggestionChip(
                            onClick = { sendMessage("నా పరిధిలోని వార్తలపై ఎడిటోరియల్ డెస్క్ పరిశీలన కావాలి.") },
                            label = { Text("వార్త పరిశీలన 📝", fontSize = 11.sp) }
                        )
                        SuggestionChip(
                            onClick = { sendMessage("నా మండలంలో వార్తలు లేదా యాప్‌లో సాంకేతిక సమస్య ఉంది.") },
                            label = { Text("సమస్య తెలియజేయండి ⚠️", fontSize = 11.sp) }
                        )
                        SuggestionChip(
                            onClick = { sendMessage("ఐడీ కార్డు లేదా ప్రొఫైల్ వివరాల సవరణ కొరకు సహాయం కావాలి.") },
                            label = { Text("ఐడీ / ప్రొఫైల్ సాయం 🪪", fontSize = 11.sp) }
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
                            placeholder = { Text("అడ్మిన్‌కు సందేశం టైప్ చేయండి...", fontSize = 13.sp) },
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
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Header greeting note
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(Icons.Default.SupportAgent, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Column {
                                    Text(
                                        text = "అల్ఫా న్యూస్ రిపోర్టర్ డెస్క్",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontFamily = Ramabhadra
                                    )
                                    Text(
                                        text = "వార్తల ప్రచురణ, జిల్లా అంశాలు లేదా ఏవైనా సమస్యలు ఉంటే ఇక్కడ మెసేజ్ చేయండి.",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    if (messages.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 40.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("💬", fontSize = 48.sp)
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        text = "సందేశాలు ఏవీ లేవు. మీ సందేహాలను ఇక్కడ అడగవచ్చు.",
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 13.sp
                                    )
                                    Spacer(Modifier.height(16.dp))
                                    Button(
                                        onClick = { inputText = "నమస్కారం అడ్మిన్ డెస్క్, " },
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                        shape = RoundedCornerShape(20.dp)
                                    ) {
                                        Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("అడ్మిన్‌కు సందేశం పంపు", fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = Ramabhadra)
                                    }
                                }
                            }
                        }
                    } else {
                        items(messages, key = { it.id }) { msg ->
                            val isMe = msg.senderRole == "REPORTER"
                            ReporterChatBubble(msg = msg, isMe = isMe)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReporterChatBubble(msg: ReporterMessage, isMe: Boolean) {
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
            // High visibility warning card
            Card(
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.85f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = "Warning",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(24.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "అధికారిక హెచ్చరిక (Official Notice)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.error
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = msg.text,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            lineHeight = 18.sp
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = dateStr,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        } else if (isBroadcast) {
            // Broadcast announcement card
            Card(
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.85f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        Icons.Default.Campaign,
                        contentDescription = "Broadcast",
                        tint = MaterialTheme.colorScheme.tertiary,
                        modifier = Modifier.size(24.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "అధికారిక ప్రకటన (Official Announcement)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = msg.text,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onTertiaryContainer,
                            lineHeight = 18.sp
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = dateStr,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        } else {
            // Standard Chat Bubble
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

                    Row(
                        modifier = Modifier.align(Alignment.End),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Text(
                            text = dateStr,
                            fontSize = 9.sp,
                            color = (if (isMe) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant).copy(alpha = 0.7f),
                            fontWeight = FontWeight.Medium
                        )

                        if (isMe) {
                            if (msg.read) {
                                Icon(
                                    Icons.Default.DoneAll,
                                    contentDescription = "Read",
                                    tint = MaterialTheme.colorScheme.onPrimary,
                                    modifier = Modifier.size(13.dp)
                                )
                            } else {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = "Delivered",
                                    tint = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.6f),
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
