package com.alfanews.telugu.views

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.alfanews.telugu.ViewModelFactory
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.viewmodels.LeaderboardViewModel
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaderboardView(
    language: Language,
    onBack: () -> Unit,
    onReporterClick: (String) -> Unit
) {
    val context = LocalContext.current
    val viewModel: LeaderboardViewModel = viewModel(
        factory = ViewModelFactory(context.applicationContext as Application)
    )
    val entries by viewModel.leaderboard.collectAsStateWithLifecycle()
    val loading by viewModel.loading.collectAsStateWithLifecycle()

    val calendar = Calendar.getInstance()
    val monthName = calendar.getDisplayName(Calendar.MONTH, Calendar.LONG, if (language == Language.TELUGU) Locale("te") else Locale.ENGLISH)
    val year = calendar.get(Calendar.YEAR)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text(
                            text = if (language == Language.TELUGU) "మంత్లీ లీడర్ బోర్డ్" else "Monthly Leaderboard",
                            fontFamily = Ramabhadra,
                            fontSize = 18.sp
                        )
                        Text(
                            text = "$monthName $year",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Normal
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        if (loading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (entries.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text(
                    text = if (language == Language.TELUGU) "డేటా అందుబాటులో లేదు." else "No data available.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .background(MaterialTheme.colorScheme.background),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                itemsIndexed(entries) { index, reporter ->
                    LeaderboardEntryCard(
                        rank = index + 1,
                        reporter = reporter,
                        onClick = { onReporterClick(reporter.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun LeaderboardEntryCard(
    rank: Int,
    reporter: User,
    onClick: () -> Unit
) {
    val rankColor = when (rank) {
        1 -> Color(0xFFFFD700) // Gold
        2 -> Color(0xFFC0C0C0) // Silver
        3 -> Color(0xFFCD7F32) // Bronze
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Rank Circle
            Surface(
                modifier = Modifier.size(36.dp),
                shape = CircleShape,
                color = if (rank <= 3) rankColor else MaterialTheme.colorScheme.surfaceVariant
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (rank <= 3) {
                        Icon(
                            Icons.Default.EmojiEvents,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                            tint = Color.White
                        )
                    } else {
                        Text(
                            text = rank.toString(),
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            AsyncImage(
                model = reporter.photoUrl ?: "https://ui-avatars.com/api/?name=${reporter.name}&background=random",
                contentDescription = null,
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            Column(
                modifier = Modifier
                    .padding(start = 12.dp)
                    .weight(1f)
            ) {
                Text(
                    text = reporter.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                Text(
                    text = "${reporter.district ?: ""} ${if (reporter.assignedMandal.isNullOrEmpty()) "" else "- ${reporter.assignedMandal}"}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = reporter.points.toString(),
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 20.sp,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Points",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
