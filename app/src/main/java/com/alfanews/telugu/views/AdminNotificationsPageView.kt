package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminNotificationsPageView(showTitle: Boolean = true) {
    var latestPosts by remember { mutableStateOf<List<NewsPost>>(emptyList()) }
    var selectedPostId by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var loadingPosts by remember { mutableStateOf(true) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Notification Channel State
    val channels = mapOf(
        "general_news" to "General News",
        "breaking_news" to "Breaking News",
        "local_news" to "Local News"
    )
    var selectedChannelId by remember { mutableStateOf("general_news") }
    var channelExpanded by remember { mutableStateOf(false) }


    LaunchedEffect(Unit) {
        scope.launch {
            loadingPosts = true
            try {
                val snapshot = FirebaseService.db.collection("news")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(100)
                    .get()
                    .await()

                latestPosts = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val headlineData = data["headline"] as? Map<*, *> ?: emptyMap<Any, Any>()

                    NewsPost(
                        id = doc.id,
                        headline = com.alfanews.telugu.models.Headline(
                            telugu = headlineData["telugu"] as? String ?: "",
                            english = headlineData["english"] as? String ?: ""
                        ),
                        content = com.alfanews.telugu.models.Content(),
                        mediaUrl = data["mediaUrl"] as? String ?: "",
                        categories = listOf(data["category"] as? String ?: "")
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                loadingPosts = false
            }
        }
    }

    var customTitle by remember { mutableStateOf("") }
    var customBody by remember { mutableStateOf("") }
    var useCustomMessage by remember { mutableStateOf(false) }

    fun handleSend() {
        if (!useCustomMessage && selectedPostId.isEmpty()) {
            Toast.makeText(context, "దయచేసి ఒక వార్తను ఎంచుకోండి లేదా కస్టమ్ మెసేజ్ టైప్ చేయండి.", Toast.LENGTH_SHORT).show()
            return
        }
        if (useCustomMessage && (customTitle.isEmpty() || customBody.isEmpty())) {
            Toast.makeText(context, "శీర్షిక మరియు వివరణ తప్పనిసరి.", Toast.LENGTH_SHORT).show()
            return
        }

        val selectedPost = latestPosts.find { it.id == selectedPostId }

        scope.launch {
            isSending = true
            try {
                // Determine title and silent status from channel
                val isSilent = selectedChannelId != "breaking_news"
                
                val finalTitle = if (useCustomMessage) customTitle else {
                    if (selectedChannelId == "breaking_news") "🔴 బ్రేకింగ్ న్యూస్" else selectedPost?.headline?.telugu ?: ""
                }
                
                val finalBody = if (useCustomMessage) customBody else selectedPost?.headline?.telugu ?: ""
                val actionUrl = if (useCustomMessage) "" else "#/s/${selectedPost?.id}"
                val imageUrl = if (useCustomMessage) "" else selectedPost?.mediaUrl ?: ""

                val result = FirebaseFunctionsService.triggerPushBroadcast(
                    title = finalTitle,
                    body = finalBody,
                    actionUrl = actionUrl,
                    topic = "all_users",
                    silent = isSilent,
                    channelId = selectedChannelId,
                    imageUrl = imageUrl.ifBlank { null }
                )

                if (result.isSuccess) {
                    Toast.makeText(context, "నోటిఫికేషన్ విజయవంతంగా పంపబడింది!", Toast.LENGTH_SHORT).show()
                    if (!useCustomMessage) selectedPostId = "" else {
                        customTitle = ""
                        customBody = ""
                    }
                } else {
                    Toast.makeText(
                        context,
                        "లోపం: ${result.exceptionOrNull()?.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSending = false
            }
        }
    }

    ElevatedCard(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        shape = RoundedCornerShape(8.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (showTitle) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("📢", fontSize = 24.sp)
                    Text(
                        text = "Mobile Push Broadcast",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = "గమనిక: కింద ఉన్న డ్రాప్ డౌన్ నుండి ఒక వార్తను ఎంచుకోండి. అది యూజర్ల మొబైల్ హోమ్ స్క్రీన్ పై అలర్ట్ లాగా కనిపిస్తుంది.",
                    modifier = Modifier.padding(16.dp),
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }

            // New Channel Dropdown
            Text(
                text = "నోటిఫికేషన్ ఛానెల్ (Channel)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            ExposedDropdownMenuBox(
                expanded = channelExpanded,
                onExpandedChange = { channelExpanded = !channelExpanded },
            ) {
                OutlinedTextField(
                    value = channels[selectedChannelId] ?: "",
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    label = { Text("ఛానెల్") },
                    shape = RoundedCornerShape(8.dp),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = channelExpanded) }
                )
                ExposedDropdownMenu(
                    expanded = channelExpanded,
                    onDismissRequest = { channelExpanded = false }
                ) {
                    channels.forEach { (id, name) ->
                        DropdownMenuItem(
                            text = { Text(name) },
                            onClick = {
                                selectedChannelId = id
                                channelExpanded = false
                            }
                        )
                    }
                }
            }

            // Toggle between Custom and Post-based
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (useCustomMessage) "✍️ కస్టమ్ మెసేజ్ పంపు" else "📰 వార్తను ఎంచుకో",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Button(
                    onClick = { useCustomMessage = !useCustomMessage },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                ) {
                    Text(if (useCustomMessage) "వార్తకు మారు" else "కస్టమ్ కి మారు")
                }
            }

            if (useCustomMessage) {
                OutlinedTextField(
                    value = customTitle,
                    onValueChange = { customTitle = it },
                    label = { Text("నోటిఫికేషన్ శీర్షిక (Title)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = customBody,
                    onValueChange = { customBody = it },
                    label = { Text("నోటిఫికేషన్ వివరణ (Body)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    minLines = 3
                )
            } else {
                if (loadingPosts) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else {
                    var postExpanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = postExpanded,
                        onExpandedChange = { postExpanded = !postExpanded },
                    ) {
                        OutlinedTextField(
                            value = latestPosts.find { it.id == selectedPostId }?.headline?.telugu ?: "-- వార్తను ఎంచుకోండి --",
                            onValueChange = { },
                            readOnly = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            label = { Text("వార్త") },
                            shape = RoundedCornerShape(8.dp),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = postExpanded) }
                        )
                        ExposedDropdownMenu(
                            expanded = postExpanded,
                            onDismissRequest = { postExpanded = false }
                        ) {
                            latestPosts.forEach { post ->
                                DropdownMenuItem(
                                    text = { Text(post.headline.telugu, maxLines = 2) },
                                    onClick = {
                                        selectedPostId = post.id
                                        postExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            val isSilent = selectedChannelId != "breaking_news"
            Button(
                onClick = { handleSend() },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = !isSending && selectedPostId.isNotEmpty(),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isSilent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
            ) {
                if (isSending) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("📢 SEND BROADCAST", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
