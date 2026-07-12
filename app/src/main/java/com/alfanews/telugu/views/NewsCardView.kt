package com.alfanews.telugu.views

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.PixelCopy
import android.view.View
import android.widget.Toast
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.crossfade
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.MediaType
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
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
import com.alfanews.telugu.utils.DateTimeUtils
import com.alfanews.telugu.models.SurveyQuestion
import com.alfanews.telugu.models.SurveyOption
import kotlinx.coroutines.tasks.await
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.*

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
    showTopHeader: Boolean = true,
    autoShare: Boolean = false,
    onAutoShareDone: () -> Unit = {},
    onEditClick: (NewsPost) -> Unit = {},
    isActive: Boolean = false
) {
    if (autoShare) onAutoShareDone()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val view = LocalView.current
    val uriHandler = LocalUriHandler.current

    var isLiked by remember(post.id) { mutableStateOf(false) }
    var showComments by remember(post.id) { mutableStateOf(false) }
    
    val scrollState = rememberScrollState()
    var hasReadFinished by remember(post.id) { mutableStateOf(false) }
    var startTime by remember { mutableStateOf<Long?>(null) }

    val headlineText = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
    val contentText = if (language == Language.TELUGU) post.content.telugu else post.content.english

    val isEnglish = language == Language.ENGLISH
    val headlineSize = if (isEnglish) 19.sp else 22.sp
    val headlineLineHeight = if (isEnglish) 27.sp else 30.sp
    val contentSize = if (isEnglish) 16.sp else 19.sp
    val contentLineHeight = if (isEnglish) 23.sp else 26.sp

    val englishRegex = remember { Regex("[a-zA-Z]") }

    val headlineFontFamily = remember(language, headlineText) {
        if (language == Language.ENGLISH || (headlineText != "" && headlineText.contains(englishRegex))) Poppins else Ramabhadra
    }

    val headlineFontWeight = remember(language, headlineText) {
        if (language == Language.ENGLISH || (headlineText != "" && headlineText.contains(englishRegex))) FontWeight.Bold else FontWeight.Normal
    }

    val contentFontFamily = remember(language, contentText) {
        if (language == Language.ENGLISH || (contentText != "" && contentText.contains(englishRegex))) Poppins else Mallanna
    }

    var isSharing by remember { mutableStateOf(false) }

    val formattedTimestamp = remember(post.timestamp) { 
        DateTimeUtils.formatTimestamp(post.timestamp, "dd-MM-yy, hh:mm a", Locale.forLanguageTag("en-IN")) 
    }

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

    LaunchedEffect(scrollState) {
        snapshotFlow { scrollState.value }
            .collect { value ->
                if (!hasReadFinished && scrollState.maxValue > 0 && value >= scrollState.maxValue - 50) {
                    hasReadFinished = true
                    AnalyticsService.logFullRead(post)
                }
            }
    }

    DisposableEffect(Unit) {
        onDispose {
            startTime?.let { start ->
                val duration = (System.currentTimeMillis() - start) / 1000.0
                if (duration < 2) {
                    AnalyticsService.logNegativeSignal(post)
                } else if (duration > 4) {
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
    
    val isSpecialCard = post.type == "greeting" || post.type == "quote"
    val isCartoonCard = post.type == "cartoon"
    val isSurveyCard = post.type == "survey"

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        if (isSurveyCard) {
            SurveyCardContent(
                post = post,
                currentUser = currentUser,
                language = language,
                onProfileClick = onProfileClick,
                isSharing = isSharing,
                setSharing = { isSharing = it },
                shareCount = shareCount,
                setShareCount = { shareCount = it },
                view = view,
                isActive = isActive
            )
        } else if (isSpecialCard || isCartoonCard) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
                val mediaList = remember(post) {
                    if (post.mediaUrls.isNotEmpty()) post.mediaUrls else if (post.mediaUrl.isNotEmpty()) listOf(post.mediaUrl) else emptyList<String>()
                }
                val mediaTypes = remember(post) {
                    if (post.mediaTypes.isNotEmpty()) post.mediaTypes else listOf(post.mediaType)
                }

                if (post.youtubeUrl != null && post.youtubeUrl.isNotEmpty()) {
                    YouTubePlayerComponent(youtubeUrl = post.youtubeUrl)
                } else if (mediaList.isNotEmpty()) {
                    val pagerState = rememberPagerState(pageCount = { mediaList.size })
                    Box(modifier = Modifier.fillMaxSize()) {
                        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                            val url = mediaList[page]
                            val type = mediaTypes.getOrNull(page) ?: MediaType.IMAGE
                            if (type == MediaType.VIDEO) {
                                VideoPlayerView(
                                    videoUrl = url,
                                    autoPlay = isActive && pagerState.currentPage == page
                                )
                            } else {
                                AsyncImage(
                                    model = ImageRequest.Builder(context).data(url).crossfade(true).allowHardware(true).build(),
                                    fallback = painterResource(id = R.drawable.fallback_news_image),
                                    error = painterResource(id = R.drawable.fallback_news_image),
                                    contentDescription = headlineText,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop,
                                    alignment = Alignment.Center
                                )
                            }
                        }
                        if (mediaList.size > 1) {
                            Row(Modifier.height(30.dp).fillMaxWidth().align(Alignment.BottomCenter).background(Color.Black.copy(alpha = 0.3f)), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                                repeat(mediaList.size) { iteration ->
                                    val color = if (pagerState.currentPage == iteration) Color.White else Color.White.copy(alpha = 0.5f)
                                    Box(modifier = Modifier.padding(2.dp).clip(CircleShape).background(color).size(8.dp))
                                }
                            }
                        }
                    }
                }

                if (isSpecialCard || isCartoonCard) {
                    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f)), startY = 500f)))
                    Text(
                        text = contentText,
                        color = Color.White,
                        fontSize = if (isCartoonCard) 26.sp else 23.sp,
                        fontFamily = Ramabhadra,
                        lineHeight = if (isCartoonCard) 36.sp else 33.sp,
                        fontWeight = if (isCartoonCard) FontWeight.Bold else FontWeight.Normal,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.align(Alignment.BottomCenter).padding(start = 24.dp, end = 80.dp, bottom = 48.dp)
                    )
                }

                Box(modifier = Modifier.fillMaxSize().background(Brush.horizontalGradient(colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.5f)), startX = 0f)))

                Column(modifier = Modifier.align(Alignment.CenterEnd).padding(end = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
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
                                    FirebaseService.db.collection("news").document(post.id).update("likes", FieldValue.increment(if (isLiked) 1 else -1))
                                    AnalyticsService.logAnalyticsEvent("like", Bundle().apply { putString("post_id", post.id) })
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
                        onClick = { 
                            if (!isSharing) {
                                val bounds = Rect()
                                view.getGlobalVisibleRect(bounds)
                                performShare(scope, isSharing, { isSharing = it }, { shareCount++ }, post, context, language, bounds, view) 
                            }
                        }
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    ActionButton(icon = Icons.AutoMirrored.Filled.Comment, count = commentCount.toString(), tint = Color.White, onClick = { showComments = true })
                }
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
                Box(modifier = Modifier.fillMaxWidth().weight(0.38f)) {
                    val mediaList = remember(post) { if (post.mediaUrls.isNotEmpty()) post.mediaUrls else if (post.mediaUrl.isNotEmpty()) listOf(post.mediaUrl) else emptyList<String>() }
                    val mediaTypes = remember(post) { if (post.mediaTypes.isNotEmpty()) post.mediaTypes else listOf(post.mediaType) }
                    
                    if (post.youtubeUrl != null && post.youtubeUrl.isNotEmpty()) {
                        YouTubePlayerComponent(youtubeUrl = post.youtubeUrl)
                    } else if (mediaList.isNotEmpty()) {
                        val pagerState = rememberPagerState(pageCount = { mediaList.size })
                        Box(modifier = Modifier.fillMaxSize()) {
                            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                                val url = mediaList[page]
                                val type = mediaTypes.getOrNull(page) ?: MediaType.IMAGE
                                if (type == MediaType.VIDEO) {
                                    VideoPlayerView(videoUrl = url, autoPlay = isActive && pagerState.currentPage == page)
                                } else {
                                    AsyncImage(
                                        model = ImageRequest.Builder(context).data(url).crossfade(true).allowHardware(true).build(),
                                        fallback = painterResource(id = R.drawable.fallback_news_image),
                                        error = painterResource(id = R.drawable.fallback_news_image),
                                        contentDescription = headlineText,
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = ContentScale.Crop,
                                        alignment = Alignment.Center
                                    )
                                }
                            }
                            
                            if (post.reporter.name.isNotEmpty()) {
                                val sourceText = if (language == Language.TELUGU) "మూలం: " else "Source: "
                                Text(
                                    text = "$sourceText${post.reporter.name}",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontFamily = Mallanna,
                                    modifier = Modifier.align(Alignment.BottomStart).padding(10.dp).clickable {
                                        val url = post.originalUrl
                                        if (!url.isNullOrEmpty()) uriHandler.openUri(url) else onReporterClick(post.reporter.id)
                                    }
                                )
                            }
                            
                            if (mediaList.size > 1) {
                                Row(Modifier.height(30.dp).fillMaxWidth().align(Alignment.BottomCenter).background(Color.Black.copy(alpha = 0.3f)), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                                    repeat(mediaList.size) { iteration ->
                                        val color = if (pagerState.currentPage == iteration) Color.White else Color.White.copy(alpha = 0.5f)
                                        Box(modifier = Modifier.padding(2.dp).clip(CircleShape).background(color).size(8.dp))
                                    }
                                }
                            }
                        }
                    }
                }
                
                Row(modifier = Modifier.fillMaxWidth().weight(0.62f)) {
                    Column(modifier = Modifier.weight(1f).padding(start = 16.dp, end = 0.dp, top = 6.dp, bottom = 12.dp)) {
                        Text(text = headlineText, style = TextStyle(fontSize = headlineSize, lineHeight = headlineLineHeight, fontWeight = headlineFontWeight, fontFamily = headlineFontFamily, platformStyle = PlatformTextStyle(includeFontPadding = false)), color = MaterialTheme.colorScheme.onSurface)
                        Spacer(modifier = Modifier.height(6.dp))
                        DottedLine()
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Start) {
                            if (post.reporter.name.isNotEmpty()) {
                                Text(text = post.reporter.name, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = Mallanna, color = MaterialTheme.colorScheme.primary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false).clickable { onReporterClick(post.reporter.id) })
                                Text(text = " | ", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f))
                            }
                            Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(2.dp))
                            Text(text = post.location, fontSize = 12.sp, fontFamily = Ramabhadra, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                            Spacer(Modifier.width(8.dp))
                            Text(text = formattedTimestamp, fontSize = 10.sp, fontFamily = Mallanna, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        DottedLine()
                        Spacer(modifier = Modifier.height(6.dp))
                        Column(modifier = Modifier.weight(1f).verticalScroll(scrollState)) {
                            Text(text = contentText, style = TextStyle(fontSize = contentSize, lineHeight = contentLineHeight, fontFamily = contentFontFamily, platformStyle = PlatformTextStyle(includeFontPadding = false)), color = MaterialTheme.colorScheme.onSurface)
                            
                            if (post.affiliateUrl != null && post.affiliateUrl.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(16.dp))
                                if (post.type == "affiliate") {
                                    // Style for regular news-like post with link
                                    Text(
                                        text = if (language == Language.TELUGU) "మరిన్ని వివరాలకు ఇక్కడ క్లిక్ చేయండి..." else "Click here for more details...",
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold,
                                        style = TextStyle(fontSize = contentSize),
                                        modifier = Modifier.clickable {
                                            try {
                                                uriHandler.openUri(post.affiliateUrl)
                                                AnalyticsService.logAnalyticsEvent("affiliate_link_click", Bundle().apply { 
                                                    putString("post_id", post.id)
                                                    putString("url", post.affiliateUrl)
                                                })
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Could not open link", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    )
                                } else {
                                    // Shop Now Button (Default for product type if any)
                                    Button(
                                        onClick = { 
                                            try {
                                                uriHandler.openUri(post.affiliateUrl)
                                                AnalyticsService.logAnalyticsEvent("product_click", Bundle().apply { 
                                                    putString("post_id", post.id)
                                                    putString("url", post.affiliateUrl)
                                                })
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Could not open link", Toast.LENGTH_SHORT).show()
                                            }
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(48.dp)
                                            .shadow(4.dp, RoundedCornerShape(8.dp)),
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = Color(0xFFFF9900), // Amazon Orange-ish
                                            contentColor = Color.White
                                        )
                                    ) {
                                        Icon(Icons.Default.Favorite, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            text = if (language == Language.TELUGU) "వస్తువును చూడండి (Shop Now)" else "View Product (Shop Now)",
                                            style = MaterialTheme.typography.labelLarge,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                            
                            Spacer(modifier = Modifier.height(40.dp))
                        }
                    }

                    Column(modifier = Modifier.width(64.dp).fillMaxHeight().padding(bottom = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        ActionButton(
                            icon = Icons.Default.Favorite,
                            count = likeCount.toString(),
                            isHighlighted = isLiked,
                            tint = MaterialTheme.colorScheme.onSurface,
                            onClick = {
                                if (currentUser == null) onProfileClick() else {
                                    isLiked = !isLiked
                                    likeCount = if (isLiked) likeCount + 1 else likeCount - 1
                                    scope.launch {
                                        FirebaseService.db.collection("news").document(post.id).update("likes", FieldValue.increment(if (isLiked) 1 else -1))
                                        AnalyticsService.logAnalyticsEvent("like", Bundle().apply { putString("post_id", post.id) })
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
                            onClick = { 
                                if (!isSharing) {
                                    val bounds = Rect()
                                    view.getGlobalVisibleRect(bounds)
                                    performShare(scope, isSharing, { isSharing = it }, { shareCount++ }, post, context, language, bounds, view) 
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        ActionButton(icon = Icons.AutoMirrored.Filled.Comment, count = commentCount.toString(), tint = MaterialTheme.colorScheme.onSurface, onClick = { showComments = true })
                        if (currentUser != null && (currentUser.role == UserRole.ADMIN || currentUser.role == UserRole.EDITOR || (currentUser.role == UserRole.REPORTER && post.reporter.id == currentUser.id))) {
                            Spacer(modifier = Modifier.height(24.dp))
                            ActionButton(icon = Icons.Default.Edit, tint = MaterialTheme.colorScheme.onSurface, onClick = { onEditClick(post) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DottedLine() {
    val color = Color.Gray.copy(alpha = 0.4f)
    Canvas(modifier = Modifier.fillMaxWidth().height(1.dp)) {
        drawLine(color = color, start = Offset(0f, 0f), end = Offset(this.size.width, 0f), pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f, 3f), 0f), strokeWidth = 0.8.dp.toPx())
    }
}

private fun performShare(scope: CoroutineScope, isSharing: Boolean, setSharing: (Boolean) -> Unit, setShareCount: (Int) -> Unit, post: NewsPost, context: Context, language: Language, cardBounds: Rect?, view: View) {
    if (isSharing) return
    scope.launch {
        setSharing(true)
        try {
            delay(100)
            val headline = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
            val shareText = "$headline\nhttps://alfanews.app/news/${post.id}"
            val bitmap = takeScreenshot(view, cardBounds)
            if (bitmap != null) {
                val uri = saveImageToCache(context, bitmap)
                if (uri != null) {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_TEXT, shareText)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    intent.clipData = ClipData.newRawUri(null, uri)
                    val chooser = Intent.createChooser(intent, context.getString(R.string.share_news))
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    context.startActivity(chooser)
                    FirebaseService.db.collection("news").document(post.id).update("shares", FieldValue.increment(1)).addOnSuccessListener { setShareCount(1) }
                } else Toast.makeText(context, context.getString(R.string.share_failed), Toast.LENGTH_SHORT).show()
                bitmap.recycle() // ♻️ Recycle bitmap after sharing
            } else Toast.makeText(context, context.getString(R.string.screenshot_failed), Toast.LENGTH_SHORT).show()
        } catch (e: Exception) { Toast.makeText(context, "Share error", Toast.LENGTH_SHORT).show() } finally { setSharing(false) }
    }
}

private suspend fun takeScreenshot(view: View, bounds: Rect?): Bitmap? = suspendCoroutine { continuation ->
    val activity = findActivity(view.context)
    val window = activity?.window
    if (window == null || bounds == null || bounds.isEmpty || bounds.width() <= 0 || bounds.height() <= 0) { continuation.resume(null); return@suspendCoroutine }
    try {
        val decorView = window.decorView
        val windowWidth = decorView.width
        val windowHeight = decorView.height
        val safeBounds = Rect(bounds.left.coerceIn(0, windowWidth), 0, bounds.right.coerceIn(0, windowWidth), bounds.bottom.coerceIn(0, windowHeight))
        if (safeBounds.width() <= 0 || safeBounds.height() <= 0) { continuation.resume(null); return@suspendCoroutine }
        val runtime = Runtime.getRuntime()
        val availableMemory = runtime.maxMemory() - (runtime.totalMemory() - runtime.freeMemory())
        if (safeBounds.width() * safeBounds.height() * 4L > availableMemory * 0.5) { Log.w("NewsCardView", "Insufficient memory for screenshot"); continuation.resume(null); return@suspendCoroutine }
        val bitmap = try { Bitmap.createBitmap(safeBounds.width(), safeBounds.height(), Bitmap.Config.ARGB_8888) } catch (oom: OutOfMemoryError) { null }
        if (bitmap == null) { continuation.resume(null); return@suspendCoroutine }
        PixelCopy.request(window, safeBounds, bitmap, { copyResult -> 
            if (copyResult == PixelCopy.SUCCESS) {
                continuation.resume(bitmap)
            } else {
                bitmap.recycle() // ♻️ Recycle on failure
                continuation.resume(null)
            }
        }, Handler(Looper.getMainLooper()))
    } catch (e: Exception) { 
        continuation.resume(null) 
    }
}

private fun findActivity(context: Context): Activity? {
    var currentContext = context
    while (currentContext is ContextWrapper) { if (currentContext is Activity) return currentContext; currentContext = currentContext.baseContext }
    return null
}

private fun saveImageToCache(context: Context, bitmap: Bitmap): Uri? {
    val imagesFolder = File(context.cacheDir, "images")
    try {
        imagesFolder.mkdirs()
        val file = File(imagesFolder, "news_share_${System.currentTimeMillis()}.png")
        val stream = FileOutputStream(file)
        bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
        stream.close()
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    } catch (e: Exception) { e.printStackTrace() }
    return null
}

@Composable
fun ActionButton(icon: androidx.compose.ui.graphics.vector.ImageVector, count: String? = null, isHighlighted: Boolean = false, isLoading: Boolean = false, tint: Color = Color.White, description: String? = null, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(if (isPressed) 0.9f else 1.0f)
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.graphicsLayer(scaleX = scale, scaleY = scale).clickable(interactionSource = interactionSource, indication = null, onClick = onClick)) {
        Box(modifier = Modifier.size(44.dp).clip(CircleShape).background(if (isHighlighted) Color.Red.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.15f)).padding(8.dp), contentAlignment = Alignment.Center) {
            if (isLoading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = tint)
            else Icon(imageVector = icon, contentDescription = description, tint = if (isHighlighted) Color.Red else tint, modifier = Modifier.size(28.dp))
        }
        if (count != null) Text(text = count, color = tint, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = Ramabhadra, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun YouTubePlayerComponent(youtubeUrl: String) {
    val videoId = extractYoutubeVideoId(youtubeUrl) ?: return
    var player by remember { mutableStateOf<YouTubePlayer?>(null) }
    var isPlaying by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clickable { if (isPlaying) player?.pause() else player?.play() }, contentAlignment = Alignment.Center) {
        AndroidView(
            factory = { ctx ->
                YouTubePlayerView(ctx).apply {
                    enableAutomaticInitialization = false
                    val options = IFramePlayerOptions.Builder(ctx).controls(0).modestBranding(1).rel(0).ivLoadPolicy(3).build()
                    initialize(object : AbstractYouTubePlayerListener() {
                        override fun onReady(youTubePlayer: YouTubePlayer) {
                            player = youTubePlayer
                            youTubePlayer.cueVideo(videoId, 0f)
                            youTubePlayer.addListener(object : AbstractYouTubePlayerListener() {
                                override fun onStateChange(youTubePlayer: YouTubePlayer, state: com.pierfrancescosoffritti.androidyoutubeplayer.core.player.PlayerConstants.PlayerState) {
                                    isPlaying = state == com.pierfrancescosoffritti.androidyoutubeplayer.core.player.PlayerConstants.PlayerState.PLAYING
                                }
                            })
                        }
                    }, options)
                }
            },
            modifier = Modifier.fillMaxSize(),
            onRelease = { it.release() } // ♻️ Properly release player resources
        )
        if (!isPlaying) {
            Box(modifier = Modifier.size(64.dp).background(Color.Black.copy(alpha = 0.4f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(imageVector = Icons.Default.PlayArrow, contentDescription = "Play", tint = Color.White, modifier = Modifier.size(40.dp))
            }
        }
    }
}

private val YOUTUBE_ID_PATTERN = java.util.regex.Pattern.compile("^.*(?:(?:youtu\\.be/|v/|vi/|u/\\w/|embed/|shorts/)|(?:(?:watch)?\\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*", java.util.regex.Pattern.CASE_INSENSITIVE)

fun extractYoutubeVideoId(url: String?): String? {
    if (url.isNullOrEmpty()) return null
    val matcher = YOUTUBE_ID_PATTERN.matcher(url)
    return if (matcher.matches()) matcher.group(1) else null
}

/**
 * సర్వే కార్డు కంటెంట్‌ను అందంగా డిస్‌ప్లే చేస్తుంది.
 */
@Composable
fun SurveyCardContent(
    post: NewsPost,
    currentUser: User?,
    language: Language,
    onProfileClick: () -> Unit,
    isSharing: Boolean,
    setSharing: (Boolean) -> Unit,
    shareCount: Int,
    setShareCount: (Int) -> Unit,
    view: View,
    isActive: Boolean
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var hasVoted by remember(post.id, currentUser?.id) { mutableStateOf<Boolean?>(null) }
    var isSubmittingVote by remember { mutableStateOf(false) }

    var selectedAnswers by remember(post.id) { mutableStateOf(mapOf<String, String>()) }
    var selectedAnswersTexts by remember(post.id) { mutableStateOf(mapOf<String, String>()) }
    var currentPageIndex by remember(post.id) { mutableIntStateOf(0) }

    LaunchedEffect(post.id, currentUser?.id) {
        val userId = currentUser?.id
        if (userId == null) {
            hasVoted = false
        } else {
            try {
                val doc = FirebaseService.db.collection("news").document(post.id)
                    .collection("voted_users").document(userId).get().await()
                hasVoted = doc.exists()
            } catch (e: Exception) {
                hasVoted = false
            }
        }
    }

    val isDarkTheme = androidx.compose.foundation.isSystemInDarkTheme()
    val gradientBackground = if (isDarkTheme) {
        Brush.verticalGradient(listOf(Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)))
    } else {
        Brush.verticalGradient(listOf(Color(0xFFECE9E6), Color(0xFFFFFFFF)))
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(gradientBackground)
    ) {
        if (hasVoted == null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp, vertical = 24.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header (Post info, reporter, district)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.AccountCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (post.reporter.name.isNotEmpty()) post.reporter.name else "Admin",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (post.isGlobal) "State" else post.district ?: "State",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }

                // Survey Main Title (Headline)
                val headlineText = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
                Text(
                    text = headlineText,
                    fontSize = 24.sp,
                    fontFamily = Ramabhadra,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 32.sp
                )

                // Survey Details (Content)
                val contentText = if (language == Language.TELUGU) post.content.telugu else post.content.english
                if (contentText.isNotEmpty()) {
                    Text(
                        text = contentText,
                        fontSize = 15.sp,
                        fontFamily = Mallanna,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 22.sp
                    )
                }

                Divider(modifier = Modifier.padding(vertical = 4.dp))

                if (hasVoted == false) {
                    // Questionnaire Section
                    if (post.surveyQuestions.isEmpty()) {
                        Text(
                            text = "ఈ సర్వేలో ప్రశ్నలు లేవు.",
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        val currentQuestion = post.surveyQuestions[currentPageIndex]
                        
                        // Resolve Dynamic Question Text
                        val resolvedQuestionText = remember(currentQuestion.questionText, selectedAnswersTexts) {
                            var text = currentQuestion.questionText
                            // Replace by ID: {questionId_ans}
                            selectedAnswersTexts.forEach { qId: String, ansText: String ->
                                text = text.replace("{$qId" + "_ans}", ansText, ignoreCase = true)
                            }
                            // Replace by Index: {q1_ans}, {q2_ans} ...
                            val questionsList = post.surveyQuestions
                            var i = 0
                            while (i < questionsList.size) {
                                val question = questionsList[i]
                                val ansText = selectedAnswersTexts[question.id]
                                if (ansText != null) {
                                    text = text.replace("{q${i + 1}_ans}", ansText, ignoreCase = true)
                                }
                                i++
                            }
                            text
                        }

                        // Progress Indicator
                        if (post.isMultiPage && post.surveyQuestions.size > 1) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "ప్రశ్న ${currentPageIndex + 1} / ${post.surveyQuestions.size}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                                LinearProgressIndicator(
                                    progress = (currentPageIndex + 1).toFloat() / post.surveyQuestions.size,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                )
                            }
                        }

                        // Question Text
                        Text(
                            text = resolvedQuestionText,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        // Options List
                        val selectedOptId = selectedAnswers[currentQuestion.id]
                        currentQuestion.options.forEach { option ->
                            val isSelected = selectedOptId == option.id
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .border(
                                        width = 1.5.dp,
                                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                                        shape = RoundedCornerShape(12.dp)
                                    )
                                    .background(if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f) else Color.Transparent)
                                    .clickable {
                                        if (isSubmittingVote) return@clickable
                                        selectedAnswers = selectedAnswers + (currentQuestion.id to option.id)
                                        selectedAnswersTexts = selectedAnswersTexts + (currentQuestion.id to option.text)
                                        if (!post.isMultiPage) {
                                            submitSurveyVotes(
                                                postId = post.id,
                                                userId = currentUser?.id,
                                                answers = mapOf(currentQuestion.id to option.id),
                                                onSuccess = { hasVoted = true },
                                                onLoginRequired = onProfileClick,
                                                setIsSubmitting = { isSubmittingVote = it },
                                                context = context,
                                                scope = scope
                                            )
                                        }
                                    }
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = isSelected,
                                    onClick = {
                                        if (isSubmittingVote) return@RadioButton
                                        selectedAnswers = selectedAnswers + (currentQuestion.id to option.id)
                                        selectedAnswersTexts = selectedAnswersTexts + (currentQuestion.id to option.text)
                                        if (!post.isMultiPage) {
                                            submitSurveyVotes(
                                                postId = post.id,
                                                userId = currentUser?.id,
                                                answers = mapOf(currentQuestion.id to option.id),
                                                onSuccess = { hasVoted = true },
                                                onLoginRequired = onProfileClick,
                                                setIsSubmitting = { isSubmittingVote = it },
                                                context = context,
                                                scope = scope
                                            )
                                        }
                                    },
                                    colors = RadioButtonDefaults.colors(selectedColor = MaterialTheme.colorScheme.primary)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = option.text,
                                    fontSize = 16.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        // Submit/Next Actions for MultiPage
                        if (post.isMultiPage) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    if (selectedOptId == null) {
                                        Toast.makeText(context, "దయచేసి ఒక ఆప్షన్ ఎంచుకోండి.", Toast.LENGTH_SHORT).show()
                                        return@Button
                                    }
                                    
                                    var selectedOption: SurveyOption? = null
                                    val opts = currentQuestion.options
                                    var oIdx = 0
                                    while (oIdx < opts.size) {
                                        val opt = opts[oIdx]
                                        if (opt.id == selectedOptId) {
                                            selectedOption = opt
                                            break
                                        }
                                        oIdx++
                                    }
                                    
                                    val nextQId = selectedOption?.nextQuestionId
                                    
                                    if (nextQId == "END") {
                                        submitSurveyVotes(
                                            postId = post.id,
                                            userId = currentUser?.id,
                                            answers = selectedAnswers,
                                            onSuccess = { hasVoted = true },
                                            onLoginRequired = onProfileClick,
                                            setIsSubmitting = { isSubmittingVote = it },
                                            context = context,
                                            scope = scope
                                        )
                                    } else if (nextQId != null) {
                                        var targetIdx = -1
                                        val qList = post.surveyQuestions
                                        var idx = 0
                                        while (idx < qList.size) {
                                            if (qList[idx].id == nextQId) {
                                                targetIdx = idx
                                                break
                                            }
                                            idx++
                                        }
                                        
                                        if (targetIdx != -1) {
                                            currentPageIndex = targetIdx
                                        } else {
                                            if (currentPageIndex < post.surveyQuestions.size - 1) currentPageIndex++
                                            else {
                                                submitSurveyVotes(
                                                    postId = post.id,
                                                    userId = currentUser?.id,
                                                    answers = selectedAnswers,
                                                    onSuccess = { hasVoted = true },
                                                    onLoginRequired = onProfileClick,
                                                    setIsSubmitting = { isSubmittingVote = it },
                                                    context = context,
                                                    scope = scope
                                                )
                                            }
                                        }
                                    } else {
                                        if (currentPageIndex < post.surveyQuestions.size - 1) {
                                            currentPageIndex++
                                        } else {
                                            submitSurveyVotes(
                                                postId = post.id,
                                                userId = currentUser?.id,
                                                answers = selectedAnswers,
                                                onSuccess = { hasVoted = true },
                                                onLoginRequired = onProfileClick,
                                                setIsSubmitting = { isSubmittingVote = it },
                                                context = context,
                                                scope = scope
                                            )
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !isSubmittingVote
                            ) {
                                if (isSubmittingVote) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                                } else {
                                    Text(
                                        text = if (currentPageIndex < post.surveyQuestions.size - 1) "తదుపరి ప్రశ్న (Next Question)" else "అభిప్రాయాన్ని సమర్పించండి (Submit)",
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // Results Display Section
                    Text(
                        text = "సర్వే ఫలితాలు (Survey Results)",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )

                    post.surveyQuestions.forEach { question ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = question.questionText,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )

                            var questionTotalRealVotes = 0
                            val qOpts = question.options
                            var oIdx2 = 0
                            while (oIdx2 < qOpts.size) {
                                val opt = qOpts[oIdx2]
                                questionTotalRealVotes += post.votes["q_${question.id}_o_${opt.id}"] ?: 0
                                oIdx2++
                            }
                            
                            question.options.forEach { option ->
                                val optionRealVotes = post.votes["q_${question.id}_o_${option.id}"] ?: 0
                                val pct = if (questionTotalRealVotes > 0) (optionRealVotes * 100f / questionTotalRealVotes) else 0f
                                val pctString = "${"%.1f".format(pct)}%"

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(44.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                                ) {
                                    // Progress fraction background
                                    Box(
                                        modifier = Modifier
                                            .fillMaxHeight()
                                            .fillMaxWidth(fraction = pct / 100f)
                                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.25f))
                                    )
                                    // Percentage Labels Row
                                    Row(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .padding(horizontal = 16.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = option.text,
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 14.sp,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                        Text(
                                            text = pctString,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Fake Votes Counter (starts 11000+, never resets, daily increase, +1 per real vote)
                    val daysSinceCreation = ((System.currentTimeMillis() - post.surveyCreatedAt) / (24 * 60 * 60 * 1000)).coerceAtLeast(0)
                    val displayedVotesCount = post.fakeVotesBase + (daysSinceCreation * 527) + post.realVotesCount
                    val formattedVotes = java.text.NumberFormat.getIntegerInstance().format(displayedVotesCount)
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "మొత్తం అభిప్రాయాలు: $formattedVotes+",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Share Button (Google Blue: Color(0xFF1A73E8), English label "Share")
                    Spacer(modifier = Modifier.height(4.dp))
                    Button(
                        onClick = {
                            val bounds = Rect()
                            view.getGlobalVisibleRect(bounds)
                            // Use performShare defined in NewsCardView
                            performShare(
                                scope = scope,
                                isSharing = isSharing,
                                setSharing = setSharing,
                                setShareCount = setShareCount,
                                post = post,
                                context = context,
                                language = language,
                                cardBounds = bounds,
                                view = view
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A73E8)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = "Share", tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Share", 
                            color = Color.White, 
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                }
            }
        }
    }
}

private fun submitSurveyVotes(
    postId: String,
    userId: String?,
    answers: Map<String, String>,
    onSuccess: () -> Unit,
    onLoginRequired: () -> Unit,
    setIsSubmitting: (Boolean) -> Unit,
    context: Context,
    scope: CoroutineScope
) {
    if (userId == null) {
        onLoginRequired()
        return
    }
    
    setIsSubmitting(true)
    scope.launch {
        try {
            val db = FirebaseService.db
            val batch = db.batch()
            
            // 1. Create voted_user receipt
            val voteRecordRef = db.collection("news").document(postId)
                .collection("voted_users").document(userId)
            
            val recordData = mapOf(
                "userId" to userId,
                "timestamp" to FieldValue.serverTimestamp(),
                "answers" to answers
            )
            batch.set(voteRecordRef, recordData)
            
            // 2. Prepare vote aggregate counts
            val updates = mutableMapOf<String, Any>()
            answers.forEach { qId: String, oId: String ->
                updates["votes.q_${qId}_o_${oId}"] = FieldValue.increment(1)
            }
            updates["realVotesCount"] = FieldValue.increment(1)
            
            val postRef = db.collection("news").document(postId)
            batch.update(postRef, updates)
            
            batch.commit().await()
            Toast.makeText(context, "మీ అభిప్రాయం సమర్పించబడింది!", Toast.LENGTH_SHORT).show()
            onSuccess()
        } catch (e: Exception) {
            Toast.makeText(context, "ఓటు వేయడంలో లోపం: ${e.message}", Toast.LENGTH_LONG).show()
        } finally {
            setIsSubmitting(false)
        }
    }
}
