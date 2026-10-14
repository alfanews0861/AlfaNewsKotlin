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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.models.canPostSurvey
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra

@Composable
fun AppDrawerContent(
    user: User?,
    activePage: String,
    unreadMessagesCount: Int = 0,
    onPageSelected: (String) -> Unit,
    onLogout: () -> Unit
) {
    val authUser = com.alfanews.telugu.services.FirebaseService.auth.currentUser
    val cleanUserPhone = user?.phone?.replace("+91", "")?.trim()
    val cleanAuthPhone = authUser?.phoneNumber?.replace("+91", "")?.trim()
    val isAdminUser = (user?.role == UserRole.ADMIN) ||
        (cleanUserPhone == "9173811009") ||
        (user?.phone?.contains("9173811009") == true) ||
        (user?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true) ||
        (cleanAuthPhone == "9173811009") ||
        (authUser?.phoneNumber?.contains("9173811009") == true) ||
        (authUser?.email?.equals("alfanews0861@gmail.com", ignoreCase = true) == true)
    val isPermanentReporter = (user?.email?.equals("alfanewsservice@gmail.com", ignoreCase = true) == true) ||
        (authUser?.email?.equals("alfanewsservice@gmail.com", ignoreCase = true) == true)
    val effectiveDrawerUser = if (user == null && authUser != null) {
        val prefs = com.alfanews.telugu.utils.PreferenceManager.getInstance(androidx.compose.ui.platform.LocalContext.current)
        val cachedRole = if (isAdminUser) "ADMIN" else if (isPermanentReporter) "REPORTER" else (prefs.userRole ?: "SUBSCRIBER")
        User(
            id = authUser.uid,
            name = prefs.userName ?: authUser.displayName ?: if (isAdminUser) "శ్రీకాంత్ రెడ్డి" else if (isPermanentReporter) "Alfa News Service" else "User",
            phone = authUser.phoneNumber ?: prefs.userPhone,
            email = authUser.email,
            role = if (isAdminUser) UserRole.ADMIN else if (isPermanentReporter) UserRole.REPORTER else UserRole.fromString(cachedRole),
            district = if (isPermanentReporter) "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" else prefs.userDistrict,
            assignedMandal = if (isPermanentReporter) "నెల్లూరు అర్బన్" else prefs.userAssignedMandal
        )
    } else if (user != null && isPermanentReporter) {
        user.copy(
            role = UserRole.REPORTER,
            district = "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
            assignedMandal = "నెల్లూరు అర్బన్"
        )
    } else {
        user
    }
    val hasReporterHistory = effectiveDrawerUser != null && (
        !effectiveDrawerUser.assignedMandal.isNullOrBlank() ||
        effectiveDrawerUser.points > 0 ||
        effectiveDrawerUser.badges.isNotEmpty() ||
        isPermanentReporter
    )
    val role = if (isAdminUser) {
        UserRole.ADMIN
    } else if (isPermanentReporter) {
        UserRole.REPORTER
    } else if (effectiveDrawerUser?.role == UserRole.SUBSCRIBER && hasReporterHistory) {
        UserRole.REPORTER
    } else {
        effectiveDrawerUser?.role ?: if (authUser != null) UserRole.SUBSCRIBER else UserRole.GUEST
    }

    val allPages = listOf(
        AppPageConfig("profile", stringResource(R.string.profile), listOf(UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("id-card", stringResource(R.string.id_card), listOf(UserRole.REPORTER, UserRole.NEWS_DESK, UserRole.REGIONAL_INCHARGE, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("manageSurveys", "సర్వే నిర్వహణ", listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN, UserRole.NEWS_DESK)),
        AppPageConfig("messages", stringResource(R.string.messages), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN, UserRole.NEWS_DESK, UserRole.REGIONAL_INCHARGE, UserRole.SUBSCRIBER)),
        AppPageConfig("post", stringResource(R.string.post_news), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("ads", stringResource(R.string.ads_manager), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("manage", stringResource(R.string.manage_news), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN, UserRole.NEWS_DESK)),
        AppPageConfig("manageReporters", stringResource(R.string.manage_reporters), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN)),
        AppPageConfig("manageUsers", stringResource(R.string.manage_users), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN)),
        AppPageConfig("adminNotify", stringResource(R.string.push_notifications_title), listOf(UserRole.ADMIN)),
        AppPageConfig("affiliate_settings", "Affiliate News API", listOf(UserRole.ADMIN))
    )

    val accessiblePages = when (role) {
        UserRole.GUEST -> listOf(
            AppPageConfig("home", stringResource(R.string.home), emptyList()),
            AppPageConfig("local", stringResource(R.string.local_news), emptyList()),
            AppPageConfig("profile", stringResource(R.string.profile), emptyList())
        )
        UserRole.SUBSCRIBER -> listOf(
            AppPageConfig("home", stringResource(R.string.home), emptyList()),
            AppPageConfig("local", stringResource(R.string.local_news), emptyList()),
            AppPageConfig("messages", stringResource(R.string.messages), emptyList()),
            AppPageConfig("profile", stringResource(R.string.profile), emptyList())
        )
        UserRole.REPORTER -> allPages.filter { 
            val list = listOf("profile", "id-card", "manageSurveys", "post", "ads", "manage", "messages")
            list.contains(it.id)
        }
        UserRole.NEWS_DESK -> allPages.filter { 
            val list = listOf("profile", "id-card", "manageSurveys", "post", "ads", "manage", "messages")
            list.contains(it.id)
        }
        UserRole.REGIONAL_INCHARGE -> allPages.filter { 
            val list = listOf("profile", "id-card", "manageSurveys", "post", "ads", "manage", "messages", "manageReporters", "manageUsers")
            list.contains(it.id)
        }
        UserRole.EDITOR -> allPages.filter { 
            val list = listOf("profile", "id-card", "manageSurveys", "post", "ads", "manage", "messages", "manageReporters", "manageUsers")
            list.contains(it.id)
        }
        UserRole.ADMIN -> allPages.filter { it.id != "survey" }
        else -> listOf(
            AppPageConfig("home", stringResource(R.string.home), emptyList()),
            AppPageConfig("local", stringResource(R.string.local_news), emptyList()),
            AppPageConfig("profile", stringResource(R.string.profile), emptyList())
        )
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
                val headerDisplayName = when {
                    effectiveDrawerUser != null && effectiveDrawerUser.name.isNotBlank() && !effectiveDrawerUser.name.equals("User", true) && !effectiveDrawerUser.name.equals("యూజర్", true) -> effectiveDrawerUser.name
                    authUser?.displayName?.isNotBlank() == true -> authUser.displayName!!
                    authUser?.phoneNumber?.isNotBlank() == true -> authUser.phoneNumber!!
                    isAdminUser -> "శ్రీకాంత్ రెడ్డి"
                    role == UserRole.REPORTER -> "విలేకరి"
                    authUser != null -> "వినియోగదారుడు"
                    else -> stringResource(R.string.guest)
                }
                Text(
                    headerDisplayName,
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
                        "id-card" -> Icons.Default.Badge
                        "manageSurveys" -> Icons.Default.Poll
                        "post" -> Icons.Default.AddCircle
                        "survey" -> Icons.Default.BarChart
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
                badge = {
                    if (page.id == "messages" && unreadMessagesCount > 0) {
                        Surface(
                            shape = androidx.compose.foundation.shape.CircleShape,
                            color = androidx.compose.ui.graphics.Color(0xFFE53935)
                        ) {
                            Text(
                                text = if (unreadMessagesCount > 99) "99+" else "$unreadMessagesCount",
                                color = androidx.compose.ui.graphics.Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                            )
                        }
                    }
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

        Text(
            text = "Alfa News v${com.alfanews.telugu.BuildConfig.VERSION_NAME} (${com.alfanews.telugu.BuildConfig.VERSION_CODE})",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            fontFamily = Poppins,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .padding(bottom = 16.dp)
        )
    }
}

data class AppPageConfig(
    val id: String,
    val label: String,
    val roles: List<UserRole>
)
