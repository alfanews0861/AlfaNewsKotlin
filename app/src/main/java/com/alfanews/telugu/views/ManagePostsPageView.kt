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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import com.alfanews.telugu.utils.toUserObject
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
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
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
    val currentUserId = currentUser?.id ?: FirebaseService.auth.currentUser?.uid ?: ""

    // 🚀 NO STALE CACHE: ఎల్లప్పుడూ సర్వర్ నుండి తాజా వార్తలను మాత్రమే లోడ్ చేయాలి
    var posts by remember(currentUserId) { mutableStateOf<List<NewsPost>>(emptyList()) }
    var loading by remember(currentUserId) { mutableStateOf(true) }
    var refreshTrigger by remember { mutableStateOf(0) }
    var isBroadcasting by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showBroadcastDialog by remember { mutableStateOf<NewsPost?>(null) }
    var showStatusDetailDialog by remember { mutableStateOf<NewsPost?>(null) }

    // 🔍 Search and Reporter filter states
    var searchQuery by remember { mutableStateOf("") }
    var loadMoreRequested by remember { mutableStateOf(false) }
    var selectedReporterId by remember { mutableStateOf<String?>(null) }
    var selectedReporterName by remember { mutableStateOf("") }
    var reporterList by remember { mutableStateOf<List<User>>(emptyList()) }
    var reporterDropdownExpanded by remember { mutableStateOf(false) }
    val queryLimit = if (loadMoreRequested || searchQuery.isNotBlank()) 100L else 30L

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

    // Load reporters list for Admin/Editor or Regional Incharge
    LaunchedEffect(isAdminOrEditor, isRegionalIncharge) {
        if (isAdminOrEditor || isRegionalIncharge) {
            try {
                val usersSnap = FirebaseService.db.collection("users")
                    .limit(300)
                    .get()
                    .await()
                val list = usersSnap.documents.mapNotNull { it.toUserObject() }.filter { u ->
                    u.role == UserRole.REPORTER || u.role == UserRole.NEWS_DESK || u.role == UserRole.REGIONAL_INCHARGE || !u.assignedMandal.isNullOrBlank()
                }.sortedBy { it.name.ifBlank { "Reporter" } }
                reporterList = list
            } catch (e: Exception) {
                android.util.Log.e("ManagePostsPageView", "Error loading reporters: ${e.message}")
            }
        }
    }

    // Helper: Safely execute query with orderBy timestamp DESC, fallback to query without orderBy if index issue occurs
    suspend fun fetchQueryDocuments(baseQ: Query, fallbackQ: Query? = null): List<DocumentSnapshot> {
        return withContext(Dispatchers.IO) {
            try {
                // 1. Try server directly for live, fresh posts
                val snap = baseQ.get(com.google.firebase.firestore.Source.SERVER).await()
                snap.documents
            } catch (eServer: Exception) {
                try {
                    // 2. Fallback to default
                    val snap = baseQ.get().await()
                    snap.documents
                } catch (eDefault: Exception) {
                    if (fallbackQ != null) {
                        try {
                            val snap = fallbackQ.get().await()
                            snap.documents
                        } catch (eFallback: Exception) {
                            android.util.Log.w("ManagePostsPageView", "Query completely failed: ${eFallback.message}")
                            emptyList()
                        }
                    } else {
                        android.util.Log.w("ManagePostsPageView", "Query completely failed: ${eDefault.message}")
                        emptyList()
                    }
                }
            }
        }
    }

    // 🚀 LIVE FETCH ON DEMAND: తాజా వార్తల లోడింగ్
    LaunchedEffect(currentUser, selectedReporterId, queryLimit, refreshTrigger) {
        loading = true

        val queryPairs = mutableListOf<Pair<Query, Query?>>()

        if (selectedReporterId != null) {
            // 🎯 Admin selected specific reporter by UID:
            val selUid = selectedReporterId!!
            queryPairs.add(
                Pair(
                    FirebaseService.db.collection("news").whereEqualTo("originalReporterId", selUid).orderBy("timestamp", Query.Direction.DESCENDING).limit(queryLimit),
                    FirebaseService.db.collection("news").whereEqualTo("originalReporterId", selUid).limit(queryLimit)
                )
            )
            queryPairs.add(
                Pair(
                    FirebaseService.db.collection("news").whereEqualTo("reporter.id", selUid).orderBy("timestamp", Query.Direction.DESCENDING).limit(queryLimit),
                    FirebaseService.db.collection("news").whereEqualTo("reporter.id", selUid).limit(queryLimit)
                )
            )
        } else if (isAdminOrEditor) {
            // Admin/Editor with "All News": latest global posts
            queryPairs.add(
                Pair(
                    FirebaseService.db.collection("news").orderBy("timestamp", Query.Direction.DESCENDING).limit(queryLimit),
                    FirebaseService.db.collection("news").limit(queryLimit)
                )
            )
        } else if (isRegionalIncharge && currentUser?.assignedDistricts?.isNotEmpty() == true) {
            // Regional Incharge: assigned districts
            val dists = currentUser.assignedDistricts.take(10)
            queryPairs.add(
                Pair(
                    FirebaseService.db.collection("news").whereIn("district", dists).orderBy("timestamp", Query.Direction.DESCENDING).limit(queryLimit),
                    FirebaseService.db.collection("news").whereIn("district", dists).limit(queryLimit)
                )
            )
        } else {
            // 🛡️ Standard Reporter: ఖచ్చితంగా విలేకరి యొక్క ప్రామాణిక UID తో మాత్రమే తాజా వార్తలను తెస్తాము
            val reporterUid = uid.ifBlank { authUid }
            if (reporterUid.isNotBlank()) {
                queryPairs.add(
                    Pair(
                        FirebaseService.db.collection("news").whereEqualTo("originalReporterId", reporterUid).orderBy("timestamp", Query.Direction.DESCENDING).limit(queryLimit),
                        FirebaseService.db.collection("news").whereEqualTo("originalReporterId", reporterUid).limit(queryLimit)
                    )
                )
                queryPairs.add(
                    Pair(
                        FirebaseService.db.collection("news").whereEqualTo("reporter.id", reporterUid).orderBy("timestamp", Query.Direction.DESCENDING).limit(queryLimit),
                        FirebaseService.db.collection("news").whereEqualTo("reporter.id", reporterUid).limit(queryLimit)
                    )
                )
            }
        }

        try {
            val mergedMap = mutableMapOf<String, NewsPost>()
            val deferreds = queryPairs.map { (baseQ, fallbackQ) ->
                async(Dispatchers.IO) {
                    fetchQueryDocuments(baseQ, fallbackQ)
                }
            }
            deferreds.awaitAll().forEach { docs ->
                docs.forEach { doc ->
                    val data = doc.data ?: return@forEach
                    mergedMap[doc.id] = com.alfanews.telugu.models.mapMapToNewsPost(doc.id, data)
                }
            }

            // 🚀 STRICT TIMESTAMP DESCENDING: తాజా వార్తలు ఎల్లప్పుడూ పైనే ఉంటాయి
            val sorted = mergedMap.values.sortedByDescending { it.timestamp }
            posts = sorted
        } catch (e: Exception) {
            android.util.Log.e("ManagePostsPageView", "Error loading manage posts: ${e.message}")
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

    val displayedPosts = remember(posts, searchQuery) {
        if (searchQuery.isBlank()) {
            posts
        } else {
            val q = searchQuery.trim().lowercase()
            posts.filter { post ->
                post.headline.telugu.lowercase().contains(q) ||
                post.content.telugu.lowercase().contains(q) ||
                post.reporter.name.lowercase().contains(q) ||
                post.categories.any { it.lowercase().contains(q) } ||
                post.tags.any { it.lowercase().contains(q) } ||
                post.location.lowercase().contains(q) ||
                post.district?.lowercase()?.contains(q) == true
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
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { refreshTrigger++ },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Text(
                        text = "మొత్తం: ${displayedPosts.size}",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // 🔍 Controls: Search bar & Reporter Filter
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("వార్తలు లేదా విలేకరి పేరు వెతకండి...", fontSize = 13.sp) },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = "Search", tint = MaterialTheme.colorScheme.primary)
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(18.dp))
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                )
            )

            // Reporter dropdown for Admin / Editor / Incharge
            if (isAdminOrEditor || isRegionalIncharge) {
                ExposedDropdownMenuBox(
                    expanded = reporterDropdownExpanded,
                    onExpandedChange = { reporterDropdownExpanded = !reporterDropdownExpanded }
                ) {
                    val repDisplayText = when {
                        selectedReporterId == null -> "అన్ని తాజా వార్తలు (All Global News)"
                        selectedReporterId == uid -> "నా వార్తలు (My Posts)"
                        else -> selectedReporterName.ifBlank { "ఎంపిక చేసిన విలేకరి" }
                    }
                    OutlinedTextField(
                        value = repDisplayText,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("విలేకరి ఎంపిక (Select Reporter)", fontSize = 12.sp) },
                        leadingIcon = {
                            Icon(Icons.Default.Person, contentDescription = "Reporter", tint = MaterialTheme.colorScheme.primary)
                        },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = reporterDropdownExpanded)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = reporterDropdownExpanded,
                        onDismissRequest = { reporterDropdownExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("అన్ని తాజా వార్తలు (All Global News)") },
                            onClick = {
                                selectedReporterId = null
                                selectedReporterName = ""
                                reporterDropdownExpanded = false
                            }
                        )
                        if (uid.isNotBlank()) {
                            DropdownMenuItem(
                                text = { Text("నా వార్తలు (My Posts)") },
                                onClick = {
                                    selectedReporterId = uid
                                    selectedReporterName = "నా వార్తలు"
                                    reporterDropdownExpanded = false
                                }
                            )
                        }
                        HorizontalDivider()
                        reporterList.forEach { rep ->
                            val label = buildString {
                                append(rep.name.ifBlank { "Reporter" })
                                if (!rep.assignedMandal.isNullOrBlank()) append(" (${rep.assignedMandal})")
                                else if (!rep.district.isNullOrBlank()) append(" (${rep.district})")
                                if (!rep.phone.isNullOrBlank()) append(" - ${rep.phone}")
                            }
                            DropdownMenuItem(
                                text = { Text(label, maxLines = 1) },
                                onClick = {
                                    selectedReporterId = rep.id
                                    selectedReporterName = rep.name.ifBlank { "Reporter" }
                                    reporterDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

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
                if (displayedPosts.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(top = 100.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (searchQuery.isNotBlank()) "వెతికిన వార్తలు ఏవీ లేవు." else "వార్తలు ఏవీ లేవు.",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    items(displayedPosts, key = { postItem: NewsPost -> postItem.id }) { post ->
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

                    if (!loadMoreRequested && searchQuery.isBlank() && posts.size >= 10) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                OutlinedButton(
                                    onClick = { loadMoreRequested = true },
                                    shape = RoundedCornerShape(20.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        contentColor = MaterialTheme.colorScheme.primary
                                    )
                                ) {
                                    Text("మరిన్ని పాత వార్తలు (Load More Older News)")
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
