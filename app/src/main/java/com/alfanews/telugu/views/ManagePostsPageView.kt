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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
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
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.DateTimeUtils
import com.google.firebase.firestore.Query
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * ManagePostsPageView (వార్తల నిర్వహణ)
 * - Admin కు అన్ని తాజా వార్తలను ఆర్డర్‌లో చూపిస్తుంది (All Latest News).
 * - విలేకరులకు కేవలం వారి UID ఆధారంగా మాత్రమే వార్తలను చూపిస్తుంది.
 * - అన్ని అనవసరపు logicలు (ఫోన్ నంబర్, పేరు మ్యాచింగ్) తొలగించబడ్డాయి.
 */
@Composable
fun ManagePostsPageView(
    onEditPost: (NewsPost) -> Unit,
    onViewPost: (NewsPost) -> Unit = {},
    currentUser: User? = null,
    showTitle: Boolean = true
) {
    val authUid = FirebaseService.auth.currentUser?.uid ?: ""
    val uid = currentUser?.id?.takeIf { it.isNotBlank() } ?: authUid
    val role = currentUser?.role ?: UserRole.REPORTER

    val isAdmin = role == UserRole.ADMIN || role == UserRole.EDITOR ||
        currentUser?.phone?.contains("9173811009") == true ||
        currentUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true ||
        FirebaseService.auth.currentUser?.phoneNumber?.contains("9173811009") == true ||
        FirebaseService.auth.currentUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true

    var viewMode by remember { mutableStateOf(if (isAdmin) "all" else "my") }
    var posts by remember(viewMode, uid) { mutableStateOf<List<NewsPost>>(emptyList()) }
    var loading by remember(viewMode, uid) { mutableStateOf(true) }
    var refreshTrigger by remember { mutableStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showStatusDetailDialog by remember { mutableStateOf<NewsPost?>(null) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(viewMode, uid, refreshTrigger) {
        loading = true
        try {
            val shouldFetchAll = isAdmin && viewMode == "all"

            if (shouldFetchAll) {
                // 🚀 ADMIN VIEW: అన్ని తాజా వార్తలు (Live latest global feed descending by timestamp)
                val snap = FirebaseService.db.collection("news")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(100)
                    .get()
                    .await()

                posts = snap.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    mapMapToNewsPost(doc.id, data)
                }
            } else {
                // 🛡️ REPORTER VIEW: కేవలం విలేకరి UID ఆధారంగా మాత్రమే
                if (uid.isBlank()) {
                    posts = emptyList()
                    loading = false
                    return@LaunchedEffect
                }

                val postsMap = mutableMapOf<String, NewsPost>()

                val deferredOriginal = async(Dispatchers.IO) {
                    try {
                        FirebaseService.db.collection("news")
                            .whereEqualTo("originalReporterId", uid)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(100)
                            .get()
                            .await()
                            .documents
                    } catch (_: Exception) {
                        try {
                            FirebaseService.db.collection("news")
                                .whereEqualTo("originalReporterId", uid)
                                .limit(100)
                                .get()
                                .await()
                                .documents
                        } catch (_: Exception) {
                            emptyList()
                        }
                    }
                }

                val deferredReporter = async(Dispatchers.IO) {
                    try {
                        FirebaseService.db.collection("news")
                            .whereEqualTo("reporter.id", uid)
                            .orderBy("timestamp", Query.Direction.DESCENDING)
                            .limit(100)
                            .get()
                            .await()
                            .documents
                    } catch (_: Exception) {
                        try {
                            FirebaseService.db.collection("news")
                                .whereEqualTo("reporter.id", uid)
                                .limit(100)
                                .get()
                                .await()
                                .documents
                        } catch (_: Exception) {
                            emptyList()
                        }
                    }
                }

                val docsOriginal = deferredOriginal.await()
                val docsReporter = deferredReporter.await()

                for (doc in docsOriginal + docsReporter) {
                    val data = doc.data ?: continue
                    postsMap[doc.id] = mapMapToNewsPost(doc.id, data)
                }

                posts = postsMap.values.sortedByDescending { it.timestamp }
            }
        } catch (e: Exception) {
            android.util.Log.e("ManagePostsPageView", "Error loading posts: ${e.message}")
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

    val displayedPosts = remember(posts, searchQuery) {
        if (searchQuery.isBlank()) {
            posts
        } else {
            val q = searchQuery.trim().lowercase()
            posts.filter { post ->
                post.headline.telugu.lowercase().contains(q) ||
                post.content.telugu.lowercase().contains(q) ||
                post.reporter.name.lowercase().contains(q) ||
                post.reporter.id.lowercase().contains(q) ||
                post.originalReporterId?.lowercase()?.contains(q) == true ||
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
        // హెడర్
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (showTitle) {
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

        Spacer(modifier = Modifier.height(12.dp))

        // అడ్మిన్ కోసం మోడ్ సెలెక్టర్ (All News vs My Posts)
        if (isAdmin) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = viewMode == "all",
                    onClick = { viewMode = "all" },
                    label = { Text("అన్ని తాజా వార్తలు", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                    modifier = Modifier.weight(1f),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
                FilterChip(
                    selected = viewMode == "my",
                    onClick = { viewMode = "my" },
                    label = { Text("నా వార్తలు", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                    modifier = Modifier.weight(1f),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
        }

        // శోధన బార్ (Search Bar)
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("వార్తలు, విలేకరి పేరు లేదా UID వెతకండి...", fontSize = 13.sp) },
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
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 80.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = when {
                                    searchQuery.isNotBlank() -> "వెతికిన వార్తలు ఏవీ లేవు."
                                    viewMode == "my" -> "మీరు పోస్ట్ చేసిన వార్తలు ఏవీ లేవు."
                                    else -> "వార్తలు ఏవీ లేవు."
                                },
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    items(displayedPosts, key = { it.id }) { post ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (post.approved || post.status?.uppercase() == "PUBLISHED") {
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

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        val timeString = DateTimeUtils.formatTimestamp(post.timestamp, "dd MMM, hh:mm a")
                                        val repLabel = post.reporter.name.ifBlank { "Alfa News" }
                                        val distLabel = if (!post.district.isNullOrBlank()) " • ${post.district}" else ""
                                        Text(
                                            text = "${post.categories.firstOrNull() ?: "General"} • $repLabel$distLabel • $timeString",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )

                                        Spacer(modifier = Modifier.height(6.dp))

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
                                            else -> if (post.approved) "LIVE" else "పరిశీలనలో ఉంది..."
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

                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        IconButton(
                                            onClick = { onEditPost(post) },
                                            modifier = Modifier
                                                .background(MaterialTheme.colorScheme.surface, CircleShape)
                                                .size(36.dp)
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
                                            modifier = Modifier
                                                .background(MaterialTheme.colorScheme.surface, CircleShape)
                                                .size(36.dp)
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
