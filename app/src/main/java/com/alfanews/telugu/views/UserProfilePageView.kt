package com.alfanews.telugu.views

import android.app.Activity
import android.app.Application
import android.content.Intent
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.alfanews.telugu.R
import com.alfanews.telugu.ViewModelFactory
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.models.ThemeMode
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.viewmodels.LeaderboardViewModel
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
    onToggleNotifications: (Boolean) -> Unit = {},
    onMenuClick: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val leaderboardViewModel: LeaderboardViewModel = viewModel(
        factory = ViewModelFactory(context.applicationContext as Application)
    )
    val leaderboardEntries by leaderboardViewModel.leaderboard.collectAsStateWithLifecycle()
    val leaderboardLoading by leaderboardViewModel.loading.collectAsStateWithLifecycle()

    val isGuest = user.id == "guest" || user.role == UserRole.GUEST
    val isStaff = listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN, UserRole.REGIONAL_INCHARGE, UserRole.NEWS_DESK).contains(user.role)

    var pushEnabled by remember { mutableStateOf(user.pushEnabled) }

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
        "reporters" to stringResource(R.string.reporters),
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
    ) {
        Column(
            modifier = Modifier
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

            // 🎁 యాప్ ప్రమోషన్ & పాయింట్లు (Referral Promotion Box)
            if (!isGuest) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.large,
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CardGiftcard,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(24.dp)
                            )
                            Text(
                                text = if (language == Language.TELUGU) "యాప్ ప్రమోషన్ & పాయింట్లు" else "App Promotion & Points",
                                fontSize = 18.sp,
                                fontFamily = Ramabhadra,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Text(
                            text = if (language == Language.TELUGU) 
                                "ఈ క్రింది లింక్ ద్వారా ఇతరులు యాప్‌ను డౌన్‌లోడ్ చేసుకుంటే మీకు 50 పాయింట్లు లభిస్తాయి." 
                            else 
                                "Share the link below. You'll get 50 points when someone installs the app through your link.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        val referralLink = "https://play.google.com/store/apps/details?id=com.alfanews.telugu&referrer=ref_${user.id}"

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = referralLink,
                                    modifier = Modifier.weight(1f),
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                                    fontFamily = Poppins
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
                                Icon(
                                    imageVector = Icons.Default.ContentCopy,
                                    contentDescription = "Copy",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clickable {
                                            clipboardManager.setText(androidx.compose.ui.text.AnnotatedString(referralLink))
                                            Toast.makeText(
                                                context,
                                                if (language == Language.TELUGU) "రిఫరల్ లింక్ కాపీ చేయబడింది!" else "Referral link copied!",
                                                Toast.LENGTH_SHORT
                                            ).show()
                                        }
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Total installs count display
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Download,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = if (language == Language.TELUGU) 
                                        "మొత్తం ఇన్‌స్టాల్స్: ${user.referralCount}" 
                                    else 
                                        "Total Installs: ${user.referralCount}",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }

                            // Direct Share Button
                            Button(
                                onClick = {
                                    val shareText = if (language == Language.TELUGU)
                                        "ఆల్ఫా న్యూస్ యాప్‌ని డౌన్‌లోడ్ చేసుకోండి మరియు తాజా వార్తలను తెలుసుకోండి!\n\nడౌన్‌లోడ్ లింక్: $referralLink"
                                    else
                                        "Download Alfa News app to get the latest news updates!\n\nDownload Link: $referralLink"
                                    val shareIntent = Intent().apply {
                                        action = Intent.ACTION_SEND
                                        putExtra(Intent.EXTRA_TEXT, shareText)
                                        type = "text/plain"
                                    }
                                    context.startActivity(Intent.createChooser(shareIntent, if (language == Language.TELUGU) "యాప్ లింక్ షేర్ చేయండి" else "Share App Link"))
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Share,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onPrimary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = if (language == Language.TELUGU) "షేర్" else "Share",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                            }
                        }
                    }
                }
            }

            // ✉️ సందేశాలు (Messages) - logged-in users only
            if (!isGuest) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigate("messages") },
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.05f))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Mail, contentDescription = null, tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = stringResource(R.string.messages),
                                fontFamily = Ramabhadra,
                                fontSize = 18.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline)
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
                }
            }

            // రిపోర్టర్ ఇన్సెంటివ్ సిస్టమ్ (Internal Staff Only)
            if (isStaff) {
                SettingsGroup(if (language == Language.TELUGU) "రిపోర్టర్ బోర్డ్" else "Reporter Board") {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        // Top 3 Mini Leaderboard
                        if (leaderboardLoading) {
                            Box(
                                modifier = Modifier.fillMaxWidth().height(60.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                            }
                        } else if (leaderboardEntries.isNotEmpty()) {
                            leaderboardEntries.take(3).forEachIndexed { index, reporter: com.alfanews.telugu.models.User ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.5f))
                                        .padding(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // Rank icon
                                    val rankColor = when (index) {
                                        0 -> Color(0xFFFFD700) // Gold
                                        1 -> Color(0xFFC0C0C0) // Silver
                                        else -> Color(0xFFCD7F32) // Bronze
                                    }
                                    Icon(
                                        Icons.Default.EmojiEvents,
                                        contentDescription = null,
                                        tint = rankColor,
                                        modifier = Modifier.size(24.dp)
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    AsyncImage(
                                        model = (reporter.photoUrl ?: "https://ui-avatars.com/api/?name=${URLEncoder.encode(reporter.name, "UTF-8")}&background=random"),
                                        contentDescription = null,
                                        modifier = Modifier.size(32.dp).clip(CircleShape),
                                        contentScale = ContentScale.Crop
                                    )
                                    Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                                        Text(reporter.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                                        Text(reporter.district ?: "", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Text(
                                        text = reporter.points.toString(),
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 16.sp,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        } else {
                            Box(
                                modifier = Modifier.fillMaxWidth().height(60.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    if (language == Language.TELUGU) "డేటా అందుబాటులో లేదు." else "No data available.",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Button(
                            onClick = { onNavigate("leaderboard") },
                            modifier = Modifier.fillMaxWidth().height(40.dp),
                            shape = MaterialTheme.shapes.small,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                            ),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text(
                                text = if (language == Language.TELUGU) "పూర్తి వివరాలు చూడండి (View All)" else "View All",
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
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
                                val icon = when(id) {
                                    "reporters" -> Icons.Default.People
                                    "about" -> Icons.Default.Info
                                    else -> Icons.Default.Email
                                }
                                Icon(
                                    imageVector = icon,
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
            
            Spacer(modifier = Modifier.height(32.dp))
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
