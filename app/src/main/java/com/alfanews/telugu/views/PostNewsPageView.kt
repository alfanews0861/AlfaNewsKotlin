package com.alfanews.telugu.views

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import android.media.MediaMetadataRetriever
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.R
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.uploadMediaToStorage
import com.google.firebase.Timestamp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

fun getVideoDuration(context: android.content.Context, uri: Uri): Long {
    return try {
        val retriever = MediaMetadataRetriever()
        retriever.setDataSource(context, uri)
        val time = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        retriever.release()
        time?.toLong() ?: 0
    } catch (e: Exception) {
        0
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostNewsPageView(
    user: User,
    postToEdit: NewsPost?,
    onActionComplete: (String) -> Unit
) {
    var headline by remember { mutableStateOf(postToEdit?.headline?.telugu ?: "") }
    var content by remember { mutableStateOf(postToEdit?.content?.telugu ?: "") }
    var mediaUrl by remember { mutableStateOf(postToEdit?.mediaUrl ?: "") }
    var youtubeUrl by remember { mutableStateOf(postToEdit?.youtubeUrl ?: "") }
    var mediaUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var location by remember { mutableStateOf(postToEdit?.location ?: user.assignedMandal ?: "") }
    var category by remember { mutableStateOf(postToEdit?.categories?.firstOrNull { !Constants.ALL_DISTRICTS.contains(it) } ?: "జిల్లా వార్త") }
    var state by remember { mutableStateOf(postToEdit?.state ?: user.state ?: "TS") }
    var district by remember { mutableStateOf(postToEdit?.district ?: user.district ?: "") }
    var isGlobalNews by remember { mutableStateOf(postToEdit?.isGlobal ?: false) }
    var isSubmitting by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val publishString = stringResource(R.string.publish_news)
    val updateString = stringResource(R.string.update_news)
    val tsString = stringResource(R.string.telangana)
    val apString = stringResource(R.string.andhra_pradesh)
    val stateLabel = stringResource(R.string.state)
    val districtLabel = stringResource(R.string.district)
    val mandalLabel = stringResource(R.string.mandal)
    val detailsLabel = stringResource(R.string.news_details)
    val headlineLabel = stringResource(R.string.headline)
    val contentLabel = stringResource(R.string.news_content)
    val regionDetailsLabel = stringResource(R.string.region_details)
    val mediaLabel = stringResource(R.string.news_media)
    
    var statusMessage by remember { mutableStateOf("") }
    
    LaunchedEffect(postToEdit) {
        statusMessage = if (postToEdit != null) updateString else publishString
    }

    val imageLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            mediaUris = (mediaUris + uris).take(3)
        }
    }

    val videoLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            val duration = getVideoDuration(context, uri)
            if (duration > 10 * 60 * 1000) {
                Toast.makeText(context, "వీడియో నిడివి 10 నిమిషాల కంటే తక్కువ ఉండాలి", Toast.LENGTH_LONG).show()
            } else {
                val images = mediaUris.filter { context.contentResolver.getType(it)?.startsWith("image/") == true }
                mediaUris = (listOf(uri) + images).take(3)
            }
        }
    }

    val districts = remember(state, user) {
        val baseDistricts = if (state == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
        if (user.role == UserRole.REGIONAL_INCHARGE) {
            baseDistricts.filter { user.assignedDistricts.contains(it) }
        } else {
            baseDistricts
        }
    }

    val districtOptions = remember(districts) {
        districts.map { it to it }
    }

    val mandals = remember(district) {
        Constants.MANDAL_DATA[district] ?: emptyList()
    }

    val mandalOptions = remember(mandals) {
        mandals.map { it to it }
    }

    val stateOptions = remember(tsString, apString) {
        listOf("TS" to tsString, "AP" to apString)
    }

    LaunchedEffect(districts) {
        if (district.isNotEmpty() && !districts.contains(district)) {
            district = ""
        }
    }

    fun handleSubmit() {
        if (!isGlobalNews && (headline.isBlank() || content.isBlank() || district.isBlank())) {
            Toast.makeText(context, context.getString(R.string.fill_details_error), Toast.LENGTH_SHORT).show()
            return
        }
        if (isGlobalNews && (headline.isBlank() || content.isBlank())) {
            Toast.makeText(context, context.getString(R.string.fill_details_error), Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                statusMessage = context.getString(R.string.uploading_media)
                
                val finalMediaUrls = if (postToEdit != null) {
                    (postToEdit.mediaUrls.ifEmpty { if (postToEdit.mediaUrl.isNotEmpty()) listOf(postToEdit.mediaUrl) else emptyList() }).toMutableList()
                } else {
                    mutableListOf<String>()
                }
                val finalMediaTypes = if (postToEdit != null) {
                    (postToEdit.mediaTypes.map { it.name }.ifEmpty { listOf(postToEdit.mediaType.name) }).toMutableList()
                } else {
                    mutableListOf<String>()
                }

                if (mediaUris.isNotEmpty()) {
                    val sortedUris = mediaUris.sortedByDescending { uri ->
                        context.contentResolver.getType(uri)?.startsWith("video/") == true
                    }

                    for (uri in sortedUris) {
                        val isVideo = context.contentResolver.getType(uri)?.startsWith("video/") == true
                        if (isVideo) {
                            statusMessage = "వీడియో సర్వర్‌కు చేరుతోంది: 0%"
                        } else {
                            statusMessage = "ఫోటో అప్‌లోడ్ అవుతోంది..."
                        }
                        val url = uploadMediaToStorage(context, uri, "news-media", isVideo) { progress ->
                            if (isVideo) {
                                statusMessage = "వీడియో సర్వర్‌కు చేరుతోంది: ${progress.toInt()}%"
                            }
                        }
                        finalMediaUrls.add(url)
                        finalMediaTypes.add(if (isVideo) "VIDEO" else "IMAGE")
                    }
                }

                statusMessage = "వార్త సర్వర్‌కు చేరుతోంది..."
                
                val finalCategories = listOf(category, if (isGlobalNews) "State" else district).filter { it.isNotBlank() }

                val reporterData = if (postToEdit != null) {
                    mapOf("id" to postToEdit.reporter.id, "name" to postToEdit.reporter.name)
                } else {
                    mapOf("id" to user.id, "name" to user.name)
                }

                val postData = hashMapOf(
                    "mediaUrl" to (finalMediaUrls.firstOrNull() ?: ""),
                    "mediaUrls" to finalMediaUrls,
                    "mediaType" to (finalMediaTypes.firstOrNull() ?: "IMAGE"),
                    "mediaTypes" to finalMediaTypes,
                    "youtubeUrl" to youtubeUrl,
                    "location" to location,
                    "categories" to finalCategories,
                    "reporter" to reporterData,
                    "category" to category,
                    "district" to (if (isGlobalNews) "State" else district),
                    "state" to state,
                    "isGlobal" to isGlobalNews,
                    "likes" to (postToEdit?.likes ?: 0),
                    "comments" to (postToEdit?.comments ?: 0),
                    "shares" to (postToEdit?.shares ?: 0),
                    "verificationStatus" to "VERIFIED",
                    "verificationReason" to "VERIFIED BY REPORTER",
                    "isReporter" to true,
                    "isCitizen" to false,
                    "meta" to mapOf("location" to location),
                    "headline" to mapOf("telugu" to headline),
                    "content" to mapOf("telugu" to content)
                )

                try {
                    val result = FirebaseFunctionsService.processReporterSubmission(
                        postId = postToEdit?.id,
                        postData = postData
                    ).getOrThrow()
                    
                    val serverMessage = result["message"] as? String
                    val newPostId = result["postId"] as? String
                    
                    // Improved Feedback: Clear message that upload is done and server is working
                    val isVideoPost = finalMediaTypes.contains("VIDEO")
                    if (isVideoPost) {
                        Toast.makeText(context, "వార్త అప్‌లోడ్ విజయవంతమైంది! వీడియో తయారీ మరియు ఇతర పనులు నేపథ్యంలో జరుగుతున్నాయి. 10 నిమిషాల తర్వాత చూడండి.", Toast.LENGTH_LONG).show()
                        onActionComplete("HOME_ONLY") 
                    } else {
                        Toast.makeText(context, "వార్త విజయవంతంగా పంపబడింది. త్వరలో హోమ్ ఫీడ్ లో చూడవచ్చు.", Toast.LENGTH_LONG).show()
                        onActionComplete("HOME_ONLY")
                    }
                } catch (e: Exception) {
                    statusMessage = context.getString(R.string.error)
                    Toast.makeText(context, context.getString(R.string.error_publishing_news, e.message ?: ""), Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                statusMessage = context.getString(R.string.error)
                Toast.makeText(context, context.getString(R.string.error_publishing_news, e.message ?: ""), Toast.LENGTH_LONG).show()
            } finally {
                isSubmitting = false
            }
        }
    }

    AlfaNewsTheme {
        Column(
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Spacer(modifier = Modifier.height(8.dp))
                
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(detailsLabel, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                        OutlinedTextField(
                            value = headline,
                            onValueChange = { headline = it },
                            label = { Text(headlineLabel) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                            )
                        )
                        OutlinedTextField(
                            value = content,
                            onValueChange = { content = it },
                            label = { Text(contentLabel) },
                            modifier = Modifier.fillMaxWidth().height(200.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                            )
                        )
                    }
                }

                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(regionDetailsLabel, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)

                        if (user.role == UserRole.ADMIN || user.role == UserRole.NEWS_DESK) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(stringResource(R.string.global_news_label), style = MaterialTheme.typography.bodyLarge)
                                    Text(stringResource(R.string.global_news_desc), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Switch(
                                    checked = isGlobalNews,
                                    onCheckedChange = { isGlobalNews = it }
                                )
                            }
                        }

                        if (!isGlobalNews) {
                            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                Dropdown(label = stateLabel, options = stateOptions, selected = state, onSelected = { s -> state = s; district = "" }, modifier = Modifier.weight(1f))
                                Dropdown(label = districtLabel, options = districtOptions, selected = district, onSelected = { d -> district = d; location = "" }, modifier = Modifier.weight(1f))
                            }

                            if (mandals.isNotEmpty()) {
                                Dropdown(label = mandalLabel, options = mandalOptions, selected = location, onSelected = { l -> location = l }, modifier = Modifier.fillMaxWidth())
                            } else {
                                OutlinedTextField(
                                    value = location,
                                    onValueChange = { location = it },
                                    label = { Text(stringResource(R.string.location_placeholder)) },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                            }
                        }
                    }
                }

                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(mediaLabel, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                        
                        val combinedMediaUrls = remember(mediaUrl, mediaUris) {
                            val existing = if (mediaUrl.isNotEmpty()) listOf(mediaUrl) else emptyList()
                            existing + mediaUris.map { it.toString() }
                        }

                        if (combinedMediaUrls.isNotEmpty()) {
                            val pagerState = rememberPagerState(pageCount = { combinedMediaUrls.size })
                            Box(modifier = Modifier.fillMaxWidth().height(250.dp).clip(MaterialTheme.shapes.medium)) {
                                HorizontalPager(
                                    state = pagerState,
                                    modifier = Modifier.fillMaxSize()
                                ) { page ->
                                    val mediaItem = combinedMediaUrls[page]
                                    val isVideo = mediaItem.contains("video", ignoreCase = true) || 
                                                  context.contentResolver.getType(Uri.parse(mediaItem))?.startsWith("video/") == true
                                    
                                    if (isVideo) {
                                        VideoPlayerView(videoUrl = mediaItem)
                                    } else {
                                        AsyncImage(
                                            model = mediaItem,
                                            contentDescription = "Selected Media",
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop
                                        )
                                    }
                                }
                                
                                if (combinedMediaUrls.size > 1) {
                                    Row(
                                        Modifier.height(30.dp).fillMaxWidth().align(Alignment.BottomCenter).background(Color.Black.copy(alpha = 0.3f)),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        repeat(combinedMediaUrls.size) { iteration ->
                                            val color = if (pagerState.currentPage == iteration) Color.White else Color.White.copy(alpha = 0.5f)
                                            Box(
                                                modifier = Modifier.padding(2.dp).clip(CircleShape).background(color).size(8.dp)
                                            )
                                        }
                                    }
                                }

                                IconButton(
                                    onClick = {
                                        if (pagerState.currentPage < (if (mediaUrl.isNotEmpty()) 1 else 0)) {
                                            mediaUrl = ""
                                        } else {
                                            val indexInUris = pagerState.currentPage - (if (mediaUrl.isNotEmpty()) 1 else 0)
                                            mediaUris = mediaUris.filterIndexed { index, _ -> index != indexInUris }
                                        }
                                    },
                                    modifier = Modifier.align(Alignment.TopEnd).padding(8.dp).background(Color.Black.copy(alpha = 0.5f), CircleShape)
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = "Remove", tint = Color.White)
                                }
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Button(
                                onClick = { imageLauncher.launch("image/*") },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                modifier = Modifier.weight(1f),
                                enabled = (mediaUris.size + (if(mediaUrl.isNotEmpty()) 1 else 0)) < 3
                            ) {
                                Icon(Icons.Default.Upload, contentDescription = null, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.size(8.dp))
                                Text("Image")
                            }

                            Button(
                                onClick = { videoLauncher.launch("video/*") },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4285F4)),
                                modifier = Modifier.weight(1f),
                                enabled = mediaUris.none { context.contentResolver.getType(it)?.startsWith("video/") == true } && (mediaUris.size + (if(mediaUrl.isNotEmpty()) 1 else 0)) < 3
                            ) {
                                Icon(Icons.Default.VideoLibrary, contentDescription = null, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.size(8.dp))
                                Text("Video")
                            }
                        }

                    }
                }

                Button(
                    onClick = { handleSubmit() },
                    enabled = !isSubmitting,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    if (isSubmitting) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                            Text(statusMessage)
                        }
                    } else {
                        Text(if (postToEdit != null) updateString else publishString, fontSize = 18.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun Dropdown(
    label: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedDisplay = remember(options, selected) {
        options.find { it.first == selected }?.second ?: selected
    }

    LaunchedEffect(selected) {
        if (selected.isNotEmpty()) {
            expanded = false
        }
    }

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }, modifier = modifier) {
        OutlinedTextField(
            value = selectedDisplay,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
            )
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (key, value) ->
                DropdownMenuItem(text = { Text(value) }, onClick = { onSelected(key); expanded = false })
            }
        }
    }
}
