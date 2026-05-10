package com.alfanews.telugu.services

import com.google.gson.annotations.SerializedName
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query

// --- Geocoding Models ---
data class GeocodingResponse(
    @SerializedName("results") val results: List<GeocodingResult>?
)

data class GeocodingResult(
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("name") val name: String
)

// --- Weather Models ---
data class WeatherResponse(
    @SerializedName("current_weather") val currentWeather: CurrentWeather
)

data class CurrentWeather(
    @SerializedName("temperature") val temperature: Double,
    @SerializedName("weathercode") val weatherCode: Int,
    @SerializedName("windspeed") val windSpeed: Double,
    @SerializedName("is_day") val isDay: Int
)

interface WeatherApiService {
    @GET("https://geocoding-api.open-meteo.com/v1/search")
    suspend fun getCoordinates(
        @Query("name") name: String,
        @Query("count") count: Int = 1,
        @Query("language") language: String = "en",
        @Query("format") format: String = "json"
    ): GeocodingResponse

    @GET("https://api.open-meteo.com/v1/forecast")
    suspend fun getWeather(
        @Query("latitude") lat: Double,
        @Query("longitude") lon: Double,
        @Query("current_weather") currentWeather: Boolean = true
    ): WeatherResponse
}

object WeatherService {
    private val retrofit = Retrofit.Builder()
        .baseUrl("https://api.open-meteo.com/") // Base URL is required but we use full URLs in interface
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val api = retrofit.create(WeatherApiService::class.java)

    /**
     * జిల్లా పేరు ఆధారంగా నిజమైన వాతావరణ సమాచారాన్ని తెస్తుంది.
     * రిటర్న్: Pair(Temperature, WeatherCode) -> ఇప్పుడు Triple(Temperature, WeatherCode, WindSpeed)
     */
    suspend fun fetchWeather(district: String): Triple<Double, Int, Double>? {
        return try {
            // 1. Get coordinates
            val geoResponse = api.getCoordinates(district)
            val location = geoResponse.results?.firstOrNull() ?: return null
            
            // 2. Get weather for those coordinates
            val weatherResponse = api.getWeather(location.latitude, location.longitude)
            Triple(
                weatherResponse.currentWeather.temperature, 
                weatherResponse.currentWeather.weatherCode,
                weatherResponse.currentWeather.windSpeed
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Weather Code ను తెలుగు వివరణగా మారుస్తుంది.
     * WMO Weather interpretation codes (WW)
     */
    fun getWeatherDescription(code: Int): String {
        return when (code) {
            0 -> "ఆకాశం నిర్మలంగా ఉంది (Clear Sky)"
            1, 2, 3 -> "పాక్షికంగా మేఘావృతం (Partly Cloudy)"
            45, 48 -> "మంచు కురిసే అవకాశం (Foggy)"
            51, 53, 55 -> "చినుకులు పడే అవకాశం (Drizzle)"
            61, 63, 65 -> "వర్షం పడే అవకాశం (Rainy)"
            71, 73, 75 -> "మంచు కురిసే అవకాశం (Snow Fall)"
            77 -> "మంచు బిందువులు (Snow Grains)"
            80, 81, 82 -> "వర్షపు జల్లులు (Rain Showers)"
            85, 86 -> "మంచు జల్లులు (Snow Showers)"
            95 -> "పిడుగులతో కూడిన వర్షం (Thunderstorm)"
            96, 99 -> "వడగళ్ల వాన (Thunderstorm with Hail)"
            else -> "సాధారణ వాతావరణం"
        }
    }
    
    fun getWeatherTypeLabel(code: Int): String {
        return when (code) {
            0 -> "Sunny"
            1, 2, 3 -> "Partly Cloudy"
            45, 48 -> "Foggy"
            61, 63, 65, 80, 81, 82 -> "Rainy"
            95, 96, 99 -> "Thunderstorm"
            else -> "Cloudy"
        }
    }
}
