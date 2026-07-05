package com.alfanews.telugu.services

import android.app.Activity
import android.util.Log
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.nativead.NativeAd
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.jvm.Synchronized

/**
 * యాడ్ మాబ్ (AdMob) ప్రకటనలను నిర్వహించే సర్వీస్.
 * 
 * ఈ సర్వీస్ ద్వారా నేటివ్ యాడ్స్ (Native Ads) మరియు బ్యానర్ యాడ్స్ (Banner Ads) 
 * లోడ్ చేయడం మరియు ముందుగానే లోడ్ చేసి ఉంచడం (Preloading) జరుగుతుంది.
 */
object AdMobService {
    private const val TAG = "AdMobService"
    private const val NATIVE_AD_UNIT_ID = "ca-app-pub-5787901991150360/1972465675"
    private const val MAX_NATIVE_ADS = 5
    private val nativeAds = ConcurrentLinkedQueue<NativeAd>()
    private val isPreloading = AtomicBoolean(false)

    /**
     * యాడ్ మాబ్ SDK ని ప్రారంభిస్తుంది.
     */
    fun initialize(activity: Activity, onInitializationComplete: () -> Unit = {}) {
        MobileAds.initialize(activity) { initializationStatus ->
            Log.d(TAG, "AdMob initialized: ${initializationStatus.adapterStatusMap}")
            preloadNativeAds(activity)
            onInitializationComplete()
        }
    }

    /**
     * నేటివ్ యాడ్స్ ను ముందుగానే లోడ్ చేసి మెమరీలో ఉంచుతుంది.
     */
    @Synchronized
    private fun preloadNativeAds(activity: Activity) {
        if (nativeAds.size >= MAX_NATIVE_ADS) {
            Log.d(TAG, "Native ad cache full (${nativeAds.size}). Skipping preload.")
            return
        }

        if (!isPreloading.compareAndSet(false, true)) {
            Log.d(TAG, "Preload already in progress. Skipping.")
            return
        }

        val numberOfAdsToLoad = MAX_NATIVE_ADS - nativeAds.size
        Log.d(TAG, "Starting preload for $numberOfAdsToLoad native ads. Current cache size: ${nativeAds.size}")

        val adLoader = AdLoader.Builder(activity, NATIVE_AD_UNIT_ID)
            .forNativeAd { ad: NativeAd ->
                nativeAds.add(ad)
                Log.d(TAG, "Native ad preloaded successfully. New cache size: ${nativeAds.size}")
                
                // If we reached the target, we can allow more preloads later
                if (nativeAds.size >= MAX_NATIVE_ADS) {
                    isPreloading.set(false)
                }
            }
            .withAdListener(object : AdListener() {
                override fun onAdFailedToLoad(error: LoadAdError) {
                    Log.e(TAG, "Native ad failed to preload: ${error.message} (Code: ${error.code})")
                    isPreloading.set(false)
                }

                override fun onAdLoaded() {
                    super.onAdLoaded()
                    Log.d(TAG, "Native ad batch load operation completed. Cache size: ${nativeAds.size}")
                    // Reset flag anyway when batch completes to avoid getting stuck
                    isPreloading.set(false)
                }
            })
            .build()

        adLoader.loadAds(AdRequest.Builder().build(), numberOfAdsToLoad)
    }

    /**
     * లోడ్ అయిన నేటివ్ యాడ్ ను అందిస్తుంది. ఒకవేళ ఏదీ అందుబాటులో లేకపోతే కొత్తది లోడ్ చేస్తుంది.
     */
    fun loadNativeAd(activity: Activity, onAdLoaded: (NativeAd?) -> Unit) {
        val ad = nativeAds.poll()
        if (ad != null) {
            Log.d(TAG, "Serving native ad from cache. Remaining: ${nativeAds.size}")
            onAdLoaded(ad)
            
            // కాష్ లో యాడ్స్ తగ్గిపోతే మళ్ళీ లోడ్ చేయడం
            if (nativeAds.size < MAX_NATIVE_ADS / 2) {
                preloadNativeAds(activity)
            }
            return
        }

        // కాష్ ఖాళీగా ఉంటే వెంటనే కొత్త యాడ్ లోడ్ చేయడం
        Log.d(TAG, "Ad cache empty. Loading a new native ad on demand.")
        val adLoader = AdLoader.Builder(activity, NATIVE_AD_UNIT_ID)
            .forNativeAd { loadedAd -> 
                Log.d(TAG, "On-demand native ad loaded.")
                onAdLoaded(loadedAd) 
            }
            .withAdListener(object : AdListener() {
                override fun onAdFailedToLoad(error: LoadAdError) {
                    Log.e(TAG, "On-demand native ad failed to load: ${error.message}")
                    onAdLoaded(null)
                }
            })
            .build()
        adLoader.loadAd(AdRequest.Builder().build())

        preloadNativeAds(activity)
    }

    /**
     * బ్యానర్ యాడ్ ను లోడ్ చేస్తుంది.
     */
    fun loadBannerAd(adView: AdView) {
        val adRequest = AdRequest.Builder().build()
        adView.loadAd(adRequest)
        adView.adListener = object : AdListener() {
            override fun onAdLoaded() {
                Log.d(TAG, "Banner ad loaded")
            }

            override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                Log.e(TAG, "Banner ad failed to load: ${loadAdError.message}")
            }
        }
    }

    /** నేటివ్ యాడ్ యూనిట్ ID ని తిరిగి ఇస్తుంది. */
    fun getNativeAdUnitId(): String = NATIVE_AD_UNIT_ID
}
