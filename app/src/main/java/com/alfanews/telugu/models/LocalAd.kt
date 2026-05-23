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

enum class AdType {
    VIEWS_BASED,        // వ్యూస్ ఆధారంగా (Cost per View)
    TIME_BASED_FIXED    // సమయం ఆధారంగా (Fixed Rate - Day/Week/Unlimited)
}

enum class AdMediaType {
    IMAGE,
    VIDEO,
    HTML
}

data class LocalAd(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val bannerUrl: String = "",
    val htmlContent: String = "",
    val adMediaType: AdMediaType = AdMediaType.IMAGE,
    val targetState: String = "ALL",
    val targetDistrict: String = "ALL",
    val actionUrl: String = "", // వెబ్‌సైట్ లేదా వాట్సాప్ లింక్
    val phoneNumber: String = "", // నేరుగా ఫోన్ చేయడానికి
    val actionText: String = "మరిన్ని వివరాలు", // బటన్ పై కనిపించే టెక్స్ట్
    val adType: AdType = AdType.VIEWS_BASED,
    val viewsOrdered: Int = 0,
    val viewsCurrent: Int = 0,
    val clicksCurrent: Int = 0, // ఎన్ని క్లిక్స్ వచ్చాయి
    val costPerView: Double = 0.20,
    val startDate: Long? = null,
    val endDate: Long? = null,
    val totalAmount: Double = 0.0,
    val status: AdStatus = AdStatus.PENDING_PAYMENT,
    val likes: Int = 0,
    val comments: Int = 0,
    val shares: Int = 0,
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
                htmlContent = data["htmlContent"] as? String ?: "",
                adMediaType = try {
                    AdMediaType.valueOf(data["adMediaType"] as? String ?: "IMAGE")
                } catch (e: Exception) {
                    AdMediaType.IMAGE
                },
                targetState = data["targetState"] as? String ?: "ALL",
                targetDistrict = data["targetDistrict"] as? String ?: "ALL",
                actionUrl = data["actionUrl"] as? String ?: "",
                phoneNumber = data["phoneNumber"] as? String ?: "",
                actionText = data["actionText"] as? String ?: "మరిన్ని వివరాలు",
                adType = try {
                    AdType.valueOf(data["adType"] as? String ?: "VIEWS_BASED")
                } catch (e: Exception) {
                    AdType.VIEWS_BASED
                },
                viewsOrdered = (data["viewsOrdered"] as? Number)?.toInt() ?: 0,
                viewsCurrent = (data["viewsCurrent"] as? Number)?.toInt() ?: 0,
                clicksCurrent = (data["clicksCurrent"] as? Number)?.toInt() ?: 0,
                costPerView = (data["costPerView"] as? Number)?.toDouble() ?: 0.20,
                startDate = (data["startDate"] as? Number)?.toLong(),
                endDate = (data["endDate"] as? Number)?.toLong(),
                totalAmount = (data["totalAmount"] as? Number)?.toDouble() ?: 0.0,
                status = try {
                    AdStatus.valueOf(data["status"] as? String ?: "PENDING_PAYMENT")
                } catch (e: Exception) {
                    AdStatus.PENDING_PAYMENT
                },
                likes = (data["likes"] as? Number)?.toInt() ?: 0,
                comments = (data["comments"] as? Number)?.toInt() ?: 0,
                shares = (data["shares"] as? Number)?.toInt() ?: 0,
                createdAt = (data["createdAt"] as? Number)?.toLong() ?: System.currentTimeMillis(),
                approvedAt = (data["approvedAt"] as? Number)?.toLong()
            )
        }
    }
}
