package com.alfanews.telugu.models

data class SocialFeed(
    val id: String,
    val url: String,
    val sourceName: String,
    val platform: SocialPlatform,
    val category: String
)
