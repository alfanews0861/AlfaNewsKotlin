package com.alfanews.telugu.views

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra

/**
 * 🛡️ 100% WATERTIGHT MANDATORY FULL-SCREEN FORCE UPDATE SCREEN:
 * 
 * When minimum required version in Firestore (settings/android_config.min_version_code)
 * is greater than the installed app's BuildConfig.VERSION_CODE:
 * 
 * - Completely intercepts root navigation.
 * - Suppresses all Firestore news queries (0 reads, 0 egress).
 * - Non-dismissible: Back press closes the app cleanly via finishAffinity().
 * - Direct one-tap deep link to Google Play Store update page.
 */
@Composable
fun MandatoryUpdateScreen(
    currentVersionName: String,
    onUpdateClick: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity

    // 🔒 Back-press handler: Exits app cleanly, never leaks into news feed
    BackHandler {
        activity?.finishAffinity()
    }

    val infiniteTransition = rememberInfiniteTransition(label = "pulse_transition")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.12f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF030A1A),
            Color(0xFF0B1938),
            Color(0xFF020612)
        )
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush = backgroundBrush),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 36.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // 1. App Header
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 16.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "alfa",
                        color = Color.White,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.Bold,
                        fontSize = 38.sp
                    )
                    Text(
                        text = "news",
                        color = Color(0xFFE53935),
                        fontFamily = Poppins,
                        fontWeight = FontWeight.Bold,
                        fontSize = 38.sp
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "తెలుగు వార్తా ప్రపంచం",
                    color = Color.White.copy(alpha = 0.65f),
                    fontFamily = Ramabhadra,
                    fontSize = 14.sp
                )
            }

            // 2. Central Update Card
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(vertical = 24.dp)
            ) {
                // Glowing pulsating icon
                Box(
                    modifier = Modifier
                        .size(110.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .background(Color(0xFFE53935).copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFE53935)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.SystemUpdate,
                            contentDescription = "Update Required",
                            tint = Color.White,
                            modifier = Modifier.size(44.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Urgent Status Badge
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xFFD32F2F).copy(alpha = 0.25f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE53935).copy(alpha = 0.6f))
                ) {
                    Text(
                        text = "🚨 సరికొత్త అప్‌డేట్ తప్పనిసరి",
                        color = Color(0xFFFF5252),
                        fontFamily = Ramabhadra,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "యాప్ అప్‌డేట్ చేయండి",
                    fontFamily = Ramabhadra,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = Color.White,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "ప్రియమైన పాఠకులకు & విలేకరులకు ముఖ్య గమనిక:\n\nమీ ఆల్ఫా న్యూస్ యాప్‌లో సరికొత్త ఫీచర్లు, మెరుపు వేగంతో లైవ్ వార్తల లోడింగ్ మరియు అత్యుత్తమ పనితీరు కోసం సరికొత్త వెర్షన్‌ను గూగుల్ ప్లే స్టోర్‌లో అందుబాటులోకి తీసుకువచ్చాము.\n\nపాత వెర్షన్ సేవలు నిలిపివేయబడ్డాయి. యాప్‌ను ఉపయోగించడానికి మరియు తాజా వార్తలను పొందడానికి దయచేసి ఇప్పుడే గూగుల్ ప్లే స్టోర్ నుండి అప్‌డేట్ చేసుకోండి.",
                    fontFamily = Mallanna,
                    fontSize = 17.sp,
                    lineHeight = 25.sp,
                    color = Color.White.copy(alpha = 0.88f),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Current version chip
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White.copy(alpha = 0.08f)
                ) {
                    Text(
                        text = "ప్రస్తుత వెర్షన్: $currentVersionName ➔ సరికొత్త వెర్షన్ సిద్ధంగా ఉంది",
                        color = Color.White.copy(alpha = 0.65f),
                        fontFamily = Mallanna,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }

            // 3. Bottom Action Buttons
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp)
            ) {
                Button(
                    onClick = onUpdateClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935)),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                ) {
                    Text(
                        text = "ప్లే స్టోర్‌లో ఇప్పుడే అప్‌డేట్ చేయండి 📲",
                        fontFamily = Ramabhadra,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "గూగుల్ ప్లే స్టోర్ అధికారిక అప్‌డేట్ (Safe & Secure)",
                    fontFamily = Mallanna,
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.5f),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
