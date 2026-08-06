package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.layout.WindowInsets
import com.alfanews.telugu.R
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins

/**
 * Advanced Material 3 Navigation Bar
 * Uses high-contrast, theme-aware colors and a sharp, modern design.
 */
@Composable
fun Footer(
    activeTab: String,
    onTabChange: (String) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().navigationBarsPadding(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp,
        shadowElevation = 8.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            HorizontalDivider(
                thickness = 1.dp,
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)
            )
            NavigationBar(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp), // Clean, uncompressed footer height inside safe area
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
                tonalElevation = 0.dp,
                windowInsets = WindowInsets(0, 0, 0, 0)
            ) {
                FooterItem(
                    icon = Icons.Default.Home,
                    label = stringResource(R.string.nav_home),
                    isActive = activeTab == "home",
                    onClick = { onTabChange("home") }
                )
                FooterItem(
                    icon = Icons.Default.LocationOn,
                    label = stringResource(R.string.nav_local),
                    isActive = activeTab == "local",
                    onClick = { onTabChange("local") }
                )
                FooterItem(
                    icon = Icons.Default.AddCircle,
                    label = stringResource(R.string.nav_post),
                    isActive = activeTab == "create",
                    isSpecial = true,
                    onClick = { onTabChange("create") }
                )
                FooterItem(
                    icon = Icons.Default.List,
                    label = stringResource(R.string.nav_classifieds),
                    isActive = activeTab == "classifieds",
                    onClick = { onTabChange("classifieds") }
                )
                FooterItem(
                    icon = Icons.Default.Person,
                    label = stringResource(R.string.nav_profile),
                    isActive = activeTab == "profile",
                    onClick = { onTabChange("profile") }
                )
            }
        }
    }
}

@Composable
fun RowScope.FooterItem(
    icon: ImageVector,
    label: String,
    isActive: Boolean,
    isSpecial: Boolean = false,
    onClick: () -> Unit
) {
    // Vibrant active colors vs muted unselected gray
    val activeRed = Color(0xFFD32F2F) // Vibrant Telugu News Red for active tab
    val specialBlue = Color(0xFF1976D2) // Distinct Blue for Create Post button
    
    val selectedColor = if (isSpecial) specialBlue else activeRed
    val unselectedColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
    
    val iconColor = if (isActive || isSpecial) selectedColor else unselectedColor

    NavigationBarItem(
        icon = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    modifier = Modifier.size(24.dp),
                    tint = iconColor
                )
                
                Spacer(modifier = Modifier.height(2.dp))
                
                Text(
                    text = label,
                    fontSize = 11.sp,
                    fontFamily = if (label.any { it.code > 127 }) Mallanna else Poppins,
                    fontWeight = if (isActive || isSpecial) FontWeight.Bold else FontWeight.Medium,
                    color = iconColor,
                    maxLines = 1,
                    letterSpacing = 0.sp
                )
            }
        },
        label = null,
        selected = isActive,
        onClick = onClick,
        colors = NavigationBarItemDefaults.colors(
            indicatorColor = Color.Transparent,
            selectedIconColor = selectedColor,
            unselectedIconColor = unselectedColor
        )
    )
}
