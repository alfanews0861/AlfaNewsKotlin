package com.alfanews.telugu.models

data class ReporterConversation(
    val reporterId: String = "",
    val reporterName: String = "",
    val reporterPhone: String = "",
    val reporterDistrict: String = "",
    val reporterMandal: String = "",
    val reporterPhotoUrl: String = "",
    val lastMessage: String = "",
    val lastMessageTime: Long = 0L,
    val lastSenderRole: String = "",
    val lastSenderId: String = "",
    val unreadCountForAdmin: Int = 0,
    val unreadCountForReporter: Int = 0,
    val updatedAt: Long = 0L
)

data class ReporterMessage(
    val id: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val senderRole: String = "ADMIN", // "ADMIN" | "REPORTER"
    val text: String = "",
    val type: String = "CHAT",        // "CHAT" | "WARNING" | "BROADCAST" | "NOTICE"
    val read: Boolean = false,
    val timestamp: Long = 0L
)

data class AdminNotice(
    val id: String = "",
    val title: String = "",
    val text: String = "",
    val senderName: String = "ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్",
    val senderRole: String = "ADMIN",
    val type: String = "NOTICE", // "WARNING" | "BROADCAST" | "DAILY_BEAT" | "REMINDER" | "NOTICE" | "CHAT"
    val timestamp: Long = System.currentTimeMillis(),
    val source: String = "REPORTER_CONV" // "REPORTER_CONV" | "USER_MSG"
)

