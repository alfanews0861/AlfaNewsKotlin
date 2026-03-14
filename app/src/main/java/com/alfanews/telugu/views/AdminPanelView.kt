package com.alfanews.telugu.views

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.viewmodels.ThemeMode
import kotlinx.coroutines.launch
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins
import kotlinx.coroutines.tasks.await
import java.net.URLEncoder
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminPanelView(
    user: User,
    onClose: () -> Unit,
    language: Language,
    setLanguage: (Language) -> Unit,
    onLogout: () -> Unit,
    onLoginRequest: (() -> Unit)? = null,
    initialPage: String = "profile",
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    onThemeModeChange: (ThemeMode) -> Unit = {},
    isModal: Boolean = false,
    onNavigate: (String) -> Unit = {}
) {
    var activePage by remember { mutableStateOf(initialPage) }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var editingPost by remember { mutableStateOf<NewsPost?>(null) }
    var savingProfile by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val allPages = listOf(
        PageConfig("profile", "ప్రొఫైల్ (Profile)", listOf(UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        PageConfig("edit-profile", "ప్రొఫైల్ ను ఎడిట్ చేయండి", listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        PageConfig("id-card", "ID Card", listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        PageConfig("post", "వార్తను పోస్ట్ చేయండి", listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        PageConfig("ads", "ప్రకటనలు (Ads Manager)", listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        PageConfig("manage", "వార్తలను నిర్వహించండి", listOf(UserRole.EDITOR, UserRole.ADMIN)),
        PageConfig("manageUsers", "వినియోగదారు నిర్వహణ", listOf(UserRole.EDITOR, UserRole.ADMIN)),
        PageConfig("adminNotify", "Push Notifications", listOf(UserRole.ADMIN)),
        PageConfig("scraping", "వెబ్ స్క్రాపింగ్", listOf(UserRole.ADMIN)),
        PageConfig("gnews_dashboard", "GNews Dashboard", listOf(UserRole.ADMIN))
    )

    val accessiblePages = when (user.role) {
        UserRole.GUEST, UserRole.SUBSCRIBER -> allPages.filter { it.id == "profile" }
        UserRole.REPORTER -> allPages.filter { listOf("profile", "post", "ads", "edit-profile", "id-card").contains(it.id) }
        UserRole.EDITOR -> allPages.filter { listOf("profile", "post", "ads", "manage", "manageUsers", "edit-profile", "id-card").contains(it.id) }
        UserRole.ADMIN -> allPages
    }

    LaunchedEffect(user.role) {
        if (accessiblePages.none { it.id == activePage }) {
            activePage = accessiblePages.firstOrNull()?.id ?: "profile"
        }
    }
    
    fun saveProfile(name: String, address: String, district: String, photoUri: Uri?, signatureUri: Uri?) {
        scope.launch {
            savingProfile = true
            try {
                var photoUrl = user.photoUrl
                if (photoUri != null) {
                    val photoRef = FirebaseService.storage.reference.child("profile_photos/${user.id}/${UUID.randomUUID()}")
                    photoUrl = photoRef.putFile(photoUri).await().storage.downloadUrl.await().toString()
                }

                var signatureUrl = user.signatureUrl
                if (signatureUri != null && user.role == UserRole.ADMIN) {
                    val signatureRef = FirebaseService.storage.reference.child("signatures/${user.id}/${UUID.randomUUID()}")
                    signatureUrl = signatureRef.putFile(signatureUri).await().storage.downloadUrl.await().toString()
                }

                if (user.role == UserRole.ADMIN && !signatureUrl.isNullOrBlank()) {
                    // Update global authorized signature if admin
                    try {
                        FirebaseService.db.collection("settings").document("android_config")
                            .update("authorized_signature", signatureUrl).await()
                    } catch (e: Exception) {
                        FirebaseService.db.collection("settings").document("android_config")
                            .set(mapOf("authorized_signature" to signatureUrl), com.google.firebase.firestore.SetOptions.merge()).await()
                    }
                }

                val updatedUser = user.copy(
                    name = name,
                    address = address,
                    district = district,
                    photoUrl = photoUrl,
                    signatureUrl = signatureUrl
                )
                FirebaseService.db.collection("users").document(user.id).set(updatedUser).await()
                activePage = "profile"
                Toast.makeText(context, "Profile updated successfully!", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to update profile: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                savingProfile = false
            }
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = MaterialTheme.colorScheme.surface,
                drawerTonalElevation = 4.dp,
                modifier = Modifier.width(320.dp),
                drawerShape = RoundedCornerShape(topEnd = 24.dp, bottomEnd = 24.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                                colors = listOf(
                                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                                    MaterialTheme.colorScheme.surface
                                )
                            )
                        )
                        .padding(vertical = 32.dp, horizontal = 24.dp)
                ) {
                    Column {
                        Text(
                            "నిర్వహణ ప్యానెల్",
                            style = MaterialTheme.typography.headlineSmall.copy(
                                fontFamily = Ramabhadra,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        )
                        Text(
                            "Admin Dashboard",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontFamily = Poppins,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        )
                    }
                }

                Divider(modifier = Modifier.padding(horizontal = 24.dp), color = MaterialTheme.colorScheme.outlineVariant)
                
                Spacer(modifier = Modifier.height(16.dp))

                accessiblePages.filter{ !listOf("edit-profile", "id-card").contains(it.id) }.forEach { page ->
                    NavigationDrawerItem(
                        label = { Text(page.label, fontFamily = Mallanna, fontSize = 18.sp, fontWeight = FontWeight.Medium) },
                        selected = activePage == page.id,
                        onClick = {
                            if (activePage == "post" && page.id != "post") editingPost = null
                            activePage = page.id
                            scope.launch { drawerState.close() }
                        },
                        icon = {
                            val icon = when(page.id) {
                                "profile" -> Icons.Default.Person
                                "post" -> Icons.Default.AddCircle
                                "ads" -> Icons.Default.AdsClick
                                "manage" -> Icons.Default.Article
                                "manageUsers" -> Icons.Default.Group
                                "adminNotify" -> Icons.Default.NotificationsActive
                                "scraping" -> Icons.Default.CloudDownload
                                "gnews_dashboard" -> Icons.Default.Dashboard
                                else -> Icons.Default.Settings
                            }
                            Icon(icon, contentDescription = null)
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = NavigationDrawerItemDefaults.colors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedTextColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                if (user.role != UserRole.GUEST) {
                    Divider(modifier = Modifier.padding(horizontal = 24.dp), color = MaterialTheme.colorScheme.outlineVariant)
                    NavigationDrawerItem(
                        label = { Text("లాగౌట్ (Logout)", fontFamily = Mallanna, fontWeight = FontWeight.Bold) },
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
        },
        gesturesEnabled = accessiblePages.size > 1
    ) {
        Scaffold(
            topBar = {
                CenterAlignedTopAppBar(
                    title = {
                        Text(
                            text = accessiblePages.find { it.id == activePage }?.label ?: "Alfa News",
                            fontFamily = Ramabhadra,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface
                    ),
                    navigationIcon = {
                        if (accessiblePages.size > 1 && !listOf("edit-profile", "id-card").contains(activePage)) {
                            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                Icon(Icons.Default.Menu, contentDescription = "Menu")
                            }
                        } else {
                             IconButton(onClick = { activePage = "profile" }) {
                                Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                            }
                        }
                    },
                    actions = {
                        if (isModal) {
                            IconButton(onClick = onClose) {
                                Icon(Icons.Default.Close, contentDescription = "Close")
                            }
                        }
                    }
                )
            }
        ) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding).padding(top = 8.dp)) {
                when (activePage) {
                    "profile" -> UserProfilePageView(
                        user = user,
                        language = language,
                        setLanguage = setLanguage,
                        themeMode = themeMode,
                        onThemeModeChange = onThemeModeChange,
                        onNavigate = { page ->
                            if(listOf("edit-profile", "id-card").contains(page)) activePage = page
                            else onNavigate(page)
                         },
                        onLoginRequest = onLoginRequest
                    )
                    "edit-profile" -> EditProfilePageView(
                        user = user,
                        onClose = { activePage = "profile" },
                        onSave = ::saveProfile,
                        saving = savingProfile
                    )
                    "id-card" -> IdCardPageView(
                        user = user,
                        onBack = { activePage = "profile" }
                    )
                    "post" -> PostNewsPageView(
                        user = user,
                        postToEdit = editingPost,
                        onActionComplete = { _ -> activePage = "manage" }
                    )
                    "manage" -> ManagePostsPageView(
                        onEditPost = { post ->
                            editingPost = post
                            activePage = "post"
                        },
                        currentUser = user
                    )
                    "ads" -> AdsManagerPageView(currentUser = user)
                    "manageUsers" -> UserManagementPageView(currentUser = user)
                    "adminNotify" -> AdminNotificationsPageView()
                    "scraping" -> WebScrapingPageView()
                    "gnews_dashboard" -> GNewsDashboardView()
                }
            }
        }
    }
}

data class PageConfig(
    val id: String,
    val label: String,
    val roles: List<UserRole>
)

@Composable
fun MenuItem(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    textColor: Color = Color(0xFFD1D5DB)
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(
                if (isSelected) MaterialTheme.colorScheme.error else Color.Transparent
            )
            .padding(20.dp)
    ) {
        Text(
            text = label,
            fontSize = 20.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            color = if (isSelected) Color.White else textColor
        )
    }
}
