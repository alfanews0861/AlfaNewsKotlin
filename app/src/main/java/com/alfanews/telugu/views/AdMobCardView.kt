package com.alfanews.telugu.views

import android.view.LayoutInflater
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.alfanews.telugu.R
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.nativead.MediaView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView

@Composable
fun AdMobCardView(
    modifier: Modifier = Modifier,
    nativeAd: NativeAd?,
    isLoading: Boolean = false,
    isFailed: Boolean = false,
    onFallbackClick: (() -> Unit)? = null
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        if (isFailed) {
            if (onFallbackClick != null) {
                // Classifieds fallback: Promote posting a user's own ad
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(12.dp))
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "మీ వ్యాపార ప్రకటనను ఇక్కడ ప్రచురించండి!",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        fontFamily = Ramabhadra,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "తక్కువ ఖర్చుతో వేలాది మంది కస్టమర్లను చేరుకోండి",
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = Ramabhadra,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onFallbackClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "ప్రకటన పోస్ట్ చేయండి",
                            fontWeight = FontWeight.Bold,
                            fontFamily = Ramabhadra,
                            fontSize = 14.sp
                        )
                    }
                }
            } else {
                FallbackAdCardView(modifier = Modifier.fillMaxSize())
            }
        } else if (nativeAd != null) {
            AndroidView(
                factory = { context ->
                    LayoutInflater.from(context)
                        .inflate(R.layout.native_ad_layout, null) as NativeAdView
                },
                update = { adView ->
                    adView.mediaView = adView.findViewById<MediaView>(R.id.ad_media)
                    adView.headlineView = adView.findViewById<TextView>(R.id.ad_headline)
                    adView.bodyView = adView.findViewById<TextView>(R.id.ad_body)
                    adView.callToActionView = adView.findViewById<Button>(R.id.ad_call_to_action)
                    adView.iconView = adView.findViewById<ImageView>(R.id.ad_app_icon)

                    (adView.headlineView as? TextView)?.text = nativeAd.headline
                    nativeAd.mediaContent?.let { adView.mediaView?.setMediaContent(it) }
                    (adView.bodyView as? TextView)?.text = nativeAd.body
                    (adView.callToActionView as? Button)?.text = nativeAd.callToAction
                    nativeAd.icon?.drawable?.let { (adView.iconView as? ImageView)?.setImageDrawable(it) }

                    adView.setNativeAd(nativeAd)
                },
                modifier = Modifier.fillMaxSize()
            )
        } else {
            // Show a progress indicator when loading
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp), 
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f),
                    strokeWidth = 2.dp
                )
            }
        }
    }
}

@Composable
fun FallbackAdCardView(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), shape = CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = null,
                    modifier = Modifier.size(32.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "అల్ఫా న్యూస్",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "మీ ప్రాంతీయ వార్తలు మరియు సమాచారం",
                style = MaterialTheme.typography.bodyMedium,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun AdMobBannerAd(
    modifier: Modifier = Modifier,
    adUnitId: String = AdMobService.getBannerAdUnitId()
) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            AdView(context).apply {
                setAdSize(AdSize.BANNER)
                this.adUnitId = adUnitId
                AdMobService.loadBannerAd(this)
            }
        },
        update = { }
    )
}
