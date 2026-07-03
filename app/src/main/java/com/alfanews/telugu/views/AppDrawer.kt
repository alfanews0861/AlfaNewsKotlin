package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra

@Composable
fun AppDrawerContent(
    user: User?,
    activePage: String,
    onPageSelected: (String) -> Unit,
    onLogout: () -> Unit
) {
    val role = user?.role ?: UserRole.GUEST

    val allPages = listOf(
        AppPageConfig("home", stringResource(R.string.home), listOf(UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("local", stringResource(R.string.local_news), listOf(UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("profile", stringResource(R.string.profile), listOf(UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("messages", stringResource(R.string.messages), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN, UserRole.NEWS_DESK)),
        AppPageConfig("post", stringResource(R.string.post_news), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("ads", stringResource(R.string.ads_manager), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("manage", stringResource(R.string.manage_news), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN, UserRole.NEWS_DESK)),
        AppPageConfig("manageReporters", stringResource(R.string.manage_reporters), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN)),
        AppPageConfig("manageUsers", stringResource(R.string.manage_users), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN)),
        AppPageConfig("adminNotify", stringResource(R.string.push_notifications_title), listOf(UserRole.ADMIN)),
        AppPageConfig("affiliate_settings", "Affiliate News API", listOf(UserRole.ADMIN))
    )

    val accessiblePages = when (role) {
        UserRole.GUEST, UserRole.SUBSCRIBER -> allPages.filter { listOf("home", "local", "profile").contains(it.id) }
        UserRole.REPORTER -> allPages.filter { listOf("home", "local", "profile", "post", "ads", "manage", "messages").contains(it.id) }
        UserRole.NEWS_DESK -> allPages.filter { listOf("home", "local", "profile", "post", "ads", "manage", "messages").contains(it.id) }
        UserRole.REGIONAL_INCHARGE -> allPages.filter { listOf("home", "local", "profile", "post", "ads", "manage", "manageReporters", "manageUsers").contains(it.id) }
        UserRole.EDITOR -> allPages.filter { listOf("home", "local", "profile", "post", "ads", "manage", "manageReporters", "manageUsers").contains(it.id) }
        UserRole.ADMIN -> allPages
        else -> allPages.filter { listOf("home", "local", "profile").contains(it.id) }
    }

    ModalDrawerSheet(
        drawerContainerColor = MaterialTheme.colorScheme.background,
        drawerTonalElevation = 8.dp,
        modifier = Modifier.width(320.dp),
        drawerShape = RoundedCornerShape(topEnd = 24.dp, bottomEnd = 24.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer,
                            MaterialTheme.colorScheme.background
                        )
                    )
                )
                .padding(vertical = 32.dp, horizontal = 24.dp)
        ) {
            Column {
                Text(
                    stringResource(R.string.app_name),
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontFamily = Ramabhadra,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                )
                Text(
                    user?.name ?: stringResource(R.string.guest),
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontFamily = Poppins,
                        color = MaterialTheme.colorScheme.secondary
                    )
                )
            }
        }

        Divider(modifier = Modifier.padding(horizontal = 24.dp), color = MaterialTheme.colorScheme.outlineVariant)
        
        Spacer(modifier = Modifier.height(16.dp))

        accessiblePages.forEach { page ->
            NavigationDrawerItem(
                label = { Text(page.label, fontFamily = Mallanna, fontSize = 18.sp, fontWeight = FontWeight.Medium) },
                selected = activePage == page.id,
                onClick = { onPageSelected(page.id) },
                icon = {
                    val icon = when(page.id) {
                        "home" -> Icons.Default.Home
                        "local" -> Icons.Default.LocationOn
                        "profile" -> Icons.Default.Person
                        "post" -> Icons.Default.AddCircle
                        "ads" -> Icons.Default.AdsClick
                        "manage" -> Icons.Default.Article
                        "messages" -> Icons.Default.Mail
                        "manageReporters" -> Icons.Default.AssignmentInd
                        "manageUsers" -> Icons.Default.Group
                        "adminNotify" -> Icons.Default.NotificationsActive
                        "affiliate_settings" -> Icons.Default.Link
                        else -> Icons.Default.Settings
                    }
                    Icon(icon, contentDescription = null)
                },
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp),
                shape = RoundedCornerShape(12.dp),
                colors = NavigationDrawerItemDefaults.colors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.onPrimary,
                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurface,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                )
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        if (user != null && user.role != UserRole.GUEST) {
            Divider(modifier = Modifier.padding(horizontal = 24.dp), color = MaterialTheme.colorScheme.outlineVariant)
            NavigationDrawerItem(
                label = { Text(stringResource(R.string.logout), fontFamily = Mallanna, fontWeight = FontWeight.Bold) },
                selected = false,
                onClick = onLogout,
                icon = { Icon(Icons.Default.Logout, contentDescription = null) },
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = NavigationDrawerItemDefaults.colors(
                    unselectedTextColor = MaterialTheme.colorScheme.error,
                    unselectedIconColor = MaterialTheme.colorScheme.error
                )
            )
        }
    }
}

data class AppPageConfig(
    val id: String,
    val label: String,
    val roles: List<UserRole>
)
