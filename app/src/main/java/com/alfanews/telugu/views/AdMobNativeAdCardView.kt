package com.alfanews.telugu.views

import android.view.LayoutInflater
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.alfanews.telugu.R
import com.google.android.gms.ads.nativead.MediaView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView

@Composable
fun AdMobNativeAdCardView(nativeAd: NativeAd) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
    ) {
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
    }
}
