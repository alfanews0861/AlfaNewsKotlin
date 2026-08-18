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

/**
 * యాడ్స్ లోడింగ్ స్థితులను సూచించే ఇంటర్‌ఫేస్.
 */
sealed interface AdState {
    object Loading : AdState
    data class Success(val nativeAd: NativeAd) : AdState
    object Failed : AdState
}

/**
 * యాడ్ మాబ్ (AdMob) ప్రకటనలను నిర్వహించే సర్వీస్.
 * 
 * ఈ సర్వీస్ ద్వారా నేటివ్ యాడ్స్ (Native Ads) మరియు బ్యానర్ యాడ్స్ (Banner Ads) 
 * లోడ్ చేయడం మరియు ముందుగానే లోడ్ చేసి ఉంచడం (Preloading) జరుగుతుంది.
 */
object AdMobService {
    private const val TAG = "AdMobService"
    
    // Production Native & Banner Ad Unit IDs
    private const val NATIVE_AD_UNIT_ID = "ca-app-pub-5787901991150360/1972465675"
    private const val BANNER_AD_UNIT_ID = "ca-app-pub-5787901991150360/1972465675"
    
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
     * Original standard loadAds parallel batch request.
     */
    @Synchronized
    private fun preloadNativeAds(activity: Activity) {
        if (activity.isFinishing || activity.isDestroyed) return
        if (nativeAds.size >= MAX_NATIVE_ADS) {
            Log.d(TAG, "Native ad cache full (${nativeAds.size}). Skipping preload.")
            return
        }

        if (!isPreloading.compareAndSet(false, true)) {
            Log.d(TAG, "Preload already in progress. Skipping.")
            return
        }

        val numberOfAdsToLoad = MAX_NATIVE_ADS - nativeAds.size
        Log.d(TAG, "Starting parallel batch preload for $numberOfAdsToLoad native ads. Current cache size: ${nativeAds.size}")

        val adLoader = AdLoader.Builder(activity, NATIVE_AD_UNIT_ID)
            .forNativeAd { ad: NativeAd ->
                nativeAds.add(ad)
                Log.d(TAG, "Native ad preloaded successfully. New cache size: ${nativeAds.size}")
            }
            .withAdListener(object : AdListener() {
                override fun onAdFailedToLoad(error: LoadAdError) {
                    Log.e(TAG, "Native ad failed to preload: ${error.message} (Code: ${error.code})")
                    isPreloading.set(false)
                }

                override fun onAdLoaded() {
                    super.onAdLoaded()
                    Log.d(TAG, "Native ad batch load completed. Cache size: ${nativeAds.size}")
                    isPreloading.set(false)
                }
            })
            .build()

        adLoader.loadAds(AdRequest.Builder().build(), numberOfAdsToLoad)
    }

    /**
     * లోడ్ అయిన నేటివ్ యాడ్ ను అందిస్తుంది. ఒకవేళ ఏదీ అందుబాటులో లేకపోతే కొత్తది లోడ్ చేస్తుంది (మరియు ఫెయిల్ అయితే ఆటో-రీట్రై చేస్తుంది).
     */
    fun loadNativeAd(activity: Activity, retriesLeft: Int = 2, onAdLoaded: (NativeAd?) -> Unit) {
        if (activity.isFinishing || activity.isDestroyed) {
            onAdLoaded(null)
            return
        }
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
        Log.d(TAG, "Ad cache empty. Loading a new native ad on demand. Retries left: $retriesLeft")
        val adLoader = AdLoader.Builder(activity, NATIVE_AD_UNIT_ID)
            .forNativeAd { loadedAd -> 
                Log.d(TAG, "On-demand native ad loaded successfully.")
                onAdLoaded(loadedAd) 
                preloadNativeAds(activity)
            }
            .withAdListener(object : AdListener() {
                override fun onAdFailedToLoad(error: LoadAdError) {
                    Log.e(TAG, "On-demand native ad failed to load: ${error.message} (Code: ${error.code})")
                    if (retriesLeft > 0 && !activity.isFinishing && !activity.isDestroyed) {
                        Log.d(TAG, "Retrying on-demand native ad load in 1.5 seconds...")
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            if (!activity.isFinishing && !activity.isDestroyed) {
                                loadNativeAd(activity, retriesLeft - 1, onAdLoaded)
                            }
                        }, 1500)
                    } else {
                        onAdLoaded(null)
                    }
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

    /** banner యాడ్ యూనిట్ ID ని తిరిగి ఇస్తుంది. */
    fun getBannerAdUnitId(): String = BANNER_AD_UNIT_ID
}
