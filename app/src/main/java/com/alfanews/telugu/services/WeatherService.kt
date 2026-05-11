package com.alfanews.telugu.services

import com.alfanews.telugu.utils.Constants
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
    @SerializedName("is_day") val isDay: Int,
    @SerializedName("time") val time: String
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

    // ✅ In-memory cache: 1 hour TTL per location to avoid repeated API calls
    private data class CachedWeather(val data: WeatherData, val fetchedAt: Long)
    private val weatherCache = mutableMapOf<String, CachedWeather>()
    private const val CACHE_TTL_MS = 60 * 60 * 1000L // 1 hour

    // తెలుగు పేర్లను ఇంగ్లీష్ లోకి మార్చే మ్యాపింగ్ - Open-Meteo API కోసం
    private val locationMapping = mapOf(
        "ఆదిలాబాద్" to "Adilabad",
        "భద్రాద్రి కొత్తగూడెం" to "Kothagudem",
        "హన్మకొండ" to "Hanamkonda",
        "హైదరాబాద్" to "Hyderabad",
        "జగిత్యాల" to "Jagtial",
        "జనగాం" to "Jangaon",
        "జయశంకర్ భూపాలపల్లి" to "Bhupalpally",
        "జోగులాంబ గద్వాల" to "Gadwal",
        "కామారెడ్డి" to "Kamareddy",
        "కరీంనగర్" to "Karimnagar",
        "ఖమ్మం" to "Khammam",
        "కుమ్రం భీమ్ ఆసిఫాబాద్" to "Asifabad",
        "మహబూబాబాద్" to "Mahabubabad",
        "మహబూబ్ నగర్" to "Mahabubnagar",
        "మంచిర్యాల" to "Mancherial",
        "మెదక్" to "Medak",
        "మేడ్చల్ మల్కాజిగిరి" to "Malkajgiri",
        "ములుగు" to "Mulugu",
        "నాగర్ కర్నూల్" to "Nagarkurnool",
        "నల్గొండ" to "Nalgonda",
        "నారాయణపేట" to "Narayanpet",
        "నిర్మల్" to "Nirmal",
        "నిజామాబాద్" to "Nizamabad",
        "పెద్దపల్లి" to "Peddapalli",
        "రాజన్న సిరిసిల్ల" to "Sircilla",
        "రంగారెడ్డి" to "Rangareddy",
        "సంగారెడ్డి" to "Sangareddy",
        "సిద్దిపేట" to "Siddipet",
        "సూర్యాపేట" to "Suryapet",
        "వికారాబాద్" to "Vikarabad",
        "వనపర్తి" to "Wanaparthy",
        "వరంగల్" to "Warangal",
        "యాదాద్రి భువనగిరి" to "Bhuvanagiri",
        "అల్లూరి సీతారామరాజు" to "Paderu",
        "అనకాపల్లి" to "Anakapalli",
        "అనంతపురం" to "Anantapur",
        "అన్నమయ్య" to "Rayachoti",
        "బాపట్ల" to "Bapatla",
        "చిత్తూరు" to "Chittoor",
        "కోనసీమ" to "Amalapuram",
        "తూర్పు గోదావరి" to "Rajahmundry",
        "ఏలూరు" to "Eluru",
        "గుంటూరు" to "Guntur",
        "కాకినాడ" to "Kakinada",
        "కృష్ణా" to "Machilipatnam",
        "కర్నూలు" to "Kurnool",
        "నంద్యాల" to "Nandyal",
        "ఎన్టీఆర్" to "Vijayawada",
        "పల్నాడు" to "Narasaraopeta",
        "పార్వతీపురం మన్యం" to "Parvathipuram",
        "ప్రకాశం" to "Ongole",
        "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" to "Nellore",
        "శ్రీ సత్యసాయి" to "Puttaparthi",
        "శ్రీకాకుళం" to "Srikakulam",
        "తిరుపతి" to "Tirupati",
        "విశాఖపట్నం" to "Visakhapatnam",
        "విజయనగరం" to "Vizianagaram",
        "పశ్చిమ గోదావరి" to "Bhimavaram",
        "వైఎస్ఆర్ కడప" to "Kadapa"
    )

    /**
     * జిల్లా పేరు ఆధారంగా నిజమైన వాతావరణ సమాచారాన్ని తెస్తుంది.
     * రిటర్న్: ResultData(Temperature, WeatherCode, WindSpeed, Time)
     */
    data class WeatherData(
        val temp: Double,
        val code: Int,
        val wind: Double,
        val time: String
    )

    suspend fun fetchWeather(locationName: String, lat: Double? = null, lon: Double? = null): WeatherData? {
        // ✅ Check cache first (1-hour TTL)
        val cacheKey = if (lat != null && lon != null) "coords_${lat}_${lon}" else locationName
        val cached = weatherCache[cacheKey]
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt < CACHE_TTL_MS) {
            return cached.data
        }
        return try {
            val latitude: Double
            val longitude: Double

            if (lat != null && lon != null) {
                // If coordinates are provided, use them directly for 100% accuracy
                latitude = lat
                longitude = lon
            } else {
                // 1. Try to use the location name directly (Mandal/Town) with "India" suffix
                val searchName = locationMapping[locationName] ?: locationName
                val finalSearchName = "$searchName, India"
                
                // 2. Get coordinates via Geocoding
                val geoResponse = api.getCoordinates(finalSearchName)
                val location = geoResponse.results?.firstOrNull() 
                
                if (location == null) {
                    // Fallback: If mandal name is not found, try searching with district context
                    // This is more likely to find the specific area than just "District, India"
                    val parentDistrict = Constants.MANDAL_DATA.entries.find { it.value.contains(locationName) }?.key
                    val contextualSearch = if (parentDistrict != null) "$locationName, $parentDistrict, India" else null
                    
                    val fallbackGeoResponse = contextualSearch?.let { api.getCoordinates(it) }
                    val fallbackLocation = fallbackGeoResponse?.results?.firstOrNull()
                    
                    if (fallbackLocation != null) {
                        latitude = fallbackLocation.latitude
                        longitude = fallbackLocation.longitude
                    } else {
                        // If all fails, return null - don't show wrong district center data
                        return null
                    }
                } else {
                    latitude = location.latitude
                    longitude = location.longitude
                }
            }
            
            // 3. Get weather for these specific coordinates
            val weatherResponse = api.getWeather(latitude, longitude)
            val result = WeatherData(
                weatherResponse.currentWeather.temperature, 
                weatherResponse.currentWeather.weatherCode,
                weatherResponse.currentWeather.windSpeed,
                weatherResponse.currentWeather.time
            )
            weatherCache[cacheKey] = CachedWeather(result, System.currentTimeMillis())
            result
        } catch (e: Exception) {
            null
        }
    }

    /**
     * ISO టైమ్ (2024-05-20T14:00) ని చక్కటి తెలుగు టైమ్ గా మారుస్తుంది.
     * Example: "2024-05-20T06:30" → "తెల్లవారుజామున 6:30"
     *          "2024-05-20T14:00" → "మధ్యాహ్నం 2:00"
     */
    fun formatTime(isoTime: String): String {
        return try {
            val timePart = isoTime.split("T").getOrNull(1) ?: return isoTime
            val colonIdx = timePart.indexOf(':')
            if (colonIdx < 0) return timePart
            val hour = timePart.substring(0, colonIdx).toInt()
            val minute = timePart.substring(colonIdx + 1, minOf(colonIdx + 3, timePart.length))
            val displayHour = if (hour % 12 == 0) 12 else hour % 12
            val period = when (hour) {
                in 0..4   -> "రాత్రి"
                in 5..11  -> "ఉదయం"
                12        -> "మధ్యాహ్నం"
                in 13..16 -> "మధ్యాహ్నం"
                in 17..19 -> "సాయంత్రం"
                else      -> "రాత్రి"
            }
            "$period $displayHour:$minute"
        } catch (e: Exception) {
            isoTime
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
