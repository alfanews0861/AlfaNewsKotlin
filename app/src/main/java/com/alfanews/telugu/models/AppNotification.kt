package com.alfanews.telugu.models

enum class NotificationType {
    NEWS,
    ENGAGEMENT,
    PROMOTION,
    SYSTEM
}

data class AppNotification(
    val id: String = "",
    val title: String = "",
    val body: String = "",
    val type: NotificationType = NotificationType.SYSTEM,
    val read: Boolean = false,
    val actionUrl: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)
