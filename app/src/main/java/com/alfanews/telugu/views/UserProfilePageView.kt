package com.alfanews.telugu.views

import android.app.Activity
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.utils.PreferenceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.tasks.await
import java.net.URLEncoder

/**
 * వినియోగదారు ప్రొఫైల్ పేజీ (UserProfilePageView).
 */
@Composable
fun UserProfilePageView(
    user: User,
    language: Language,
    setLanguage: (Language) -> Unit,
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    onThemeModeChange: (ThemeMode) -> Unit = {},
    onNavigate: (String) -> Unit = {},
    onLoginRequest: (() -> Unit)? = null,
    onToggleNotifications: (Boolean) -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { PreferenceManager.getInstance(context) }

    val isGuest = user.id == "guest" || user.role == UserRole.GUEST
    val isStaff = listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN, UserRole.REGIONAL_INCHARGE).contains(user.role)

    var pushEnabled by remember { mutableStateOf(user.pushEnabled) }
    var storageLimit by remember { mutableIntStateOf(prefs.storageLimitMB) }

    /** ప్రస్తుత కాష్ పరిమాణాన్ని లెక్కిస్తుంది. */
    fun getCacheSize(): String {
        var totalSize: Long = 0
        try {
            context.cacheDir.walkTopDown().forEach { if (it.isFile) totalSize += it.length() }
            context.filesDir.walkTopDown().forEach { 
                if (it.isFile && (it.name.contains("cache", true) || it.name.contains("coil", true) || it.name.contains("image", true))) {
                    totalSize += it.length() 
                }
            }
        } catch (e: Exception) { }
        
        return if (totalSize < 1024 * 1024) {
            "${totalSize / 1024} KB"
        } else {
            "${totalSize / (1024 * 1024)} MB"
        }
    }

    var currentCacheSize by remember { mutableStateOf(getCacheSize()) }

    /** నోటిఫికేషన్లను ఆన్/ఆఫ్ చేస్తుంది. */
    fun toggleNotifications() {
        val newValue = !pushEnabled
        
        // ఆండ్రాయిడ్ 13+ కోసం పర్మిషన్ చెక్
        if (newValue && android.os.Build.VERSION.SDK_INT >= 33) { // 33 is TIRAMISU
            val permission = "android.permission.POST_NOTIFICATIONS"
            if (androidx.core.content.ContextCompat.checkSelfPermission(context, permission) != 0) { // 0 is PERMISSION_GRANTED
                (context as? android.app.Activity)?.let { activity ->
                    androidx.core.app.ActivityCompat.requestPermissions(activity, kotlin.arrayOf(permission), 101)
                }
            }
        }

        pushEnabled = newValue
        onToggleNotifications(newValue)
    }

    /** సైన్ అవుట్ ప్రక్రియను నిర్వహిస్తుంది. */
    fun handleLogout() {
        FirebaseService.auth.signOut()
    }

    /** వినియోగదారు ఖాతాను తొలగిస్తుంది. */
    fun handleDelete() {
        scope.launch {
            try {
                FirebaseService.db.collection("users")
                    .document(user.id)
                    .delete()
                    .await()
                FirebaseService.auth.signOut()
            } catch (e: Exception) {
                Toast.makeText(context, context.getString(R.string.account_delete_error, e.message ?: ""), Toast.LENGTH_SHORT).show()
            }
        }
    }

    /** కాష్ ని క్లియర్ చేస్తుంది. */
    fun clearCache() {
        scope.launch(Dispatchers.IO) {
            try {
                context.cacheDir.deleteRecursively()
                context.filesDir.listFiles()?.forEach { file ->
                    if (file.name.contains("cache", true) || file.name.contains("coil", true) || file.name.contains("image", true)) {
                        file.deleteRecursively()
                    }
                }
                withContext(Dispatchers.Main) {
                    currentCacheSize = "0 MB"
                    Toast.makeText(context, context.getString(R.string.cache_cleared_success), Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // ముఖ్యమైన లింక్‌లు
    val mainLinks = listOf(
        "about" to stringResource(R.string.about_us),
        "contact" to stringResource(R.string.contact_us)
    )

    // పాలసీ లింక్‌లు
    val policyLinks = listOf(
        "privacy-policy" to stringResource(R.string.privacy_policy),
        "terms" to stringResource(R.string.terms_of_service),
        "content-policy" to stringResource(R.string.content_policy),
        "disclaimer" to stringResource(R.string.disclaimer),
        "ad-policy" to stringResource(R.string.ad_policy),
        "data-collection" to stringResource(R.string.data_policy)
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // వినియోగదారు సమాచార కార్డ్
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.05f))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(contentAlignment = Alignment.BottomEnd) {
                    AsyncImage(
                        model = user.photoUrl ?: "https://ui-avatars.com/api/?name=${URLEncoder.encode(user.name, "UTF-8")}&background=random",
                        contentDescription = user.name,
                        modifier = Modifier
                            .size(110.dp)
                            .clip(CircleShape)
                            .border(2.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), CircleShape)
                    )
                    if (!isGuest) {
                        Surface(
                            modifier = Modifier.size(32.dp).clickable { onNavigate("edit-profile") },
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primary,
                            shadowElevation = 2.dp
                        ) {
                            Icon(
                                Icons.Default.Edit,
                                contentDescription = stringResource(R.string.edit_profile),
                                modifier = Modifier.padding(8.dp),
                                tint = MaterialTheme.colorScheme.onPrimary
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    user.name,
                    fontSize = 28.sp,
                    fontFamily = Ramabhadra,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center
                )
                
                Surface(
                    modifier = Modifier.padding(top = 4.dp),
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = when {
                            isGuest -> stringResource(R.string.guest)
                            user.role == UserRole.ADMIN -> stringResource(R.string.admin)
                            user.role == UserRole.EDITOR -> stringResource(R.string.editor)
                            user.role == UserRole.REPORTER -> stringResource(R.string.reporter)
                            user.role == UserRole.SUBSCRIBER -> stringResource(R.string.subscriber)
                            else -> user.role.name
                        },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                if (isGuest) {
                    Button(
                        onClick = { onLoginRequest?.invoke() },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = MaterialTheme.shapes.medium,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text(stringResource(R.string.login_signup), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimary)
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { onNavigate("edit-profile") },
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = MaterialTheme.shapes.medium,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text(stringResource(R.string.edit_profile), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimary)
                        }
                        if (isStaff) {
                            OutlinedButton(
                                onClick = { onNavigate("id-card") },
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = MaterialTheme.shapes.medium,
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                            ) {
                                Text(stringResource(R.string.id_card), color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
        
        // భాష ఎంపిక (Language Selector)
        SettingsGroup(
            title = stringResource(R.string.news_language)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), MaterialTheme.shapes.medium)
                    .padding(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(MaterialTheme.shapes.small)
                        .background(if (language == Language.TELUGU) MaterialTheme.colorScheme.primary else Color.Transparent)
                        .clickable { 
                            if (language != Language.TELUGU) {
                                setLanguage(Language.TELUGU)
                                (context as? Activity)?.recreate()
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(stringResource(R.string.language_telugu), fontWeight = FontWeight.Bold, color = if (language == Language.TELUGU) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(MaterialTheme.shapes.small)
                        .background(if (language == Language.ENGLISH) MaterialTheme.colorScheme.primary else Color.Transparent)
                        .clickable { 
                            if (language != Language.ENGLISH) {
                                setLanguage(Language.ENGLISH)
                                (context as? Activity)?.recreate()
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(stringResource(R.string.language_english), fontWeight = FontWeight.Bold, color = if (language == Language.ENGLISH) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // థీమ్ ఎంపిక (Theme Selector)
        SettingsGroup(stringResource(R.string.display_theme)) {
             Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), MaterialTheme.shapes.medium)
                    .padding(4.dp)
            ) {
                ThemeOption(
                    label = stringResource(R.string.theme_light),
                    isSelected = themeMode == ThemeMode.LIGHT,
                    onClick = { onThemeModeChange(ThemeMode.LIGHT) },
                    modifier = Modifier.weight(1f)
                )
                ThemeOption(
                    label = stringResource(R.string.theme_dark),
                    isSelected = themeMode == ThemeMode.DARK,
                    onClick = { onThemeModeChange(ThemeMode.DARK) },
                    modifier = Modifier.weight(1f)
                )
                ThemeOption(
                    label = stringResource(R.string.theme_system),
                    isSelected = themeMode == ThemeMode.SYSTEM,
                    onClick = { onThemeModeChange(ThemeMode.SYSTEM) },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // నోటిఫికేషన్లు
        SettingsGroup(stringResource(R.string.notifications)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Notifications, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(stringResource(R.string.push_notifications), color = MaterialTheme.colorScheme.onSurface)
                }
                Switch(
                    checked = pushEnabled,
                    onCheckedChange = { toggleNotifications() },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = MaterialTheme.colorScheme.primary
                    )
                )
            }
        }

        // స్టోరేజ్ మేనేజ్‌మెంట్ (Storage Management)
        SettingsGroup(stringResource(R.string.storage_management)) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(R.string.current_cache_usage, currentCacheSize),
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                Button(
                    onClick = { clearCache() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.1f)),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(stringResource(R.string.clear_cache_now), color = MaterialTheme.colorScheme.secondary)
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = stringResource(R.string.cache_size_limit),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                val limits = listOf(100, 200, 500, 0) // 0 for unlimited
                limits.forEach { limit ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { 
                                storageLimit = limit
                                prefs.storageLimitMB = limit
                            }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = storageLimit == limit,
                            onClick = { 
                                storageLimit = limit
                                prefs.storageLimitMB = limit
                            }
                        )
                        Text(
                            text = when(limit) {
                                100 -> stringResource(R.string.cache_size_100mb)
                                200 -> stringResource(R.string.cache_size_200mb)
                                500 -> stringResource(R.string.cache_size_500mb)
                                else -> stringResource(R.string.cache_size_unlimited)
                            },
                            modifier = Modifier.padding(start = 8.dp)
                        )
                    }
                }
            }
        }

        // మా గురించి మరియు సంప్రదించండి
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.05f))
        ) {
            Column {
                mainLinks.forEachIndexed { index, (id, label) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(id) }
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = if (id == "about") Icons.Default.Info else Icons.Default.Email,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(label, fontFamily = Ramabhadra, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline)
                    }
                    if (index < mainLinks.size - 1) {
                        Divider(modifier = Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                    }
                }
            }
        }

        // ఇతర పాలసీలు
        SettingsGroup(stringResource(R.string.policies_info)) {
            Column {
                policyLinks.forEachIndexed { index, (id, label) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(id) }
                            .padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, fontFamily = Mallanna, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline)
                    }
                    if (index < policyLinks.size - 1) {
                        Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // లాగ్ అవుట్ మరియు ఖాతా తొలగింపు
        if (!isGuest) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { handleLogout() },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = MaterialTheme.shapes.medium,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Text(stringResource(R.string.logout), color = MaterialTheme.colorScheme.onErrorContainer, fontWeight = FontWeight.Bold)
                }

                TextButton(
                    onClick = { handleDelete() },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.delete_account), color = MaterialTheme.colorScheme.outline, fontSize = 12.sp)
                }
            }
        }
    }
}

/** సెట్టింగ్స్ సమూహాన్ని ప్రదర్శించే కాంపోజబుల్. */
@Composable
fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.05f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
                modifier = Modifier.padding(bottom = 12.dp)
            )
            content()
        }
    }
}

/** థీమ్ ఎంపిక బటన్. */
@Composable
fun ThemeOption(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(40.dp)
            .clip(MaterialTheme.shapes.small)
            .background(if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontFamily = Poppins,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 13.sp
        )
    }
}
