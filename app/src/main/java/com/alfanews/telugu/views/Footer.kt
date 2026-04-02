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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.utils.glassmorphism
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins

/**
 * Advanced Material 3 Navigation Bar
 * Uses theme-aware colors and a sharp, modern design.
 */
@Composable
fun Footer(
    activeTab: String,
    onTabChange: (String) -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        color = Color.Transparent,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp
    ) {
        NavigationBar(
            modifier = Modifier.fillMaxWidth().height(52.dp), // Reduced height from 64dp
            containerColor = Color.Transparent,
            contentColor = MaterialTheme.colorScheme.onSurface,
            tonalElevation = 0.dp,
            windowInsets = WindowInsets(0, 0, 0, 0) // Remove default insets
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

@Composable
fun RowScope.FooterItem(
    icon: ImageVector,
    label: String,
    isActive: Boolean,
    isSpecial: Boolean = false,
    onClick: () -> Unit
) {
    val selectedColor = MaterialTheme.colorScheme.primary
    val unselectedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
    
    NavigationBarItem(
        icon = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    modifier = Modifier.size(24.dp), // Unified size for all icons
                    tint = if (isSpecial) Color.White else (if (isActive) selectedColor else unselectedColor)
                )
                
                Spacer(modifier = Modifier.height(0.dp)) // Tight gap between icon and text
                
                Text(
                    text = label,
                    fontSize = 9.sp, // Reduced font size
                    fontFamily = if (label.any { it.code > 127 }) Mallanna else Poppins,
                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                    color = if (isActive) selectedColor else unselectedColor,
                    maxLines = 1,
                    letterSpacing = 0.sp
                )
            }
        },
        label = null, // Disable default label slot to use the custom Column layout
        selected = isActive,
        onClick = onClick,
        colors = NavigationBarItemDefaults.colors(
            indicatorColor = Color.Transparent // Clean look
        )
    )
}
