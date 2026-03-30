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
import com.alfanews.telugu.viewmodels.ThemeMode
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import kotlinx.coroutines.launch
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
    onNavigate: (String) -> Unit,
    onLoginRequest: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pushEnabled by remember { mutableStateOf(user.pushEnabled) }

    val isGuest = user.role == UserRole.GUEST
    val isStaff = listOf(UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN).contains(user.role)

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

    /** నోటిఫికేషన్లను ఆన్/ఆఫ్ చేస్తుంది. */
    fun toggleNotifications() {
        scope.launch {
            val newValue = !pushEnabled
            pushEnabled = newValue
            try {
                FirebaseService.db.collection("users")
                    .document(user.id)
                    .update("pushEnabled", newValue)
                    .await()
            } catch (e: Exception) {
                Toast.makeText(context, context.getString(R.string.notification_setting_error), Toast.LENGTH_SHORT).show()
            }
        }
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // వినియోగదారు సమాచార కార్డ్
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
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
                            .border(3.dp, MaterialTheme.colorScheme.primary, CircleShape)
                    )
                    if (!isGuest) {
                        Surface(
                            modifier = Modifier.size(32.dp).clickable { onNavigate("edit-profile") },
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primary,
                            border = BorderStroke(2.dp, MaterialTheme.colorScheme.surface)
                        ) {
                            Icon(
                                Icons.Default.Edit,
                                contentDescription = stringResource(R.string.edit_profile),
                                modifier = Modifier.padding(6.dp),
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
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                Surface(
                    modifier = Modifier.padding(top = 4.dp),
                    color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = if (isGuest) stringResource(R.string.guest) else user.role.name,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
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
                        Text(stringResource(R.string.login_signup), fontWeight = FontWeight.Bold)
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
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
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

        // మా గురించి మరియు సంప్రదించండి
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
        ) {
            Column {
                mainLinks.forEachIndexed { index, (id, label) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(id) }
                            .padding(20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, fontFamily = Ramabhadra, fontSize = 18.sp, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                    if (index < mainLinks.size - 1) {
                        Divider(modifier = Modifier.padding(horizontal = 20.dp), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
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
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(bottom = 16.dp)
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
