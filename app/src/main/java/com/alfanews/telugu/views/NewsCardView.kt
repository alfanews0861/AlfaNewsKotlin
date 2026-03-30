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
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
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
import androidx.core.content.FileProvider
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.allowHardware
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.utils.SafeImageLoader
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
    autoShare: Boolean = false,
    onAutoShareDone: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current
    val view = LocalView.current

    var isLiked by remember { mutableStateOf(false) }
    var showComments by remember { mutableStateOf(false) }
    
    val scrollState = rememberScrollState()
    var hasScrolledToBottom by remember { mutableStateOf(false) }
    var startTime by remember { mutableStateOf<Long?>(null) }

    var cardBounds by remember { mutableStateOf<Rect?>(null) }

    val headline = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
    val content = if (language == Language.TELUGU) post.content.telugu else post.content.english

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

    // Scroll Depth ట్రాకింగ్
    LaunchedEffect(scrollState.value) {
        if (!hasScrolledToBottom && scrollState.maxValue > 0 && scrollState.value >= scrollState.maxValue - 50) {
            hasScrolledToBottom = true
            AnalyticsService.logFullRead(post)
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
    
    val isSpecialCard = post.type == "greeting" || post.type == "history"
    val isCartoonCard = post.type == "cartoon"

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .onGloballyPositioned { coordinates ->
                val position = coordinates.positionInWindow()
                val size = coordinates.size
                cardBounds = Rect(
                    position.x.toInt(),
                    position.y.toInt(),
                    (position.x + size.width).toInt(),
                    (position.y + size.height).toInt()
                )
            }
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {

            // HEADER: Rendered only if it is NOT a special card or cartoon card
            if (!isSpecialCard && !isCartoonCard) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Start
                ) {
                    Text(
                        text = "alfa",
                        fontSize = 28.sp,
                        fontFamily = Ramabhadra,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = stringResource(R.string.news),
                        fontSize = 28.sp,
                        fontFamily = Ramabhadra,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.40f) // Media section weight
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .background(Color.Black)
                ) {
                    if (!post.youtubeUrl.isNullOrBlank()) {
                        YouTubePlayerComponent(youtubeUrl = post.youtubeUrl)
                    } else {
                        when (post.mediaType) {
                            MediaType.IMAGE -> {
                                val imageLoader = remember { SafeImageLoader.getImageLoader(context) }
                                AsyncImage(
                                    model = ImageRequest.Builder(context)
                                        .data(post.mediaUrl)
                                        .build(),
                                    imageLoader = imageLoader,
                                    contentDescription = headline,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop, // మార్పును వెనక్కి తీసుకున్నాను, Crop పాత పద్ధతిలోనే పనిచేస్తుంది
                                    alignment = Alignment.TopCenter
                                )
                            }
                            MediaType.VIDEO -> {
                                VideoPlayerView(videoUrl = post.mediaUrl)
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
                    if (post.mediaType == MediaType.IMAGE && post.youtubeUrl.isNullOrBlank() && !isSpecialCard && !isCartoonCard) {
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

            // Content/Buttons Section (Weight 0.60f)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.60f)
                    .padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 12.dp)
            ) {
                if (isSpecialCard || isCartoonCard) {
                    // --- SPECIAL CARD OR CARTOON: Buttons Only, No Text Content ---
                    Column(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // Spacer to push buttons to the bottom/right where text content would normally be
                        Column(modifier = Modifier.weight(1f)) {} 
                        
                        // Action Buttons positioned to the right-center, mimicking normal card right column
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End, // Push buttons to the right
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Like Button (Simplified Logic)
                            ActionButton(
                                icon = Icons.Default.Favorite,
                                count = likeCount.toString(),
                                isHighlighted = isLiked,
                                tint = MaterialTheme.colorScheme.onBackground,
                                onClick = {
                                    scope.launch {
                                        FirebaseService.db.collection("news").document(post.id).update("likes", FieldValue.increment(1))
                                        likeCount++ // Update local count immediately
                                        val params = Bundle().apply { putString("post_id", post.id) }
                                        AnalyticsService.logAnalyticsEvent("like", params)
                                    }
                                    Toast.makeText(context, "Like registered for this special card!", Toast.LENGTH_SHORT).show()
                                }
                            )

                            Spacer(modifier = Modifier.width(24.dp))

                            // Share Button (Simplified Logic)
                            ActionButton(
                                icon = Icons.Default.Share,
                                count = shareCount.toString(),
                                isLoading = isSharing,
                                tint = MaterialTheme.colorScheme.onBackground,
                                onClick = { if (!isSharing) { performShare(scope, isSharing, { isSharing = it }, { shareCount++ }, post, context, uriHandler, cardBounds, view) } }
                            )

                            Spacer(modifier = Modifier.width(24.dp))

                            // Comment Button (Simplified Logic)
                            ActionButton(
                                icon = Icons.AutoMirrored.Filled.Comment,
                                count = commentCount.toString(),
                                tint = MaterialTheme.colorScheme.onBackground,
                                onClick = { showComments = true }
                            )
                        }
                    }
                } else {
                    // --- NORMAL CARD: Content + Buttons (Original Logic) ---
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
                                fontSize = 24.sp,
                                fontFamily = headlineFontFamily,
                                fontWeight = headlineFontWeight,
                                color = MaterialTheme.colorScheme.onBackground,
                                lineHeight = 34.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 2.dp)
                            )

                            Column(
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                // Reduced padding to pull reporter info and content up
                                DottedDivider()
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(vertical = 2.dp) // Reduced vertical padding
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
                                    Text("•", color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f), fontSize = 12.sp)
                                    Text(
                                        text = post.location,
                                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                                        fontSize = 12.sp,
                                        fontFamily = contentFontFamily,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                         modifier = Modifier.weight(0.3f, fill = false)
                                    )
                                    Text("•", color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f), fontSize = 12.sp)
                                    Text(
                                        text = formattedTimestamp,
                                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                                        fontSize = 12.sp,
                                        fontFamily = Poppins,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(0.4f, fill = false)
                                    )
                                }
                                DottedDivider()
                            }

                            Spacer(modifier = Modifier.height(2.dp)) // Reduced spacer height

                            Text(
                                text = content,
                                fontSize = 20.sp,
                                fontFamily = contentFontFamily,
                                fontWeight = FontWeight.Normal,
                                color = MaterialTheme.colorScheme.onBackground,
                                lineHeight = 26.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f)
                                    .verticalScroll(scrollState)
                            )
                        }

                        Column(
                            modifier = Modifier
                                .weight(0.09f)
                                .fillMaxHeight(),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            ActionButton(
                                icon = Icons.Default.Favorite,
                                count = likeCount.toString(),
                                isHighlighted = isLiked,
                                tint = MaterialTheme.colorScheme.onBackground,
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
                                tint = MaterialTheme.colorScheme.onBackground,
                                onClick = { if (!isSharing) { performShare(scope, isSharing, { isSharing = it }, { shareCount++ }, post, context, uriHandler, cardBounds, view) } }
                            )

                            Spacer(modifier = Modifier.height(24.dp))

                            ActionButton(
                                icon = Icons.AutoMirrored.Filled.Comment,
                                count = commentCount.toString(),
                                tint = MaterialTheme.colorScheme.onBackground,
                                onClick = { showComments = true }
                            )
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

        if (post.mediaType == MediaType.VIDEO || !post.youtubeUrl.isNullOrBlank()) {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, shareText)
            }
            context.startActivity(Intent.createChooser(intent, context.getString(R.string.share_news)))
            FirebaseService.db.collection("news").document(post.id).update("shares", FieldValue.increment(1)).addOnSuccessListener {
                setShareCount(1)
            }
            
            setSharing(false)
        } else {
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
}


