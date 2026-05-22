package com.alfanews.telugu.views

import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Launch
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.AdMediaType
import com.alfanews.telugu.models.LocalAd
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.FieldValue

@Composable
fun LocalAdCardView(
    ad: LocalAd,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val isPreview = ad.id.isEmpty() || ad.id.startsWith("preview_")

    // వ్యూ కౌంట్ పెంచడం (Preview లో కాకుండా)
    LaunchedEffect(ad.id) {
        if (!isPreview) {
            FirebaseService.db.collection("local_ads").document(ad.id)
                .update("viewsCurrent", FieldValue.increment(1))
        }
    }

    fun handleAdClick() {
        // క్లిక్ కౌంట్ పెంచడం
        FirebaseService.db.collection("local_ads").document(ad.id)
            .update("clicksCurrent", FieldValue.increment(1))

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
            .clickable { handleAdClick() }
    ) {
        // ... (మునుపటి మీడియా ప్లేయర్ కోడ్)
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
                    modifier = Modifier.fillMaxSize()
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

        // Call to Action Button (కింద భాగంలో)
        if (ad.phoneNumber.isNotEmpty() || ad.actionUrl.isNotEmpty()) {
            Button(
                onClick = { handleAdClick() },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 32.dp)
                    .height(56.dp)
                    .fillMaxWidth(0.8f),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Icon(
                    imageVector = if (ad.phoneNumber.isNotEmpty()) Icons.Default.Call else Icons.Default.Launch,
                    contentDescription = null
                )
                Spacer(Modifier.width(8.dp))
                Text(ad.actionText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
