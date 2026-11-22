package com.alfanews.telugu.services

import android.util.Log
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.mapMapToNewsPost
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

data class CachedHomeFeedResult(
    val main: List<NewsPost>,
    val statePosts: List<NewsPost>,
    val local: List<NewsPost>,
    val greeting: NewsPost?,
    val mainLastTs: Long?,
    val stateLastTs: Long?,
    val localLastTs: Long?
)

data class CachedLocalFeedResult(
    val posts: List<NewsPost>,
    val lastTs: Long?
)

/**
 * Server-Side CDN Edge Cache client (/api/feed).
 *
 * - Zero disk cache on user device (no OkHttp Cache directory attached).
 * - Automatic Gzip compression via OkHttp (~20-35 KB per full cold start vs 4.5 MB Firestore SDK).
 * - Strict short timeouts (2.5s connect / 3.0s read) with silent null return so callers seamlessly
 *   fall back to direct Firestore queries if the CDN endpoint is unreachable.
 */
object FeedEdgeCacheService {
    private const val TAG = "FeedEdgeCacheService"
    private const val FEED_ENDPOINT = "https://alfanews.app/api/feed"

    private val gson = Gson()
    private val mapType = object : TypeToken<Map<String, Any?>>() {}.type

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(2500L, TimeUnit.MILLISECONDS)
            .readTimeout(3000L, TimeUnit.MILLISECONDS)
            .writeTimeout(2000L, TimeUnit.MILLISECONDS)
            .cache(null) // Strictly NO local disk cache on phone
            .build()
    }

    suspend fun fetchHomeFeed(
        collection: String,
        stateCode: String?,
        district: String?,
        language: Language,
        limit: Int = 25
    ): CachedHomeFeedResult? = withContext(Dispatchers.IO) {
        try {
            val urlBuilder = FEED_ENDPOINT.toHttpUrl().newBuilder()
                .addQueryParameter("type", "home")
                .addQueryParameter("col", collection.ifBlank { "news" })
                .addQueryParameter("limit", limit.coerceIn(5, 35).toString())

            if (!stateCode.isNullOrBlank()) {
                urlBuilder.addQueryParameter("state", stateCode.trim())
            }
            if (!district.isNullOrBlank()) {
                urlBuilder.addQueryParameter("district", district.trim())
            }

            val root = executeGetJson(urlBuilder.build().toString()) ?: return@withContext null
            if (root["ok"] != true) return@withContext null

            val main = parsePostList(root["main"], language)
            val statePosts = parsePostList(root["statePosts"], language)
            val local = parsePostList(root["local"], language)
            val greeting = parseSinglePost(root["greeting"], language)

            if (main.isEmpty() && statePosts.isEmpty() && local.isEmpty()) {
                return@withContext null
            }

            val cursors = root["cursors"] as? Map<*, *>
            val mainLastTs = (cursors?.get("mainLastTs") as? Number)?.toLong()
                ?: main.lastOrNull()?.timestamp
            val stateLastTs = (cursors?.get("stateLastTs") as? Number)?.toLong()
                ?: statePosts.lastOrNull()?.timestamp
            val localLastTs = (cursors?.get("localLastTs") as? Number)?.toLong()
                ?: local.lastOrNull()?.timestamp

            CachedHomeFeedResult(
                main = main,
                statePosts = statePosts,
                local = local,
                greeting = greeting,
                mainLastTs = mainLastTs,
                stateLastTs = stateLastTs,
                localLastTs = localLastTs
            )
        } catch (e: Exception) {
            Log.w(TAG, "fetchHomeFeed fallback to Firestore: ${e.message}")
            null
        }
    }

    suspend fun fetchLocalFeed(
        collection: String,
        stateCode: String?,
        district: String?,
        language: Language,
        limit: Int = 20
    ): CachedLocalFeedResult? = withContext(Dispatchers.IO) {
        try {
            val urlBuilder = FEED_ENDPOINT.toHttpUrl().newBuilder()
                .addQueryParameter("type", "local")
                .addQueryParameter("col", collection.ifBlank { "news" })
                .addQueryParameter("limit", limit.coerceIn(5, 35).toString())

            if (!stateCode.isNullOrBlank()) {
                urlBuilder.addQueryParameter("state", stateCode.trim())
            }
            if (!district.isNullOrBlank()) {
                urlBuilder.addQueryParameter("district", district.trim())
            }

            val root = executeGetJson(urlBuilder.build().toString()) ?: return@withContext null
            if (root["ok"] != true) return@withContext null

            val posts = parsePostList(root["posts"], language)
            if (posts.isEmpty()) return@withContext null

            val cursors = root["cursors"] as? Map<*, *>
            val lastTs = (cursors?.get("lastTs") as? Number)?.toLong()
                ?: posts.lastOrNull()?.timestamp

            CachedLocalFeedResult(
                posts = posts,
                lastTs = lastTs
            )
        } catch (e: Exception) {
            Log.w(TAG, "fetchLocalFeed fallback to Firestore: ${e.message}")
            null
        }
    }

    private fun executeGetJson(url: String): Map<String, Any?>? {
        val request = Request.Builder()
            .url(url)
            .get()
            .header("Accept", "application/json")
            .build()

        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            val contentType = response.header("Content-Type") ?: ""
            if (!contentType.contains("application/json", ignoreCase = true)) return null
            val bodyStr = response.body?.string() ?: return null
            if (bodyStr.isBlank()) return null
            @Suppress("UNCHECKED_CAST")
            return gson.fromJson<Map<String, Any?>>(bodyStr, mapType)
        }
    }

    private fun parsePostList(raw: Any?, language: Language): List<NewsPost> {
        val list = raw as? List<*> ?: return emptyList()
        return list.mapNotNull { item -> parseSinglePost(item, language) }
    }

    private fun parseSinglePost(raw: Any?, language: Language): NewsPost? {
        val rawMap = raw as? Map<*, *> ?: return null
        val id = rawMap["id"]?.toString()?.trim()
        if (id.isNullOrBlank()) return null
        val typedMap = HashMap<String, Any?>(rawMap.size)
        for ((k, v) in rawMap) {
            if (k != null) typedMap[k.toString()] = v
        }
        return try {
            mapMapToNewsPost(id, typedMap, language)
        } catch (e: Exception) {
            null
        }
    }
}
