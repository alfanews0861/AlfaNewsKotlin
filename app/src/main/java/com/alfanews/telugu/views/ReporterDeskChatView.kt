package com.alfanews.telugu.views

import android.widget.Toast
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
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var messages by remember { mutableStateOf<List<ReporterMessage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var inputText by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }

    val reporterId = user.id

    // Real-time listener for reporter's conversation with Admin
    DisposableEffect(reporterId) {
        if (reporterId.isBlank()) {
            loading = false
            return@DisposableEffect onDispose {}
        }

        // Reset unread count for reporter on open
        scope.launch {
            try {
                FirebaseService.db.collection("reporter_conversations")
                    .document(reporterId)
                    .update("unreadCountForReporter", 0)
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

    // Auto-scroll to bottom on new message
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    fun sendMessage() {
        val text = inputText.trim()
        if (text.isEmpty() || isSending) return

        scope.launch {
            isSending = true
            try {
                val result = FirebaseFunctionsService.sendAdminReporterMessage(
                    reporterId = reporterId,
                    text = text,
                    type = "CHAT"
                )
                if (result.isSuccess) {
                    AnalyticsService.logReporterMessageSent("CHAT")
                    inputText = ""
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
