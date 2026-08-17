package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Ramabhadra
import kotlinx.coroutines.launch

@Composable
fun ReportNewsDialog(
    postId: String,
    headlineText: String,
    onDismissRequest: () -> Unit,
    onReportSuccess: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val reasons = listOf(
        stringResource(R.string.report_reason_fake),
        stringResource(R.string.report_reason_defamation),
        stringResource(R.string.report_reason_hate),
        stringResource(R.string.report_reason_inappropriate),
        stringResource(R.string.report_reason_other)
    )

    var selectedReason by remember { mutableStateOf(reasons[0]) }
    var detailsText by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!isSubmitting) onDismissRequest() },
        shape = RoundedCornerShape(16.dp),
        icon = {
            Icon(
                imageVector = Icons.Default.Flag,
                contentDescription = null,
                tint = Color(0xFFDC2626),
                modifier = Modifier.size(28.dp)
            )
        },
        title = {
            Text(
                text = stringResource(R.string.report_news),
                fontSize = 18.sp,
                fontFamily = Ramabhadra,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (headlineText.isNotBlank()) {
                    Text(
                        text = headlineText,
                        fontSize = 13.sp,
                        fontFamily = Mallanna,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Text(
                    text = stringResource(R.string.report_reason_title),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                reasons.forEach { reason ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !isSubmitting) { selectedReason = reason }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = (selectedReason == reason),
                            onClick = { if (!isSubmitting) selectedReason = reason },
                            colors = RadioButtonDefaults.colors(selectedColor = Color(0xFFDC2626))
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = reason,
                            fontSize = 14.sp,
                            fontFamily = Mallanna,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }

                OutlinedTextField(
                    value = detailsText,
                    onValueChange = { detailsText = it },
                    label = { Text("అదనపు వివరాలు (ఐచ్ఛికం)", fontSize = 12.sp) },
                    placeholder = { Text("సమస్యను క్లుప్తంగా వివరించండి...", fontSize = 12.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    enabled = !isSubmitting,
                    shape = RoundedCornerShape(8.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (isSubmitting) return@Button
                    isSubmitting = true
                    scope.launch {
                        try {
                            val result = FirebaseFunctionsService.reportNewsPost(
                                postId = postId,
                                reason = selectedReason,
                                details = detailsText.trim().ifEmpty { null }
                            )
                            isSubmitting = false
                            if (result.isSuccess) {
                                val message = result.getOrNull()?.get("message") as? String
                                    ?: context.getString(R.string.report_success)
                                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                                onReportSuccess()
                                onDismissRequest()
                            } else {
                                Toast.makeText(
                                    context,
                                    context.getString(R.string.report_error),
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        } catch (e: Exception) {
                            isSubmitting = false
                            Toast.makeText(
                                context,
                                context.getString(R.string.report_error),
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                },
                enabled = !isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.report_submitting), fontSize = 13.sp)
                } else {
                    Text(stringResource(R.string.report_submit), fontSize = 13.sp, color = Color.White)
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismissRequest,
                enabled = !isSubmitting
            ) {
                Text(stringResource(R.string.cancel), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    )
}
