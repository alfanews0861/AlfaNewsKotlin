package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManagePostsPageView(
    onEditPost: (NewsPost) -> Unit,
    currentUser: User? = null
) {
    var posts by remember { mutableStateOf<List<NewsPost>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var isBroadcasting by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showBroadcastDialog by remember { mutableStateOf<NewsPost?>(null) }

    fun fetchPosts() {
        scope.launch {
            loading = true
            try {
                val snapshot = FirebaseService.db.collection("news")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(100)
                    .get()
                    .await()

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
                        mediaType = when (data["mediaType"]) {
                            "video" -> com.alfanews.telugu.models.MediaType.VIDEO
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
                        likes = (data["likes"] as? Number)?.toInt() ?: 0,
                        comments = (data["comments"] as? Number)?.toInt() ?: 0,
                        shares = (data["shares"] as? Number)?.toInt() ?: 0
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchPosts()
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
                    Toast.makeText(context, "విఫలమైంది: ${result.exceptionOrNull()?.message}", Toast.LENGTH_SHORT
                    ).show()
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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(8.dp)
                    .height(24.dp)
                    .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(4.dp))
            )
            Text(
                text = "వార్తల నిర్వహణ",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Divider(modifier = Modifier.padding(vertical = 16.dp))

        if (loading) {
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (posts.isEmpty()) {
                    item {
                        Text(
                            text = "వార్తలు ఏవీ లేవు.",
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                } else {
                    items(posts) { post ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                AsyncImage(
                                    model = post.mediaUrl,
                                    contentDescription = post.headline.telugu,
                                    modifier = Modifier
                                        .size(64.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                )

                                Column(
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        text = post.headline.telugu,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        maxLines = 2
                                    )
                                    Text(
                                        text = "${post.categories.firstOrNull() ?: ""} • ${post.reporter.name}",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                    )
                                }

                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    if (currentUser?.role == UserRole.ADMIN) {
                                        IconButton(
                                            onClick = { showBroadcastDialog = post },
                                            enabled = isBroadcasting != post.id
                                        ) {
                                            if (isBroadcasting == post.id) {
                                                CircularProgressIndicator(modifier = Modifier.size(20.dp))
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
                                        onClick = { onEditPost(post) }
                                    ) {
                                        Icon(
                                            Icons.Default.Edit,
                                            contentDescription = "Edit",
                                            tint = MaterialTheme.colorScheme.secondary
                                        )
                                    }

                                    IconButton(
                                        onClick = { showDeleteDialog = post.id }
                                    ) {
                                        Icon(
                                            Icons.Default.Delete,
                                            contentDescription = "Delete",
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

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
                    Button(
                        onClick = { sendBroadcast(post, selectedChannelId) }
                    ) {
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
