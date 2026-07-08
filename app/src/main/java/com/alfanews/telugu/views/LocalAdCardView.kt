package com.alfanews.telugu.views

import android.annotation.SuppressLint
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
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Launch
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import coil3.compose.AsyncImage
import com.alfanews.telugu.R
import com.alfanews.telugu.models.AdMediaType
import com.alfanews.telugu.models.LocalAd
import com.alfanews.telugu.services.AnalyticsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

@Composable
fun LocalAdCardView(
    ad: LocalAd,
    modifier: Modifier = Modifier,
    isActive: Boolean = true
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val view = LocalView.current
    val isPreview = ad.id.isEmpty() || ad.id.startsWith("preview_")

    var isLiked by remember(ad.id) { mutableStateOf(false) }
    var isSharing by remember { mutableStateOf(false) }

    val initialLikeCount = remember(ad.id) {
        if (ad.likes == 0) (40..180).random() else ad.likes
    }
    val initialShareCount = remember(ad.id) {
        if (ad.shares == 0) (10..45).random() else ad.shares
    }

    var likeCount by remember { mutableIntStateOf(initialLikeCount) }
    var shareCount by remember { mutableIntStateOf(initialShareCount) }
    var commentCount by remember { mutableIntStateOf(ad.comments) }

    // వ్యూ కౌంట్ పెంచడం (Preview లో కాకుండా)
    LaunchedEffect(ad.id) {
        if (!isPreview) {
            FirebaseService.db.collection("local_ads").document(ad.id)
                .update("viewsCurrent", FieldValue.increment(1))
            
            // క్యూ మేనేజ్మెంట్ కోసం యాడ్ ని "చూసినట్లుగా" మార్క్ చేయడం
            com.alfanews.telugu.utils.PreferenceManager.getInstance(context).markLocalAdSeen(ad.id)
        }
    }

    fun handleAdClick() {
        // క్లిక్ కౌంట్ పెంచడం
        if (!isPreview) {
            FirebaseService.db.collection("local_ads").document(ad.id)
                .update("clicksCurrent", FieldValue.increment(1))
        }

        try {
            if (ad.phoneNumber.isNotEmpty()) {
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${ad.phoneNumber}"))
                context.startActivity(intent)
            } else if (ad.actionUrl.isNotEmpty()) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(ad.actionUrl))
                context.startActivity(intent)
            }
        } catch (e: Exception) {
            // Handle error
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        Box(modifier = Modifier.fillMaxSize().clickable { handleAdClick() }) {
            when (ad.adMediaType) {
                AdMediaType.IMAGE -> {
                    AsyncImage(
                        model = ad.bannerUrl,
                        contentDescription = "Ad Image",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                }
                AdMediaType.VIDEO -> {
                    VideoPlayerView(
                        videoUrl = ad.bannerUrl,
                        modifier = Modifier.fillMaxSize(),
                        autoPlay = isActive,
                        muted = false // Audio should play if autoplaying
                    )
                }
                AdMediaType.HTML -> {
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                webViewClient = WebViewClient()
                                settings.javaScriptEnabled = true
                                loadData(ad.htmlContent, "text/html", "UTF-8")
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
        
        // Sponsored tag
        Surface(
            modifier = Modifier.align(Alignment.TopEnd).padding(16.dp),
            color = Color.Black.copy(alpha = 0.6f),
            shape = RoundedCornerShape(4.dp)
        ) {
            Text(
                text = "ప్రకటన (Sponsored)",
                color = Color.White,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                fontWeight = FontWeight.Bold
            )
        }

        // Social Action Buttons (Right side - exactly like NewsCard special cards)
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
                    isLiked = !isLiked
                    likeCount = if (isLiked) likeCount + 1 else likeCount - 1
                    if (!isPreview) {
                        scope.launch {
                            FirebaseService.db.collection("local_ads").document(ad.id)
                                .update("likes", FieldValue.increment(if (isLiked) 1 else -1))
                            AnalyticsService.logAnalyticsEvent("ad_like", Bundle().apply { putString("ad_id", ad.id) })
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
                        performAdShare(scope, isSharing, { isSharing = it }, { 
                            shareCount++ 
                            if (!isPreview) {
                                FirebaseService.db.collection("local_ads").document(ad.id).update("shares", FieldValue.increment(1))
                            }
                        }, ad, context, bounds, view)
                    }
                }
            )
            Spacer(modifier = Modifier.height(24.dp))
            ActionButton(
                icon = Icons.AutoMirrored.Filled.Comment,
                count = commentCount.toString(),
                tint = Color.White,
                onClick = { /* Comments for ads can be implemented here if needed */ }
            )
        }

        // Call to Action Button (కింద భాగంలో - Google Style prominent button)
        if (ad.phoneNumber.isNotEmpty() || ad.actionUrl.isNotEmpty()) {
            ElevatedButton(
                onClick = { handleAdClick() },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 32.dp)
                    .height(54.dp)
                    .fillMaxWidth(0.85f),
                shape = RoundedCornerShape(12.dp), // Google style slightly rounded corners
                elevation = ButtonDefaults.elevatedButtonElevation(defaultElevation = 6.dp),
                colors = ButtonDefaults.elevatedButtonColors(
                    containerColor = Color(0xFF1A73E8), // Google Blue
                    contentColor = Color.White
                )
            ) {
                Icon(
                    imageVector = if (ad.phoneNumber.isNotEmpty()) Icons.Default.Call else Icons.Default.Launch,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = ad.actionText, 
                    fontSize = 18.sp, 
                    fontWeight = FontWeight.Bold,
                    fontFamily = Ramabhadra
                )
            }
        }
    }
}

