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
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .glassmorphism(cornerRadius = 32.dp, blurRadius = 24.dp, opacity = 0.1f),
        color = Color.Transparent,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp
    ) {
        NavigationBar(
            modifier = Modifier.fillMaxWidth().height(64.dp),
            containerColor = Color.Transparent,
            contentColor = MaterialTheme.colorScheme.onSurface,
            tonalElevation = 0.dp
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
                    modifier = Modifier.size(48.dp), // Original size
                    shape = CircleShape,
                    color = Color.Transparent
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
                            modifier = Modifier.size(32.dp), // Original size
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
                        modifier = Modifier.size(26.dp) // Original size
                    )
                }
            }
        },
        label = {
            Text(
                text = label,
                fontSize = 10.sp, // Reduced slightly
                fontFamily = if (label.any { it.code > 127 }) Mallanna else Poppins,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
                lineHeight = 12.sp, // Reduced line height to tighten vertical gap
                letterSpacing = 0.2.sp
            )
        },
        selected = isActive,
        onClick = onClick,
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = MaterialTheme.colorScheme.primary,
            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            selectedTextColor = MaterialTheme.colorScheme.primary,
            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            indicatorColor = Color.Transparent // Remove background indicator to reduce clutter
        )
    )
}
