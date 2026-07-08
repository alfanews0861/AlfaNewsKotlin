package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManagePostsPageView(
    onEditPost: (NewsPost) -> Unit,
    onViewPost: (NewsPost) -> Unit = {},
    currentUser: User? = null,
    showTitle: Boolean = true
) {
    var posts by remember { mutableStateOf<List<NewsPost>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var isBroadcasting by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dateFormat = remember { SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()) }

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showBroadcastDialog by remember { mutableStateOf<NewsPost?>(null) }

    // ✅ REAL-TIME LISTENER: Updates automatically when status changes
    DisposableEffect(currentUser) {
        var query = FirebaseService.db.collection("news")
            .orderBy("timestamp", Query.Direction.DESCENDING)

        if (currentUser?.role == UserRole.REGIONAL_INCHARGE && currentUser.assignedDistricts.isNotEmpty()) {
            query = query.whereIn("district", currentUser.assignedDistricts)
        }
        
        if (currentUser?.role == UserRole.REPORTER) {
            query = query.whereEqualTo("reporter.id", currentUser.id)
        }

        val listener = query.limit(100).addSnapshotListener { snapshot, e ->
            loading = false
            if (e != null) return@addSnapshotListener
            
            if (snapshot != null) {
                posts = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val headlineData = data["headline"] as? Map<*, *> ?: emptyMap<Any, Any>()
                    val contentData = data["content"] as? Map<*, *> ?: emptyMap<Any, Any>()
                    val reporterData = data["reporter"] as? Map<*, *> ?: emptyMap<Any, Any>()

                    val timestamp = when (val ts = data["timestamp"]) {
                        is com.google.firebase.Timestamp -> ts.toDate().time
                        is Number -> ts.toLong()
                        else -> System.currentTimeMillis()
                    }

                    NewsPost(
                        id = doc.id,
                        headline = com.alfanews.telugu.models.Headline(
                            telugu = headlineData["telugu"] as? String ?: "",
                            english = headlineData["english"] as? String ?: ""
                        ),
                        content = com.alfanews.telugu.models.Content(
                            telugu = contentData["telugu"] as? String ?: "",
                            english = contentData["english"] as? String ?: ""
                        ),
                        mediaUrl = data["mediaUrl"] as? String ?: "",
                        mediaType = when (data["mediaType"]?.toString()?.uppercase()) {
                            "VIDEO" -> com.alfanews.telugu.models.MediaType.VIDEO
                            else -> com.alfanews.telugu.models.MediaType.IMAGE
                        },
                        reporter = com.alfanews.telugu.models.Reporter(
                            id = reporterData["id"] as? String ?: "",
                            name = reporterData["name"] as? String ?: ""
                        ),
                        location = data["location"] as? String ?: "",
                        state = data["state"] as? String,
                        district = data["district"] as? String,
                        timestamp = timestamp,
                        categories = data["categories"] as? List<String> ?: emptyList(),
                        likes = (data["likes"] as? Number)?.toInt() ?: (data["likes"] as? String)?.toIntOrNull() ?: 0,
                        comments = (data["comments"] as? Number)?.toInt() ?: (data["comments"] as? String)?.toIntOrNull() ?: 0,
                        shares = (data["shares"] as? Number)?.toInt() ?: (data["shares"] as? String)?.toIntOrNull() ?: 0,
                        approved = data["approved"] as? Boolean ?: false,
                        isGlobal = data["isGlobal"] as? Boolean ?: false
                    )
                }
            }
        }
        
        onDispose { listener.remove() }
    }

    fun confirmDelete(postId: String) {
        scope.launch {
            try {
                FirebaseService.db.collection("news")
                    .document(postId)
                    .delete()
                    .await()
                posts = posts.filter { it.id != postId }
                Toast.makeText(context, "వార్త తొలగించబడింది", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "తొలగించడం విఫలమైంది: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                showDeleteDialog = null
            }
        }
    }

    fun sendBroadcast(post: NewsPost, channelId: String) {
        scope.launch {
            isBroadcasting = post.id
            try {
                val isSilent = channelId != "breaking_news"
                val title = if (isSilent) post.headline.telugu else "🔴 బ్రేకింగ్ న్యూస్"

                val result = FirebaseFunctionsService.triggerPushBroadcast(
                    title = title,
                    body = post.headline.telugu,
                    actionUrl = "#/s/${post.id}",
                    topic = "all_users",
                    silent = isSilent,
                    channelId = channelId
                )

                if (result.isSuccess) {
                    Toast.makeText(context, "పుష్ నోటిఫికేషన్ పంపబడింది!", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "విఫలమైంది: ${result.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "విఫలమైంది: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isBroadcasting = null
                showBroadcastDialog = null
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        if (showTitle) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .width(6.dp)
                            .height(28.dp)
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(3.dp))
                    )
                    Text(
                        text = "వార్తల నిర్వహణ",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }

        if (loading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                contentPadding = PaddingValues(bottom = 80.dp)
            ) {
                if (posts.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(top = 100.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "వార్తలు ఏవీ లేవు.",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }
                    }
                } else {
                    items(posts, key = { postItem: NewsPost -> postItem.id }) { post ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (post.approved) {
                                        onViewPost(post)
                                    } else {
                                        Toast.makeText(context, "మీ వార్త పరిశీలనలో ఉంది...", Toast.LENGTH_SHORT).show()
                                    }
                                },
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f)
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp, 
                                MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp)
                            ) {
                                // Top Row: Image and Headline
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                                    verticalAlignment = Alignment.Top
                                ) {
                                    AsyncImage(
                                        model = post.mediaUrl,
                                        contentDescription = null,
                                        modifier = Modifier
                                            .size(90.dp)
                                            .clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop
                                    )

                                    Text(
                                        text = post.headline.telugu,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 3,
                                        modifier = Modifier.weight(1f),
                                        lineHeight = 22.sp
                                    )
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.08f))
                                Spacer(modifier = Modifier.height(10.dp))

                                // Bottom Row: Meta and Actions
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        val timeString = dateFormat.format(Date(post.timestamp))
                                        Text(
                                            text = "${post.categories.firstOrNull() ?: "General"} • ${post.reporter.name} • $timeString",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                        )
                                        
                                        Spacer(modifier = Modifier.height(6.dp))

                                        // Status Badge
                                        val statusColor = if (post.approved) Color(0xFF4CAF50) else Color(0xFFFF9800)
                                        val statusText = if (post.approved) "LIVE" else "PENDING"
                                        
                                        Surface(
                                            color = statusColor.copy(alpha = 0.15f),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = statusText,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = statusColor,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }

                                    // Action Buttons
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (currentUser?.role == UserRole.ADMIN) {
                                            IconButton(
                                                onClick = { showBroadcastDialog = post },
                                                enabled = isBroadcasting != post.id
                                            ) {
                                                if (isBroadcasting == post.id) {
                                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                                } else {
                                                    Icon(
                                                        Icons.Default.Notifications,
                                                        contentDescription = "Broadcast",
                                                        tint = MaterialTheme.colorScheme.primary
                                                    )
                                                }
                                            }
                                        }

                                        IconButton(
                                            onClick = { onEditPost(post) },
                                            modifier = Modifier.background(MaterialTheme.colorScheme.surface, CircleShape).size(36.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.Edit,
                                                contentDescription = "Edit",
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }

                                        IconButton(
                                            onClick = { showDeleteDialog = post.id },
                                            modifier = Modifier.background(MaterialTheme.colorScheme.surface, CircleShape).size(36.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.Delete,
                                                contentDescription = "Delete",
                                                tint = MaterialTheme.colorScheme.error,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Dialogs
        showDeleteDialog?.let { postId ->
            AlertDialog(
                onDismissRequest = { showDeleteDialog = null },
                title = { Text("వార్తను తొలగించండి") },
                text = { Text("ఈ వార్తను శాశ్వతంగా తొలగించాలా?") },
                confirmButton = {
                    Button(
                        onClick = { confirmDelete(postId) },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("తొలగించు")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDeleteDialog = null }) {
                        Text("రద్దు")
                    }
                }
            )
        }

        showBroadcastDialog?.let { post ->
            var channelExpanded by remember { mutableStateOf(false) }
            val channels = mapOf(
                "general_news" to "General News",
                "breaking_news" to "Breaking News",
                "local_news" to "Local News"
            )
            var selectedChannelId by remember { mutableStateOf("general_news") }

            AlertDialog(
                onDismissRequest = { showBroadcastDialog = null },
                title = { Text("Send Push Notification") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("Channel for: \"${post.headline.telugu}\"")

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
                                label = { Text("Channel") },
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
                                            channelExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = { sendBroadcast(post, selectedChannelId) }) {
                        Text("Send")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showBroadcastDialog = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
