package com.alfanews.telugu.views

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
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
                val adView = NativeAdView(context)
                // Inflate the layout for the native ad
                // and bind the native ad to the view
                adView
            },
            update = { adView ->
                // Bind the native ad to the view
            }
        )
    }
}
