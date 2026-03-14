package com.alfanews.telugu.models

data class ClassifiedAd(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val title: String = "",
    val description: String = "",
    val price: Double = 0.0,
    val category: String = "",
    val location: String = "",
    val imageUrl: String = "",
    val contactPhone: String = "",
    val whatsappNumber: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

object ClassifiedCategories {
    val categories = listOf(
        "స్థిరాస్తి (Real Estate)",
        "వాహనాలు (Vehicles)",
        "ఎలక్ట్రానిక్స్ (Electronics)",
        "ఉద్యోగాలు (Jobs)",
        "సేవలు (Services)",
        "ఫర్నిచర్ (Furniture)",
        "ఇతర (Others)"
    )
}
