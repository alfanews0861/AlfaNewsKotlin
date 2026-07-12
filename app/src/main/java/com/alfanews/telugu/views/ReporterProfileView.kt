package com.alfanews.telugu.views

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.google.firebase.Timestamp
import com.alfanews.telugu.services.FirebaseService
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.alfanews.telugu.utils.DateTimeUtils
import java.util.*
import java.util.*

private fun getTimestampValue(data: Map<String, Any?>): Long {
    val timestamp = data["timestamp"] ?: return System.currentTimeMillis()
    return when (timestamp) {
        is Timestamp -> timestamp.toDate().time
        is Long -> timestamp
        is Number -> timestamp.toLong()
        else -> System.currentTimeMillis()
    }
}

private fun mapDocumentToNewsPost(id: String, data: Map<String, Any?>): NewsPost {
    return com.alfanews.telugu.models.mapMapToNewsPost(id, data)
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ReporterProfileView(
    reporterId: String,
    language: Language,
    currentUser: User?,
    onBack: () -> Unit
) {
    var reporter by remember { mutableStateOf<User?>(null) }
    var posts by remember { mutableStateOf<List<NewsPost>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var selectedPostId by remember { mutableStateOf<String?>(null) }
    
    val scope = rememberCoroutineScope()
    
    LaunchedEffect(reporterId) {
        loading = true
        
        try {
            // Fetch reporter details
            if (reporterId.startsWith("SYSTEM_")) {
                reporter = User(
                    id = reporterId,
                    name = when (reporterId) {
                        "SYSTEM_RSS" -> "Web Desk"
                        "SYSTEM_SOCIAL" -> "Social Desk"
                        else -> "News Desk"
                    },
                    role = UserRole.REPORTER,
                    photoUrl = "https://ui-avatars.com/api/?name=Alfa+News&background=random"
                )
            } else {
                val userRef = FirebaseService.db.collection("users").document(reporterId)
                val userSnap = userRef.get().await()
                
                if (userSnap.exists()) {
                    val data = userSnap.data ?: return@LaunchedEffect
                    reporter = User(
                        id = userSnap.id,
                        name = data["name"] as? String ?: "",
                        email = data["email"] as? String,
                        phone = data["phone"] as? String,
                        photoUrl = data["photoUrl"] as? String,
                        role = try {
                            UserRole.valueOf(data["role"] as? String ?: "GUEST")
                        } catch (e: Exception) {
                            UserRole.GUEST
                        },
                        address = data["address"] as? String,
                        district = data["district"] as? String,
                        points = (data["points"] as? Number)?.toInt() ?: 0,
                        badges = (data["badges"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                    )
                }
            }
            
            // Fetch posts by this reporter
            val newsRef = FirebaseService.db.collection("news")
            val query = newsRef.whereEqualTo("reporter.id", reporterId)
                .whereEqualTo("approved", true)
            val querySnapshot = query.get().await()
            
            val fetchedPosts = querySnapshot.documents.mapNotNull { doc ->
                try {
                    val data = doc.data ?: return@mapNotNull null
                    mapDocumentToNewsPost(doc.id, data)
                } catch (e: Exception) {
                    null
                }
            }
            
            // Sort by timestamp (newest first)
            posts = fetchedPosts.sortedByDescending { it.timestamp }
            
        } catch (e: Exception) {
            // Handle error
        } finally {
            loading = false
        }
    }
    
    if (loading) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(40.dp),
                color = MaterialTheme.colorScheme.primary
            )
        }
    } else if (reporter == null) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Reporter profile not found.",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                modifier = Modifier.padding(bottom = 16.dp)
            )
            TextButton(onClick = onBack) {
                Text("Back", color = MaterialTheme.colorScheme.primary)
            }
        }
    } else {
        if (selectedPostId != null) {
            // Feed Mode
            val initialIndex = posts.indexOfFirst { it.id == selectedPostId }.coerceAtLeast(0)
            val pagerState = rememberPagerState(initialPage = initialIndex, pageCount = { posts.size })
            
            Box(modifier = Modifier.fillMaxSize()) {
                VerticalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize(),
                    flingBehavior = PagerDefaults.flingBehavior(
                        state = pagerState,
                        snapPositionalThreshold = 0.05f
                    )
                ) { page ->
                    NewsCardView(
                        post = posts[page],
                        language = language,
                        currentUser = currentUser,
                        modifier = Modifier.fillMaxSize(),
                        showTopHeader = false,
                        onReporterClick = { /* Already on reporter page */ }
                    )
                }
                
                // Back to Grid button
                IconButton(
                    onClick = { selectedPostId = null },
                    modifier = Modifier
                        .padding(16.dp)
                        .align(Alignment.TopStart)
                        .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                ) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
            }
        } else {
            // Grid Mode
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                // Profile Info Span
                item(span = { GridItemSpan(2) }) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shadowElevation = 1.dp,
                        color = MaterialTheme.colorScheme.surface
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            AsyncImage(
                                model = reporter?.photoUrl ?: "https://ui-avatars.com/api/?name=${reporter?.name ?: "R"}&background=random",
                                contentDescription = reporter?.name,
                                modifier = Modifier
                                    .size(96.dp)
                                    .clip(CircleShape)
                                    .border(4.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f), CircleShape),
                                contentScale = ContentScale.Crop
                            )
                            
                            Spacer(modifier = Modifier.height(12.dp))
                            
                            Text(
                                text = reporter?.name ?: "",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            Surface(
                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.2f),
                                shape = MaterialTheme.shapes.small
                            ) {
                                Text(
                                    text = reporter?.role?.name ?: "REPORTER",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                            
                            if (!reporter?.address.isNullOrEmpty()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.LocationOn,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                        tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                    Text(
                                        text = reporter?.address ?: "",
                                        fontSize = 14.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                }
                            }
                            
                            Spacer(modifier = Modifier.height(24.dp))
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                            Spacer(modifier = Modifier.height(16.dp))
                            
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally)
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = posts.size.toString(),
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = "Posts",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                }

                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    val pointsText = (reporter?.points ?: 0).toString()
                                    Text(
                                        text = pointsText,
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFE91E63)
                                    )
                                    Text(
                                        text = "Points",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                }
                            }

                            if (!reporter?.badges.isNullOrEmpty()) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    reporter?.badges?.forEach { badge ->
                                        Surface(
                                            color = Color(0xFFFFA000).copy(alpha = 0.1f),
                                            shape = RoundedCornerShape(16.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFA000).copy(alpha = 0.5f)),
                                            modifier = Modifier.padding(horizontal = 4.dp)
                                        ) {
                                            Text(
                                                text = badge,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFFFFA000),
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Section Title Span
                item(span = { GridItemSpan(2) }) {
                    Text(
                        text = "వార్తలు (Stories)",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp)
                    )
                }

                if (posts.isEmpty()) {
                    item(span = { GridItemSpan(2) }) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No stories posted yet.",
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                            )
                        }
                    }
                } else {
                    items(posts) { post ->
                        Box(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                            PostThumbnailCard(
                                post = post,
                                onClick = { selectedPostId = post.id }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PostThumbnailCard(
    post: NewsPost,
    onClick: () -> Unit
) {
    val dateFormat = remember { DateTimeUtils.getSimpleDateFormat("dd MMM", Locale.getDefault()) }
    val formattedDate = remember(post.timestamp) {
        dateFormat.format(Date(post.timestamp))
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(128.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                val mediaUrl = post.mediaUrl
                if (mediaUrl.isNotEmpty()) {
                    AsyncImage(
                        model = mediaUrl,
                        contentDescription = post.headline.telugu,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }
            }
            
            Column(
                modifier = Modifier.padding(8.dp)
            ) {
                Text(
                    text = post.headline.telugu,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.height(40.dp)
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = formattedDate,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}
