package com.alfanews.telugu.views

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.ui.theme.Poppins

@Composable
fun LogoHeader(
    modifier: Modifier = Modifier,
    district: String? = null,
    onDistrictClick: (() -> Unit)? = null,
    showDistrictSelector: Boolean = false
) {
    Surface(
        color = Color.Black,
        shadowElevation = 8.dp,
        modifier = modifier.fillMaxWidth().zIndex(1f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "alfa",
                    fontSize = 28.sp,
                    fontFamily = Poppins,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF2196F3) // Blue
                )
                Text(
                    text = "news",
                    fontSize = 28.sp,
                    fontFamily = Poppins,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFFF44336) // Red
                )
            }
            
            if (showDistrictSelector && onDistrictClick != null) {
                TextButton(
                    onClick = onDistrictClick,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                        tint = Color(0xFF2196F3)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = district ?: "Select District",
                        fontSize = 14.sp,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}
