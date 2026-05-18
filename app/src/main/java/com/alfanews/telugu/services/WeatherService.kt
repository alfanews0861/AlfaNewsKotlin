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
    @SerializedName("current_weather") val currentWeather: CurrentWeather,
    @SerializedName("hourly") val hourly: HourlyData?,
    @SerializedName("daily") val daily: DailyData?
)

data class CurrentWeather(
    @SerializedName("temperature") val temperature: Double,
    @SerializedName("weathercode") val weatherCode: Int,
    @SerializedName("windspeed") val windSpeed: Double,
    @SerializedName("is_day") val isDay: Int,
    @SerializedName("time") val time: String
)

data class HourlyData(
    @SerializedName("time") val time: List<String>,
    @SerializedName("relative_humidity_2m") val humidity: List<Int>?
)

data class DailyData(
    @SerializedName("time") val time: List<String>,
    @SerializedName("weathercode") val weatherCode: List<Int>?,
    @SerializedName("temperature_2m_max") val tempMax: List<Double>?,
    @SerializedName("temperature_2m_min") val tempMin: List<Double>?,
    @SerializedName("uv_index_max") val uvIndex: List<Double>?
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
        @Query("current_weather") currentWeather: Boolean = true,
        @Query("hourly") hourly: String = "relative_humidity_2m",
        @Query("daily") daily: String = "weathercode,temperature_2m_max,temperature_2m_min,uv_index_max",
        @Query("timezone") timezone: String = "auto"
    ): WeatherResponse
}

object WeatherService {
    private val retrofit = Retrofit.Builder()
        .baseUrl("https://api.open-meteo.com/") // Base URL is required but we use full URLs in interface
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val api = retrofit.create(WeatherApiService::class.java)

    // ✅ In-memory cache: 10-min TTL per location to avoid repeated API calls (Reduced from 30m for real-time accuracy)
    private data class CachedWeather(val data: WeatherData, val fetchedAt: Long)
    private val weatherCache = mutableMapOf<String, CachedWeather>()

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
     * రిటర్న్: ResultData(Temperature, WeatherCode, WindSpeed, Time, Humidity, Forecast)
     */
    data class WeatherData(
        val temp: Double,
        val code: Int,
        val wind: Double,
        val time: String,
        val humidity: Int? = null,
        val isDay: Boolean = true,
        val uvIndex: Double? = null,
        val isPrecise: Boolean = true,
        val dailyForecast: List<DayForecast> = emptyList()
    )

    data class DayForecast(
        val date: String,
        val code: Int,
        val maxTemp: Double,
        val minTemp: Double
    )

    suspend fun fetchWeather(locationName: String, lat: Double? = null, lon: Double? = null): WeatherData? {
        // ✅ Treat 0.0, 0.0 as null (likely unitialized prefs)
        val validLat = if (lat != null && lat != 0.0) lat else null
        val validLon = if (lon != null && lon != 0.0) lon else null

        // ✅ Check cache first (10-min TTL for robustness)
        val cacheKey = if (validLat != null && validLon != null) "coords_${validLat}_${validLon}" else locationName
        val cached = weatherCache[cacheKey]
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt < 10 * 60 * 1000L) {
            return cached.data
        }
        return try {
            val latitude: Double
            val longitude: Double

            if (validLat != null && validLon != null) {
                latitude = validLat
                longitude = validLon
            } else {
                val searchName = locationMapping[locationName] ?: locationName
                val finalSearchName = "$searchName, India"
                val geoResponse = api.getCoordinates(finalSearchName)
                val location = geoResponse.results?.firstOrNull() 
                
                if (location == null) {
                    // Fallback: If mandal name is not found, try searching with district context in English
                    val parentDistrictTe = Constants.MANDAL_DATA.entries.find { it.value.contains(locationName) }?.key
                    val parentDistrictEn = locationMapping[parentDistrictTe]
                    
                    val contextualSearch = if (parentDistrictEn != null) {
                        "$locationName, $parentDistrictEn, India"
                    } else if (parentDistrictTe != null) {
                        "$locationName, $parentDistrictTe, India"
                    } else null
                    
                    val fallbackGeoResponse = contextualSearch?.let { api.getCoordinates(it) }
                    val fallbackLocation = fallbackGeoResponse?.results?.firstOrNull()
                    
                    if (fallbackLocation != null) {
                        latitude = fallbackLocation.latitude
                        longitude = fallbackLocation.longitude
                    } else {
                        // Final fallback: Use the district center if mandal is still not found
                        val districtEn = locationMapping[parentDistrictTe] ?: locationMapping[locationName]
                        if (districtEn != null) {
                            val districtGeo = api.getCoordinates("$districtEn, India").results?.firstOrNull()
                            if (districtGeo != null) {
                                latitude = districtGeo.latitude
                                longitude = districtGeo.longitude
                            } else return null
                        } else return null
                    }
                } else {
                    latitude = location.latitude
                    longitude = location.longitude
                }
            }
            
            val weatherResponse = api.getWeather(latitude, longitude)
            
            // Get current humidity (first hourly value)
            val currentHumidity = weatherResponse.hourly?.humidity?.firstOrNull()
            
            // Build daily forecast
            val daily = weatherResponse.daily
            val forecastList = mutableListOf<DayForecast>()
            if (daily?.time != null && daily.weatherCode != null) {
                for (i in 0 until minOf(daily.time.size, 7)) {
                    forecastList.add(DayForecast(
                        daily.time[i],
                        daily.weatherCode[i],
                        daily.tempMax?.getOrNull(i) ?: 0.0,
                        daily.tempMin?.getOrNull(i) ?: 0.0
                    ))
                }
            }

            val isPrecise = validLat != null && validLon != null
            val result = WeatherData(
                temp = weatherResponse.currentWeather.temperature, 
                code = weatherResponse.currentWeather.weatherCode,
                wind = weatherResponse.currentWeather.windSpeed,
                time = weatherResponse.currentWeather.time,
                humidity = currentHumidity,
                isDay = weatherResponse.currentWeather.isDay == 1,
                uvIndex = weatherResponse.daily?.uvIndex?.firstOrNull(),
                isPrecise = isPrecise,
                dailyForecast = forecastList
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
