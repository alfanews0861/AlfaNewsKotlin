package com.alfanews.telugu.views

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import kotlinx.coroutines.delay

@Composable
fun SplashScreenView(
    isReady: Boolean = true,
    onFinished: () -> Unit
) {
    val step = remember { mutableStateOf(0) }
    val words = listOf("సూటిగా", " - ", "సుత్తి లేకుండా", " - ", "క్లుప్తంగా")
    val animationFinished = remember { mutableStateOf(false) }

    val captions = remember {
        listOf(
            "Real News. Real Fast.",
            "Facts First, Noise Last.",
            "The Pulse of People.",
            "Pure News, Zero Nonsense.",
            "Unbiased. Unfiltered. Unmatched.",
            "Truth Behind the Trends.",
            "Your Daily Dose of Truth.",
            "Stay Informed, Stay Ahead.",
            "The World in Your Pocket.",
            "Smart News for Smart People.",
            "అక్షరం పొల్లుపోకుండా.. అసలైన వార్త",
            "నిమిషం వార్త.. నిమిషంలో మీ ముందుకు.",
            "న్యూస్ అంటే గోల కాదు.. అసలైన సమాచారం.",
            "కోట్లాది తెలుగు ప్రజల గుండె చప్పుడు"
        )
    }
    val randomCaption = remember { captions.random() }

    LaunchedEffect(Unit) {
        delay(200)
        step.value = 1 // Start logo animation
        delay(800)
        step.value = 2 // Start tagline animation
        delay(1200)
        
        // Wait until data is ready or max 5 seconds total
        var waitTime = 0
        while (!isReady && waitTime < 3000) {
            delay(100)
            waitTime += 100
        }
        
        step.value = 3 // Hold
        delay(500)
        step.value = 4 // Fade out
        delay(400)
        animationFinished.value = true
    }

    LaunchedEffect(animationFinished.value) {
        if (animationFinished.value) {
            onFinished()
        }
    }

    val logoOpacity by animateFloatAsState(targetValue = if (step.value >= 1) 1f else 0f, animationSpec = tween(800))
    val logoScale by animateFloatAsState(
        targetValue = if (step.value >= 1) 1f else 0.8f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)
    )
    val globalOpacity by animateFloatAsState(targetValue = if (step.value < 4) 1f else 0f, animationSpec = tween(400))

    val backgroundBrush = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF020A1A),
            Color(0xFF0D214F)
        )
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush = backgroundBrush)
            .graphicsLayer { alpha = globalOpacity },
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Row(
                modifier = Modifier
                    .graphicsLayer {
                        alpha = logoOpacity
                        scaleX = logoScale
                        scaleY = logoScale
                    },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "alfa",
                    color = Color.White,
                    fontFamily = Poppins,
                    fontWeight = FontWeight.Bold,
                    fontSize = 56.sp
                )
                Text(
                    text = "news",
                    color = Color.White,
                    fontFamily = Poppins,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 56.sp
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            Row(
                modifier = Modifier.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                words.forEachIndexed { index, word ->
                    val wordOpacity by animateFloatAsState(
                        targetValue = if (step.value >= 2) 1f else 0f,
                        animationSpec = tween(durationMillis = 500, delayMillis = index * 100)
                    )
                    Text(
                        text = word,
                        fontSize = 20.sp,
                        fontFamily = Ramabhadra,
                        color = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.graphicsLayer { alpha = wordOpacity }
                    )
                }
            }
        }

        Text(
            text = randomCaption,
            color = Color.White.copy(alpha = 0.8f),
            fontFamily = Ramabhadra,
            fontSize = 16.sp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 60.dp)
        )
    }
}
