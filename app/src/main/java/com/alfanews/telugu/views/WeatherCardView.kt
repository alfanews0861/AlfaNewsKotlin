package com.alfanews.telugu.views

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra
import java.util.*

/**
 * వాతావరణం వివరాలను అందమైన గ్రాఫిక్‌తో ప్రదర్శించే కార్డ్.
 */
@Composable
fun WeatherCardView(
    post: NewsPost,
    language: Language,
    modifier: Modifier = Modifier
) {
    val headline = if (language == Language.TELUGU) post.headline.telugu else post.headline.english
    val content = if (language == Language.TELUGU) post.content.telugu else post.content.english
    
    // వాతావరణ రకాన్ని గుర్తించడం (హెడ్‌లైన్ ఆధారంగా సింపుల్ లాజిక్)
    val weatherType = remember(headline) {
        when {
            headline.contains("ఎండ", true) || headline.contains("Sunny", true) -> WeatherType.SUNNY
            headline.contains("వర్షం", true) || headline.contains("Rain", true) -> WeatherType.RAINY
            headline.contains("మేఘావృతం", true) || headline.contains("Cloudy", true) -> WeatherType.CLOUDY
            else -> WeatherType.PARTLY_CLOUDY
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
    ) {
        // HEADER - App Name (Matches NewsCardView)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .padding(horizontal = 16.dp),
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
        }

        // WEATHER GRAPHIC AREA (Replacing News Image)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.38f)
                .background(weatherType.backgroundColor)
        ) {
            // Background Canvas for decorative elements
            Canvas(modifier = Modifier.fillMaxSize()) {
                val width = size.width
                val height = size.height
                
                // Draw some decorative circles/glows
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.2f), Color.Transparent),
                        center = Offset(width * 0.8f, height * 0.2f),
                        radius = width * 0.4f
                    ),
                    radius = width * 0.4f,
                    center = Offset(width * 0.8f, height * 0.2f)
                )
            }

            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = weatherType.icon,
                    contentDescription = null,
                    modifier = Modifier.size(100.dp),
                    tint = Color.White
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = post.location,
                    color = Color.White,
                    fontSize = 20.sp,
                    fontFamily = Ramabhadra,
                    fontWeight = FontWeight.Bold
                )
            }
            
            // Bottom gradient to blend into content
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.4f)),
                            startY = 300f
                        )
                    )
            )
            
            Text(
                text = stringResource(id = R.string.weather_report_label),
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 12.sp,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
            )
        }

        // CONTENT AREA
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.62f),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 2.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                Text(
                    text = headline,
                    fontSize = 22.sp,
                    fontFamily = Ramabhadra,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 30.sp,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 8.dp),
                    thickness = 1.dp,
                    color = MaterialTheme.colorScheme.outlineVariant
                )

                Text(
                    text = content,
                    fontSize = 18.sp,
                    fontFamily = Mallanna,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 26.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                )
                
                // Footer
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Alfa Weather Service",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}

enum class WeatherType(
    val icon: ImageVector,
    val backgroundColor: Color
) {
    SUNNY(Icons.Default.WbSunny, Color(0xFFFFB300)),
    RAINY(Icons.Default.Umbrella, Color(0xFF1976D2)),
    CLOUDY(Icons.Default.Cloud, Color(0xFF78909C)),
    PARTLY_CLOUDY(Icons.Default.WbCloudy, Color(0xFF00ACC1))
}
