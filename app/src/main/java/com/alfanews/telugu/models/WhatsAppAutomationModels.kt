package com.alfanews.telugu.models

/**
 * వాట్సాప్ గ్రూప్ వివరాలను కలిగి ఉన్న డేటా క్లాస్.
 */
data class WhatsAppGroup(
    val id: String = "",
    val name: String = ""
)

/**
 * వాట్సాప్ ఆటోమేషన్ సెట్టింగ్‌లను కలిగి ఉన్న డేటా క్లాస్.
 */
data class WhatsAppSettings(
    val status: String = "disconnected", // 'disconnected', 'connecting', 'connected'
    val phoneNumber: String = "",
    val pairingCode: String? = null,
    val selectedGroups: List<WhatsAppGroup> = emptyList(),
    val availableGroups: List<WhatsAppGroup> = emptyList() // బ్యాకెండ్ ద్వారా నింపబడుతుంది
)
