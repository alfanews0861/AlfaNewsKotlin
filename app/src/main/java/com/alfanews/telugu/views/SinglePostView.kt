package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.google.firebase.Timestamp

private fun getTimestampValue(data: Map<String, Any?>): Long {
    val timestamp = data["timestamp"] ?: return System.currentTimeMillis()
    return when (timestamp) {
        is Timestamp -> timestamp.toDate().time
        is Long -> timestamp
        is Number -> timestamp.toLong()
        else -> System.currentTimeMillis()
    }
}

@Suppress("UNCHECKED_CAST")
private fun mapDocumentToNewsPost(id: String, data: Map<String, Any?>): NewsPost {
    return NewsPost(
        id = id,
        headline = com.alfanews.telugu.models.Headline(
            telugu = (data["headline"] as? Map<*, *>)?.get("telugu") as? String ?: "",
            english = (data["headline"] as? Map<*, *>)?.get("english") as? String ?: ""
        ),
        content = com.alfanews.telugu.models.Content(
            telugu = (data["content"] as? Map<*, *>)?.get("telugu") as? String ?: "",
            english = (data["content"] as? Map<*, *>)?.get("english") as? String ?: ""
        ),
        mediaUrl = data["mediaUrl"] as? String ?: "",
        mediaType = when (data["mediaType"] as? String) {
            "VIDEO" -> com.alfanews.telugu.models.MediaType.VIDEO
            else -> com.alfanews.telugu.models.MediaType.IMAGE
        },
        postFormat = when (data["postFormat"] as? String) {
            "16:9" -> com.alfanews.telugu.models.PostFormat.HORIZONTAL
            else -> com.alfanews.telugu.models.PostFormat.VERTICAL
        },
        reporter = com.alfanews.telugu.models.Reporter(
            id = (data["reporter"] as? Map<*, *>)?.get("id") as? String ?: "",
            name = (data["reporter"] as? Map<*, *>)?.get("name") as? String ?: ""
        ),
        location = data["location"] as? String ?: "",
        timestamp = getTimestampValue(data),
        categories = data["categories"] as? List<String> ?: emptyList(),
        likes = (data["likes"] as? Long)?.toInt() ?: 0,
        comments = (data["comments"] as? Long)?.toInt() ?: 0,
        shares = (data["shares"] as? Long)?.toInt() ?: 0,
        localAdUrl = data["localAdUrl"] as? String,
        localAdContact = data["localAdContact"] as? String,
        originalUrl = data["originalUrl"] as? String
    )
}

@Composable
fun SinglePostView(
    postId: String,
    language: Language,
    currentUser: User?,
    onLoginRequest: () -> Unit = {},
    onGoHome: () -> Unit = {},
    onDistrictClick: () -> Unit = {}
) {
    var post by remember { mutableStateOf<NewsPost?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(postId) {
        loading = true
        error = null

        try {
            val docRef = FirebaseService.db.collection("news").document(postId)
            val docSnap = docRef.get().await()

            if (docSnap.exists()) {
                val data = docSnap.data ?: throw Exception("No data")
                post = mapDocumentToNewsPost(docSnap.id, data)
            } else {
                error = "వార్త అందుబాటులో లేదు."
            }
        } catch (e: Exception) {
            error = "లోపం జరిగింది: ${e.message}"
        } finally {
            loading = false
        }
    }

    LaunchedEffect(post) {
        val currentPost = post
        if (currentPost != null) {
            AnalyticsService.logPostEngagement(currentPost)
            AnalyticsService.logNewsScreenView(
                postId = currentPost.id,
                title = currentPost.headline.telugu,
                categories = currentPost.categories
            )
            
            kotlinx.coroutines.delay(10000)
            AnalyticsService.logNewsEngagement(
                postId = currentPost.id,
                title = currentPost.headline.telugu
            )
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
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
        } else if (error != null || post == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = error ?: "వార్త కనుగొనబడలేదు",
                    color = Color(0xFF9CA3AF),
                    fontSize = 16.sp,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                Button(
                    onClick = onGoHome,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("హోమ్ పేజీకి వెళ్ళండి", fontWeight = FontWeight.Bold)
                }
            }
        } else {
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                // Back button
                FloatingActionButton(
                    onClick = onGoHome,
                    modifier = Modifier
                        .padding(16.dp)
                        .size(48.dp),
                    containerColor = Color.Black.copy(alpha = 0.5f),
                    contentColor = Color.White
                ) {
                    Icon(
                        Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        modifier = Modifier.size(24.dp)
                    )
                }

                // Post content
                Box(modifier = Modifier.fillMaxSize()) {
                    NewsCardView(
                        post = post!!,
                        language = language,
                        currentUser = currentUser,
                        onProfileClick = onLoginRequest,
                        onReporterClick = {},
                        onDistrictClick = onDistrictClick
                    )
                }
            }
        }
    }
}
