package com.alfanews.telugu.views

import android.view.LayoutInflater
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.ui.PlayerView
import com.alfanews.telugu.R
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.crossfade

@Composable
fun VideoPlayerView(
    videoUrl: String,
    modifier: Modifier = Modifier,
    autoPlay: Boolean = false,
    muted: Boolean = false
) {
    var isInitialized by remember { mutableStateOf(false) }

    LaunchedEffect(autoPlay) {
        if (autoPlay) {
            isInitialized = true
        }
    }

    if (isInitialized) {
        ActiveVideoPlayer(
            videoUrl = videoUrl,
            modifier = modifier,
            autoPlay = autoPlay,
            muted = muted
        )
    } else {
        VideoPlaceholder(
            videoUrl = videoUrl,
            modifier = modifier,
            onPlayClick = { isInitialized = true }
        )
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun ActiveVideoPlayer(
    videoUrl: String,
    modifier: Modifier,
    autoPlay: Boolean,
    muted: Boolean
) {
    val context = LocalContext.current
    var isPlaying by remember { mutableStateOf(false) }

    val exoPlayer = remember(videoUrl) {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(500, 10_000, 300, 500)
            .build()
        ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .build().apply {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                    .build()
                setAudioAttributes(audioAttributes, true)
                setMediaItem(MediaItem.fromUri(videoUrl))
                repeatMode = ExoPlayer.REPEAT_MODE_ONE
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlayingParam: Boolean) {
                        isPlaying = isPlayingParam
                    }
                })
            }
    }

    LaunchedEffect(autoPlay) {
        if (autoPlay) {
            if (exoPlayer.playbackState == Player.STATE_IDLE) {
                exoPlayer.prepare()
            }
            exoPlayer.playWhenReady = true
        } else {
            exoPlayer.playWhenReady = false
        }
    }

    LaunchedEffect(muted) {
        exoPlayer.volume = if (muted) 0f else 1f
    }

    DisposableEffect(videoUrl) {
        onDispose {
            exoPlayer.pause()
            exoPlayer.release()
        }
    }

    Box(
        modifier = modifier.clickable {
            if (exoPlayer.playbackState == Player.STATE_IDLE) exoPlayer.prepare()
            if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
        },
        contentAlignment = Alignment.Center
    ) {
        AndroidView(
            factory = { ctx ->
                val view = LayoutInflater.from(ctx).inflate(R.layout.exo_player_texture_view, null) as PlayerView
                view.apply {
                    player = exoPlayer
                    useController = false
                    setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        if (!isPlaying) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .background(Color.Black.copy(alpha = 0.4f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(40.dp)
                )
            }
        }
    }
}

@Composable
private fun VideoPlaceholder(
    videoUrl: String,
    modifier: Modifier,
    onPlayClick: () -> Unit
) {
    val context = LocalContext.current
    Box(
        modifier = modifier
            .background(Color.Black)
            .clickable { onPlayClick() },
        contentAlignment = Alignment.Center
    ) {
        val request = remember(videoUrl) {
            ImageRequest.Builder(context)
                .data(videoUrl)
                .crossfade(true)
                .allowHardware(true)
                .build()
        }
        AsyncImage(
            model = request,
            contentDescription = "Video Thumbnail",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            fallback = painterResource(id = R.drawable.fallback_news_image),
            error = painterResource(id = R.drawable.fallback_news_image)
        )

        Box(
            modifier = Modifier
                .size(64.dp)
                .background(Color.Black.copy(alpha = 0.4f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.PlayArrow,
                contentDescription = "Play",
                tint = Color.White,
                modifier = Modifier.size(40.dp)
            )
        }
    }
}
