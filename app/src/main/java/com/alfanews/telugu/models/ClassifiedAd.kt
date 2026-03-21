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
