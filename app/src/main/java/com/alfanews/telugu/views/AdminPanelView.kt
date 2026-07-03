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
import com.alfanews.telugu.models.ThemeMode
import kotlinx.coroutines.launch
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import java.net.URLEncoder
import java.util.*
import java.util.UUID

import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import android.app.Activity

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
    onNavigate: (String) -> Unit = {},
    onPostPublished: (String) -> Unit = {},
    onMenuClick: (() -> Unit)? = null
) {
    var activePage by remember { mutableStateOf(initialPage) }
    val scope = rememberCoroutineScope()
    var editingPost by remember { mutableStateOf<NewsPost?>(null) }
    var selectedPostForView by remember { mutableStateOf<NewsPost?>(null) }
    var savingProfile by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val allPages = listOf(
        AppPageConfig("profile", stringResource(R.string.profile), listOf(UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("edit-profile", stringResource(R.string.edit_profile), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("id-card", stringResource(R.string.id_card), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("messages", stringResource(R.string.messages), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN, UserRole.NEWS_DESK)),
        AppPageConfig("post", stringResource(R.string.post_news), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("ads", stringResource(R.string.ads_manager), listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN)),
        AppPageConfig("manage", stringResource(R.string.manage_news), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN, UserRole.NEWS_DESK)),
        AppPageConfig("manageReporters", stringResource(R.string.manage_reporters), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN)),
        AppPageConfig("manageUsers", stringResource(R.string.manage_users), listOf(UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN)),
        AppPageConfig("adminNotify", stringResource(R.string.push_notifications_title), listOf(UserRole.ADMIN)),
        AppPageConfig("scraping", stringResource(R.string.web_scraping), listOf(UserRole.ADMIN)),
        AppPageConfig("gnews_dashboard", stringResource(R.string.gnews_dashboard), listOf(UserRole.ADMIN)),
        AppPageConfig("affiliate_settings", "Affiliate News API", listOf(UserRole.ADMIN))
    )

    val accessiblePages = when (user.role) {
        UserRole.GUEST, UserRole.SUBSCRIBER -> allPages.filter { it.id == "profile" }
        UserRole.REPORTER -> allPages.filter { listOf("profile", "post", "ads", "manage", "edit-profile", "id-card", "messages").contains(it.id) }
        UserRole.NEWS_DESK -> allPages.filter { listOf("profile", "post", "ads", "manage", "edit-profile", "id-card", "messages").contains(it.id) }
        UserRole.REGIONAL_INCHARGE -> allPages.filter { listOf("profile", "post", "ads", "manage", "manageReporters", "manageUsers", "edit-profile", "id-card").contains(it.id) }
        UserRole.EDITOR -> allPages.filter { listOf("profile", "post", "ads", "manage", "manageReporters", "manageUsers", "edit-profile", "id-card").contains(it.id) }
        UserRole.ADMIN -> allPages
        else -> allPages.filter { it.id == "profile" }
    }

    LaunchedEffect(user.role) {
        if (accessiblePages.none { it.id == activePage }) {
            activePage = accessiblePages.firstOrNull()?.id ?: "profile"
        }
    }
    
    fun saveProfile(name: String, phone: String, address: String, district: String, photoUri: Uri?, signatureUri: Uri?) {
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
                    try {
                        FirebaseService.db.collection("settings").document("android_config")
                            .update("authorized_signature", signatureUrl).await()
                    } catch (e: Exception) {
                        FirebaseService.db.collection("settings").document("android_config")
                            .set(mapOf("authorized_signature" to signatureUrl), com.google.firebase.firestore.SetOptions.merge()).await()
                    }
                }

                val updates = mutableMapOf<String, Any>(
                    "name" to name,
                    "phone" to phone,
                    "address" to address,
                    "district" to district,
                    "photoUrl" to (photoUrl ?: ""),
                )
                if (!signatureUrl.isNullOrBlank()) updates["signatureUrl"] = signatureUrl

                FirebaseService.db.collection("users").document(user.id).update(updates).await()
                activePage = "profile"
                Toast.makeText(context, context.getString(R.string.profile_updated), Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, context.getString(R.string.profile_update_failed, e.message ?: ""), Toast.LENGTH_LONG).show()
            } finally {
                savingProfile = false
            }
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = accessiblePages.find { it.id == activePage }?.label ?: stringResource(R.string.app_name),
                        fontFamily = Ramabhadra,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                navigationIcon = {
                    if (onMenuClick != null && !listOf("edit-profile", "id-card").contains(activePage)) {
                        IconButton(onClick = onMenuClick) {
                            Icon(Icons.Default.Menu, contentDescription = stringResource(R.string.menu))
                        }
                    } else {
                         IconButton(onClick = { 
                             if (activePage == "profile") onClose()
                             else activePage = "profile" 
                         }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.back))
                        }
                    }
                },
                actions = {
                    if (isModal) {
                        IconButton(onClick = onClose) {
                            Icon(Icons.Default.Close, contentDescription = stringResource(R.string.close))
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
                "messages" -> MessagesPageView(
                    user = user,
                    onBack = { activePage = "profile" }
                )
                "post" -> PostNewsPageView(
                    user = user,
                    postToEdit = editingPost,
                    onActionComplete = { postId -> 
                        editingPost = null
                        activePage = if (listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN).contains(user.role)) "manage" else "profile"
                        if (postId.isNotBlank() && postId != "HOME_ONLY") {
                            onPostPublished(postId)
                        }
                    }
                )
                "manage" -> ManagePostsPageView(
                    onEditPost = { post ->
                        editingPost = post
                        activePage = "post"
                    },
                    onViewPost = { post ->
                        onPostPublished(post.id)
                    },
                    currentUser = user
                )
                "manageReporters" -> ReporterManagementPageView(currentUser = user)
                "ads" -> AdsManagerPageView(currentUser = user)
                "manageUsers" -> UserManagementPageView(currentUser = user)
                "adminNotify" -> AdminNotificationsPageView()
                "scraping" -> WebScrapingPageView()
                "gnews_dashboard" -> GNewsDashboardView()
                "affiliate_settings" -> AffiliateSettingsView(onBack = { activePage = "profile" })
            }
        }
    }
}
