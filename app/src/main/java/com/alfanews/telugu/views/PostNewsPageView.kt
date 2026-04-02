package com.alfanews.telugu.views

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Upload
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
import com.alfanews.telugu.utils.glassmorphism
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import androidx.compose.ui.res.stringResource
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
    var mediaUri by remember { mutableStateOf<Uri?>(null) }
    var mediaType by remember { mutableStateOf(postToEdit?.mediaType?.name ?: "IMAGE") }
    var location by remember { mutableStateOf(postToEdit?.location ?: user.assignedMandal ?: "") }
    var category by remember { mutableStateOf(postToEdit?.categories?.firstOrNull { !Constants.ALL_DISTRICTS.contains(it) } ?: "రాజకీయం") }
    var state by remember { mutableStateOf(postToEdit?.state ?: user.state ?: "TS") }
    var district by remember { mutableStateOf(postToEdit?.district ?: user.district ?: "") }
    var isSubmitting by remember { mutableStateOf(false) }
    
    val publishString = stringResource(R.string.publish_news)
    val updateString = stringResource(R.string.update_news)
    var statusMessage by remember { mutableStateOf("") }
    
    LaunchedEffect(postToEdit) {
        statusMessage = if (postToEdit != null) updateString else publishString
    }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val districts = remember(state, user) {
        val baseDistricts = if (state == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
        if (user.role == UserRole.REGIONAL_INCHARGE) {
            baseDistricts.filter { user.assignedDistricts.contains(it) }
        } else {
            baseDistricts
        }
    }

    LaunchedEffect(districts) {
        if (district.isNotEmpty() && !districts.contains(district)) {
            district = ""
        }
    }

    fun handleSubmit() {
        if (headline.isBlank() || content.isBlank() || (category == "స్థానిక" && district.isBlank())) {
            Toast.makeText(context, context.getString(R.string.fill_details_error), Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                statusMessage = context.getString(R.string.uploading_media)
                var finalMediaUrl = mediaUrl
                if (mediaUri != null) {
                    val isVideo = context.contentResolver.getType(mediaUri!!)?.startsWith("video/") == true
                    finalMediaUrl = uploadMediaToStorage(mediaUri!!, "news-media", isVideo)
                    mediaType = if (isVideo) "VIDEO" else "IMAGE"
                }

                statusMessage = context.getString(R.string.loading)
                
                val finalCategories = listOf(category, district).filter { it.isNotBlank() }

                val postData = hashMapOf(
                    "mediaUrl" to finalMediaUrl,
                    "youtubeUrl" to youtubeUrl,
                    "mediaType" to mediaType,
                    "location" to location,
                    "categories" to finalCategories,
                    "reporter" to mapOf("id" to user.id, "name" to user.name),
                    "category" to category,
                    "district" to district,
                    "state" to state,
                    "likes" to (postToEdit?.likes ?: 0),
                    "comments" to (postToEdit?.comments ?: 0),
                    "shares" to (postToEdit?.shares ?: 0),
                    "verificationStatus" to "VERIFIED",
                    "verificationReason" to "VERIFIED BY REPORTER",
                    "meta" to mapOf("location" to location),
                    "headline" to mapOf("telugu" to headline),
                    "content" to mapOf("telugu" to content)
                )

                try {
                    val result = FirebaseFunctionsService.processNewsPost(
                        postId = postToEdit?.id,
                        postData = postData
                    ).getOrThrow()
                    
                    val newPostId = result["postId"] as? String
                    
                    val successMessage = if (postToEdit != null) context.getString(R.string.news_updated_successfully) else context.getString(R.string.news_published_successfully)
                    Toast.makeText(context, successMessage, Toast.LENGTH_SHORT).show()

                    delay(1500)
                    onActionComplete(newPostId ?: postToEdit?.id ?: "")
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
            modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(modifier = Modifier.fillMaxWidth().glassmorphism(cornerRadius = 16.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(stringResource(R.string.news_details), style = MaterialTheme.typography.titleLarge)
                    OutlinedTextField(value = headline, onValueChange = { headline = it }, label = { Text(stringResource(R.string.headline)) }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = content, onValueChange = { content = it }, label = { Text(stringResource(R.string.news_content)) }, modifier = Modifier.fillMaxWidth().height(200.dp))
                }
            }

            Box(modifier = Modifier.fillMaxWidth().glassmorphism(cornerRadius = 16.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(stringResource(R.string.region_category), style = MaterialTheme.typography.titleLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Dropdown(label = stringResource(R.string.state), options = listOf("TS" to stringResource(R.string.telangana), "AP" to stringResource(R.string.andhra_pradesh)), selected = state, onSelected = { s -> state = s; district = "" }, modifier = Modifier.weight(1f))
                        Dropdown(label = stringResource(R.string.district), options = districts.map { it to it }, selected = district, onSelected = { d -> district = d; location = "" }, modifier = Modifier.weight(1f))
                    }
                    
                    val mandals: List<String> = Constants.MANDAL_DATA[district] ?: emptyList()
                    if (mandals.isNotEmpty()) {
                        Dropdown(label = stringResource(R.string.mandal), options = mandals.map { it to it }, selected = location, onSelected = { l -> location = l }, modifier = Modifier.fillMaxWidth())
                    } else {
                        OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text(stringResource(R.string.location_placeholder)) }, modifier = Modifier.fillMaxWidth())
                    }

                    Dropdown(label = stringResource(R.string.category), options = Constants.CATEGORIES.map { cat -> cat to stringResource(Constants.CATEGORY_RES_MAP[cat] ?: R.string.cat_others) }, selected = category, onSelected = { c -> category = c }, modifier = Modifier.fillMaxWidth())
                }
            }

            Box(modifier = Modifier.fillMaxWidth().glassmorphism(cornerRadius = 16.dp)) {
                Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(stringResource(R.string.news_media), style = MaterialTheme.typography.titleLarge)
                    val displayMedia = mediaUri?.toString() ?: mediaUrl
                    if (displayMedia.isNotEmpty()) {
                        AsyncImage(
                            model = displayMedia, 
                            contentDescription = "Selected Media", 
                            modifier = Modifier.fillMaxWidth().height(200.dp).clip(MaterialTheme.shapes.medium), 
                            contentScale = ContentScale.Crop
                        )
                    }

                    // --- Media Pickers ---
                    var tempCameraUri by remember { mutableStateOf<Uri?>(null) }
                    
                    val galleryLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.GetContent()
                    ) { uri: Uri? -> 
                        if (uri != null) mediaUri = uri 
                    }

                    val cameraLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.TakePicture()
                    ) { success ->
                        if (success && tempCameraUri != null) {
                            mediaUri = tempCameraUri
                        }
                    }

                    val cameraPermissionLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.RequestPermission()
                    ) { isGranted ->
                        if (isGranted) {
                             val imagesDir = File(context.cacheDir, "images")
                             imagesDir.mkdirs()
                             val file = File(imagesDir, "camera_image_${System.currentTimeMillis()}.jpg")
                             val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                             tempCameraUri = uri
                             cameraLauncher.launch(uri)
                        } else {
                            Toast.makeText(context, context.getString(R.string.camera_permission_required), Toast.LENGTH_SHORT).show()
                        }
                    }

                    // Helper to create temp file for camera
                    fun launchCameraWithPermission() {
                        val permission = Manifest.permission.CAMERA
                        if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
                            val imagesDir = File(context.cacheDir, "images")
                            imagesDir.mkdirs()
                            val file = File(imagesDir, "camera_image_${System.currentTimeMillis()}.jpg")
                            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                            tempCameraUri = uri
                            cameraLauncher.launch(uri)
                        } else {
                            cameraPermissionLauncher.launch(permission)
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Upload Button (Red)
                        Button(
                            onClick = { galleryLauncher.launch("image/*") },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error), // Red-ish
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Upload, contentDescription = null, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.size(8.dp))
                            Text(stringResource(R.string.upload))
                        }

                        // Camera Button (Blue)
                        Button(
                            onClick = { launchCameraWithPermission() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4285F4)), // Google Blue
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.size(8.dp))
                            Text(stringResource(R.string.camera))
                        }
                    }

                    OutlinedTextField(
                        value = youtubeUrl ?: "",
                        onValueChange = { youtubeUrl = it },
                        label = { Text(stringResource(R.string.youtube_link)) },
                        placeholder = { Text("https://www.youtube.com/watch?v=...") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Button(
                onClick = { handleSubmit() },
                enabled = !isSubmitting,
                modifier = Modifier.fillMaxWidth().height(56.dp)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Dropdown(
    label: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedDisplay = options.find { it.first == selected }?.second ?: selected

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }, modifier = modifier) {
        OutlinedTextField(
            value = selectedDisplay,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (key, value) ->
                DropdownMenuItem(text = { Text(value) }, onClick = { onSelected(key); expanded = false })
            }
        }
    }
}
