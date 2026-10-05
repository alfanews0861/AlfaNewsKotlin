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
import com.alfanews.telugu.utils.DateTimeUtils
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// 🚀 IN-MEMORY CACHE: Preserves reporter posts in memory so redirecting to Manage News is instant (0ms) without spinners
private var cachedManagePosts = listOf<NewsPost>()
private var cachedManagePostsUserId = ""

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManagePostsPageView(
    onEditPost: (NewsPost) -> Unit,
    onViewPost: (NewsPost) -> Unit = {},
    currentUser: User? = null,
    showTitle: Boolean = true
) {
    val currentUserId = currentUser?.id ?: FirebaseService.auth.currentUser?.uid ?: ""
    val initialPosts = if (currentUserId == cachedManagePostsUserId) cachedManagePosts else emptyList()

    var posts by remember { mutableStateOf(initialPosts) }
    var loading by remember { mutableStateOf(initialPosts.isEmpty()) }
    var isBroadcasting by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showBroadcastDialog by remember { mutableStateOf<NewsPost?>(null) }
    var showStatusDetailDialog by remember { mutableStateOf<NewsPost?>(null) }

    // ✅ REAL-TIME LISTENER: Updates automatically when status changes
    LaunchedEffect(currentUser) {
        // Safety watchdog: prevent infinite spinner on slow/offline listeners
        kotlinx.coroutines.delay(4000L)
        loading = false
    }

    DisposableEffect(currentUser) {
        val authUid = FirebaseService.auth.currentUser?.uid ?: ""
        val uid = currentUser?.id?.takeIf { it.isNotBlank() } ?: authUid
        val role = currentUser?.role ?: UserRole.REPORTER
        val isReporter = role == UserRole.REPORTER || role == UserRole.NEWS_DESK
        val isSuperAdmin = currentUser?.phone?.contains("9173811009") == true ||
            currentUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true ||
            FirebaseService.auth.currentUser?.phoneNumber?.contains("9173811009") == true ||
            FirebaseService.auth.currentUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true
        val isAdminOrEditor = role == UserRole.ADMIN || role == UserRole.EDITOR || isSuperAdmin
        val isRegionalIncharge = role == UserRole.REGIONAL_INCHARGE

        // Candidate IDs to match reporter posts across various auth states and post formats
        val candidateIds = mutableSetOf<String>().apply {
            if (uid.isNotBlank()) add(uid)
            if (authUid.isNotBlank()) add(authUid)
            currentUser?.id?.takeIf { it.isNotBlank() }?.let { add(it) }
            currentUser?.phone?.takeIf { it.isNotBlank() }?.let { phone ->
                add(phone)
                val clean = phone.replace("+91", "").trim()
                if (clean.isNotBlank()) {
                    add(clean)
                    add("+91$clean")
                }
            }
        }.toList()

        // Merged state map (postId -> NewsPost) to deduplicate across all listeners
        val mergedMap = mutableMapOf<String, NewsPost>()

        fun rebuildPosts(isServerResponse: Boolean = false) {
            val sorted = mergedMap.values
                .sortedByDescending { it.timestamp }
                .take(100)
            posts = sorted
            if (sorted.isNotEmpty()) {
                cachedManagePosts = sorted
                cachedManagePostsUserId = uid
            }
            // 🛡️ Only dismiss loading if we have posts to show, OR if server explicitly confirmed 0 posts.
            // Empty local cache snapshots will NEVER prematurely dismiss loading!
            if (sorted.isNotEmpty() || isServerResponse) {
                loading = false
            }
        }

        val listeners = mutableListOf<com.google.firebase.firestore.ListenerRegistration>()

        if (isAdminOrEditor) {
            // Admin/Editor: 1. Latest 100 posts (by timestamp)
            val qAdmin = FirebaseService.db.collection("news")
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(100)
            listeners.add(qAdmin.addSnapshotListener { snapshot, e ->
                if (e != null) {
                    android.util.Log.e("ManagePostsPageView", "Admin query error: ${e.message}", e)
                    // Fallback: If orderBy fails (e.g. index/missing field), query directly without orderBy
                    val qAdminFallback = FirebaseService.db.collection("news").limit(100)
                    listeners.add(qAdminFallback.addSnapshotListener { fbSnap, _ ->
                        fbSnap?.documents?.forEach { doc ->
                            val data = doc.data ?: return@forEach
                            mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                        }
                        val isServer = fbSnap != null && !fbSnap.metadata.isFromCache
                        rebuildPosts(isServerResponse = isServer)
                    })
                    return@addSnapshotListener
                }
                snapshot?.documents?.forEach { doc ->
                    val data = doc.data ?: return@forEach
                    mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                }
                val isServer = snapshot != null && !snapshot.metadata.isFromCache
                rebuildPosts(isServerResponse = isServer)
            })

            // Admin/Editor: 2. Also watch own posts specifically across candidate IDs
            val validAdminCandidateIds = candidateIds.filter { it.isNotBlank() }.distinct().take(10)
            if (validAdminCandidateIds.isNotEmpty()) {
                val qOwn = if (validAdminCandidateIds.size > 1) {
                    FirebaseService.db.collection("news").whereIn("reporter.id", validAdminCandidateIds).limit(50)
                } else {
                    FirebaseService.db.collection("news").whereEqualTo("reporter.id", validAdminCandidateIds[0]).limit(50)
                }
                listeners.add(qOwn.addSnapshotListener { snapshot, e ->
                    if (e != null) return@addSnapshotListener
                    snapshot?.documents?.forEach { doc ->
                        val data = doc.data ?: return@forEach
                        mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                    }
                    val isServer = snapshot != null && !snapshot.metadata.isFromCache
                    rebuildPosts(isServerResponse = isServer)
                })
            }
        } else if (isRegionalIncharge && currentUser?.assignedDistricts?.isNotEmpty() == true) {
            // 🛡️ Regional Incharge: Do NOT use orderBy with whereIn to avoid composite index requirements
            val qIncharge = FirebaseService.db.collection("news")
                .whereIn("district", currentUser.assignedDistricts)
                .limit(100)
            listeners.add(qIncharge.addSnapshotListener { snapshot, e ->
                if (e != null) {
                    android.util.Log.e("ManagePostsPageView", "Incharge query error: ${e.message}", e)
                    return@addSnapshotListener
                }
                snapshot?.documents?.forEach { doc ->
                    val data = doc.data ?: return@forEach
                    mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                }
                val isServer = snapshot != null && !snapshot.metadata.isFromCache
                rebuildPosts(isServerResponse = isServer)
            })

            // Also include own submitted posts
            val validInchargeCandidateIds = candidateIds.filter { it.isNotBlank() }.distinct().take(10)
            if (validInchargeCandidateIds.isNotEmpty()) {
                val qOwn = if (validInchargeCandidateIds.size > 1) {
                    FirebaseService.db.collection("news").whereIn("reporter.id", validInchargeCandidateIds).limit(50)
                } else {
                    FirebaseService.db.collection("news").whereEqualTo("reporter.id", validInchargeCandidateIds[0]).limit(50)
                }
                listeners.add(qOwn.addSnapshotListener { snapshot, _ ->
                    snapshot?.documents?.forEach { doc ->
                        val data = doc.data ?: return@forEach
                        mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                    }
                    val isServer = snapshot != null && !snapshot.metadata.isFromCache
                    rebuildPosts(isServerResponse = isServer)
                })
            }
        } else {
            // Standard Reporter:
            // 🛡️ Consolidated whereIn queries NEVER require a composite index and prevent socket contention.
            // Client-side rebuildPosts() sorts all posts by timestamp descending!
            val validCandidateIds = candidateIds.filter { it.isNotBlank() }.distinct().take(10)
            if (validCandidateIds.isNotEmpty()) {
                // 1. Posts where reporter.id matches any candidate ID (uid, authUid, phone)
                val q1 = if (validCandidateIds.size > 1) {
                    FirebaseService.db.collection("news").whereIn("reporter.id", validCandidateIds).limit(100)
                } else {
                    FirebaseService.db.collection("news").whereEqualTo("reporter.id", validCandidateIds[0]).limit(100)
                }
                listeners.add(q1.addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        android.util.Log.e("ManagePostsPageView", "Reporter listener1 error: ${e.message}", e)
                        return@addSnapshotListener
                    }
                    snapshot?.documents?.forEach { doc ->
                        val data = doc.data ?: return@forEach
                        mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                    }
                    val isServer = snapshot != null && !snapshot.metadata.isFromCache
                    rebuildPosts(isServerResponse = isServer)
                })

                // 2. Posts where originalReporterId matches any candidate ID (cross-mandal or desk attribution posts)
                val q2 = if (validCandidateIds.size > 1) {
                    FirebaseService.db.collection("news").whereIn("originalReporterId", validCandidateIds).limit(100)
                } else {
                    FirebaseService.db.collection("news").whereEqualTo("originalReporterId", validCandidateIds[0]).limit(100)
                }
                listeners.add(q2.addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        android.util.Log.e("ManagePostsPageView", "Reporter listener2 error: ${e.message}", e)
                        return@addSnapshotListener
                    }
                    snapshot?.documents?.forEach { doc ->
                        val data = doc.data ?: return@forEach
                        mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                    }
                    val isServer = snapshot != null && !snapshot.metadata.isFromCache
                    rebuildPosts(isServerResponse = isServer)
                })

                // 3. Fallback lookup by reporter name if available
                val repName = currentUser?.name?.takeIf { it.isNotBlank() }
                if (repName != null) {
                    val qName = FirebaseService.db.collection("news")
                        .whereEqualTo("reporter.name", repName)
                        .limit(50)
                    listeners.add(qName.addSnapshotListener { snapshot, e ->
                        if (e != null) return@addSnapshotListener
                        snapshot?.documents?.forEach { doc ->
                            val data = doc.data ?: return@forEach
                            mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                        }
                        val isServer = snapshot != null && !snapshot.metadata.isFromCache
                        rebuildPosts(isServerResponse = isServer)
                    })
                }
            } else {
                loading = false
            }
        }

        onDispose {
            listeners.forEach { it.remove() }
            listeners.clear()
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
                if (e !is kotlinx.coroutines.CancellationException) {
                    Toast.makeText(context, "తొలగించడం విఫలమైంది: ${e.message}", Toast.LENGTH_SHORT).show()
                }
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
                    actionUrl = "alfanews://news/${post.id}",
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
                if (e !is kotlinx.coroutines.CancellationException) {
                    Toast.makeText(context, "విఫలమైంది: ${e.message}", Toast.LENGTH_SHORT).show()
                }
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
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onBackground
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
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(36.dp),
                        strokeWidth = 3.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "వార్తలు లోడ్ అవుతున్నాయి...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
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
                                color = MaterialTheme.colorScheme.onSurfaceVariant
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
                                        showStatusDetailDialog = post
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
                                            text = "${post.categories.firstOrNull() ?: "General"} • ${post.reporter.name} • $timeString",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        
                                        Spacer(modifier = Modifier.height(6.dp))

                                        // Status Badge
                                        val statusColor = when {
                                            post.approved || post.status?.uppercase() == "PUBLISHED" -> Color(0xFF4CAF50)
                                            post.status?.uppercase() == "REJECTED" -> Color(0xFFE53935)
                                            post.status?.uppercase() == "FAILED" -> Color(0xFFD32F2F)
                                            else -> Color(0xFFFF9800)
                                        }
                                        val statusLabel = when (post.status?.uppercase()) {
                                            "PENDING" -> "పరిశీలనలో ఉంది..."
                                            "REVIEWING_CONTENT" -> "సిద్ధమవుతోంది..."
                                            "PROCESSING_VIDEO" -> "వీడియో తయారవుతోంది..."
                                            "PROCESSING_VIDEO_START" -> "ప్రచురించబడుతోంది..."
                                            "PUBLISHED" -> "LIVE"
                                            "FAILED" -> "విఫలమైంది"
                                            "REJECTED" -> "తిరస్కరించబడింది"
                                            else -> if (post.approved) "LIVE" else "PENDING"
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

        showStatusDetailDialog?.let { dialogPost ->
            val rawStatus = (dialogPost.status ?: "").uppercase()
            val isRejected = rawStatus == "REJECTED" || !dialogPost.rejectionReason.isNullOrBlank()
            val isFailed = rawStatus == "FAILED" || !dialogPost.error.isNullOrBlank()

            val dialogTitle = when {
                isRejected -> "⚠️ ఎడిటోరియల్ డెస్క్ పరిశీలన"
                isFailed -> "⚠️ ప్రచురణలో అంతరాయం"
                rawStatus == "REVIEWING_CONTENT" || rawStatus == "PROCESSING_VIDEO" -> "⏳ డెస్క్ పరిశీలిస్తోంది..."
                else -> "⏳ పరిశీలనలో ఉంది (Pending)"
            }

            val statusColor = when {
                isRejected -> Color(0xFFE53935)
                isFailed -> Color(0xFFD32F2F)
                else -> Color(0xFFFF9800)
            }

            val reasonContent = when {
                !dialogPost.rejectionReason.isNullOrBlank() -> dialogPost.rejectionReason!!
                dialogPost.isDuplicate -> "ఈ మండలంలో గత కొన్ని గంటల్లో ఈ వార్తాంశం ఇప్పటికే ప్రచురించబడింది."
                !dialogPost.error.isNullOrBlank() -> "సాంకేతిక అంతరాయం వల్ల ప్రచురణ ప్రక్రియ నిలిచింది. డెస్క్ దీనిని మళ్ళీ పరిశీలిస్తుంది."
                rawStatus == "PENDING" -> "మీ వార్త ఎడిటోరియల్ డెస్క్ పరిశీలనలో ఉంది. త్వరలోనే ప్రచురించబడుతుంది."
                else -> "వార్త పరిశీలనలో ఉంది..."
            }

            AlertDialog(
                onDismissRequest = { showStatusDetailDialog = null },
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            color = statusColor.copy(alpha = 0.15f),
                            shape = CircleShape,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = if (isRejected || isFailed) "!" else "⏳",
                                    fontWeight = FontWeight.Bold,
                                    color = statusColor,
                                    fontSize = 18.sp
                                )
                            }
                        }
                        Text(
                            text = dialogTitle,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = statusColor
                        )
                    }
                },
                text = {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        if (dialogPost.headline.telugu.isNotBlank()) {
                            Text(
                                text = dialogPost.headline.telugu,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "కారణం / వివరాలు:",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Text(
                                    text = reasonContent,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    lineHeight = 18.sp
                                )
                            }
                        }

                        if (isRejected) {
                            Text(
                                text = "గమనిక: నిబంధనలకు విరుద్ధంగా ఉన్న వార్తలు, డూప్లికేట్లు ప్రచురించబడవు. దయచేసి వివరాలను సరిచూసి కొత్త వార్తను పోస్ట్ చేయండి.",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { showStatusDetailDialog = null },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text("సరే (Close)")
                    }
                }
            )
        }
    }
}
