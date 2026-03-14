package com.alfanews.telugu.models

data class RssFeed(
    val id: String,
    val url: String,
    val category: String,
    val state: String? = null,
    val district: String? = null,
    val lastStatus: String?,
    val lastFetchTime: Long?,
    val lastError: String?,
    val lastProcessedCount: Int?,
    val lastFailedCount: Int?,
    val isPaused: Boolean
)
