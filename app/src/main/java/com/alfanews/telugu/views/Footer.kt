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
        tonalElevation = 8.dp, // Adds a subtle depth
        shadowElevation = 16.dp
    ) {
        NavigationBar(
            modifier = Modifier.fillMaxWidth(),
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
            windowInsets = WindowInsets.navigationBars
        ) {
            FooterItem(
                icon = Icons.Default.Home,
                label = "హోమ్",
                isActive = activeTab == "home",
                onClick = { onTabChange("home") }
            )
            FooterItem(
                icon = Icons.Default.LocationOn,
                label = "లోకల్",
                isActive = activeTab == "local",
                onClick = { onTabChange("local") }
            )
            FooterItem(
                icon = Icons.Default.AddCircle,
                label = "పోస్ట్",
                isActive = activeTab == "create",
                isSpecial = true,
                onClick = { onTabChange("create") }
            )
            FooterItem(
                icon = Icons.Default.List,
                label = "క్లాసిఫైడ్స్",
                isActive = activeTab == "classifieds",
                onClick = { onTabChange("classifieds") }
            )
            FooterItem(
                icon = Icons.Default.Person,
                label = "ప్రొఫైల్",
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
    NavigationBarItem(
        icon = {
            if (isSpecial) {
                // Special "Create" button with a modern gradient background
                val gradientBrush = Brush.linearGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.primary,
                        MaterialTheme.colorScheme.tertiary
                    )
                )
                
                Surface(
                    modifier = Modifier.size(48.dp),
                    shape = CircleShape,
                    color = Color.Transparent,
                    tonalElevation = 4.dp,
                    shadowElevation = 4.dp
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(gradientBrush),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = label,
                            modifier = Modifier.size(32.dp),
                            tint = Color.White
                        )
                    }
                }
            } else {
                BadgedBox(
                    badge = {
                        if (label == "ప్రొఫైల్" && !isActive) {
                            Badge(
                                containerColor = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(6.dp)
                            )
                        }
                    }
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        modifier = Modifier.size(26.dp)
                    )
                }
            }
        },
        label = {
            Text(
                text = label,
                fontSize = 11.sp,
                fontFamily = if (label.any { it.code > 127 }) Mallanna else Poppins,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
                letterSpacing = 0.5.sp
            )
        },
        selected = isActive,
        onClick = onClick,
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = MaterialTheme.colorScheme.primary,
            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            selectedTextColor = MaterialTheme.colorScheme.primary,
            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            indicatorColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        )
    )
}
