package com.alfanews.telugu.views

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.View
import android.widget.Toast
import androidx.compose.ui.platform.UriHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.core.content.FileProvider
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.crossfade
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.utils.SafeImageLoader
import com.alfanews.telugu.utils.glassmorphism
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.MediaType
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.google.firebase.firestore.FieldValue
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.YouTubePlayer
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.listeners.AbstractYouTubePlayerListener
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.options.IFramePlayerOptions
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.views.YouTubePlayerView
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * ఒక వార్తను కార్డ్ రూపంలో ప్రదర్శించే వ్యూ (NewsCardView).
 */
@Composable
fun NewsCardView(
    post: NewsPost,
    language: Language,
    currentUser: User?,
    modifier: Modifier = Modifier,
    onProfileClick: () -> Unit = {},
    onReporterClick: (String) -> Unit = {},
    onDistrictClick: () -> Unit = {},
    district: String? = null,
    showDistrictSelector: Boolean = false,
    autoShare: Boolean = false,
    onAutoShareDone: () -> Unit = {},
    onEditClick: (NewsPost) -> Unit = {}
) {
    if (autoShare) {
        onAutoShareDone()
    }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current
    val view = LocalView.current

    var isLiked by remember(post.id) { mutableStateOf(false) }
    var showComments by remember(post.id) { mutableStateOf(false) }
    
    val scrollState = rememberScrollState()
    var hasScrolledToBottom by remember(post.id) { mutableStateOf(false) }
    var startTime by remember { mutableStateOf<Long?>(null) }

    var cardBounds by remember(post.id) { mutableStateOf<Rect?>(null) }

    val headline = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
    val content = if (language == Language.TELUGU) post.content.telugu else post.content.english

    // ✅ Single imageLoader for the entire card - reused across all AsyncImage calls
    val imageLoader = remember { SafeImageLoader.getImageLoader(context) }

    val isEnglish = language == Language.ENGLISH
    val headlineSize = if (isEnglish) 19.sp else 22.sp
    val headlineLineHeight = if (isEnglish) 27.sp else 30.sp
    val contentSize = if (isEnglish) 16.sp else 18.sp
    val contentLineHeight = if (isEnglish) 23.sp else 26.sp

    val englishRegex = remember { Regex("[a-zA-Z]") }

    val headlineFontFamily = remember(language, headline) {
        if (language == Language.ENGLISH || headline.contains(englishRegex)) Poppins else Ramabhadra
    }

    val headlineFontWeight = remember(language, headline) {
        if (language == Language.ENGLISH || headline.contains(englishRegex)) FontWeight.Bold else FontWeight.Normal
    }

    val contentFontFamily = remember(language, content) {
        if (language == Language.ENGLISH || content.contains(englishRegex)) Poppins else Mallanna
    }

    var isSharing by remember { mutableStateOf(false) }

    val dateFormat = remember { SimpleDateFormat("dd-MMM-yy | hh:mm a", Locale.forLanguageTag("en-IN")) }
    val formattedTimestamp = remember(post.timestamp) { dateFormat.format(Date(post.timestamp)) }

    // Initializing counters once using remember, so they don't reset during recomposition.
    // If the post has 0 likes/shares, we generate a persistent fake count for this session.
    val initialLikeCount = remember(post.id) {
        if (post.likes == 0) (40..180).random() else post.likes
    }
    val initialShareCount = remember(post.id) {
        if (post.shares == 0) (10..45).random() else post.shares
    }

    var likeCount by remember { mutableIntStateOf(initialLikeCount) }
    var shareCount by remember { mutableIntStateOf(initialShareCount) }
    var commentCount by remember { mutableIntStateOf(post.comments) }

    LaunchedEffect(Unit) {
        startTime = System.currentTimeMillis()
    }

    // Scroll Depth ట్రాకింగ్ - పర్ఫార్మెన్స్ కోసం snapshotFlow వాడుతున్నాము
    LaunchedEffect(scrollState) {
        snapshotFlow { scrollState.value }
            .collect { value ->
                if (!hasScrolledToBottom && scrollState.maxValue > 0 && value >= scrollState.maxValue - 50) {
                    hasScrolledToBottom = true
                    AnalyticsService.logFullRead(post)
                }
            }
    }

    DisposableEffect(Unit) {
        onDispose {
            startTime?.let { start ->
                val duration = (System.currentTimeMillis() - start) / 1000.0
                
                when {
                    duration < 2 -> {
                        // Negative Signal: వార్తను 2 సెకన్ల కంటే ముందే స్కిప్ చేస్తే
                        AnalyticsService.logNegativeSignal(post)
                    }
                    duration > 4 -> {
                        // Positive Signal: 4 సెకన్ల కంటే ఎక్కువ సమయం చదివితే
                        AnalyticsService.logPostEngagement(post)
                        
                        val params = Bundle().apply {
                            putString("post_id", post.id)
                            putString("user_id", currentUser?.id)
                            putDouble("duration", duration)
                        }
                        AnalyticsService.logAnalyticsEvent("view", params)
                    }
                }
            }
        }
    }
    
    val isSpecialCard = post.type == "greeting" || post.type == "quote"
    val isCartoonCard = post.type == "cartoon"

    Box(
        modifier = modifier
            .fillMaxSize()
            .onGloballyPositioned { coordinates ->
                // ✅ Only update when size actually changes to prevent recomposition loops
                val position = coordinates.positionInWindow()
                val size = coordinates.size
                val newBounds = Rect(
                    position.x.toInt(),
                    position.y.toInt(),
                    (position.x + size.width).toInt(),
                    (position.y + size.height).toInt()
                )
                if (cardBounds != newBounds) {
                    cardBounds = newBounds
                }
            }
    ) {
        if (isSpecialCard || isCartoonCard) {
            // --- SPECIAL CARD OR CARTOON: Full Screen Media, Overlay Buttons ---
            Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
                val mediaList = remember(post) {
                    if (post.mediaUrls.isNotEmpty()) post.mediaUrls else listOf(post.mediaUrl).filter { it.isNotEmpty() }
                }
                val mediaTypes = remember(post) {
                    if (post.mediaTypes.isNotEmpty()) post.mediaTypes else listOf(post.mediaType)
                }

                if (!post.youtubeUrl.isNullOrBlank()) {
                    YouTubePlayerComponent(youtubeUrl = post.youtubeUrl)
                } else if (mediaList.isNotEmpty()) {
                    val pagerState = rememberPagerState(pageCount = { mediaList.size })
                    Box(modifier = Modifier.fillMaxSize()) {
                        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                            val url = mediaList[page]
                            val type = mediaTypes.getOrNull(page) ?: MediaType.IMAGE
                            if (type == MediaType.VIDEO) {
                                VideoPlayerView(videoUrl = url)
                            } else {
                                AsyncImage(
                                    model = ImageRequest.Builder(context)
                                        .data(url)
                                        .crossfade(true)
                                        .allowHardware(true)
                                        .build(),
                                    fallback = androidx.compose.ui.res.painterResource(id = R.drawable.fallback_news_image),
                                    error = androidx.compose.ui.res.painterResource(id = R.drawable.fallback_news_image),
                                    imageLoader = imageLoader,
                                    contentDescription = headline,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop,
                                    alignment = Alignment.Center
                                )
                            }
                        }
                        
                        if (mediaList.size > 1) {
                            Row(
                                Modifier.height(30.dp).fillMaxWidth().align(Alignment.BottomCenter).background(Color.Black.copy(alpha = 0.3f)),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                repeat(mediaList.size) { iteration ->
                                    val color = if (pagerState.currentPage == iteration) Color.White else Color.White.copy(alpha = 0.5f)
                                    Box(
                                        modifier = Modifier.padding(2.dp).clip(CircleShape).background(color).size(8.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // Overlay text for Quote, Greeting or Cartoon
                if (isSpecialCard || isCartoonCard) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f)),
                                    startY = 500f
                                )
                            )
                    )
                    
                    Text(
                        text = content,
                        color = Color.White,
                        fontSize = if (isCartoonCard) 26.sp else 23.sp,
                        fontFamily = Ramabhadra,
                        lineHeight = if (isCartoonCard) 36.sp else 33.sp,
                        fontWeight = if (isCartoonCard) FontWeight.Bold else FontWeight.Normal,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(start = 24.dp, end = 80.dp, bottom = 48.dp) // Leave space for buttons on right
                    )
                }

                // Optional gradient for buttons visibility
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.5f)),
                                startX = 0f
                            )
                        )
                )

                // Action Buttons on the right
                Column(
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    ActionButton(
                        icon = Icons.Default.Favorite,
                        count = likeCount.toString(),
                        isHighlighted = isLiked,
                        tint = Color.White,
                        onClick = {
                            if (currentUser == null) {
                                onProfileClick()
                            } else {
                                isLiked = !isLiked
                                likeCount = if (isLiked) likeCount + 1 else likeCount - 1
                                scope.launch {
                                    FirebaseService.db.collection("news")
                                        .document(post.id)
                                        .update("likes", FieldValue.increment(if (isLiked) 1 else -1))
                                    val params = Bundle().apply { putString("post_id", post.id) }
                                    AnalyticsService.logAnalyticsEvent("like", params)
                                }
                            }
                        }
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    ActionButton(
                        icon = Icons.Default.Share,
                        count = shareCount.toString(),
                        isLoading = isSharing,
                        tint = Color.White,
                        onClick = { if (!isSharing) { performShare(scope, isSharing, { isSharing = it }, { shareCount++ }, post, context, uriHandler, cardBounds, view) } }
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    ActionButton(
                        icon = Icons.AutoMirrored.Filled.Comment,
                        count = commentCount.toString(),
                        tint = Color.White,
                        onClick = { showComments = true }
                    )
                }
            }
        } else {
            // --- NORMAL CARD: Header, Media, Content ---
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                // HEADER
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "alfa",
                            fontSize = 28.sp,
                            fontFamily = Ramabhadra,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "news",
                            fontSize = 28.sp,
                            fontFamily = Ramabhadra,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    if (showDistrictSelector) {
                        TextButton(
                            onClick = onDistrictClick,
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                Icons.Default.LocationOn,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = "Dist Selector",
                                fontSize = 14.sp,
                                fontFamily = Ramabhadra,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }

                // MEDIA
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(0.38f)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .background(Color.Black)
                    ) {
                        val mediaList = remember(post) {
                            if (post.mediaUrls.isNotEmpty()) post.mediaUrls else listOf(post.mediaUrl).filter { it.isNotEmpty() }
                        }
                        val mediaTypes = remember(post) {
                            if (post.mediaTypes.isNotEmpty()) post.mediaTypes else listOf(post.mediaType)
                        }

                        if (!post.youtubeUrl.isNullOrBlank()) {
                            YouTubePlayerComponent(youtubeUrl = post.youtubeUrl)
                        } else if (mediaList.isNotEmpty()) {
                            val pagerState = rememberPagerState(pageCount = { mediaList.size })
                            Box(modifier = Modifier.fillMaxSize()) {
                                HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                                    val url = mediaList[page]
                                    val type = mediaTypes.getOrNull(page) ?: MediaType.IMAGE
                                    if (type == MediaType.VIDEO) {
                                        VideoPlayerView(videoUrl = url)
                                    } else {
                                        AsyncImage(
                                            model = ImageRequest.Builder(context)
                                                .data(url)
                                                .crossfade(true)
                                                .allowHardware(true)
                                                .build(),
                                            fallback = androidx.compose.ui.res.painterResource(id = R.drawable.fallback_news_image),
                                            error = androidx.compose.ui.res.painterResource(id = R.drawable.fallback_news_image),
                                            imageLoader = imageLoader,
                                            contentDescription = headline,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop,
                                            alignment = Alignment.TopCenter
                                        )
                                    }
                                }
                                
                                if (mediaList.size > 1) {
                                    Row(
                                        Modifier.height(30.dp).fillMaxWidth().align(Alignment.BottomCenter).background(Color.Black.copy(alpha = 0.3f)),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        repeat(mediaList.size) { iteration ->
                                            val color = if (pagerState.currentPage == iteration) Color.White else Color.White.copy(alpha = 0.5f)
                                            Box(
                                                modifier = Modifier.padding(2.dp).clip(CircleShape).background(color).size(6.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(
                                            Color.Transparent,
                                            Color.Transparent,
                                            Color.Black.copy(alpha = 0.3f)
                                        )
                                    )
                                )
                        )
                        
                        if (district != null) {
                             Row(
                                modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp).clickable { onDistrictClick() },
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.LocationOn,
                                    contentDescription = stringResource(R.string.district_desc),
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = district,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    fontSize = 12.sp,
                                    fontFamily = Ramabhadra
                                )
                            }
                        }

                        // ఇమేజ్ సోర్స్ మరియు రిపోర్టర్ పేరును ఇమేజ్ పై ప్రదర్శించడం
                        if (post.mediaType == MediaType.IMAGE && post.youtubeUrl.isNullOrBlank()) {
                            Text(
                                text = context.getString(R.string.news_source, post.reporter.name),
                                color = Color.White.copy(alpha = 0.5f),
                                fontSize = 10.sp,
                                fontFamily = Poppins,
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .padding(12.dp)
                                    .clickable {
                                        if (!post.originalUrl.isNullOrEmpty()) {
                                            uriHandler.openUri(post.originalUrl)
                                        }
                                    }
                            )
                        }
                    }
                }

                // CONTENT
                androidx.compose.material3.Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(0.62f),
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 2.dp
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize()
                        ) {
                            Column(
                                modifier = Modifier
                                    .weight(0.91f)
                                    .fillMaxHeight()
                            ) {
                                Text(
                                    text = headline,
                                    fontSize = headlineSize,
                                    fontFamily = headlineFontFamily,
                                    fontWeight = headlineFontWeight,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    lineHeight = headlineLineHeight,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 2.dp)
                                )

                                Column(
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    DottedDivider()
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = post.reporter.name,
                                            fontSize = 12.sp,
                                            fontFamily = headlineFontFamily,
                                            fontWeight = FontWeight.Medium,
                                            color = Color.Red.copy(alpha = 0.9f),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.clickable(
                                                interactionSource = remember { MutableInteractionSource() },
                                                indication = LocalIndication.current
                                            ) { onReporterClick(post.reporter.id) }.weight(0.3f, fill = false)
                                        )
                                        Text("•", color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f), fontSize = 12.sp)
                                        Text(
                                            text = post.location,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                                            fontSize = 12.sp,
                                            fontFamily = contentFontFamily,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                             modifier = Modifier.weight(0.3f, fill = false)
                                        )
                                        Text("•", color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f), fontSize = 12.sp)
                                        Text(
                                            text = formattedTimestamp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                                            fontSize = 12.sp,
                                            fontFamily = Poppins,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.weight(0.4f, fill = false)
                                        )
                                    }
                                    DottedDivider()
                                }

                                Spacer(modifier = Modifier.height(2.dp))

                                Text(
                                    text = content,
                                    fontSize = contentSize,
                                    fontFamily = contentFontFamily,
                                    fontWeight = FontWeight.Normal,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    lineHeight = contentLineHeight,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .weight(1f),
                                    overflow = TextOverflow.Ellipsis
                                )
                            }

                            Column(
                                modifier = Modifier
                                    .weight(0.09f)
                                    .fillMaxHeight(),
                                verticalArrangement = Arrangement.Center,
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                if (currentUser != null && currentUser.id == post.reporter.id) {
                                    ActionButton(
                                        icon = Icons.Default.Edit,
                                        tint = MaterialTheme.colorScheme.onSurface,
                                        onClick = { onEditClick(post) }
                                    )
                                    Spacer(modifier = Modifier.height(24.dp))
                                }

                                ActionButton(
                                    icon = Icons.Default.Favorite,
                                    count = likeCount.toString(),
                                    isHighlighted = isLiked,
                                    tint = MaterialTheme.colorScheme.onSurface,
                                    onClick = {
                                        if (currentUser == null) {
                                            onProfileClick()
                                        } else {
                                            isLiked = !isLiked
                                            likeCount = if (isLiked) likeCount + 1 else likeCount - 1
                                            scope.launch {
                                                FirebaseService.db.collection("news")
                                                    .document(post.id)
                                                    .update("likes", FieldValue.increment(if (isLiked) 1 else -1))
                                                val params = Bundle().apply { putString("post_id", post.id) }
                                                AnalyticsService.logAnalyticsEvent("like", params)
                                            }
                                        }
                                    }
                                )

                                Spacer(modifier = Modifier.height(24.dp))

                                ActionButton(
                                    icon = Icons.Default.Share,
                                    count = shareCount.toString(),
                                    isLoading = isSharing,
                                    tint = MaterialTheme.colorScheme.onSurface,
                                    onClick = { if (!isSharing) { performShare(scope, isSharing, { isSharing = it }, { shareCount++ }, post, context, uriHandler, cardBounds, view) } }
                                )

                                Spacer(modifier = Modifier.height(24.dp))

                                ActionButton(
                                    icon = Icons.AutoMirrored.Filled.Comment,
                                    count = commentCount.toString(),
                                    tint = MaterialTheme.colorScheme.onSurface,
                                    onClick = { showComments = true }
                                )
                            }
                        }
                    }
                }
            }
        }

        if (showComments) {
            CommentSectionView(
                postId = post.id,
                initialCommentCount = commentCount,
                currentUser = currentUser,
                onClose = { showComments = false },
                onCommentPosted = { commentCount++ },
                onLoginRequest = onProfileClick
            )
        }
    }
}

