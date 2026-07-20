package com.alfanews.telugu.views

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.compose.ui.tooling.preview.Preview
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.WeatherService
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.PreferenceManager
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

/**
 * వాతావరణ కార్డ్ - పూర్తి redesign మరియు bug fixes తో.
 * Premium glassmorphism UI with correct API data handling.
 */
@Composable
fun WeatherCardView(
    post: NewsPost,
    language: Language,
    modifier: Modifier = Modifier,
    onLocationRequest: () -> Unit = {},
    showTopHeader: Boolean = true
) {
    val context = LocalContext.current
    val headline = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
    val content = if (language == Language.TELUGU) post.content.telugu else post.content.english

    // ✅ FIX: Read live GPS coords directly from prefs, not stale post.latitude/longitude.
    // post coords were set at loadNews time — if user moved or GPS updated later, those are stale.
    val prefs = remember { PreferenceManager.getInstance(context) }

    // State
    var weatherData by remember { mutableStateOf<WeatherService.WeatherData?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var hasError by remember { mutableStateOf(false) }
    var retryTrigger by remember { mutableStateOf(0) }

    val hasLocationPermission = remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    // ✅ FIX: Prefer live prefs coords over stale post coords, unless user manually selected a different district
    val isManualDistrict = prefs.selectedDistrict != null && prefs.selectedDistrict != prefs.detectedDistrict
    val liveLat = if (isManualDistrict) null else prefs.lastLat.takeIf { it != 0.0 }
    val liveLon = if (isManualDistrict) null else prefs.lastLon.takeIf { it != 0.0 }
    val effectiveLat = liveLat ?: post.latitude
    val effectiveLon = liveLon ?: post.longitude
    val effectiveLocation = if (liveLat != null) (prefs.localPlace ?: post.location) else post.location

    val isUsingGPS = weatherData?.isPrecise == true || (liveLat != null)

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasLocationPermission.value = isGranted
        if (isGranted) {
            onLocationRequest()
            retryTrigger++
        }
    }

    // ✅ FIX: Use effectiveLat/Lon (live prefs) instead of post.latitude/longitude
    // This means weather re-fetches whenever GPS coords change in prefs
    LaunchedEffect(effectiveLocation, effectiveLat, effectiveLon, retryTrigger) {
        isLoading = true
        hasError = false
        try {
            val data = WeatherService.fetchWeather(effectiveLocation, effectiveLat, effectiveLon)
            weatherData = data
            hasError = data == null
        } catch (e: Exception) {
            hasError = true
        }
        isLoading = false
    }

    val isDay = weatherData?.isDay ?: true
    val realWeatherCode = weatherData?.code

    // Weather type
    val weatherType = remember(realWeatherCode, headline, isDay) {
        val type = when {
            realWeatherCode != null -> when (realWeatherCode) {
                0 -> WeatherType.SUNNY
                1, 2, 3 -> WeatherType.PARTLY_CLOUDY
                45, 48 -> WeatherType.FOGGY
                51, 53, 55 -> WeatherType.DRIZZLE
                61, 63, 65, 80, 81, 82 -> WeatherType.RAINY
                95, 96, 99 -> WeatherType.THUNDERSTORM
                else -> WeatherType.PARTLY_CLOUDY
            }
            headline.contains("ఎండ", ignoreCase = true) ||
            headline.contains("Sunny", ignoreCase = true) ||
            headline.contains("Clear", ignoreCase = true) -> WeatherType.SUNNY
            headline.contains("వర్షం", ignoreCase = true) ||
            headline.contains("Rain", ignoreCase = true) -> WeatherType.RAINY
            headline.contains("పిడుగు", ignoreCase = true) ||
            headline.contains("Thunder", ignoreCase = true) -> WeatherType.THUNDERSTORM
            headline.contains("మేఘావృతం", ignoreCase = true) ||
            headline.contains("Cloudy", ignoreCase = true) -> WeatherType.PARTLY_CLOUDY
            else -> WeatherType.PARTLY_CLOUDY
        }
        if (!isDay && type == WeatherType.SUNNY) WeatherType.CLEAR_NIGHT
        else if (!isDay && type == WeatherType.PARTLY_CLOUDY) WeatherType.CLOUDY_NIGHT
        else type
    }

    // Temperature
    val temperature = remember(weatherData, headline) {
        val d = weatherData
        if (d != null) d.temp.toInt().toString()
        else Regex("(\\d+)°C").find(headline)?.groupValues?.get(1) ?: "--"
    }
    val windSpeed = weatherData?.wind?.toInt()?.toString() ?: "--"
    val humidity = weatherData?.humidity?.let { "$it%" } ?: "--"
    val uvIndex = weatherData?.uvIndex?.let { String.format(Locale.getDefault(), "%.1f", it) } ?: "--"
    val feelsLike = when {
        weatherData?.feelsLike != null -> weatherData?.feelsLike?.toInt().toString()
        weatherData?.temp != null -> {
            val h = (weatherData?.humidity ?: 50)
            val t = weatherData?.temp!!
            val hi = t + (0.33 * (h / 100.0 * 6.105) - 0.7)
            hi.toInt().toString()
        }
        else -> "--"
    }
    val weatherTime = weatherData?.time?.let { WeatherService.formatTime(it) } ?: ""

    // Animations
    val infiniteTransition = rememberInfiniteTransition(label = "weather_anim")
    val animPhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(8000, easing = LinearEasing)
        ),
        label = "anim_phase"
    )
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // GPS Banner
        if (!isUsingGPS && !isLoading) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                weatherType.colorStart.copy(alpha = 0.15f),
                                weatherType.colorEnd.copy(alpha = 0.08f)
                            )
                        )
                    )
                    .clickable {
                        if (hasLocationPermission.value) {
                            onLocationRequest(); retryTrigger++
                        } else {
                            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        }
                    }
                    .padding(horizontal = 16.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Rounded.MyLocation,
                    contentDescription = null,
                    tint = weatherType.colorStart,
                    modifier = Modifier.size(13.dp)
                )
                Text(
                    text = if (language == Language.TELUGU)
                        "ఖచ్చితమైన వాతావరణం కోసం GPS అనుమతించండి"
                    else "Tap to enable GPS for precise weather",
                    fontSize = 11.sp,
                    fontFamily = Mallanna,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f),
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    Icons.Rounded.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                    modifier = Modifier.size(13.dp)
                )
            }
            HorizontalDivider(thickness = 0.5.dp, color = weatherType.colorStart.copy(alpha = 0.2f))
        }

        // App Header
        if (showTopHeader) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("alfa", fontSize = 26.sp, fontFamily = Ramabhadra, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Text("news", fontSize = 26.sp, fontFamily = Ramabhadra, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.weight(1f))
                Icon(Icons.Rounded.LocationOn, contentDescription = null, modifier = Modifier.size(14.dp), tint = weatherType.colorStart)
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = effectiveLocation,
                    fontSize = 13.sp,
                    fontFamily = Ramabhadra,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                )
            }
        }

        // ═══════════════════════════════════════════
        // WEATHER GRAPHIC AREA - Premium Design
        // ═══════════════════════════════════════════
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.45f)
        ) {
            // Animated gradient background
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = size.width
                val h = size.height

                // Main gradient background
                drawRect(
                    brush = Brush.verticalGradient(
                        colors = listOf(weatherType.colorStart, weatherType.colorEnd),
                        startY = 0f,
                        endY = h
                    )
                )

                // Animated floating orbs
                val orb1X = w * 0.15f + (sin(animPhase.toDouble()) * w * 0.08f).toFloat()
                val orb1Y = h * 0.25f + (cos(animPhase.toDouble()) * h * 0.06f).toFloat()
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.18f), Color.Transparent),
                        center = Offset(orb1X, orb1Y),
                        radius = w * 0.45f
                    ),
                    radius = w * 0.45f,
                    center = Offset(orb1X, orb1Y)
                )

                val orb2X = w * 0.85f + (cos(animPhase.toDouble()) * w * 0.05f).toFloat()
                val orb2Y = h * 0.7f + (sin(animPhase.toDouble()) * h * 0.08f).toFloat()
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.12f), Color.Transparent),
                        center = Offset(orb2X, orb2Y),
                        radius = w * 0.35f
                    ),
                    radius = w * 0.35f,
                    center = Offset(orb2X, orb2Y)
                )

                // Bottom wave overlay
                drawRect(
                    brush = Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.12f)),
                        startY = h * 0.6f,
                        endY = h
                    )
                )
            }

            if (isLoading) {
                // Loading state
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(40.dp),
                        strokeWidth = 3.dp,
                        trackColor = Color.White.copy(alpha = 0.25f)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = if (language == Language.TELUGU) "వాతావరణ సమాచారం తెస్తున్నాం..." else "Fetching weather data...",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                        fontFamily = Mallanna
                    )
                }
            } else if (hasError) {
                // Error state
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Rounded.CloudOff, contentDescription = null, tint = Color.White, modifier = Modifier.size(32.dp))
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = if (language == Language.TELUGU) "సమాచారం అందుబాటులో లేదు" else "Weather data unavailable",
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 15.sp,
                        fontFamily = Ramabhadra
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { retryTrigger++ },
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.6f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (language == Language.TELUGU) "మళ్ళీ ప్రయత్నించు" else "Retry", fontFamily = Mallanna)
                    }
                }
            } else {
                // MAIN WEATHER DISPLAY
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    // Top row: Location + time
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Rounded.LocationOn,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.9f),
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = effectiveLocation,
                                color = Color.White.copy(alpha = 0.9f),
                                fontSize = 13.sp,
                                fontFamily = Ramabhadra
                            )
                        }
                        // Live badge
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.2f))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF4CAF50))
                            )
                            Text(
                                text = if (weatherTime.isNotEmpty()) "Live • $weatherTime" else "Live",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontFamily = Ramabhadra
                            )
                        }
                    }

                    // Center: Big temperature + icon
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        // Weather icon with glow
                        Box(contentAlignment = Alignment.Center) {
                            // Glow circle behind icon
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.12f))
                            )
                            Icon(
                                imageVector = weatherType.icon,
                                contentDescription = null,
                                modifier = Modifier.size(56.dp),
                                tint = Color.White
                            )
                        }

                        Spacer(modifier = Modifier.width(20.dp))

                        Column {
                            Text(
                                text = "$temperature°C",
                                color = Color.White,
                                fontSize = 58.sp,
                                fontFamily = Ramabhadra,
                                fontWeight = FontWeight.Bold,
                                style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))
                            )
                            Text(
                                text = if (language == Language.TELUGU) weatherType.labelTe else weatherType.labelEn,
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 16.sp,
                                fontFamily = Mallanna
                            )
                        }
                    }

                    // Bottom: Stats row with glassmorphism
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.Black.copy(alpha = 0.18f))
                            .padding(vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        WeatherStatItem(Icons.Rounded.WaterDrop, stringResource(R.string.weather_humidity), humidity)
                        WeatherStatDivider()
                        WeatherStatItem(Icons.Rounded.Air, stringResource(R.string.weather_wind), "$windSpeed km/h")
                        WeatherStatDivider()
                        WeatherStatItem(Icons.Rounded.WbSunny, "UV", uvIndex)
                        WeatherStatDivider()
                        WeatherStatItem(Icons.Rounded.Thermostat, stringResource(R.string.weather_feels_like), "$feelsLike°")
                    }
                }
            }
        }

        // ═══════════════════════════════════════════
        // CONTENT AREA - News + Forecast
        // ═══════════════════════════════════════════
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.55f),
            color = MaterialTheme.colorScheme.background
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 18.dp, vertical = 14.dp)
            ) {
                // Headline
                Text(
                    text = headline,
                    fontSize = 21.sp,
                    fontFamily = Ramabhadra,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 28.sp,
                    modifier = Modifier.padding(bottom = 8.dp),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )

                // Content text
                Text(
                    text = content,
                    fontSize = 17.sp,
                    fontFamily = Mallanna,
                    style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                    lineHeight = 25.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Forecast section header
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height(14.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(weatherType.colorStart)
                        )
                        Text(
                            text = stringResource(R.string.weather_upcoming),
                            fontSize = 13.sp,
                            fontFamily = Ramabhadra,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Text(
                        text = "Alfa Weather",
                        fontSize = 10.sp,
                        fontFamily = Ramabhadra,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                    )
                }

                // Forecast cards
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val forecasts = weatherData?.dailyForecast
                    if (forecasts != null && forecasts.size >= 3) {
                        forecasts.take(3).forEachIndexed { index, forecast ->
                            val dayLabel = when (index) {
                                0 -> stringResource(R.string.weather_today)
                                1 -> stringResource(R.string.weather_tomorrow)
                                else -> if (language == Language.TELUGU) "ఎల్లుండి" else "Day After"
                            }
                            PremiumForecastItem(
                                day = dayLabel,
                                icon = getWeatherIconForCode(forecast.code),
                                max = "${forecast.maxTemp.toInt()}°",
                                min = "${forecast.minTemp.toInt()}°",
                                accentColor = weatherType.colorStart,
                                isToday = index == 0,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    } else {
                        val tempInt = weatherData?.temp?.toInt() ?: 32
                        PremiumForecastItem(
                            day = stringResource(R.string.weather_today),
                            icon = weatherType.icon,
                            max = "$tempInt°", min = "${tempInt - 5}°",
                            accentColor = weatherType.colorStart, isToday = true,
                            modifier = Modifier.weight(1f)
                        )
                        PremiumForecastItem(
                            day = stringResource(R.string.weather_tomorrow),
                            icon = Icons.Rounded.WbCloudy,
                            max = "${tempInt + 1}°", min = "${tempInt - 4}°",
                            accentColor = weatherType.colorStart, isToday = false,
                            modifier = Modifier.weight(1f)
                        )
                        PremiumForecastItem(
                            day = if (language == Language.TELUGU) "ఎల్లుండి" else "Day After",
                            icon = Icons.Rounded.Cloud,
                            max = "${tempInt - 1}°", min = "${tempInt - 6}°",
                            accentColor = weatherType.colorStart, isToday = false,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

// ─── Sub-components ───────────────────────────────────────

@Composable
private fun WeatherStatItem(icon: ImageVector, label: String, value: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = Color.White.copy(alpha = 0.9f), modifier = Modifier.size(17.dp))
        Text(text = value, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = Ramabhadra)
        Text(text = label, color = Color.White.copy(alpha = 0.65f), fontSize = 9.sp, fontFamily = Mallanna)
    }
}

@Composable
private fun WeatherStatDivider() {
    Box(
        modifier = Modifier
            .width(0.5.dp)
            .height(36.dp)
            .background(Color.White.copy(alpha = 0.2f))
    )
}

@Composable
fun PremiumForecastItem(
    day: String,
    icon: ImageVector,
    max: String,
    min: String,
    accentColor: Color,
    isToday: Boolean,
    modifier: Modifier = Modifier
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (isToday) accentColor.copy(alpha = 0.12f)
                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            )
            .then(
                if (isToday) Modifier // extra styling for today
                else Modifier
            )
            .padding(vertical = 10.dp, horizontal = 6.dp)
    ) {
        Text(
            text = day,
            fontSize = 10.sp,
            fontFamily = Ramabhadra,
            color = if (isToday) accentColor else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal
        )
        Spacer(modifier = Modifier.height(6.dp))
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isToday) accentColor else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            modifier = Modifier.size(22.dp)
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = max,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = Ramabhadra,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = min,
            fontSize = 11.sp,
            fontFamily = Ramabhadra,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
        )
    }
}

