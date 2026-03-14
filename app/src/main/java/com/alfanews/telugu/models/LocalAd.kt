package com.alfanews.telugu.models

import com.google.firebase.firestore.DocumentSnapshot

enum class AdStatus {
    PENDING_PAYMENT,
    PENDING_APPROVAL,
    ACTIVE,
    PAUSED,
    COMPLETED,
    REJECTED
}

data class LocalAd(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val bannerUrl: String = "",
    val targetState: String = "ALL",
    val targetDistrict: String = "ALL",
    val viewsOrdered: Int = 0,
    val viewsCurrent: Int = 0,
    val costPerView: Double = 0.20,
    val totalAmount: Double = 0.0,
    val status: AdStatus = AdStatus.PENDING_PAYMENT,
    val createdAt: Long = System.currentTimeMillis(),
    val approvedAt: Long? = null
) {
    companion object {
        fun fromSnapshot(doc: DocumentSnapshot): LocalAd? {
            val data = doc.data ?: return null
            return LocalAd(
                id = doc.id,
                userId = data["userId"] as? String ?: "",
                userName = data["userName"] as? String ?: "",
                bannerUrl = data["bannerUrl"] as? String ?: "",
                targetState = data["targetState"] as? String ?: "ALL",
                targetDistrict = data["targetDistrict"] as? String ?: "ALL",
                viewsOrdered = (data["viewsOrdered"] as? Number)?.toInt() ?: 0,
                viewsCurrent = (data["viewsCurrent"] as? Number)?.toInt() ?: 0,
                costPerView = (data["costPerView"] as? Number)?.toDouble() ?: 0.20,
                totalAmount = (data["totalAmount"] as? Number)?.toDouble() ?: 0.0,
                status = try {
                    AdStatus.valueOf(data["status"] as? String ?: "PENDING_PAYMENT")
                } catch (e: Exception) {
                    AdStatus.PENDING_PAYMENT
                },
                createdAt = (data["createdAt"] as? Number)?.toLong() ?: System.currentTimeMillis(),
                approvedAt = (data["approvedAt"] as? Number)?.toLong()
            )
        }
    }
}
