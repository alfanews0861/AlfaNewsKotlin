package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.R

@Composable
fun CreateMenuView(
    currentUser: User?,
    onAction: (String) -> Unit = {},
    onClose: () -> Unit = {}
) {
    val Poppins = FontFamily.SansSerif 
    val canPostNews = currentUser != null && 
        (currentUser.role == UserRole.REPORTER || 
         currentUser.role == UserRole.EDITOR || 
         currentUser.role == UserRole.ADMIN)
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "మీరు ఏమి పోస్ట్ చేయాలనుకుంటున్నారు?",
                fontSize = 28.sp,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                text = "Share your story with the world.",
                fontSize = 16.sp,
                fontFamily = Poppins,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            Text(
                text = "మీ కంటెంట్‌ని ప్రపంచానికి తెలియజేయండి.",
                fontSize = 18.sp,
                fontFamily = Mallanna,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(bottom = 32.dp)
            )
            
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                CreateMenuButton(
                    title = "సిటిజన్ జర్నలిజం",
                    subtitle = "Public submission",
                    icon = "📢",
                    gradientColors = listOf(MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.primary),
                    onClick = { onAction("citizen") }
                )
                
                if (canPostNews) {
                    CreateMenuButton(
                        title = "కొత్త వార్తను పోస్ట్ చెయ్యి",
                        subtitle = "Reporter / Staff Desk",
                        icon = "📝",
                        gradientColors = listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.secondary),
                        onClick = { onAction("news") }
                    )
                } else {
                    CreateMenuButton(
                        title = "విలేకరి గా చేరండి",
                        subtitle = "Join our reporting team",
                        icon = "🎤",
                        gradientColors = listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.secondary),
                        onClick = { onAction("join_reporter") }
                    )
                }
                
                CreateMenuButton(
                    title = "కొత్త క్లాసిఫైడ్ పోస్ట్",
                    subtitle = "Buy, Sell or Services",
                    icon = "🏷️",
                    gradientColors = listOf(MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.primary),
                    onClick = { onAction("classified") }
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            TextButton(onClick = onClose) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Close",
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "తిరిగి వెళ్ళు",
                    fontSize = 18.sp,
                    fontFamily = Ramabhadra,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }
        }
    }
}

@Composable
fun CreateMenuButton(
    title: String,
    subtitle: String,
    icon: String,
    gradientColors: List<Color>,
    onClick: () -> Unit
) {
    val Poppins = FontFamily.SansSerif

    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(90.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent
        ),
        contentPadding = PaddingValues(0.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.horizontalGradient(gradientColors),
                    shape = RoundedCornerShape(16.dp)
                )
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .background(
                                Color.White.copy(alpha = 0.2f),
                                RoundedCornerShape(12.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = icon,
                            fontSize = 28.sp
                        )
                    }
                    Column {
                        Text(
                            text = title,
                            fontSize = 20.sp,
                            fontFamily = Ramabhadra,
                            color = Color.White
                        )
                        Text(
                            text = subtitle,
                            fontSize = 12.sp,
                            fontFamily = Poppins,
                            color = Color.White.copy(alpha = 0.8f),
                            letterSpacing = 0.5.sp
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Default.ArrowForward,
                    contentDescription = "Next",
                    tint = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}
