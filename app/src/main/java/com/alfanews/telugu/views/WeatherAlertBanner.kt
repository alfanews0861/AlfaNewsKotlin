package com.alfanews.telugu.views

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.WeatherAlert
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra

@Composable
fun WeatherAlertBanner(
    alert: WeatherAlert,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor = when (alert.severity) {
        "SEVERE" -> Color(0xFFD32F2F) 
        "WARNING" -> Color(0xFFF57C00) 
        else -> Color(0xFF1976D2) 
    }

    AnimatedVisibility(
        visible = true,
        enter = expandVertically(),
        exit = shrinkVertically()
    ) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(bgColor)
                .clickable { }
                .padding(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = alert.title,
                        color = Color.White,
                        fontSize = 15.sp,
                        fontFamily = Ramabhadra,
                        fontWeight = FontWeight.Bold
                    )
                    if (alert.body.isNotEmpty()) {
                        Text(
                            text = alert.body,
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 13.sp,
                            fontFamily = Mallanna,
                            lineHeight = 18.sp
                        )
                    }
                }

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Dismiss",
                        tint = Color.White.copy(alpha = 0.7f),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}
