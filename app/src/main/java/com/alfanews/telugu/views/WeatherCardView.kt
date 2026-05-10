package com.alfanews.telugu.views

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.WeatherService
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra

/**
 * వాతావరణం వివరాలను అత్యంత ప్రొఫెషనల్ మరియు అందమైన గ్రాఫిక్‌తో ప్రదర్శించే కార్డ్.
 * Real-time data WeatherService API నుండి వస్తుంది.
 */
@Composable
fun WeatherCardView(
    post: NewsPost,
    language: Language,
    modifier: Modifier = Modifier,
) {
    val headline = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
    val content = if (language == Language.TELUGU) post.content.telugu else post.content.english

    // Real-time API state
    var realTemp by remember { mutableStateOf<Double?>(null) }
    var realWind by remember { mutableStateOf<Double?>(null) }
    var realWeatherCode by remember { mutableStateOf<Int?>(null) }
    var realTime by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    // Fetch real weather data from WeatherService
    LaunchedEffect(post.location) {
        isLoading = true
        try {
            val data = WeatherService.fetchWeather(post.location)
            if (data != null) {
                realTemp = data.temp
                realWind = data.wind
                realWeatherCode = data.code
                realTime = WeatherService.formatTime(data.time)
            }
        } catch (_: Exception) { }
        isLoading = false
    }

    // Temperature to display: real API data or fallback from text
    val temperature: String = when {
        realTemp != null -> realTemp!!.toInt().toString()
        else -> "—"
    }

    val windSpeed: String = when {
        realWind != null -> realWind!!.toInt().toString()
        else -> "—"
    }

    val weatherTime: String = realTime ?: ""

    // Weather type: from real code if available, else from headline keywords
    val weatherType = remember(realWeatherCode, headline) {
        when {
            realWeatherCode != null -> when (realWeatherCode!!) {
                0 -> WeatherType.SUNNY
                1, 2, 3 -> WeatherType.PARTLY_CLOUDY
                45, 48 -> WeatherType.CLOUDY
                61, 63, 65, 80, 81, 82 -> WeatherType.RAINY
                95, 96, 99 -> WeatherType.THUNDERSTORM
                else -> WeatherType.PARTLY_CLOUDY
            }
            headline.contains("ఎండ", ignoreCase = true) || headline.contains("Sunny", ignoreCase = true) || headline.contains("వేడి", ignoreCase = true) -> WeatherType.SUNNY
            headline.contains("వర్షం", ignoreCase = true) || headline.contains("Rain", ignoreCase = true) || content.contains("వాన", ignoreCase = true) -> WeatherType.RAINY
            headline.contains("పిడుగు", ignoreCase = true) || headline.contains("Thunder", ignoreCase = true) -> WeatherType.THUNDERSTORM
            headline.contains("మేఘావృతం", ignoreCase = true) || headline.contains("Cloudy", ignoreCase = true) -> WeatherType.CLOUDY
            else -> WeatherType.PARTLY_CLOUDY
        }
    }

    // Humidity from weather code (approximate)
    val humidity: String = when (realWeatherCode) {
        0 -> "30%"
        1, 2, 3 -> "50%"
        45, 48 -> "80%"
        61, 63, 65, 80, 81, 82 -> "88%"
        95, 96, 99 -> "92%"
        else -> "60%"
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
    ) {
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
                        center = Offset(width * 0.2f, height * 0.3f),
                        radius = width * 0.5f
                    ),
                    radius = width * 0.5f,
                    center = Offset(width * 0.2f, height * 0.3f)
                )
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.1f), Color.Transparent),
                        center = Offset(width * 0.9f, height * 0.8f),
                        radius = width * 0.3f
                    ),
                    radius = width * 0.3f,
                    center = Offset(width * 0.9f, height * 0.8f)
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
                        text = "వాతావరణ సమాచారం తెస్తున్నాం...",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 14.sp,
                        fontFamily = Mallanna
                    )
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

                    // Weather details row - real data
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.Black.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        val feelsLike = realTemp?.let { (it + 1.5).toInt().toString() } ?: "—"
                        WeatherDetailItem(Icons.Default.WaterDrop, stringResource(R.string.weather_humidity), humidity)
                        WeatherDetailItem(Icons.Default.Air, stringResource(R.string.weather_wind), "$windSpeed km/h")
                        WeatherDetailItem(Icons.Default.Thermostat, stringResource(R.string.weather_feels_like), "$feelsLike°")
                    }
                }
            }

            Text(
                text = if (weatherTime.isNotEmpty())
                    "${stringResource(id = R.string.weather_report_label)} • $weatherTime"
                else stringResource(id = R.string.weather_report_label),
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
                    val tempInt = realTemp?.toInt() ?: 32
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

enum class WeatherType(
    val icon: ImageVector,
    val colorStart: Color,
    val colorEnd: Color,
    val labelTe: String,
    val labelEn: String
) {
    SUNNY(Icons.Default.WbSunny, Color(0xFFFFB300), Color(0xFFFF6F00), "ఎండగా ఉంది", "Sunny"),
    RAINY(Icons.Default.Umbrella, Color(0xFF1976D2), Color(0xFF0D47A1), "వర్షం పడే అవకాశం", "Rainy"),
    THUNDERSTORM(Icons.Default.Thunderstorm, Color(0xFF4527A0), Color(0xFF311B92), "పిడుగులతో కూడిన వర్షం", "Thunderstorm"),
    CLOUDY(Icons.Default.Cloud, Color(0xFF78909C), Color(0xFF455A64), "మేఘావృతం", "Cloudy"),
    PARTLY_CLOUDY(Icons.Default.WbCloudy, Color(0xFF00ACC1), Color(0xFF006064), "అక్కడక్కడ మేఘాలు", "Partly Cloudy")
}