private fun performAdShare(
    scope: CoroutineScope,
    isSharing: Boolean,
    setSharing: (Boolean) -> Unit,
    onShareSuccess: () -> Unit,
    ad: LocalAd,
    context: Context,
    cardBounds: Rect?,
    view: View
) {
    if (isSharing) return
    scope.launch {
        setSharing(true)
        try {
            delay(100)
            val shareText = "చూడండి! ఒక ఆసక్తికరమైన ప్రకటన\nhttps://alfanews.app/ad/${ad.id}"
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
                    val chooser = Intent.createChooser(intent, "ప్రకటనను షేర్ చేయండి")
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    context.startActivity(chooser)
                    onShareSuccess()
                } else Toast.makeText(context, "షేర్ చేయడం విఫలమైంది", Toast.LENGTH_SHORT).show()
            } else Toast.makeText(context, "స్క్రీన్ షాట్ తీయడం విఫలమైంది", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(context, "Share error", Toast.LENGTH_SHORT).show()
        } finally {
            setSharing(false)
        }
    }
}

@SuppressLint("NewApi")
private suspend fun takeScreenshot(view: View, bounds: Rect?): Bitmap? = suspendCoroutine { continuation ->
    val activity = findActivity(view.context)
    val window = activity?.window
    if (window == null || bounds == null || bounds.isEmpty || bounds.width() <= 0 || bounds.height() <= 0) {
        continuation.resume(null)
        return@suspendCoroutine
    }
    try {
        val decorView = window.decorView
        val windowWidth = decorView.width
        val windowHeight = decorView.height
        val safeBounds = Rect(
            bounds.left.coerceIn(0, windowWidth),
            0, // Start from y=0 to include the logo header at the top of the window
            bounds.right.coerceIn(0, windowWidth),
            bounds.bottom.coerceIn(0, windowHeight)
        )
        if (safeBounds.width() <= 0 || safeBounds.height() <= 0) {
            continuation.resume(null)
            return@suspendCoroutine
        }
        val bitmap = Bitmap.createBitmap(safeBounds.width(), safeBounds.height(), Bitmap.Config.ARGB_8888)
        PixelCopy.request(window, safeBounds, bitmap, { copyResult ->
            if (copyResult == PixelCopy.SUCCESS) continuation.resume(bitmap)
            else { bitmap.recycle(); continuation.resume(null) }
        }, Handler(Looper.getMainLooper()))
    } catch (e: Exception) { continuation.resume(null) }
}

private fun findActivity(context: Context): Activity? {
    var currentContext = context
    while (currentContext is ContextWrapper) {
        if (currentContext is Activity) return currentContext
        currentContext = currentContext.baseContext
    }
    return null
}

private fun saveImageToCache(context: Context, bitmap: Bitmap): Uri? {
    val imagesFolder = File(context.cacheDir, "images")
    try {
        imagesFolder.mkdirs()
        val file = File(imagesFolder, "ad_share_${System.currentTimeMillis()}.png")
        val stream = FileOutputStream(file)
        bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
        stream.flush()
        stream.close()
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    } catch (e: Exception) { e.printStackTrace() }
    return null
}
