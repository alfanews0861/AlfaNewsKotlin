package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.tooling.preview.Preview
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.ui.theme.BrandDarkBlue
import com.alfanews.telugu.ui.theme.Poppins

@Preview(showBackground = true)
@Composable
fun LogoHeaderPreview() {
    AlfaNewsTheme {
        LogoHeader(
            district = "Hyderabad",
            showDistrictSelector = true,
            onMenuClick = {}
        )
    }
}

@Composable
fun LogoHeader(
    modifier: Modifier = Modifier,
    district: String? = null,
    onDistrictClick: (() -> Unit)? = null,
    showDistrictSelector: Boolean = false,
    onMenuClick: (() -> Unit)? = null
) {
    Surface(
        color = BrandDarkBlue,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                if (onMenuClick != null) {
                    IconButton(onClick = onMenuClick) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Menu",
                            tint = Color.White
                        )
                    }
                }
                
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(start = if (onMenuClick == null) 12.dp else 4.dp)
                ) {
                    Text(
                        text = "alfa",
                        fontSize = 24.sp,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "news",
                        fontSize = 24.sp,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }
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
                        tint = Color.White
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
