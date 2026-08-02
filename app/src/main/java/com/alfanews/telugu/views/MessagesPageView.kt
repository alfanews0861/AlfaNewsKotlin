package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.utils.DateTimeUtils
import com.alfanews.telugu.models.AppMessage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun MessagesPageView(
    user: User,
    onBack: () -> Unit = {},
    onMenuClick: (() -> Unit)? = null,
    showTitle: Boolean = true
) {
    var messages by remember { mutableStateOf<List<AppMessage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    DisposableEffect(user.id) {
        if (user.id.isEmpty()) {
            loading = false
            return@DisposableEffect onDispose {}
        }

        val msgRef = FirebaseService.db
            .collection("users")
            .document(user.id)
            .collection("messages")

        val query = msgRef
            .orderBy("timestamp", Query.Direction.DESCENDING)

        val listenerRegistration: ListenerRegistration = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                loading = false
                return@addSnapshotListener
            }

            if (snapshot != null) {
                val items = snapshot.documents.mapNotNull { doc ->
                    try {
                        val data = doc.data ?: return@mapNotNull null
                        val timestamp = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time
                            ?: System.currentTimeMillis()

                        AppMessage(
                            id = doc.id,
                            title = data["title"] as? String ?: "",
                            body = data["body"] as? String ?: "",
                            senderName = data["senderName"] as? String ?: "Admin",
                            read = data["read"] as? Boolean ?: false,
                            timestamp = timestamp,
                            importance = data["importance"] as? String ?: "NORMAL"
                        )
                    } catch (e: Exception) {
                        null
                    }
                }
                messages = items
                loading = false
            }
        }

        onDispose {
            listenerRegistration.remove()
        }
    }

    fun markAsRead(msg: AppMessage) {
        if (msg.read) return
        scope.launch {
            try {
                FirebaseService.db
                    .collection("users")
                    .document(user.id)
                    .collection("messages")
                    .document(msg.id)
                    .update("read", true)
                    .await()
            } catch (e: Exception) {
                // Silent fail
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else if (messages.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("✉️", fontSize = 48.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("సందేశాలు ఏవీ లేవు.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(messages) { msg ->
                    MessageCard(msg = msg, onClick = { markAsRead(msg) })
                }
            }
        }
    }
}

@Composable
fun MessageCard(msg: AppMessage, onClick: () -> Unit) {
    val dateStr = remember(msg.timestamp) { 
        DateTimeUtils.formatTimestamp(msg.timestamp, "dd MMM yyyy, hh:mm a") 
    }

    val bgColor = when(msg.importance) {
        "CRITICAL" -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        "HIGH" -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
        else -> MaterialTheme.colorScheme.surface
    }

    val icon = when(msg.importance) {
        "CRITICAL", "HIGH" -> Icons.Default.Warning
        else -> Icons.Default.Mail
    }
    
    val iconColor = when(msg.importance) {
        "CRITICAL" -> MaterialTheme.colorScheme.error
        "HIGH" -> Color(0xFFF59E0B)
        else -> MaterialTheme.colorScheme.primary
    }

    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.elevatedCardColors(containerColor = bgColor)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconColor.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(24.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = msg.title,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (!msg.read) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary)
                        )
                    }
                }
                
                Text(
                    text = msg.senderName,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = msg.body,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = dateStr,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