/**
 * వ్యూ యొక్క స్క్రీన్ షాట్ తీస్తుంది.
 */
private suspend fun takeScreenshot(view: View, bounds: Rect?): Bitmap? = suspendCoroutine { continuation ->
    if (bounds == null) {
        continuation.resume(null)
        return@suspendCoroutine
    }

    try {
        val bitmap = Bitmap.createBitmap(bounds.width(), bounds.height(), Bitmap.Config.ARGB_8888)
        PixelCopy.request(
            (view.context as Activity).window,
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
    count: String,
    isHighlighted: Boolean = false,
    isLoading: Boolean = false,
    tint: Color = MaterialTheme.colorScheme.onBackground,
    contentDescription: String? = null,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
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
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = count,
            color = if (isHighlighted) MaterialTheme.colorScheme.primary else tint,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun DottedDivider() {
    androidx.compose.foundation.Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
    ) {
        val pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f), 0f)
        drawLine(
            color = Color.Gray.copy(alpha = 0.6f),
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
            playWhenReady = true
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
    val videoId = extractYoutubeVideoId(youtubeUrl)
    AndroidView(
        factory = { context: Context ->
            val ytpv = YouTubePlayerView(context)
            ytpv.enableAutomaticInitialization = false
            ytpv.initialize(object : AbstractYouTubePlayerListener() {
                override fun onReady(youTubePlayer: YouTubePlayer) {
                    videoId?.let { youTubePlayer.loadVideo(it, 0f) }
                }
            })
            ytpv
        },
        modifier = Modifier.fillMaxSize()
    )
}

private fun extractYoutubeVideoId(youtubeUrl: String?): String? {
    if (youtubeUrl.isNullOrBlank()) return null
    val pattern = "(?<=watch\\?v=|/videos/|embed/|youtu.be/|/v/|/e/|watch\\?v%3D|watch\\?feature=player_embedded&v=|%2Fvideos%2F|embed%\u200C\u200B2f|youtu.be%\u200C\u200B2f|%2Fv%2F)[^#&?\\n]*"
    val compiledPattern = java.util.regex.Pattern.compile(pattern)
    val matcher = compiledPattern.matcher(youtubeUrl)
    return if (matcher.find()) matcher.group() else null
}
