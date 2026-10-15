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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * ManagePostsPageView (వార్తల నిర్వహణ)
 * - యూజర్ ఐడీ ఆధారంగా తాజా 10 వార్తలను నేరుగా ప్రదర్శిస్తుంది.
 * - స్వచ్ఛమైన, వేగవంతమైన ఆర్కిటెక్చర్ (Zero Over-engineering).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManagePostsPageView(
    onEditPost: (NewsPost) -> Unit,
    onViewPost: (NewsPost) -> Unit = {},
    currentUser: User? = null,
    showTitle: Boolean = true
) {
    val authUser = FirebaseService.auth.currentUser
    val currentUserId = currentUser?.id?.takeIf { it.isNotBlank() } ?: authUser?.uid ?: ""
    val currentUserPhone = (currentUser?.phone ?: authUser?.phoneNumber ?: "").replace("+91", "").trim()
    val role = currentUser?.role ?: UserRole.REPORTER

    val isAdmin = role == UserRole.ADMIN || role == UserRole.EDITOR ||
        role == UserRole.NEWS_DESK || role == UserRole.REGIONAL_INCHARGE ||
        currentUserPhone == "9173811009" ||
        currentUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true ||
        authUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true

    var viewMode by remember(isAdmin) { mutableStateOf(if (isAdmin) "all" else "my") }
    var posts by remember { mutableStateOf<List<NewsPost>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var isManualRefreshing by remember { mutableStateOf(false) }
    var refreshTrigger by remember { mutableStateOf(0) }

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showStatusDetailDialog by remember { mutableStateOf<NewsPost?>(null) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // 🚀 యూజర్ ఐడీ ఆధారంగా తాజా 10 వార్తలను నేరుగా లోడ్ చేసే శుభ్రమైన లాజిక్
    LaunchedEffect(viewMode, refreshTrigger, currentUserId) {
        if (!isAdmin && currentUserId.isBlank()) {
            loading = false
            posts = emptyList()
            return@LaunchedEffect
        }

        loading = posts.isEmpty()
        try {
            withContext(Dispatchers.IO) {
                val newsRef = FirebaseService.db.collection("news")
                val docs = mutableListOf<com.google.firebase.firestore.DocumentSnapshot>()

                if (isAdmin && viewMode == "all") {
                    val snap = try {
                        newsRef.orderBy("timestamp", Query.Direction.DESCENDING).limit(10).get().await()
                    } catch (_: Exception) {
                        try { newsRef.limit(10).get().await() } catch (_: Exception) { null }
                    }
                    snap?.documents?.let { docs.addAll(it) }
                } else {
                    // యూజర్ ఐడీ ఆధారంగా తాజా వార్తలు (సింగిల్ ఫీల్డ్ క్వెరీలు)
                    val s1 = try { newsRef.whereEqualTo("userId", currentUserId).limit(20).get().await() } catch (_: Exception) { null }
                    if (s1 != null && !s1.isEmpty) docs.addAll(s1.documents)

                    val s2 = try { newsRef.whereEqualTo("originalReporterId", currentUserId).limit(20).get().await() } catch (_: Exception) { null }
                    if (s2 != null && !s2.isEmpty) docs.addAll(s2.documents)

                    val s3 = try { newsRef.whereEqualTo("reporter.id", currentUserId).limit(20).get().await() } catch (_: Exception) { null }
                    if (s3 != null && !s3.isEmpty) docs.addAll(s3.documents)

                    // ఫోన్ నంబర్ ఆధారిత ఫాల్‌బ్యాక్
                    if (docs.isEmpty() && currentUserPhone.isNotBlank()) {
                        val s4 = try { newsRef.whereEqualTo("reporterPhone", currentUserPhone).limit(20).get().await() } catch (_: Exception) { null }
                        if (s4 != null && !s4.isEmpty) docs.addAll(s4.documents)
                    }
                }

                val loaded = docs.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    mapMapToNewsPost(doc.id, data)
                }.distinctBy { it.id }.sortedByDescending { it.timestamp }.take(10)

                withContext(Dispatchers.Main) {
                    posts = loaded
                    loading = false
                    isManualRefreshing = false
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                loading = false
                isManualRefreshing = false
            }
        }
    }

    // ⏳ ప్రాసెసింగ్ లో ఉన్న వార్తల కోసం 10 సెకన్ల ఆటో-రిఫ్రెష్
    LaunchedEffect(posts) {
        val hasPending = posts.any {
            val st = it.status?.uppercase() ?: ""
            st == "PENDING" || st == "REVIEWING_CONTENT" || st == "PROCESSING_VIDEO" || st == "PROCESSING_VIDEO_START"
        }
        if (hasPending) {
            kotlinx.coroutines.delay(10000L)
            refreshTrigger++
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
                        text = "తాజా వార్తలు: ${posts.size}",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // అడ్మిన్ కోసం మాత్రమే మోడ్ సెలెక్టర్ (All News vs My Posts)
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

        if (loading && posts.isEmpty()) {
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
            PullToRefreshBox(
                isRefreshing = isManualRefreshing,
                onRefresh = {
                    scope.launch {
                        isManualRefreshing = true
                        refreshTrigger++
                        kotlinx.coroutines.delay(1000L)
                        isManualRefreshing = false
                    }
                },
                modifier = Modifier.fillMaxSize()
            ) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                if (posts.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 60.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = if (viewMode == "my") "మీరు పోస్ట్ చేసిన వార్తలు ఏవీ లేవు." else "వార్తలు ఏవీ లేవు.",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                OutlinedButton(
                                    onClick = { refreshTrigger++ },
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Refresh,
                                        contentDescription = "Refresh",
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("రిఫ్రెష్ చేయండి", fontSize = 13.sp)
                                }
                            }
                        }
                    }
                } else {
                    items(posts, key = { it.id }) { post ->
                        val statusUpper = post.status?.uppercase()
                        val isRejected = statusUpper == "REJECTED" || !post.rejectionReason.isNullOrBlank() || post.isDuplicate
                        val isFailed = statusUpper == "FAILED" || !post.error.isNullOrBlank()
                        val isPublished = post.approved || statusUpper == "PUBLISHED"
                        val isProcessing = statusUpper == "REVIEWING_CONTENT" || statusUpper == "PROCESSING_VIDEO" || statusUpper == "PROCESSING_VIDEO_START"

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (isRejected || isFailed) {
                                        showStatusDetailDialog = post
                                    } else {
                                        onViewPost(post)
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
                                            text = "${post.categories.firstOrNull() ?: "జిల్లా వార్త"} • $repLabel$distLabel • $timeString",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )

                                        Spacer(modifier = Modifier.height(6.dp))

                                        val statusColor = when {
                                            isRejected -> Color(0xFFE53935)
                                            isFailed -> Color(0xFFD32F2F)
                                            isPublished -> Color(0xFF4CAF50)
                                            isProcessing -> Color(0xFF1976D2)
                                            else -> Color(0xFFFF9800)
                                        }
                                        val statusLabel = when {
                                            isRejected -> "తిరస్కరించబడింది"
                                            isFailed -> "విఫలమైంది"
                                            isPublished -> "LIVE"
                                            statusUpper == "REVIEWING_CONTENT" -> "సిద్ధమవుతోంది..."
                                            statusUpper == "PROCESSING_VIDEO" -> "వీడియో తయారవుతోంది..."
                                            statusUpper == "PROCESSING_VIDEO_START" -> "ప్రచురించబడుతోంది..."
                                            else -> "పరిశీలనలో ఉంది..."
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
        }

        // తొలగింపు కన్ఫర్మేషన్ డైలాగ్
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

        // స్టేటస్ వివరాల డైలాగ్ (తిరస్కరణ కారణం చూసేందుకు)
        showStatusDetailDialog?.let { dialogPost ->
            val rawStatus = (dialogPost.status ?: "").uppercase()
            val isRejected = rawStatus == "REJECTED" || !dialogPost.rejectionReason.isNullOrBlank() || dialogPost.isDuplicate
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
                                text = "గమనిక: నిబంధనలకు విరుద్ధంగా ఉన్న వార్తలు, డూప్లికేట్లు ప్రచురించబడవు. దయచేసి వివరాలను సరిచూసి సవరించి మళ్ళీ పంపండి.",
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
                },
                dismissButton = {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        TextButton(
                            onClick = {
                                val target = dialogPost
                                showStatusDetailDialog = null
                                onEditPost(target)
                            }
                        ) {
                            Text("సవరించండి")
                        }
                        TextButton(
                            onClick = {
                                val target = dialogPost
                                showStatusDetailDialog = null
                                onViewPost(target)
                            }
                        ) {
                            Text("చూడండి")
                        }
                    }
                }
            )
        }
    }
}
