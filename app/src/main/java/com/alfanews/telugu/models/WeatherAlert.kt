package com.alfanews.telugu.models

data class WeatherAlert(
    val title: String = "",
    val body: String = "",
    val district: String = "",
    val timestamp: Long = 0L,
    val severity: String = "INFO" // INFO, WARNING, SEVERE
)
