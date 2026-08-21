package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.alfanews.telugu.R
import com.alfanews.telugu.models.*
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.DateTimeUtils
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManageSurveysPageView(
    currentUser: User?,
    language: Language = Language.TELUGU,
    showTitle: Boolean = true,
    onNavigateToCreateSurvey: (() -> Unit)? = null,
    onEditSurvey: ((NewsPost) -> Unit)? = null
) {
    var surveys by remember { mutableStateOf<List<NewsPost>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showDeleteDialog by remember { mutableStateOf<String?>(null) }
    var showResultsDialog by remember { mutableStateOf<NewsPost?>(null) }
    var showDetailPreviewDialog by remember { mutableStateOf<NewsPost?>(null) }

    // ✅ REAL-TIME LISTENER for Surveys
    DisposableEffect(currentUser) {
        val query = FirebaseService.db.collection("news")
            .whereEqualTo("type", "survey")

        val listener = query.limit(50).addSnapshotListener { snapshot, e ->
            loading = false
            if (e != null) {
                android.util.Log.e("ManageSurveys", "Error: ${e.message}")
                return@addSnapshotListener
            }
            
            if (snapshot != null) {
                surveys = snapshot.documents.mapNotNull { doc ->
                    mapMapToNewsPost(doc.id, doc.data ?: emptyMap(), language)
                }.sortedByDescending { it.timestamp }
            }
        }
        
        onDispose { listener.remove() }
    }

    fun approveSurvey(postId: String) {
        scope.launch {
            try {
                FirebaseService.db.collection("news").document(postId)
                    .update(mapOf(
                        "approved" to true,
                        "status" to "PUBLISHED"
                    )).await()
                Toast.makeText(context, "సర్వే ఆమోదించబడింది (Approved)!", Toast.LENGTH_SHORT).show()
                // Update local preview if open
                if (showDetailPreviewDialog?.id == postId) {
                    showDetailPreviewDialog = showDetailPreviewDialog?.copy(approved = true, status = "PUBLISHED")
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun deleteSurvey(postId: String) {
        scope.launch {
            try {
                FirebaseService.db.collection("news").document(postId).delete().await()
                Toast.makeText(context, "సర్వే తొలగించబడింది", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                showDeleteDialog = null
                if (showDetailPreviewDialog?.id == postId) {
                    showDetailPreviewDialog = null
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        val canPost = currentUser?.canPostSurvey() == true && onNavigateToCreateSurvey != null

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (showTitle) {
                Text(
                    text = "సర్వే నిర్వహణ",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.ExtraBold
                )
            } else {
                Spacer(modifier = Modifier.weight(1f))
            }

            if (canPost) {
                Button(
                    onClick = { onNavigateToCreateSurvey?.invoke() },
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = stringResource(R.string.post_survey),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 80.dp)
            ) {
                if (surveys.isEmpty()) {
                    item {
                        Text(
                            text = "సర్వేలు ఏవీ లేవు.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            modifier = Modifier.fillMaxWidth().padding(top = 100.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    items(surveys, key = { it.id }) { survey ->
                        val isStaff = currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.EDITOR || currentUser?.role == UserRole.NEWS_DESK || currentUser?.role == UserRole.REGIONAL_INCHARGE
                        val isOwner = currentUser?.id != null && survey.reporter.id == currentUser.id
                        val canEdit = isStaff || isOwner
                        val canDelete = isStaff || isOwner
                        val canApprove = isStaff && !survey.approved

                        SurveyManagementCard(
                            survey = survey,
                            isAdmin = isStaff,
                            canEdit = canEdit,
                            canDelete = canDelete,
                            canApprove = canApprove,
                            onClickCard = { showDetailPreviewDialog = survey },
                            onApprove = { approveSurvey(survey.id) },
                            onEdit = { onEditSurvey?.invoke(survey) },
                            onDelete = { showDeleteDialog = survey.id },
                            onViewResults = { showResultsDialog = survey }
                        )
                    }
                }
            }
        }
    }

    // Detail Preview Dialog
    showDetailPreviewDialog?.let { survey ->
        val isStaff = currentUser?.role == UserRole.ADMIN || currentUser?.role == UserRole.EDITOR || currentUser?.role == UserRole.NEWS_DESK || currentUser?.role == UserRole.REGIONAL_INCHARGE
        val isOwner = currentUser?.id != null && survey.reporter.id == currentUser.id
        val canEdit = isStaff || isOwner
        val canDelete = isStaff || isOwner
        val canApprove = isStaff && !survey.approved

        SurveyDetailPreviewDialog(
            survey = survey,
            canApprove = canApprove,
            canEdit = canEdit,
            canDelete = canDelete,
            onApprove = { approveSurvey(survey.id) },
            onEdit = {
                val sToEdit = survey
                showDetailPreviewDialog = null
                onEditSurvey?.invoke(sToEdit)
            },
            onDelete = {
                val sId = survey.id
                showDetailPreviewDialog = null
                showDeleteDialog = sId
            },
            onViewResults = {
                val sRes = survey
                showDetailPreviewDialog = null
                showResultsDialog = sRes
            },
            onClose = { showDetailPreviewDialog = null }
        )
    }

    // Results Dialog
    showResultsDialog?.let { survey ->
        SurveyResultsAdminDialog(
            survey = survey,
            onClose = { showResultsDialog = null }
        )
    }

    // Delete Confirmation
    showDeleteDialog?.let { postId ->
        AlertDialog(
            onDismissRequest = { showDeleteDialog = null },
            title = { Text("సర్వే తొలగింపు") },
            text = { Text("ఈ సర్వేను తొలగించాలా?") },
            confirmButton = {
                Button(onClick = { deleteSurvey(postId) }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                    Text("తొలగించు")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = null }) { Text("రద్దు") }
            }
        )
    }
}

@Composable
fun SurveyManagementCard(
    survey: NewsPost,
    isAdmin: Boolean,
    canEdit: Boolean,
    canDelete: Boolean,
    canApprove: Boolean,
    onClickCard: () -> Unit,
    onApprove: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onViewResults: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClickCard),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = survey.headline.telugu,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            Text(
                text = "By: ${survey.reporter.name.ifBlank { "Admin" }} • ${DateTimeUtils.formatTimestamp(survey.timestamp, "dd MMM, hh:mm a")}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status Badge
                val statusColor = if (survey.approved) Color(0xFF4CAF50) else Color(0xFFFF9800)
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = if (survey.approved) "LIVE" else "PENDING",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = statusColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }

                // Actions
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(onClick = onViewResults) {
                        Icon(Icons.Default.BarChart, contentDescription = "Results", tint = MaterialTheme.colorScheme.primary)
                    }

                    if (canEdit) {
                        IconButton(onClick = onEdit) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                        }
                    }

                    if (canApprove) {
                        IconButton(onClick = onApprove) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Approve", tint = Color(0xFF4CAF50))
                        }
                    }

                    if (canDelete) {
                        IconButton(onClick = onDelete) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SurveyDetailPreviewDialog(
    survey: NewsPost,
    canApprove: Boolean,
    canEdit: Boolean,
    canDelete: Boolean,
    onApprove: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onViewResults: () -> Unit,
    onClose: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onClose,
        title = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "సర్వే వివరాలు",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    
                    val statusColor = if (survey.approved) Color(0xFF4CAF50) else Color(0xFFFF9800)
                    Surface(
                        color = statusColor.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = if (survey.approved) "LIVE" else "PENDING",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = statusColor,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Headline
                Text(
                    text = survey.headline.telugu,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                // Details/Content if present
                if (survey.content.telugu.isNotBlank()) {
                    Text(
                        text = survey.content.telugu,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                    )
                }

                // Reporter & Metadata
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "రిపోర్టర్: ${survey.reporter.name.ifBlank { "Admin" }}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "తేదీ: ${DateTimeUtils.formatTimestamp(survey.timestamp, "dd MMM yyyy, hh:mm a")}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                        Text(
                            text = "ప్రాంతం: ${if (survey.isGlobal) "రాష్ట్రం (Global)" else survey.district}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                }

                HorizontalDivider()

                // Questions & Options section
                Text(
                    text = "ప్రశ్నలు & ఆప్షన్స్ (Questions & Options):",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                if (survey.surveyQuestions.isEmpty()) {
                    Text(
                        text = "ప్రశ్నల వివరాలు అందుబాటులో లేవు.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                } else {
                    survey.surveyQuestions.forEachIndexed { qIdx, question ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                                    RoundedCornerShape(8.dp)
                                )
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "${qIdx + 1}. ${question.questionText}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )

                            question.options.forEachIndexed { oIdx, option ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(start = 12.dp, top = 2.dp, bottom = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "• ${option.text}",
                                        fontSize = 13.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Actions row: Approve, Edit, Delete
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (canApprove) {
                        Button(
                            onClick = onApprove,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("ఆమోదించు", fontSize = 12.sp)
                        }
                    }

                    if (canEdit) {
                        Button(
                            onClick = onEdit,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("ఎడిట్", fontSize = 12.sp)
                        }
                    }

                    if (canDelete) {
                        OutlinedButton(
                            onClick = onDelete,
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("తొలగించు", fontSize = 12.sp)
                        }
                    }
                }

                // Secondary row: View Results & Close
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onViewResults) {
                        Icon(Icons.Default.BarChart, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ఫలితాలు చూడు", fontSize = 13.sp)
                    }

                    TextButton(onClick = onClose) {
                        Text("మూసివేయి", fontSize = 13.sp)
                    }
                }
            }
        }
    )
}

@Composable
fun SurveyResultsAdminDialog(
    survey: NewsPost,
    onClose: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text("సర్వే ఫలితాలు") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(survey.headline.telugu, fontWeight = FontWeight.Bold)
                
                survey.surveyQuestions.forEach { question ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(question.questionText, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                        
                        val totalVotes = question.options.sumOf { survey.votes["q_${question.id}_o_${it.id}"] ?: 0 }
                        
                        question.options.forEach { option ->
                            val votes = survey.votes["q_${question.id}_o_${option.id}"] ?: 0
                            val pct = if (totalVotes > 0) (votes.toFloat() / totalVotes * 100) else 0f
                            
                            Column {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(option.text, style = MaterialTheme.typography.bodySmall)
                                    Text("${"%.1f".format(pct)}% ($votes)", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                }
                                LinearProgressIndicator(
                                    progress = pct / 100f,
                                    modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp))
                                )
                            }
                        }
                    }
                }
                
                Divider()
                
                Text(
                    text = "నిజమైన ఓట్లు: ${survey.realVotesCount}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                
                val daysSinceCreation = (System.currentTimeMillis() - survey.surveyCreatedAt) / 86400000L
                val fakeVotes = survey.fakeVotesBase + (daysSinceCreation.coerceAtLeast(0) * 527)
                Text(
                    text = "బయటకు కనిపించే ఓట్లు: ${fakeVotes + survey.realVotesCount}+",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
        },
        confirmButton = {
            Button(onClick = onClose) { Text("సరే") }
        }
    )
}

