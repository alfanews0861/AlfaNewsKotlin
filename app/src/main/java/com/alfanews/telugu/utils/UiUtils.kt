package com.alfanews.telugu.utils

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.luminance

/**
 * Glassmorphism effect for Jetpack Compose.
 */
fun Modifier.glassmorphism(
    cornerRadius: Dp = 16.dp,
    blurRadius: Dp = 12.dp,
    opacity: Float = 0.08f,
    borderOpacity: Float = 0.15f,
    shadowElevation: Dp = 8.dp
): Modifier = composed {
    val isBlurSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val isDark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    
    val baseColor = if (isDark) Color.Black else Color.White
    val accentColor = if (isDark) Color.White else Color.Black
    
    val computedOpacity = if (isDark) opacity * 1.5f else opacity
    val computedBorderOpacity = if (isDark) borderOpacity * 1.2f else borderOpacity
    
    this
        .shadow(
            elevation = shadowElevation,
            shape = RoundedCornerShape(cornerRadius),
            clip = false,
            ambientColor = Color.Black.copy(alpha = 0.2f),
            spotColor = Color.Black.copy(alpha = 0.2f)
        )
        .clip(RoundedCornerShape(cornerRadius))
        .background(
            Brush.verticalGradient(
                colors = listOf(
                    baseColor.copy(alpha = computedOpacity + 0.1f),
                    baseColor.copy(alpha = computedOpacity)
                )
            )
        )
        .border(
            width = 1.dp,
            brush = Brush.verticalGradient(
                colors = listOf(
                    accentColor.copy(alpha = computedBorderOpacity),
                    accentColor.copy(alpha = computedBorderOpacity - 0.05f)
                )
            ),
            shape = RoundedCornerShape(cornerRadius)
        )
}

object UiUtils {
    // Keep object for other utils if any
}

