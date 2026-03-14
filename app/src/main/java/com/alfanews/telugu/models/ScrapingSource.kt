package com.alfanews.telugu.models

data class ScrapingSource(
    val id: String = "",
    val url: String = "",
    val siteName: String = "",
    val category: String = "",
    val state: String? = null,
    val district: String? = null,
    val lastStatus: String? = null, // "active" or "error"
    val lastFetchTime: Long? = null,
    val lastError: String? = null,
    val lastProcessedCount: Int? = null,
    val lastFailedCount: Int? = null,
    val isPaused: Boolean = false,
    val group: Int? = null,
    val processed24h: Int = 0,
    val failed24h: Int = 0,
    val lastResetTime: Long? = null
)