// ─── Helpers ──────────────────────────────────────────────

fun getWeatherIconForCode(code: Int): ImageVector {
    return when (code) {
        0 -> Icons.Rounded.WbSunny
        1, 2, 3 -> Icons.Rounded.WbCloudy
        45, 48 -> Icons.Rounded.Cloud
        51, 53, 55 -> Icons.Rounded.Grain
        61, 63, 65, 80, 81, 82 -> Icons.Rounded.Umbrella
        95, 96, 99 -> Icons.Rounded.Thunderstorm
        else -> Icons.Rounded.WbCloudy
    }
}

// ─── WeatherType with expanded palette ────────────────────

data class WeatherType(
    val icon: ImageVector,
    val colorStart: Color,
    val colorEnd: Color,
    val labelTe: String,
    val labelEn: String
) {
    companion object {
        val SUNNY = WeatherType(
            Icons.Rounded.WbSunny,
            Color(0xFFFFB300), Color(0xFFE65100),
            "ఎండగా ఉంది", "Sunny"
        )
        val PARTLY_CLOUDY = WeatherType(
            Icons.Rounded.WbCloudy,
            Color(0xFF26C6DA), Color(0xFF00838F),
            "అక్కడక్కడ మేఘాలు", "Partly Cloudy"
        )
        val RAINY = WeatherType(
            Icons.Rounded.Umbrella,
            Color(0xFF1E88E5), Color(0xFF0D47A1),
            "వర్షం పడే అవకాశం", "Rainy"
        )
        val THUNDERSTORM = WeatherType(
            Icons.Rounded.Thunderstorm,
            Color(0xFF5E35B1), Color(0xFF1A237E),
            "పిడుగులతో కూడిన వర్షం", "Thunderstorm"
        )
        val FOGGY = WeatherType(
            Icons.Rounded.Cloud,
            Color(0xFF78909C), Color(0xFF37474F),
            "పొగమంచు", "Foggy"
        )
        val DRIZZLE = WeatherType(
            Icons.Rounded.Grain,
            Color(0xFF42A5F5), Color(0xFF1565C0),
            "చినుకులు పడుతున్నాయి", "Drizzle"
        )
        val CLEAR_NIGHT = WeatherType(
            Icons.Rounded.NightsStay,
            Color(0xFF1A237E), Color(0xFF000051),
            "నిర్మలమైన రాత్రి", "Clear Night"
        )
        val CLOUDY_NIGHT = WeatherType(
            Icons.Rounded.NightsStay,
            Color(0xFF37474F), Color(0xFF102027),
            "మేఘావృత రాత్రి", "Cloudy Night"
        )
    }
}

@Preview(showBackground = true)
@Composable
fun WeatherCardPreview() {
    val mockPost = com.alfanews.telugu.models.NewsPost(
        id = "weather_mock",
        headline = com.alfanews.telugu.models.Headline(
            telugu = "32°C హైదరాబాద్ వాతావరణం: ఆకాశం నిర్మలంగా ఉంది",
            english = "32°C Hyderabad Weather"
        ),
        content = com.alfanews.telugu.models.Content(
            telugu = "నేడు హైదరాబాద్ లో వాతావరణం ఆకాశం నిర్మలంగా ఉంది. ప్రస్తుత ఉష్ణోగ్రత 32°C గా ఉంది. గాలి వేగం గంటకు 12 కిలోమీటర్లు.",
            english = "Current weather update for Hyderabad."
        ),
        location = "హైదరాబాద్",
        type = "weather"
    )
    
    MaterialTheme {
        WeatherCardView(
            post = mockPost,
            language = com.alfanews.telugu.models.Language.TELUGU,
            modifier = Modifier.fillMaxSize()
        )
    }
}
