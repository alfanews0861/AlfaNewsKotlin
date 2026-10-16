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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.models.mapMapToNewsPost
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.DateTimeUtils
import com.alfanews.telugu.utils.ManageNewsHelper
import com.alfanews.telugu.utils.ManagePostStatus
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

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
    var refreshTrigger by remember { mutableStateOf(0) }
    var isBroadcasting by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showBroadcastDialog by remember { mutableStateOf<NewsPost?>(null) }

    val authUid = remember { FirebaseService.auth.currentUser?.uid.orEmpty() }
    val candidateIds = remember(currentUser?.id, authUid) {
        val list = mutableListOf<String>()
        currentUser?.id?.takeIf { it.isNotBlank() }?.let { list.add(it.trim()) }
        if (authUid.isNotBlank() && !list.contains(authUid)) {
            list.add(authUid)
        }
        list
    }
    val targetId = candidateIds.firstOrNull() ?: authUid

    LaunchedEffect(targetId, refreshTrigger) {
        if (targetId.isBlank()) {
            posts = emptyList()
            loading = false
            return@LaunchedEffect
        }

        loading = posts.isEmpty()

        val newsRef = FirebaseService.db.collection("news")

        // 🛡️ Helper: Robust ordered query with fallback for index resilience
        suspend fun queryReporterField(
            field: String,
            value: String,
            source: Source? = null,
            limitCount: Long = 15
        ): List<DocumentSnapshot> {
            if (value.isBlank()) return emptyList()
            return try {
                val qOrdered = newsRef.whereEqualTo(field, value)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(limitCount)
                val snap = if (source != null) qOrdered.get(source).await() else qOrdered.get().await()
                snap.documents
            } catch (_: Exception) {
                try {
                    val qSimple = newsRef.whereEqualTo(field, value).limit(limitCount)
                    val snap = if (source != null) qSimple.get(source).await() else qSimple.get().await()
                    snap.documents
                } catch (_: Exception) {
                    emptyList()
                }
            }
        }

        // 1. ⚡ INSTANT LOCAL CACHE DISPLAY (< 15ms)
        if (posts.isEmpty()) {
            try {
                withContext(Dispatchers.IO) {
                    // Fast path: primary query from cache first
                    val primaryCacheDocs = queryReporterField("originalReporterId", targetId, Source.CACHE)
                    val cachedDocs = if (primaryCacheDocs.size >= 10) {
                        primaryCacheDocs
                    } else {
                        val cacheJobs = mutableListOf<kotlinx.coroutines.Deferred<List<DocumentSnapshot>>>()
                        cacheJobs.add(async { queryReporterField("reporter.id", targetId, Source.CACHE) })
                        cacheJobs.add(async { queryReporterField("reporterId", targetId, Source.CACHE) })

                        val secondId = candidateIds.getOrNull(1)
                        if (!secondId.isNullOrBlank() && secondId != targetId) {
                            cacheJobs.add(async { queryReporterField("originalReporterId", secondId, Source.CACHE) })
                            cacheJobs.add(async { queryReporterField("reporter.id", secondId, Source.CACHE) })
                        }
                        primaryCacheDocs + cacheJobs.awaitAll().flatten()
                    }

                    val seenCacheIds = mutableSetOf<String>()
                    val cachedParsed = cachedDocs.mapNotNull { doc ->
                        if (!seenCacheIds.add(doc.id)) return@mapNotNull null
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            mapMapToNewsPost(doc.id, data)
                        } catch (_: Exception) { null }
                    }.sortedByDescending { it.timestamp }.take(10)

                    if (cachedParsed.isNotEmpty()) {
                        withContext(Dispatchers.Main) {
                            posts = cachedParsed
                            loading = false
                        }
                    }
                }
            } catch (_: Exception) {}
        }

        // 2. ⚡ LIVE SERVER FETCH: Smart Short-Circuit (Priority to Reporter ID)
        try {
            withTimeoutOrNull(10000L) {
                withContext(Dispatchers.IO) {
                    // 🚀 STEP 1: ప్రథమ ప్రాధాన్యత క్వెరీ (originalReporterId) మొదట రన్ అవుతుంది
                    val primaryDocs = queryReporterField("originalReporterId", targetId)

                    // 🛑 STEP 2: మొదటి క్వెరీలోనే 10 లేదా అంతకంటే ఎక్కువ వార్తలు వస్తే, మిగతావి ట్రిగ్గర్ అవ్వకుండా ఆగిపోతాయి!
                    val candidateDocs = if (primaryDocs.size >= 10) {
                        primaryDocs
                    } else {
                        // ⚡ ఒకవేళ 10 కంటే తక్కువ ఉంటేనే (కొత్త రిపోర్టర్ లేదా పాత పోస్ట్‌లు), మిగతావి ప్యారలల్‌గా రన్ అవుతాయి
                        val fallbackJobs = mutableListOf<kotlinx.coroutines.Deferred<List<DocumentSnapshot>>>()
                        fallbackJobs.add(async { queryReporterField("reporter.id", targetId) })
                        fallbackJobs.add(async { queryReporterField("reporterId", targetId) })
                        fallbackJobs.add(async { queryReporterField("userId", targetId) })

                        val secondId = candidateIds.getOrNull(1)
                        if (!secondId.isNullOrBlank() && secondId != targetId) {
                            fallbackJobs.add(async { queryReporterField("originalReporterId", secondId) })
                            fallbackJobs.add(async { queryReporterField("reporter.id", secondId) })
                        }

                        primaryDocs + fallbackJobs.awaitAll().flatten()
                    }

                    val seenDocIds = mutableSetOf<String>()
                    val parsedPosts = candidateDocs.mapNotNull { doc ->
                        if (!seenDocIds.add(doc.id)) return@mapNotNull null
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            mapMapToNewsPost(doc.id, data)
                        } catch (_: Exception) { null }
                    }.sortedByDescending { it.timestamp }.take(10)

                    withContext(Dispatchers.Main) {
                        if (parsedPosts.isNotEmpty()) {
                            posts = parsedPosts
                        } else if (posts.isEmpty()) {
                            posts = emptyList()
                        }
                    }
                }
            }
        } catch (_: Exception) {
            // Fallback safe: any cached posts remain intact
        } finally {
            loading = false
        }
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
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
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
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            IconButton(onClick = { refreshTrigger++ }) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Refresh",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
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
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 100.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "మీరు పోస్ట్ చేసిన వార్తలు ఏవీ లేవు.",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                OutlinedButton(onClick = { refreshTrigger++ }) {
                                    Icon(
                                        imageVector = Icons.Default.Refresh,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("మళ్లీ ప్రయత్నించండి")
                                }
                            }
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
                                containerColor = MaterialTheme.colorScheme.surface,
                                contentColor = MaterialTheme.colorScheme.onSurface
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp, 
                                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
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
                                        contentScale = ContentScale.Crop,
                                        alignment = Alignment.TopCenter
                                    )

                                    Text(
                                        text = post.headline.telugu,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        maxLines = 3,
                                        modifier = Modifier.weight(1f),
                                        lineHeight = 22.sp
                                    )
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                                Spacer(modifier = Modifier.height(10.dp))

                                // Bottom Row: Meta and Actions
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        val timeString = DateTimeUtils.formatTimestamp(post.timestamp, "dd MMM, hh:mm a")
                                        Text(
                                            text = "${post.categories.firstOrNull() ?: "వార్తలు"} • ${post.reporter.name.ifBlank { "మీరు" }} • $timeString",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        
                                        Spacer(modifier = Modifier.height(6.dp))

                                        // Status Badge
                                        val status = ManageNewsHelper.resolveStatus(post)
                                        val (statusLabel, statusColor) = when (status) {
                                            ManagePostStatus.LIVE -> "LIVE" to Color(0xFF4CAF50)
                                            ManagePostStatus.PENDING -> "పరిశీలనలో ఉంది..." to Color(0xFFFF9800)
                                            ManagePostStatus.PROCESSING -> "సిద్ధమవుతోంది..." to Color(0xFF2196F3)
                                            ManagePostStatus.REJECTED -> "తిరస్కరించబడింది" to Color(0xFFE91E63)
                                            ManagePostStatus.FAILED -> "విఫలమైంది" to Color(0xFFF44336)
                                        }

                                        Surface(
                                            color = statusColor.copy(alpha = 0.15f),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = statusLabel,
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
