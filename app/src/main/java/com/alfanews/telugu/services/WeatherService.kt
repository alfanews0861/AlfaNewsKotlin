package com.alfanews.telugu.services

import com.alfanews.telugu.models.Language
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
    @SerializedName("current") val current: CurrentData?,
    @SerializedName("hourly") val hourly: HourlyData?,
    @SerializedName("daily") val daily: DailyData?
)

data class CurrentData(
    @SerializedName("temperature_2m") val temperature: Double,
    @SerializedName("relative_humidity_2m") val humidity: Int,
    @SerializedName("apparent_temperature") val feelsLike: Double,
    @SerializedName("weather_code") val weatherCode: Int,
    @SerializedName("wind_speed_10m") val windSpeed: Double,
    @SerializedName("is_day") val isDay: Int,
    @SerializedName("uv_index") val uvIndex: Double? = null,
    @SerializedName("time") val time: String? = null
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
    @SerializedName("relative_humidity_2m") val humidity: List<Int>?,
    @SerializedName("apparent_temperature") val feelsLike: List<Double>?
)

data class DailyData(
    @SerializedName("time") val time: List<String>,
    @SerializedName("weathercode") val weatherCodeOld: List<Int>?,
    @SerializedName("weather_code") val weatherCode: List<Int>?,
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

    // ✅ Real-time current + hourly + daily forecasts
    @GET("https://api.open-meteo.com/v1/forecast")
    suspend fun getWeather(
        @Query("latitude") lat: Double,
        @Query("longitude") lon: Double,
        @Query("current_weather") currentWeather: Boolean = true,
        @Query("current") current: String = "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,uv_index",
        @Query("hourly") hourly: String = "relative_humidity_2m,apparent_temperature",
        @Query("daily") daily: String = "weather_code,weathercode,temperature_2m_max,temperature_2m_min,uv_index_max",
        @Query("timezone") timezone: String = "Asia/Kolkata",
        @Query("temperature_unit") tempUnit: String = "celsius",
        @Query("wind_speed_unit") windUnit: String = "kmh",
        @Query("precipitation_unit") precipUnit: String = "mm"
    ): WeatherResponse
}

object WeatherService {
    private val retrofit = Retrofit.Builder()
        .baseUrl("https://api.open-meteo.com/")
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val api = retrofit.create(WeatherApiService::class.java)

    // ✅ In-memory cache: 5-min TTL per location
    private data class CachedWeather(val data: WeatherData, val fetchedAt: Long)
    private val weatherCache = mutableMapOf<String, CachedWeather>()

