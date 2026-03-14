package com.alfanews.telugu.views

import android.view.LayoutInflater
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.alfanews.telugu.R
import com.google.android.gms.ads.nativead.MediaView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView

@Composable
fun AdMobCardView(modifier: Modifier = Modifier, nativeAd: NativeAd?) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        if (nativeAd != null) {
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
            // If ad is null (failed or loading), show a placeholder or empty box.
            // Crucially, avoided text that confuses the user. A subtle progress indicator is better if transient.
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
