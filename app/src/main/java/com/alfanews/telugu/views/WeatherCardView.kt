package com.alfanews.telugu.views

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.WeatherService
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra
import java.util.Locale

/**
 * వాతావరణం వివరాలను అత్యంత ప్రొఫెషనల్ మరియు అందమైన గ్రాఫిక్‌తో ప్రదర్శించే కార్డ్.
 * Real-time data WeatherService API నుండి వస్తుంది.
 */
@Composable
fun WeatherCardView(
    post: NewsPost,
    language: Language,
    modifier: Modifier = Modifier,
    onLocationRequest: () -> Unit = {}
) {
    val context = LocalContext.current
    val headline = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
    val content = if (language == Language.TELUGU) post.content.telugu else post.content.english

    // Real-time API state
    var weatherData by remember { mutableStateOf<WeatherService.WeatherData?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }
    var retryTrigger by remember { mutableStateOf(0) }

    // GPS Status check
    val hasLocationPermission = remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }
    
    // We consider it "Not Precise" if weatherData says so (meaning no GPS coords were used)
    val isUsingGPS = (weatherData?.isPrecise == true && hasLocationPermission.value) || isLoading

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        hasLocationPermission.value = isGranted
        if (isGranted) {
            onLocationRequest()
            retryTrigger++ // Refresh weather when permission is granted
        }
    }

    // Fetch real weather data from WeatherService
    LaunchedEffect(post.location, post.latitude, post.longitude, retryTrigger) {
        isLoading = true
        error = false
        try {
            val data = WeatherService.fetchWeather(post.location, post.latitude, post.longitude)
            if (data != null) {
                weatherData = data
            } else {
                error = true
            }
        } catch (e: Exception) {
            error = true
        }
        isLoading = false
    }

    val realWeatherCode = weatherData?.code
    val realTime = weatherData?.time?.let { WeatherService.formatTime(it) }
    val isDay = weatherData?.isDay ?: true

    // Temperature to display: real API data or fallback from text
    val temperature: String = remember(weatherData, headline) {
        if (weatherData != null) {
            weatherData!!.temp.toInt().toString()
        } else {
            // Try to extract from headline (e.g., "31°C")
            val regex = "(\\d+)°C".toRegex()
            regex.find(headline)?.groupValues?.get(1) ?: "—"
        }
    }

    val windSpeed: String = weatherData?.wind?.toInt()?.toString() ?: "—"
    val humidity: String = weatherData?.humidity?.let { "$it%" } ?: "—"
    val uvIndex: String = weatherData?.uvIndex?.let { String.format(Locale.getDefault(), "%.1f", it) } ?: "—"
    val weatherTime: String = realTime ?: ""

    // Animation for background
    val infiniteTransition = rememberInfiniteTransition(label = "weather_bg")
    val circleOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 100f,
        animationSpec = infiniteRepeatable(
            animation = tween(5000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "circle_offset"
    )

    // Weather type: from real code if available, else from headline keywords
    val weatherType = remember(realWeatherCode, headline, isDay) {
        val type = when {
            realWeatherCode != null -> when (realWeatherCode) {
                0 -> WeatherType.SUNNY
                1, 2, 3 -> WeatherType.PARTLY_CLOUDY
                45, 48 -> WeatherType.CLOUDY
                51, 53, 55 -> WeatherType.CLOUDY // Drizzle/Foggy as cloudy
                61, 63, 65, 80, 81, 82 -> WeatherType.RAINY
                95, 96, 99 -> WeatherType.THUNDERSTORM
                else -> WeatherType.PARTLY_CLOUDY
            }
            headline.contains("ఎండ", ignoreCase = true) || headline.contains("Sunny", ignoreCase = true) -> WeatherType.SUNNY
            headline.contains("వర్షం", ignoreCase = true) || headline.contains("Rain", ignoreCase = true) -> WeatherType.RAINY
            headline.contains("పిడుగు", ignoreCase = true) || headline.contains("Thunder", ignoreCase = true) -> WeatherType.THUNDERSTORM
            headline.contains("మేఘావృతం", ignoreCase = true) || headline.contains("Cloudy", ignoreCase = true) -> WeatherType.CLOUDY
            else -> WeatherType.PARTLY_CLOUDY
        }
        
        // Adjust for night
        if (!isDay && type == WeatherType.SUNNY) {
            type.copy(icon = Icons.Default.NightsStay, labelEn = "Clear Night", labelTe = "నిర్మలమైన రాత్రి")
        } else if (!isDay && type == WeatherType.PARTLY_CLOUDY) {
            type.copy(icon = Icons.Default.NightsStay, labelEn = "Cloudy Night", labelTe = "మేఘావృత రాత్రి")
        } else {
            type
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
    ) {
        // GPS WARNING BANNER
        if (!isUsingGPS) {
            Surface(
                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.9f),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        if (hasLocationPermission.value) {
                            onLocationRequest()
                            retryTrigger++
                        } else {
                            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        }
                    }
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.GpsFixed,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = if (language == Language.TELUGU)
                            "GPS లేనందువల్ల మీ ప్రాంత వాతావరణం ఇవ్వలేకపోతున్నాం. ఖచ్చితమైన సమాచారం మరియు వార్తల కోసం GPS అనుమతించండి. (ప్రస్తుతం జిల్లా కేంద్రం వాతావరణం)"
                        else
                            "Unable to fetch local weather without GPS. Grant location for precise weather and news. (Showing district weather)",
                        fontSize = 12.sp,
                        fontFamily = Mallanna,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        lineHeight = 16.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        // HEADER - App Name
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp)
                .padding(horizontal = 20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "alfa",
                fontSize = 28.sp,
                fontFamily = Ramabhadra,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "news",
                fontSize = 28.sp,
                fontFamily = Ramabhadra,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.weight(1f))
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = if (weatherTime.isNotEmpty()) "${post.location} ($weatherTime)" else post.location,
                fontSize = 14.sp,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(start = 4.dp)
            )
        }

        // WEATHER GRAPHIC AREA
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.42f)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(weatherType.colorStart, weatherType.colorEnd)
                    )
                )
        ) {
            // Decorative canvas circles
            Canvas(modifier = Modifier.fillMaxSize()) {
                val width = size.width
                val height = size.height
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.15f), Color.Transparent),
                        center = Offset(width * 0.2f + circleOffset, height * 0.3f),
                        radius = width * 0.5f
                    ),
                    radius = width * 0.5f,
                    center = Offset(width * 0.2f + circleOffset, height * 0.3f)
                )
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.1f), Color.Transparent),
                        center = Offset(width * 0.9f - circleOffset, height * 0.8f),
                        radius = width * 0.3f
                    ),
                    radius = width * 0.3f,
                    center = Offset(width * 0.9f - circleOffset, height * 0.8f)
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(48.dp),
                        strokeWidth = 3.dp
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = if (language == Language.TELUGU) "వాతావరణ సమాచారం తెస్తున్నాం..." else "Fetching weather...",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 14.sp,
                        fontFamily = Mallanna
                    )
                } else if (error) {
                    Icon(Icons.Default.CloudOff, contentDescription = null, tint = Color.White, modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (language == Language.TELUGU) "సమాచారం అందుబాటులో లేదు" else "Weather unavailable",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontFamily = Ramabhadra
                    )
                    Button(
                        onClick = { retryTrigger++ },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.2f)),
                        modifier = Modifier.padding(top = 8.dp)
                    ) {
                        Text(if (language == Language.TELUGU) "మళ్ళీ ప్రయత్నించు" else "Retry", color = Color.White)
                    }
                } else {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = weatherType.icon,
                            contentDescription = null,
                            modifier = Modifier.size(90.dp),
                            tint = Color.White
                        )

                        Spacer(modifier = Modifier.width(16.dp))

                        Column {
                            Text(
                                text = "$temperature°C",
                                color = Color.White,
                                fontSize = 60.sp,
                                fontFamily = Ramabhadra,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (language == Language.TELUGU) weatherType.labelTe else weatherType.labelEn,
                                color = Color.White.copy(alpha = 0.9f),
                                fontSize = 20.sp,
                                fontFamily = Mallanna
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.Black.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        val currentTemp = weatherData?.temp
                        val feelsLike = currentTemp?.let { (it + 1.2).toInt().toString() } ?: "—"
                        WeatherDetailItem(Icons.Default.WaterDrop, stringResource(R.string.weather_humidity), humidity)
                        WeatherDetailItem(Icons.Default.Air, stringResource(R.string.weather_wind), "$windSpeed km/h")
                        WeatherDetailItem(Icons.Default.WbSunny, "UV", uvIndex)
                        WeatherDetailItem(Icons.Default.Thermostat, stringResource(R.string.weather_feels_like), "$feelsLike°")
                    }
                }
            }

            Text(
                text = if (weatherTime.isNotEmpty())
                    "Live • $weatherTime"
                else "Live Update",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 11.sp,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
            )
        }

        // CONTENT AREA
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.58f),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                Text(
                    text = headline,
                    fontSize = 22.sp,
                    fontFamily = Ramabhadra,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 30.sp,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                Text(
                    text = content,
                    fontSize = 18.sp,
                    fontFamily = Mallanna,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
                    lineHeight = 26.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(16.dp))

                // UPCOMING FORECAST SECTION - based on real temp
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.weather_upcoming),
                        fontSize = 14.sp,
                        fontFamily = Ramabhadra,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Alfa Weather",
                        fontSize = 10.sp,
                        fontFamily = Ramabhadra,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val forecasts = weatherData?.dailyForecast
                    if (forecasts != null && forecasts.size >= 3) {
                        // Real Forecasts
                        forecasts.take(3).forEachIndexed { index, forecast ->
                            val dayLabel = when(index) {
                                0 -> stringResource(R.string.weather_today)
                                1 -> stringResource(R.string.weather_tomorrow)
                                else -> if (language == Language.TELUGU) "ఎల్లుండి" else "Day After"
                            }
                            val icon = getWeatherIconForCode(forecast.code)
                            ForecastItem(
                                dayLabel,
                                icon,
                                "${forecast.maxTemp.toInt()}°",
                                "${forecast.minTemp.toInt()}°",
                                Modifier.weight(1f)
                            )
                        }
                    } else {
                        // Fallback Forecasts
                        val tempInt = weatherData?.temp?.toInt() ?: 32
                        ForecastItem(
                            stringResource(R.string.weather_today),
                            weatherType.icon,
                            "$tempInt°",
                            "${tempInt - 5}°",
                            Modifier.weight(1f)
                        )
                        ForecastItem(
                            stringResource(R.string.weather_tomorrow),
                            Icons.Default.WbCloudy,
                            "${tempInt + 1}°",
                            "${tempInt - 4}°",
                            Modifier.weight(1f)
                        )
                        ForecastItem(
                            if (language == Language.TELUGU) "ఎల్లుండి" else "Day After",
                            Icons.Default.CloudQueue,
                            "${tempInt - 1}°",
                            "${tempInt - 6}°",
                            Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun WeatherDetailItem(icon: ImageVector, label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(imageVector = icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
        Text(text = value, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Text(text = label, color = Color.White.copy(alpha = 0.7f), fontSize = 10.sp)
    }
}

@Composable
fun ForecastItem(day: String, icon: ImageVector, max: String, min: String, modifier: Modifier = Modifier) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
            .padding(8.dp)
    ) {
        Text(text = day, fontSize = 11.sp, fontFamily = Ramabhadra, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Icon(imageVector = icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp).padding(vertical = 4.dp))
        Row {
            Text(text = max, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = min, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

fun getWeatherIconForCode(code: Int): ImageVector {
    return when (code) {
        0 -> Icons.Default.WbSunny
        1, 2, 3 -> Icons.Default.WbCloudy
        45, 48 -> Icons.Default.Cloud
        61, 63, 65, 80, 81, 82 -> Icons.Default.Umbrella
        95, 96, 99 -> Icons.Default.Thunderstorm
        else -> Icons.Default.WbCloudy
    }
}

data class WeatherType(
    val icon: ImageVector,
    val colorStart: Color,
    val colorEnd: Color,
    val labelTe: String,
    val labelEn: String
) {
    companion object {
        val SUNNY = WeatherType(Icons.Default.WbSunny, Color(0xFFFFB300), Color(0xFFFF6F00), "ఎండగా ఉంది", "Sunny")
        val RAINY = WeatherType(Icons.Default.Umbrella, Color(0xFF1976D2), Color(0xFF0D47A1), "వర్షం పడే అవకాశం", "Rainy")
        val THUNDERSTORM = WeatherType(Icons.Default.Thunderstorm, Color(0xFF4527A0), Color(0xFF311B92), "పిడుగులతో కూడిన వర్షం", "Thunderstorm")
        val CLOUDY = WeatherType(Icons.Default.Cloud, Color(0xFF78909C), Color(0xFF455A64), "మేఘావృతం", "Cloudy")
        val PARTLY_CLOUDY = WeatherType(Icons.Default.WbCloudy, Color(0xFF00ACC1), Color(0xFF006064), "అక్కడక్కడ మేఘాలు", "Partly Cloudy")
    }
}