    // ═════════════════════════════════════════════════════════════════════════
    // 🎯 100% ACCURATE STATIC DISTRICT COORDINATES (33 TS + 29 AP Districts & Aliases)
    // Guarantees instant 0ms resolution without network geocoding failures
    // ═════════════════════════════════════════════════════════════════════════
    val DISTRICT_COORDINATES = mapOf(
        // --- TELANGANA (33 Districts) ---
        "ఆదిలాబాద్" to Pair(19.6641, 78.5320),
        "Adilabad" to Pair(19.6641, 78.5320),
        "భద్రాద్రి కొత్తగూడెం" to Pair(17.5554, 80.6198),
        "కొత్తగూడెం" to Pair(17.5554, 80.6198),
        "భద్రాచలం" to Pair(17.6689, 80.8936),
        "Kothagudem" to Pair(17.5554, 80.6198),
        "హన్మకొండ" to Pair(18.0125, 79.5603),
        "Hanamkonda" to Pair(18.0125, 79.5603),
        "హైదరాబాద్" to Pair(17.3850, 78.4867),
        "Hyderabad" to Pair(17.3850, 78.4867),
        "జగిత్యాల" to Pair(18.7954, 78.9128),
        "Jagtial" to Pair(18.7954, 78.9128),
        "జనగాం" to Pair(17.7247, 79.1558),
        "Jangaon" to Pair(17.7247, 79.1558),
        "జయశంకర్ భూపాలపల్లి" to Pair(18.4357, 79.8656),
        "భూపాలపల్లి" to Pair(18.4357, 79.8656),
        "Bhupalpally" to Pair(18.4357, 79.8656),
        "జోగులాంబ గద్వాల" to Pair(16.2330, 77.8078),
        "గద్వాల" to Pair(16.2330, 77.8078),
        "Gadwal" to Pair(16.2330, 77.8078),
        "కామారెడ్డి" to Pair(18.3248, 78.3392),
        "Kamareddy" to Pair(18.3248, 78.3392),
        "కరీంనగర్" to Pair(18.4386, 79.1288),
        "Karimnagar" to Pair(18.4386, 79.1288),
        "ఖమ్మం" to Pair(17.2473, 80.1514),
        "Khammam" to Pair(17.2473, 80.1514),
        "కుమ్రం భీమ్ ఆసిఫాబాద్" to Pair(19.3588, 79.2882),
        "ఆసిఫాబాద్" to Pair(19.3588, 79.2882),
        "Asifabad" to Pair(19.3588, 79.2882),
        "మహబూబాబాద్" to Pair(17.5975, 80.0035),
        "Mahabubabad" to Pair(17.5975, 80.0035),
        "మహబూబ్ నగర్" to Pair(16.7488, 77.9856),
        "Mahabubnagar" to Pair(16.7488, 77.9856),
        "మంచిర్యాల" to Pair(18.8679, 79.4639),
        "Mancherial" to Pair(18.8679, 79.4639),
        "మెదక్" to Pair(18.0450, 78.2618),
        "Medak" to Pair(18.0450, 78.2618),
        "మేడ్చల్ మల్కాజిగిరి" to Pair(17.4875, 78.5444),
        "మల్కాజిగిరి" to Pair(17.4875, 78.5444),
        "మేడ్చల్" to Pair(17.6297, 78.4814),
        "Malkajgiri" to Pair(17.4875, 78.5444),
        "ములుగు" to Pair(18.1924, 79.9405),
        "Mulugu" to Pair(18.1924, 79.9405),
        "నాగర్ కర్నూల్" to Pair(16.4862, 78.3214),
        "Nagarkurnool" to Pair(16.4862, 78.3214),
        "నల్గొండ" to Pair(17.0575, 79.2684),
        "Nalgonda" to Pair(17.0575, 79.2684),
        "నారాయణపేట" to Pair(16.7380, 77.4984),
        "Narayanpet" to Pair(16.7380, 77.4984),
        "నిర్మల్" to Pair(19.0964, 78.3428),
        "Nirmal" to Pair(19.0964, 78.3428),
        "నిజామాబాద్" to Pair(18.6725, 78.0941),
        "Nizamabad" to Pair(18.6725, 78.0941),
        "పెద్దపల్లి" to Pair(18.6160, 79.3756),
        "Peddapalli" to Pair(18.6160, 79.3756),
        "రాజన్న సిరిసిల్ల" to Pair(18.3888, 78.8044),
        "సిరిసిల్ల" to Pair(18.3888, 78.8044),
        "Sircilla" to Pair(18.3888, 78.8044),
        "రంగారెడ్డి" to Pair(17.3333, 78.5833),
        "Rangareddy" to Pair(17.3333, 78.5833),
        "సంగారెడ్డి" to Pair(17.6190, 78.0817),
        "Sangareddy" to Pair(17.6190, 78.0817),
        "సిద్దిపేట" to Pair(18.1018, 78.8520),
        "Siddipet" to Pair(18.1018, 78.8520),
        "సూర్యాపేట" to Pair(17.1439, 79.6239),
        "Suryapet" to Pair(17.1439, 79.6239),
        "వికారాబాద్" to Pair(17.3366, 77.9048),
        "Vikarabad" to Pair(17.3366, 77.9048),
        "వనపర్తి" to Pair(16.3624, 78.0617),
        "Wanaparthy" to Pair(16.3624, 78.0617),
        "వరంగల్" to Pair(17.9689, 79.5941),
        "Warangal" to Pair(17.9689, 79.5941),
        "యాదాద్రి భువనగిరి" to Pair(17.5147, 78.8814),
        "భువనగిరి" to Pair(17.5147, 78.8814),
        "Bhuvanagiri" to Pair(17.5147, 78.8814),

        // --- ANDHRA PRADESH (29 Districts & Divisions) ---
        "అల్లూరి సీతారామరాజు" to Pair(18.0833, 82.6667),
        "పాడేరు" to Pair(18.0833, 82.6667),
        "Paderu" to Pair(18.0833, 82.6667),
        "అనకాపల్లి" to Pair(17.6913, 83.0039),
        "Anakapalli" to Pair(17.6913, 83.0039),
        "అనంతపురం" to Pair(14.6819, 77.6006),
        "Anantapur" to Pair(14.6819, 77.6006),
        "అన్నమయ్య" to Pair(14.0583, 78.7523),
        "రాయచోటి" to Pair(14.0583, 78.7523),
        "Rayachoti" to Pair(14.0583, 78.7523),
        "బాపట్ల" to Pair(15.9056, 80.4686),
        "Bapatla" to Pair(15.9056, 80.4686),
        "చిత్తూరు" to Pair(13.2172, 79.1003),
        "Chittoor" to Pair(13.2172, 79.1003),
        "కోనసీమ" to Pair(16.5787, 82.0061),
        "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ" to Pair(16.5787, 82.0061),
        "అమలాపురం" to Pair(16.5787, 82.0061),
        "Amalapuram" to Pair(16.5787, 82.0061),
        "తూర్పు గోదావరి" to Pair(17.0005, 81.8040),
        "రాజమండ్రి" to Pair(17.0005, 81.8040),
        "రాజమహేంద్రవరం" to Pair(17.0005, 81.8040),
        "Rajahmundry" to Pair(17.0005, 81.8040),
        "ఏలూరు" to Pair(16.7107, 81.0952),
        "Eluru" to Pair(16.7107, 81.0952),
        "గుంటూరు" to Pair(16.3067, 80.4365),
        "Guntur" to Pair(16.3067, 80.4365),
        "కాకినాడ" to Pair(16.9891, 82.2475),
        "Kakinada" to Pair(16.9891, 82.2475),
        "కృష్ణా" to Pair(16.1875, 81.1389),
        "మచిలీపట్నం" to Pair(16.1875, 81.1389),
        "Machilipatnam" to Pair(16.1875, 81.1389),
        "కర్నూలు" to Pair(15.8281, 78.0373),
        "Kurnool" to Pair(15.8281, 78.0373),
        "నంద్యాల" to Pair(15.4786, 78.4836),
        "Nandyal" to Pair(15.4786, 78.4836),
        "ఎన్టీఆర్" to Pair(16.5062, 80.6480),
        "విజయవాడ" to Pair(16.5062, 80.6480),
        "Vijayawada" to Pair(16.5062, 80.6480),
        "పల్నాడు" to Pair(16.2361, 80.0499),
        "నరసరావుపేట" to Pair(16.2361, 80.0499),
        "Narasaraopeta" to Pair(16.2361, 80.0499),
        "పార్వతీపురం మన్యం" to Pair(18.7797, 83.4287),
        "మన్యం" to Pair(18.7797, 83.4287),
        "పార్వతీపురం" to Pair(18.7797, 83.4287),
        "Parvathipuram" to Pair(18.7797, 83.4287),
        "ప్రకాశం" to Pair(15.5057, 80.0499),
        "ఒంగోలు" to Pair(15.5057, 80.0499),
        "Ongole" to Pair(15.5057, 80.0499),
        "మార్కాపురం" to Pair(15.7350, 79.2710),
        "Markapur" to Pair(15.7350, 79.2710),
        "పోలవరం" to Pair(17.2514, 81.6419),
        "Polavaram" to Pair(17.2514, 81.6419),
        "మదనపల్లె" to Pair(13.5560, 78.5010),
        "Madanapalle" to Pair(13.5560, 78.5010),
        "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" to Pair(14.4426, 79.9865),
        "నెల్లూరు" to Pair(14.4426, 79.9865),
        "Nellore" to Pair(14.4426, 79.9865),
        "శ్రీ సత్యసాయి" to Pair(14.1670, 77.8119),
        "సత్యసాయి" to Pair(14.1670, 77.8119),
        "పుట్టపర్తి" to Pair(14.1670, 77.8119),
        "Puttaparthi" to Pair(14.1670, 77.8119),
        "శ్రీకాకుళం" to Pair(18.2949, 83.8938),
        "Srikakulam" to Pair(18.2949, 83.8938),
        "తిరుపతి" to Pair(13.6288, 79.4192),
        "Tirupati" to Pair(13.6288, 79.4192),
        "విశాఖపట్నం" to Pair(17.6868, 83.2185),
        "విశాఖ" to Pair(17.6868, 83.2185),
        "Visakhapatnam" to Pair(17.6868, 83.2185),
        "విజయనగరం" to Pair(18.1133, 83.3956),
        "Vizianagaram" to Pair(18.1133, 83.3956),
        "పశ్చిమ గోదావరి" to Pair(16.5449, 81.5212),
        "భీమవరం" to Pair(16.5449, 81.5212),
        "Bhimavaram" to Pair(16.5449, 81.5212),
        "వైఎస్ఆర్ కడప" to Pair(14.4673, 78.8242),
        "కడప" to Pair(14.4673, 78.8242),
        "Kadapa" to Pair(14.4673, 78.8242)
    )

