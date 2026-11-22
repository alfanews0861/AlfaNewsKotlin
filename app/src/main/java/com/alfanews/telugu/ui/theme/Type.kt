package com.alfanews.telugu.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.Font as GoogleFontImpl
import androidx.compose.ui.text.googlefonts.GoogleFont
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language

/**
 * Multi-Script Rounded Typography (ZERO BOLD POLICY)
 *
 * Matches Ramabhadra (rounded display headlines) + Mallanna (compact rounded reading body)
 * across all 5 scripts using Ek Type / Google Fonts — NEVER generic Noto Sans, ZERO Bold weights:
 * - Telugu (te):   Ramabhadra + Mallanna (bundled TTF, weight 400)
 * - Hindi (hi):    Baloo 2 + Hind (downloadable, weight 400 only)
 * - Punjabi (pa):  Baloo Paaji 2 + Mukta Mahee (downloadable, weight 400 only)
 * - Gujarati (gu): Baloo Bhai 2 + Hind Vadodara (downloadable, weight 400 only)
 * - English (en):  Baloo 2 + Poppins Regular (weight 400 only)
 */

private val GoogleFontsProvider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs
)

// Regular weight ONLY across all families (ZERO BOLD rule)
val Poppins = FontFamily(
    Font(R.font.poppins_regular, FontWeight.Normal)
)

val Ramabhadra = FontFamily(
    Font(R.font.ramabhadra_regular, FontWeight.Normal)
)

val Mallanna = FontFamily(
    Font(R.font.mallanna_regular, FontWeight.Normal)
)

// Hindi / Devanagari (Ek Type Rounded)
val Baloo2 = FontFamily(
    GoogleFontImpl(
        googleFont = GoogleFont("Baloo 2"),
        fontProvider = GoogleFontsProvider,
        weight = FontWeight.Normal
    )
)

val HindBody = FontFamily(
    GoogleFontImpl(
        googleFont = GoogleFont("Hind"),
        fontProvider = GoogleFontsProvider,
        weight = FontWeight.Normal
    )
)

// Punjabi / Gurmukhi (Ek Type Rounded)
val BalooPaaji2 = FontFamily(
    GoogleFontImpl(
        googleFont = GoogleFont("Baloo Paaji 2"),
        fontProvider = GoogleFontsProvider,
        weight = FontWeight.Normal
    )
)

val MuktaMaheeBody = FontFamily(
    GoogleFontImpl(
        googleFont = GoogleFont("Mukta Mahee"),
        fontProvider = GoogleFontsProvider,
        weight = FontWeight.Normal
    )
)

// Gujarati (Ek Type Rounded)
val BalooBhai2 = FontFamily(
    GoogleFontImpl(
        googleFont = GoogleFont("Baloo Bhai 2"),
        fontProvider = GoogleFontsProvider,
        weight = FontWeight.Normal
    )
)

val HindVadodaraBody = FontFamily(
    GoogleFontImpl(
        googleFont = GoogleFont("Hind Vadodara"),
        fontProvider = GoogleFontsProvider,
        weight = FontWeight.Normal
    )
)

fun getHeadlineFontFamily(language: Language): FontFamily = when (language) {
    Language.TELUGU -> Ramabhadra
    Language.HINDI -> Baloo2
    Language.PUNJABI -> BalooPaaji2
    Language.GUJARATI -> BalooBhai2
    Language.ENGLISH -> Baloo2
}

fun getBodyFontFamily(language: Language): FontFamily = when (language) {
    Language.TELUGU -> Mallanna
    Language.HINDI -> HindBody
    Language.PUNJABI -> MuktaMaheeBody
    Language.GUJARATI -> HindVadodaraBody
    Language.ENGLISH -> Poppins
}

// Strict ZERO BOLD typography scale (FontWeight.Normal everywhere)
val Typography = Typography(
    headlineLarge = TextStyle(
        fontFamily = Ramabhadra,
        fontWeight = FontWeight.Normal,
        fontSize = 32.sp,
        lineHeight = 42.sp,
        letterSpacing = (-0.5).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = Ramabhadra,
        fontWeight = FontWeight.Normal,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        letterSpacing = (-0.2).sp
    ),
    headlineSmall = TextStyle(
        fontFamily = Ramabhadra,
        fontWeight = FontWeight.Normal,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        letterSpacing = 0.sp
    ),
    titleLarge = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Normal,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp
    ),
    titleMedium = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Normal,
        fontSize = 18.sp,
        lineHeight = 26.sp,
        letterSpacing = 0.15.sp
    ),
    titleSmall = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.1.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = Mallanna,
        fontWeight = FontWeight.Normal,
        fontSize = 17.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.25.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = Mallanna,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp
    ),
    bodySmall = TextStyle(
        fontFamily = Mallanna,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.4.sp
    ),
    labelLarge = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),
    labelMedium = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily = Poppins,
        fontWeight = FontWeight.Normal,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    )
)
