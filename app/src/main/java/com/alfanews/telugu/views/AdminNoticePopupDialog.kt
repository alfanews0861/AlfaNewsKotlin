package com.alfanews.telugu.views

import androidx.compose.animation.*
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.alfanews.telugu.models.AdminNotice
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.DateTimeUtils

/**
 * విలేకరులు/వినియోగదారులు ప్రొఫైల్ ఓపెన్ చేసినప్పుడు అడ్మిన్ లేదా ఎడిటోరియల్ డెస్క్ పంపిన
 * ముఖ్యమైన సందేశాలను తప్పనిసరిగా చదివించడానికి చూపే In-App Popup Dialog.
 */
@Composable
fun AdminNoticePopupDialog(
    notices: List<AdminNotice>,
    onOpenAllMessages: () -> Unit,
    onDismiss: () -> Unit
) {
    if (notices.isEmpty()) return

    var currentIndex by remember { mutableIntStateOf(0) }
    val currentNotice = notices.getOrElse(currentIndex.coerceIn(0, notices.size - 1)) { notices.first() }

    // సందేశ రకాన్ని బట్టి బ్యానర్ వివరాలు (WARNING vs BROADCAST/NOTICE)
    val isWarning = currentNotice.type == "WARNING"

    val (headerBg, headerIcon, headerTitle) = when {
        isWarning -> Triple(
            Color(0xFFD32F2F),
            Icons.Default.Warning,
            "🚨 అత్యవసర హెచ్చరిక (Warning Notice)"
        )
        else -> Triple(
            Color(0xFFD32F2F),
            Icons.Default.Campaign,
            "📢 ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్ ప్రకటన"
        )
    }

    val dateStr = remember(currentNotice.timestamp) {
        if (currentNotice.timestamp > 0) {
            DateTimeUtils.formatTimestamp(currentNotice.timestamp, "dd MMM yyyy, hh:mm a")
        } else ""
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false
        )
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .wrapContentHeight()
                .padding(vertical = 16.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Header Banner
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(headerBg)
                        .padding(horizontal = 16.dp, vertical = 14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(Color.White.copy(alpha = 0.2f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = headerIcon,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = headerTitle,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                fontFamily = Ramabhadra,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close",
                                tint = Color.White.copy(alpha = 0.85f),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                // Sub-header / Notice Pager if multiple notices exist
                if (notices.size > 1) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "చదవని సందేశాలు: ${currentIndex + 1} / ${notices.size}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                IconButton(
                                    onClick = { if (currentIndex > 0) currentIndex-- },
                                    enabled = currentIndex > 0,
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.ChevronLeft,
                                        contentDescription = "Previous",
                                        tint = if (currentIndex > 0) MaterialTheme.colorScheme.primary else Color.Gray.copy(alpha = 0.4f)
                                    )
                                }
                                IconButton(
                                    onClick = { if (currentIndex < notices.size - 1) currentIndex++ },
                                    enabled = currentIndex < notices.size - 1,
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.ChevronRight,
                                        contentDescription = "Next",
                                        tint = if (currentIndex < notices.size - 1) MaterialTheme.colorScheme.primary else Color.Gray.copy(alpha = 0.4f)
                                    )
                                }
                            }
                        }
                    }
                }

                // Content Body
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 14.dp)
                ) {
                    // Sender info & Timestamp
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = currentNotice.senderName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        if (dateStr.isNotEmpty()) {
                            Text(
                                text = dateStr,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.75f)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Title
                    if (currentNotice.title.isNotBlank()) {
                        Text(
                            text = currentNotice.title,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = Ramabhadra,
                            color = MaterialTheme.colorScheme.onSurface,
                            lineHeight = 22.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    // Message text in scrollable area if long
                    val scrollState = rememberScrollState()
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 260.dp)
                            .verticalScroll(scrollState)
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                                RoundedCornerShape(12.dp)
                            )
                            .padding(12.dp)
                    ) {
                        Text(
                            text = currentNotice.text.ifBlank { currentNotice.title },
                            fontSize = 14.sp,
                            fontFamily = Mallanna,
                            color = MaterialTheme.colorScheme.onSurface,
                            lineHeight = 22.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Action Button: విలేకరి తప్పనిసరిగా సందేశాలను ఓపెన్ చేసి చదవాలి
                    Button(
                        onClick = onOpenAllMessages,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Chat,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "అన్ని సందేశాలు చూడండి (ఇన్‌బాక్స్)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            fontFamily = Ramabhadra
                        )
                    }
                }
            }
        }
    }
}
