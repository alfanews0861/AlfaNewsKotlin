package com.alfanews.telugu.utils

import android.content.Context
import android.util.Base64
import coil3.ImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import java.io.File
import java.util.concurrent.TimeUnit
import okio.Path.Companion.toPath

/**
 * బాహ్య వెబ్‌సైట్ల నుండి చిత్రాలను సురక్షితంగా లోడ్ చేయడానికి మరియు కాష్ (Cache) చేయడానికి 
 * ఉపయోగించే యుటిలిటీ.
 */
object SafeImageLoader {

    private var imageLoader: ImageLoader? = null

    /**
     * కాన్ఫిగర్ చేయబడిన [ImageLoader] ఇన్‌స్టన్స్‌ను అందిస్తుంది.
     * ఇది మెమరీ మరియు డిస్క్ కాష్‌ను ఉపయోగిస్తుంది.
     */
    fun getImageLoader(context: Context): ImageLoader {
        if (imageLoader == null) {
            imageLoader = ImageLoader.Builder(context)
                .components {
                    add(OkHttpNetworkFetcherFactory(callFactory = { createSafeOkHttpClient() }))
                }
                // మెమరీ కాష్‌ను 20% కి పరిమితం చేస్తున్నాము.
                .memoryCache {
                    MemoryCache.Builder()
                        .maxSizePercent(context, 0.20)
                        .build()
                }
                // డిస్క్ కాష్‌ను 50MB కి పరిమితం చేస్తున్నాము. 
                // దీనివల్ల ఫోన్ స్టోరేజ్ 10GB వరకు వెళ్ళే అవకాశం ఉండదు.
                .diskCache {
                    DiskCache.Builder()
                        .directory(context.cacheDir.resolve("image_cache").absolutePath.toPath())
                        .maxSizeBytes(50 * 1024 * 1024) // 50MB Limit
                        .build()
                }
                .crossfade(true)
                .build()
        }
        return imageLoader!!
    }

    /**
     * చిత్రాల అభ్యర్థనల కోసం హెడర్‌లను (Headers) జోడించే OkHttpClientని సృష్టిస్తుంది.
     */
    private fun createSafeOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(SafeHeaderInterceptor())
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    /**
     * ఇమేజ్ అభ్యర్థనలకు Referer మరియు User-Agent హెడర్‌లను జోడించే ఇంటర్‌సెప్టర్.
     * కొన్ని వెబ్‌సైట్లు నేరుగా చిత్రాలను లోడ్ చేయడానికి అనుమతించవు, వాటి కోసం ఇది అవసరం.
     */
    private class SafeHeaderInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val originalRequest = chain.request()
            val url = originalRequest.url.toString()

            // బాహ్య చిత్రాలకు మాత్రమే హెడర్‌లను సవరించడం
            if (!isExternalImageSource(url)) {
                return chain.proceed(originalRequest)
            }

            // URL ఆధారంగా తగిన Refererని నిర్ణయించడం
            val referer = when {
                url.contains("eenadu", ignoreCase = true) -> "https://www.eenadu.net/"
                url.contains("sakshi", ignoreCase = true) -> "https://www.sakshi.com/"
                url.contains("suryaa", ignoreCase = true) -> "https://www.suryaa.com/"
                url.contains("andhrajyothy", ignoreCase = true) -> "https://www.andhrajyothy.com/"
                url.contains("andhrabhoomi", ignoreCase = true) -> "https://www.andhrabhoomi.net/"
                url.contains("vaartha", ignoreCase = true) -> "https://www.vaartha.com/"
                url.contains("greatandhra", ignoreCase = true) -> "https://www.greatandhra.com/"
                url.contains("123telugu", ignoreCase = true) -> "https://www.123telugu.com/"
                else -> "https://www.google.com/"
            }

            val newRequest = originalRequest.newBuilder()
                .header("Referer", referer)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build()

            return chain.proceed(newRequest)
        }
    }

    /** URLను Base64 ఫార్మాట్‌లోకి మారుస్తుంది. */
    fun encodeImageUrl(url: String): String {
        return try {
            Base64.encodeToString(url.toByteArray(Charsets.UTF_8), Base64.NO_WRAP or Base64.URL_SAFE)
        } catch (e: Exception) {
            url
        }
    }

    /** Base64లో ఉన్న URLను తిరిగి అసలు రూపంలోకి మారుస్తుంది. */
    fun decodeImageUrl(encodedUrl: String): String {
        return try {
            String(Base64.decode(encodedUrl, Base64.NO_WRAP or Base64.URL_SAFE), Charsets.UTF_8)
        } catch (e: Exception) {
            encodedUrl
        }
    }

    /** చిత్రం బాహ్య మూలం (External Source) నుండి వచ్చిందో లేదో తనిఖీ చేస్తుంది. */
    fun isExternalImageSource(url: String?): Boolean {
        if (url.isNullOrEmpty()) return false
        return !url.contains("firebasestorage.googleapis.com", ignoreCase = true)
    }

    /** URL ఆధారంగా వార్తా సంస్థ పేరును గుర్తిస్తుంది. */
    fun getSourceName(url: String?): String? {
        if (url.isNullOrEmpty()) return null

        return when {
            url.contains("eenadu", ignoreCase = true) -> "Eenadu"
            url.contains("sakshi", ignoreCase = true) -> "Sakshi"
            url.contains("suryaa", ignoreCase = true) -> "Surya"
            url.contains("andhrajyothy", ignoreCase = true) -> "Andhra Jyothy"
            url.contains("andhrabhoomi", ignoreCase = true) -> "Andhra Bhoomi"
            url.contains("vaartha", ignoreCase = true) -> "Vaartha"
            url.contains("greatandhra", ignoreCase = true) -> "Great Andhra"
            url.contains("123telugu", ignoreCase = true) -> "123Telugu"
            else -> null
        }
    }
}