private fun performShare(scope: CoroutineScope, isSharing: Boolean, setSharing: (Boolean) -> Unit, setShareCount: (Int) -> Unit, post: NewsPost, context: Context, uriHandler: UriHandler, cardBounds: Rect?, view: View) {
    scope.launch {
        setSharing(true)
        val headline = if (context.resources.configuration.locales[0].language == "te") post.headline.telugu else post.headline.english
        val deepLink = "https://alfanews.app/news/${post.id}"
        val shareText = "$headline\n$deepLink"

        val bitmap = takeScreenshot(view, cardBounds)
        if (bitmap != null) {
            val uri = saveImageToCache(context, bitmap)
            if (uri != null) {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/*"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TEXT, shareText)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, context.getString(R.string.share_news)))
                FirebaseService.db.collection("news").document(post.id).update("shares", FieldValue.increment(1)).addOnSuccessListener {
                    setShareCount(1)
                }
            } else {
                Toast.makeText(context, context.getString(R.string.share_failed), Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(context, context.getString(R.string.screenshot_failed), Toast.LENGTH_SHORT).show()
        }
        setSharing(false)
    }
}


/**
 * వ్యూ యొక్క స్క్రీన్ షాట్ తీస్తుంది.
 */
private suspend fun takeScreenshot(view: View, bounds: Rect?): Bitmap? = suspendCoroutine { continuation ->
    if (bounds == null || bounds.isEmpty) {
        continuation.resume(null)
        return@suspendCoroutine
    }

    try {
        val window = (view.context as? Activity)?.window
        if (window == null) {
            continuation.resume(null)
            return@suspendCoroutine
        }

        val bitmap = Bitmap.createBitmap(bounds.width(), bounds.height(), Bitmap.Config.ARGB_8888)
        PixelCopy.request(
            window,
            bounds,
            bitmap,
            { copyResult ->
                if (copyResult == PixelCopy.SUCCESS) {
                    continuation.resume(bitmap)
                } else {
                    continuation.resume(null)
                }
            },
            Handler(Looper.getMainLooper())
        )
    } catch (e: Exception) {
        continuation.resume(null)
    }
}

/**
 * ఇమేజ్‌ను సేవ్ చేస్తుంది.
 */
private fun saveImageToCache(context: Context, bitmap: Bitmap): Uri? {
    val imagesFolder = File(context.cacheDir, "images")
    imagesFolder.mkdirs()
    
    // పాత షేర్ ఇమేజ్‌లను డిలీట్ చేయండి (స్టోరేజ్ ఫ్రీ చేయడానికి)
    imagesFolder.listFiles()?.forEach { if (it.name.startsWith("shared_image_")) it.delete() }

    val file = File(imagesFolder, "shared_image_${System.currentTimeMillis()}.png")
    val stream = FileOutputStream(file)
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
    stream.flush()
    stream.close()
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

@Composable
fun ActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    count: String? = null,
    isHighlighted: Boolean = false,
    isLoading: Boolean = false,
    tint: Color = MaterialTheme.colorScheme.onBackground,
    contentDescription: String? = null,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    
    // 🎨 Bounce Effect: బటన్ నొక్కినప్పుడు కొంచెం లోపలికి వెళ్ళినట్లు అనిపిస్తుంది
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.88f else 1f,
        label = "button_bounce"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.error,
                    strokeWidth = 2.dp
                )
            } else {
                Icon(
                    imageVector = icon,
                    contentDescription = contentDescription,
                    modifier = Modifier.size(28.dp),
                    tint = if (isHighlighted) MaterialTheme.colorScheme.primary else tint
                )
            }
        }
        if (count != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = count,
                color = if (isHighlighted) MaterialTheme.colorScheme.primary else tint,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun DottedDivider() {
    val color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f)
    androidx.compose.foundation.Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
    ) {
        val pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f), 0f)
        drawLine(
            color = color,
            start = Offset(0f, 0f),
            end = Offset(size.width, 0f),
            pathEffect = pathEffect,
            strokeWidth = 1.dp.toPx()
        )
    }
}

