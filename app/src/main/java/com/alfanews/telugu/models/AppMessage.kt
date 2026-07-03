package com.alfanews.telugu.models

/**
 * రిపోర్టర్లకు మరియు ఇతర వినియోగదారులకు పంపే శాశ్వత అంతర్గత సందేశాలు.
 */
data class AppMessage(
    val id: String = "",
    val title: String = "",
    val body: String = "",
    val senderName: String = "AlfaNews Admin",
    val read: Boolean = false,
    val timestamp: Long = System.currentTimeMillis(),
    val importance: String = "NORMAL" // NORMAL, HIGH, CRITICAL
)