    // తెలుగు పేర్లను ఇంగ్లీష్ లోకి మార్చే మ్యాపింగ్
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
        "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ" to "Amalapuram",
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
        "మన్యం" to "Parvathipuram",
        "ప్రకాశం" to "Ongole",
        "మార్కాపురం" to "Markapur",
        "పోలవరం" to "Polavaram",
        "మదనపల్లె" to "Madanapalle",
        "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" to "Nellore",
        "నెల్లూరు" to "Nellore",
        "శ్రీ సత్యసాయి" to "Puttaparthi",
        "సత్యసాయి" to "Puttaparthi",
        "పుట్టపర్తి" to "Puttaparthi",
        "శ్రీకాకుళం" to "Srikakulam",
        "తిరుపతి" to "Tirupati",
        "విశాఖపట్నం" to "Visakhapatnam",
        "విశాఖ" to "Visakhapatnam",
        "విజయనగరం" to "Vizianagaram",
        "పశ్చిమ గోదావరి" to "Bhimavaram",
        "భీమవరం" to "Bhimavaram",
        "వైఎస్ఆర్ కడప" to "Kadapa",
        "కడప" to "Kadapa"
    )

    // Mapping for reverse lookup (English to Telugu)
    private val reverseLocationMapping = locationMapping.entries.associate { it.value to it.key }

    fun getTeluguNameForEnglish(englishName: String): String? {
        // Direct match
        reverseLocationMapping[englishName]?.let { return it }
        // Partial match
        return reverseLocationMapping.entries.find { 
            it.key.contains(englishName, ignoreCase = true) || englishName.contains(it.key, ignoreCase = true) 
        }?.value
    }

    /**
     * జిల్లా పేరు లేదా కోఆర్డినేట్స్ ఆధారంగా నిజమైన వాతావరణ సమాచారాన్ని తెస్తుంది.
     */
    data class WeatherData(
        val temp: Double,
        val code: Int,
        val wind: Double,
        val time: String,
        val humidity: Int? = null,
        val feelsLike: Double? = null,
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
        val validLat = if (lat != null && lat != 0.0) lat else null
        val validLon = if (lon != null && lon != 0.0) lon else null

        // Cache lookup (5-min TTL)
        val cacheKey = if (validLat != null && validLon != null) "coords_${validLat}_${validLon}" else locationName.trim()
        val cached = weatherCache[cacheKey]
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt < 5 * 60 * 1000L) {
            return cached.data
        }

        return try {
            val latitude: Double
            val longitude: Double

            if (validLat != null && validLon != null) {
                latitude = validLat
                longitude = validLon
            } else {
                // 🚀 FAST-PATH: Direct static coordinates lookup for all TS & AP districts & towns
                val trimmed = locationName.trim()
                val staticCoords = DISTRICT_COORDINATES[trimmed]
                    ?: DISTRICT_COORDINATES.entries.find { it.key.equals(trimmed, ignoreCase = true) }?.value
                    ?: Constants.MANDAL_DATA.entries.find { it.value.contains(trimmed) }?.key?.let { DISTRICT_COORDINATES[it] }

                if (staticCoords != null) {
                    latitude = staticCoords.first
                    longitude = staticCoords.second
                } else {
                    // Fallback to Geocoding API if not found in static list
                    val searchName = locationMapping[trimmed] ?: trimmed
                    val parentDistrictTe = Constants.MANDAL_DATA.entries.find { it.value.contains(trimmed) }?.key
                    val parentDistrictEn = locationMapping[parentDistrictTe]

                    val finalSearchName = if (parentDistrictEn != null && searchName != parentDistrictEn) {
                        "$searchName, $parentDistrictEn"
                    } else {
                        searchName
                    }

                    val geoResponse = api.getCoordinates(finalSearchName)
                    val location = geoResponse.results?.firstOrNull()

                    if (location != null) {
                        latitude = location.latitude
                        longitude = location.longitude
                    } else {
                        val districtEn = locationMapping[parentDistrictTe] ?: locationMapping[trimmed]
                        if (districtEn != null) {
                            val districtGeo = api.getCoordinates(districtEn).results?.firstOrNull()
                            if (districtGeo != null) {
                                latitude = districtGeo.latitude
                                longitude = districtGeo.longitude
                            } else return null
                        } else return null
                    }
                }
            }

            val weatherResponse = api.getWeather(latitude, longitude)

            val currentData = weatherResponse.current
            val legacyWeather = weatherResponse.currentWeather

            val realTemp = currentData?.temperature ?: legacyWeather.temperature
            val realCode = currentData?.weatherCode ?: legacyWeather.weatherCode
            val realWind = currentData?.windSpeed ?: legacyWeather.windSpeed
            val realIsDay = (currentData?.isDay ?: legacyWeather.isDay) == 1
            val realHumidity = currentData?.humidity
            val realFeelsLike = currentData?.feelsLike

            // Fallback hourly humidity & feelsLike
            val currentTimeStr = currentData?.time ?: legacyWeather.time
            val hourlyTimes = weatherResponse.hourly?.time
            val currentHourIndex = hourlyTimes?.indexOfFirst { it.startsWith(currentTimeStr.take(13)) }
                ?.takeIf { it >= 0 }
                ?: hourlyTimes?.size?.let { minOf(it - 1, 0) }
                ?: 0

            val fallbackHumidity = weatherResponse.hourly?.humidity?.getOrNull(currentHourIndex)
            val fallbackFeelsLike = weatherResponse.hourly?.feelsLike?.getOrNull(currentHourIndex)

            val finalHumidity = realHumidity ?: fallbackHumidity
            val finalFeelsLike = realFeelsLike ?: fallbackFeelsLike

            // UV Index: If night, UV is 0.0. If day, prefer current UV or daily peak UV
            val todayMaxUV = weatherResponse.daily?.uvIndex?.getOrNull(0)
            val finalUV = if (!realIsDay) {
                0.0
            } else {
                currentData?.uvIndex ?: todayMaxUV ?: 0.0
            }

            // Build 7-day forecast
            val daily = weatherResponse.daily
            val forecastList = mutableListOf<DayForecast>()
            val dailyCodes = daily?.weatherCode ?: daily?.weatherCodeOld
            if (daily?.time != null && dailyCodes != null) {
                for (i in 0 until minOf(daily.time.size, 7)) {
                    forecastList.add(DayForecast(
                        date = daily.time[i],
                        code = dailyCodes.getOrNull(i) ?: 0,
                        maxTemp = daily.tempMax?.getOrNull(i) ?: 0.0,
                        minTemp = daily.tempMin?.getOrNull(i) ?: 0.0
                    ))
                }
            }

            val isPrecise = validLat != null && validLon != null
            val result = WeatherData(
                temp = realTemp,
                code = realCode,
                wind = realWind,
                time = currentTimeStr,
                humidity = finalHumidity,
                feelsLike = finalFeelsLike,
                isDay = realIsDay,
                uvIndex = finalUV,
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
     * ISO సమయాన్ని (2026-08-14T23:15) భాషకు తగినట్టు ఫార్మాట్ చేస్తుంది.
     * Telugu: "రాత్రి 11:15"
     * English: "11:15 PM"
     */
    fun formatTime(isoTime: String, language: Language = Language.TELUGU): String {
        return try {
            val timePart = isoTime.split("T").getOrNull(1) ?: return isoTime
            val colonIdx = timePart.indexOf(':')
            if (colonIdx < 0) return timePart
            val hour = timePart.substring(0, colonIdx).toInt()
            val minute = timePart.substring(colonIdx + 1, minOf(colonIdx + 3, timePart.length))
            val displayHour = if (hour % 12 == 0) 12 else hour % 12

            if (language == Language.ENGLISH) {
                val amPm = if (hour < 12) "AM" else "PM"
                "$displayHour:$minute $amPm"
            } else {
                val period = when (hour) {
                    in 0..3   -> "రాత్రి"
                    in 4..6   -> "తెల్లవారుజామున"
                    in 7..11  -> "ఉదయం"
                    12        -> "మధ్యాహ్నం"
                    in 13..16 -> "మధ్యాహ్నం"
                    in 17..19 -> "సాయంత్రం"
                    else      -> "రాత్రి"
                }
                "$period $displayHour:$minute"
            }
        } catch (e: Exception) {
            isoTime
        }
    }

    /**
     * WMO Weather Interpretation Codes (WW) ని ఖచ్చితమైన వివరణగా మారుస్తుంది.
     */
    fun getWeatherDescription(code: Int, language: Language = Language.TELUGU): String {
        return if (language == Language.ENGLISH) {
            when (code) {
                0 -> "Clear Sky"
                1 -> "Mainly Clear"
                2 -> "Partly Cloudy"
                3 -> "Overcast"
                45, 48 -> "Foggy"
                51, 53, 55 -> "Light Drizzle"
                56, 57 -> "Freezing Drizzle"
                61, 63, 65 -> "Rainy"
                66, 67 -> "Heavy Freezing Rain"
                71, 73, 75, 77, 85, 86 -> "Snow Fall"
                80, 81, 82 -> "Rain Showers"
                95 -> "Thunderstorm"
                96, 99 -> "Thunderstorm with Hail"
                else -> "Moderate Weather"
            }
        } else {
            when (code) {
                0 -> "ఆకాశం నిర్మలంగా ఉంది"
                1 -> "ప్రధానంగా నిర్మలమైన ఆకాశం"
                2 -> "పాక్షికంగా మేఘావృతం"
                3 -> "పూర్తిగా మేఘావృతం (మబ్బులు)"
                45, 48 -> "పొగమంచు కురిసే అవకాశం"
                51, 53, 55 -> "తేలికపాటి చినుకులు పడే అవకాశం"
                56, 57 -> "చల్లని చినుకులు"
                61, 63, 65 -> "వర్షం పడే అవకాశం"
                66, 67 -> "భారీ వర్షం"
                71, 73, 75, 77, 85, 86 -> "మంచు కురిసే అవకాశం"
                80, 81, 82 -> "వర్షపు జల్లులు కురిసే అవకాశం"
                95 -> "పిడుగులు, ఉరుములతో కూడిన వర్షం"
                96, 99 -> "తీవ్రమైన వడగళ్ల వాన"
                else -> "సాధారణ వాతావరణం"
            }
        }
    }

    /**
     * సమయం (పగలు/రాత్రి), ఉష్ణోగ్రత, తేమ, వాతావరణ పరిస్థితుల ఆధారంగా 100% ఖచ్చితమైన విశ్లేషణను అందిస్తుంది.
     */
    fun getConversationalDescription(
        code: Int,
        temp: Double,
        location: String,
        isDay: Boolean = true,
        humidity: Int? = null,
        windSpeed: Double? = null,
        language: Language = Language.TELUGU
    ): String {
        if (language == Language.ENGLISH) {
            val baseDesc = if (!isDay) {
                when (code) {
                    0 -> "Tonight in $location, skies are clear and the weather is calm and pleasant."
                    1, 2 -> "Tonight in $location, scattered clouds are expected with pleasant weather."
                    3 -> "Tonight in $location, the sky is completely overcast with thick cloud cover."
                    45, 48 -> "Foggy conditions are expected tonight in $location. Drivers are advised to be cautious."
                    51, 53, 55 -> "Light drizzles may occur tonight in $location."
                    61, 63, 65, 80, 81, 82 -> "Rain is likely tonight in $location. Carry rain gear if heading out."
                    95, 96, 99 -> "Severe thunderstorm and lightning warning tonight in $location. Stay indoors in safe shelters."
                    else -> "Weather in $location remains moderate tonight."
                }
            } else {
                when (code) {
                    0 -> "Today in $location, the sky is clear and bright with ample sunshine."
                    1, 2 -> "Today in $location, scattered clouds with pleasant weather are expected."
                    3 -> "Today in $location, the sky is completely overcast with thick clouds."
                    45, 48 -> "Foggy conditions in $location today. Commuters should drive carefully."
                    51, 53, 55 -> "Light drizzles are expected today in $location."
                    61, 63, 65, 80, 81, 82 -> "Rain is expected in $location today. Keep an umbrella handy."
                    95, 96, 99 -> "Severe thunderstorm alert in $location. Avoid standing under trees and stay indoors."
                    else -> "Weather in $location is normal today."
                }
            }

            val tempAdvice = when {
                temp >= 40 && isDay -> " Current temperature is ${temp.toInt()}°C. Severe heatwave conditions; avoid outdoor travel between 12 PM and 4 PM."
                temp >= 35 && isDay -> " Current temperature is ${temp.toInt()}°C. High heat conditions; stay well-hydrated."
                humidity != null && humidity >= 75 && temp in 27.0..35.0 -> " Temperature is ${temp.toInt()}°C with ${humidity}% humidity. High humidity and muggy conditions expected."
                temp <= 18 -> " Current temperature is ${temp.toInt()}°C. Cool weather prevails; dress warmly."
                else -> " Current temperature is ${temp.toInt()}°C with favorable conditions."
            }

            return "$baseDesc$tempAdvice"
        } else {
            val baseDesc = if (!isDay) {
                when (code) {
                    0 -> "నేడు రాత్రి $location లో ఆకాశం నిర్మలంగా, ప్రశాంతంగా ఆహ్లాదకరంగా ఉంటుంది."
                    1, 2 -> "నేడు రాత్రి $location లో అక్కడక్కడ తేలికపాటి మేఘాలు ఉంటాయి. రాత్రి వాతావరణం అనుకూలంగా ఉంటుంది."
                    3 -> "నేడు రాత్రి $location లో ఆకాశం మేఘావృతమై మబ్బుపట్టి ఉంటుంది."
                    45, 48 -> "నేడు రాత్రి $location లో పొగమంచు కురిసే అవకాశం ఉంది. వాహనదారులు జాగ్రత్తగా డ్రైవ్ చేయాలి."
                    51, 53, 55 -> "నేడు రాత్రి $location లో తేలికపాటి చినుకులు పడే అవకాశం ఉంది."
                    61, 63, 65, 80, 81, 82 -> "నేడు రాత్రి $location లో వర్షం కురిసే అవకాశం ఉంది. రాత్రి ప్రయాణాలు చేసేవారు జాగ్రత్తగా ఉండాలి."
                    95, 96, 99 -> "హెచ్చరిక: నేడు రాత్రి $location లో ఉరుములు, మెరుపులతో కూడిన భారీ వర్షం పడే ప్రమాదం ఉంది. ప్రజలు సురక్షిత ప్రాంతాల్లో ఉండాలి."
                    else -> "నేడు రాత్రి $location లో వాతావరణం సాధారణంగా ఉంటుంది."
                }
            } else {
                when (code) {
                    0 -> "నేడు $location లో ఆకాశం చాలా నిర్మలంగా, ప్రకాశవంతంగా ఉంటుంది."
                    1, 2 -> "నేడు $location లో అక్కడక్కడ మేఘాలు కనిపిస్తాయి. వాతావరణం ఆహ్లాదకరంగా ఉంటుంది."
                    3 -> "నేడు $location లో ఆకాశం పూర్తిగా మేఘావృతమై (మబ్బు పట్టి) ఉంటుంది."
                    45, 48 -> "నేడు $location లో పొగమంచు కురిసే అవకాశం ఉంది. రోడ్డుపై ప్రయాణించే వారు జాగ్రత్తగా ఉండాలి."
                    51, 53, 55 -> "నేడు $location లో అప్పుడప్పుడు తేలికపాటి చినుకులు పడే అవకాశం ఉంది."
                    61, 63, 65, 80, 81, 82 -> "నేడు $location లో వర్షం కురిసే అవకాశం ఉంది. బయటకు వెళ్లేవారు గొడుగు వెంట ఉంచుకోవడం మంచిది."
                    95, 96, 99 -> "హెచ్చరిక: నేడు $location లో పిడుగులతో కూడిన భారీ వర్షం పడే ప్రమాదం ఉంది. ఉరుములు వస్తున్నప్పుడు చెట్ల కింద ఉండరాదు, సురక్షితమైన భవనాల్లో ఉండాలి."
                    else -> "నేడు $location లో వాతావరణం సాధారణంగా ఉంటుంది."
                }
            }

            val tempAdvice = when {
                temp >= 40 && isDay -> " ప్రస్తుత ఉష్ణోగ్రత ${temp.toInt()}°C గా ఉంది. తీవ్రమైన ఎండ మరియు వేడి గాలులు ఉన్నాయి, మధ్యాహ్నం 12 నుండి 4 గంటల వరకు అత్యవసరం అయితే తప్ప బయటకు రాకపోవడం ఉత్తమం."
                temp >= 35 && isDay -> " ప్రస్తుత ఉష్ణోగ్రత ${temp.toInt()}°C గా ఉంది. ఎండ వేడి ఎక్కువగా ఉంటుంది, డీహైడ్రేషన్ బారిన పడకుండా తగినంత నీరు తాగుతూ ఉండండి."
                humidity != null && humidity >= 75 && temp in 27.0..35.0 -> " ప్రస్తుత ఉష్ణోగ్రత ${temp.toInt()}°C, తేమ శాతం ${humidity}% గా ఉంది. ఉక్కపోత ఎక్కువగా ఉండే అవకాశం ఉంది."
                temp <= 18 -> " ప్రస్తుత ఉష్ణోగ్రత ${temp.toInt()}°C గా ఉంది. చలి తీవ్రత కొంచెం ఎక్కువగా ఉంది, పిల్లలు మరియు వృద్ధులు తగిన జాగ్రత్తలు తీసుకోవాలి."
                else -> " ప్రస్తుతం ఉష్ణోగ్రత ${temp.toInt()}°C గా ఉంది. వాతావరణం అనుకూలంగా ఉంది."
            }

            return "$baseDesc$tempAdvice"
        }
    }

    fun getWeatherTypeLabel(code: Int): String {
        return when (code) {
            0 -> "Sunny"
            1, 2 -> "Partly Cloudy"
            3 -> "Overcast"
            45, 48 -> "Foggy"
            51, 53, 55, 56, 57 -> "Drizzle"
            61, 63, 65, 66, 67, 80, 81, 82 -> "Rainy"
            95, 96, 99 -> "Thunderstorm"
            else -> "Cloudy"
        }
    }
}