@Composable
fun VideoPlayerView(videoUrl: String) {
    val context = LocalContext.current
    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            val mediaItem = MediaItem.fromUri(videoUrl)
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = false
            repeatMode = ExoPlayer.REPEAT_MODE_ONE
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            exoPlayer.release()
        }
    }

    AndroidView(
        factory = {
            PlayerView(context).apply {
                player = exoPlayer
                useController = true
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
fun YouTubePlayerComponent(youtubeUrl: String) {
    val context = LocalContext.current
    val videoId = remember(youtubeUrl) { extractYoutubeVideoId(youtubeUrl) }
    var isPlaying by remember { mutableStateOf(false) }

    if (!isPlaying && videoId != null) {
        val thumbnailUrl = "https://img.youtube.com/vi/$videoId/hqdefault.jpg"
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable { isPlaying = true }
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
        val imageLoader = remember { SafeImageLoader.getImageLoader(context) }
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(thumbnailUrl)
                .crossfade(true)
                .allowHardware(true)
                .build(),
            imageLoader = imageLoader,
                contentDescription = "Video Thumbnail",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            // A simple play button
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Color.Black.copy(alpha = 0.6f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = androidx.compose.material.icons.Icons.Filled.PlayArrow,
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(32.dp)
                )
            }
        }
    } else {
        AndroidView(
            factory = { ctx: Context ->
                val ytpv = YouTubePlayerView(ctx)
                ytpv.enableAutomaticInitialization = false
                
                val options = IFramePlayerOptions.Builder(ctx)
                    .controls(0)
                    .rel(0)
                    .build()
                    
                ytpv.initialize(object : AbstractYouTubePlayerListener() {
                    override fun onReady(youTubePlayer: YouTubePlayer) {
                        videoId?.let { youTubePlayer.loadVideo(it, 0f) }
                    }
                }, options)
                ytpv
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}

// ✅ Compiled once at file level — not per card per call
private val YOUTUBE_ID_PATTERN: java.util.regex.Pattern by lazy {
    java.util.regex.Pattern.compile(
        "(?<=watch\\?v=|/videos/|embed/|youtu.be/|/v/|/e/|watch\\?v%3D|watch\\?feature=player_embedded&v=|%2Fvideos%2F|embed%\u200C\u200B2f|youtu.be%\u200C\u200B2f|%2Fv%2F)[^#&?\\n]*"
    )
}

private fun extractYoutubeVideoId(youtubeUrl: String?): String? {
    if (youtubeUrl.isNullOrBlank()) return null
    val matcher = YOUTUBE_ID_PATTERN.matcher(youtubeUrl)
    return if (matcher.find()) matcher.group() else null
}
