package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Star
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
import com.alfanews.telugu.models.AppNotification
import com.alfanews.telugu.models.NotificationType
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.alfanews.telugu.utils.DateTimeUtils
import java.util.*
import java.util.*

@Composable
fun NotificationsPageView(
    user: User,
    onAction: (String) -> Unit = {}
) {
    var notifications by remember { mutableStateOf<List<AppNotification>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    DisposableEffect(user.id) {
        if (user.id.isEmpty()) {
            return@DisposableEffect onDispose {}
        }

        val notifRef = FirebaseService.db
            .collection("users")
            .document(user.id)
            .collection("notifications")

        val query = notifRef
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(50)

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

                        AppNotification(
                            id = doc.id,
                            title = data["title"] as? String ?: "",
                            body = data["body"] as? String ?: "",
                            type = try {
                                NotificationType.valueOf(data["type"] as? String ?: "SYSTEM")
                            } catch (e: Exception) {
                                NotificationType.SYSTEM
                            },
                            read = data["read"] as? Boolean ?: false,
                            actionUrl = data["actionUrl"] as? String,
                            timestamp = timestamp
                        )
                    } catch (e: Exception) {
                        null
                    }
                }
                notifications = items
                loading = false
            }
        }

        onDispose {
            listenerRegistration.remove()
        }
    }

    fun markAsRead(notif: AppNotification) {
        if (notif.read) {
            if (notif.actionUrl != null) {
                onAction(notif.actionUrl)
            }
            return
        }

        scope.launch {
            try {
                val docRef = FirebaseService.db
                    .collection("users")
                    .document(user.id)
                    .collection("notifications")
                    .document(notif.id)

                docRef.update("read", true).await()

                if (notif.actionUrl != null) {
                    onAction(notif.actionUrl)
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun clearAll() {
        scope.launch {
            try {
                val batch = FirebaseService.db.batch()
                notifications.forEach { notif ->
                    val ref = FirebaseService.db
                        .collection("users")
                        .document(user.id)
                        .collection("notifications")
                        .document(notif.id)
                    batch.delete(ref)
                }
                batch.commit().await()
                Toast.makeText(context, "అన్ని నోటిఫికేషన్లు తొలగించబడ్డాయి", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // Header
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shadowElevation = 2.dp,
            color = Color.White
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "నోటిఫికేషన్లు",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                if (notifications.isNotEmpty()) {
                    TextButton(onClick = { clearAll() }) {
                        Text(
                            text = "Clear All",
                            color = MaterialTheme.colorScheme.error,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        // Content
        if (loading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(40.dp),
                    color = MaterialTheme.colorScheme.error
                )
            }
        } else if (notifications.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "📭",
                        fontSize = 64.sp
                    )
                    Text(
                        text = "కొత్త నోటిఫికేషన్లు ఏవీ లేవు.",
                        fontSize = 20.sp,
                        color = Color.Gray
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize()
            ) {
                items(notifications) { notif ->
                    NotificationItem(
                        notification = notif,
                        onClick = { markAsRead(notif) }
                    )
                }
            }
        }
    }
}

@Composable
fun NotificationItem(
    notification: AppNotification,
    onClick: () -> Unit
) {
    val dateFormat = remember { DateTimeUtils.getSimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()) }
    val formattedDate = remember(notification.timestamp) {
        dateFormat.format(Date(notification.timestamp))
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        color = if (notification.read) Color.White else Color(0xFFEFF6FF)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Icon
            NotificationIcon(type = notification.type)

            // Content
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = notification.title,
                    fontSize = 16.sp,
                    fontWeight = if (notification.read) FontWeight.Normal else FontWeight.Bold,
                    color = if (notification.read) Color(0xFF374151) else Color.Black
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = notification.body,
                    fontSize = 14.sp,
                    color = Color(0xFF4B5563),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = formattedDate.uppercase(),
                    fontSize = 10.sp,
                    color = Color(0xFF9CA3AF),
                    fontWeight = FontWeight.Bold
                )
            }

            // Unread indicator
            if (!notification.read) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                        .align(Alignment.Top)
                )
            }
        }
    }

    Divider()
}

@Composable
fun NotificationIcon(type: NotificationType) {
    val (icon, color) = when (type) {
        NotificationType.NEWS -> Icons.Default.Article to Color(0xFF2563EB)
        NotificationType.ENGAGEMENT -> Icons.Default.Favorite to MaterialTheme.colorScheme.error
        NotificationType.PROMOTION -> Icons.Default.Star to Color(0xFF10B981)
        NotificationType.SYSTEM -> Icons.Default.Notifications to Color(0xFF6B7280)
    }

    Surface(
        modifier = Modifier.size(40.dp),
        shape = CircleShape,
        color = color.copy(alpha = 0.1f)
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
