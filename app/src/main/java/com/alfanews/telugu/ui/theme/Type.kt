package com.alfanews.telugu.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R

/**
 * Modern, Sharp Typography
 * Combining Poppins for UI elements and optimized Telugu fonts for readability.
 */

val Poppins = FontFamily(
    Font(R.font.poppins_regular, FontWeight.Normal),
    Font(R.font.poppins_bold, FontWeight.Bold),
    Font(R.font.poppins_semibold, FontWeight.SemiBold)
)

val Ramabhadra = FontFamily(
    Font(R.font.ramabhadra_regular)
)

val Mallanna = FontFamily(
    Font(R.font.mallanna_regular)
)

// Sharp typography with optimized letter spacing and line heights
val Typography = Typography(
    headlineLarge = TextStyle(
        fontFamily = Ramabhadra,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 42.sp,
        letterSpacing = (-0.5).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = Ramabhadra,
        fontWeight = FontWeight.SemiBold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        letterSpacing = (-0.2).sp
    ),
    headlineSmall = TextStyle(
        fontFamily = Ramabhadra,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        letterSpacing = 0.sp
    ),
    titleLarge = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp
    ),
    titleMedium = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 26.sp,
        letterSpacing = 0.15.sp
    ),
    titleSmall = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.1.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = Mallanna,
        fontWeight = FontWeight.Normal,
        fontSize = 17.sp, // Slightly reduced
        lineHeight = 24.sp, // Reduced line gap
        letterSpacing = 0.25.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = Mallanna,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp, // Slightly reduced
        lineHeight = 20.sp, // Reduced line gap
        letterSpacing = 0.25.sp
    ),
    bodySmall = TextStyle(
        fontFamily = Mallanna,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp, // Slightly reduced
        lineHeight = 18.sp, // Reduced line gap
        letterSpacing = 0.4.sp
    ),
    labelLarge = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),
    labelMedium = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    )
)
