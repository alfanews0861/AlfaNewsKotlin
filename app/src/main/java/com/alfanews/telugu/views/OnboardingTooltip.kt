package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.ui.theme.Mallanna

@Composable
fun OnboardingTooltip(
    message: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .clickable { onDismiss() } // Dismiss on click anywhere
            .background(Color.Black.copy(alpha = 0.3f)), // Dim background
        contentAlignment = Alignment.BottomEnd
    ) {
        Column(
            horizontalAlignment = Alignment.End,
            modifier = Modifier
                .padding(bottom = 80.dp, end = 16.dp) // Position above footer profile icon
                .width(200.dp)
        ) {
            Box(
                modifier = Modifier
                    .background(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(8.dp)
                    )
                    .padding(12.dp)
            ) {
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    fontSize = 14.sp,
                    fontFamily = Mallanna,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center
                )
            }
            // Triangle pointer
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = null,
                modifier = Modifier
                    .size(24.dp)
                    .offset(x = (-20).dp, y = (-8).dp) // Align with the icon
                    .rotate(0f),
                tint = MaterialTheme.colorScheme.primaryContainer
            )
        }
    }
}
