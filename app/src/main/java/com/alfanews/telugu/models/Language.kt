package com.alfanews.telugu.models

enum class Language(val code: String, val nativeLabel: String) {
    TELUGU("te", "తెలుగు"),
    HINDI("hi", "हिन्दी"),
    PUNJABI("pa", "ਪੰਜਾਬੀ"),
    GUJARATI("gu", "ગુજરાતી"),
    ENGLISH("en", "English");

    companion object {
        fun fromCode(code: String?): Language {
            val clean = code?.trim()?.lowercase() ?: return TELUGU
            return entries.firstOrNull { it.code == clean || it.name.equals(clean, ignoreCase = true) } ?: TELUGU
        }
    }
}
