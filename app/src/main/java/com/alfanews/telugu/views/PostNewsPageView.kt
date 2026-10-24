@file:android.annotation.SuppressLint("LocalContextGetResourceValueCall")
package com.alfanews.telugu.views

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import android.media.MediaMetadataRetriever
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.window.DialogProperties
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
import com.alfanews.telugu.utils.ShareUtil
import com.alfanews.telugu.utils.uploadMediaToStorage
import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlin.coroutines.resume

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
    var activeAuthUser by remember { mutableStateOf(FirebaseService.auth.currentUser) }
    var isAuthValid by remember { mutableStateOf<Boolean?>(if (FirebaseService.auth.currentUser == null) false else null) }

    // 🛡️ PRE-FLIGHT AUTH VERIFICATION: వార్త రాసే ఫారం ఓపెన్ కాకముందే లాగిన్ సెషన్ చెక్ చేయడం
    LaunchedEffect(Unit) {
        val auth = FirebaseService.auth.currentUser
        if (auth == null) {
            isAuthValid = false
        } else {
            try {
                auth.getIdToken(false).await()
                activeAuthUser = auth
                isAuthValid = true
            } catch (_: Exception) {
                try {
                    auth.getIdToken(true).await()
                    activeAuthUser = auth
                    isAuthValid = true
                } catch (_: Exception) {
                    isAuthValid = false
                }
            }
        }
    }

    // లాగిన్ సెషన్ చెక్ అవుతున్నంతసేపు చిన్న లోడర్
    if (isAuthValid == null) {
        Box(
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CircularProgressIndicator(modifier = Modifier.size(36.dp), color = MaterialTheme.colorScheme.primary)
                Text(
                    text = "లాగిన్ సెషన్ ధృవీకరిస్తోంది...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        return
    }

    var loginJustSucceeded by remember { mutableStateOf(false) }

    // 🛡️ సెషన్ ఎక్స్‌పైర్ అయితే లేదా లాగిన్ లేకపోతే ఫారం ఓపెన్ కాకముందే లాగిన్ పాప్-అప్ చూపించడం
    if (isAuthValid == false || activeAuthUser == null) {
        LoginScreenView(
            onLoginSuccess = { _ ->
                loginJustSucceeded = true
                activeAuthUser = FirebaseService.auth.currentUser
                isAuthValid = true
            },
            onClose = {
                // లాగిన్ విజయవంతమైతే ఫారంను మూసివేయవద్దు. యూజర్ లాగిన్ కాకుండా Cancel/Close నొక్కినప్పుడు మాత్రమే మునుపటి స్క్రీన్‌కు వెళ్లాలి.
                if (!loginJustSucceeded && FirebaseService.auth.currentUser == null) {
                    onActionComplete("")
                }
            }
        )
        return
    }

    var headline by remember { mutableStateOf(postToEdit?.headline?.telugu ?: "") }
    var content by remember { mutableStateOf(postToEdit?.content?.telugu ?: "") }
    var existingMediaUrls by remember(postToEdit) {
        mutableStateOf(
            postToEdit?.let { p ->
                p.mediaUrls.ifEmpty { if (p.mediaUrl.isNotEmpty()) listOf(p.mediaUrl) else emptyList() }
            } ?: emptyList()
        )
    }
    var existingMediaTypes by remember(postToEdit) {
        mutableStateOf(
            postToEdit?.let { p ->
                p.mediaTypes.map { it.name }.ifEmpty { if (p.mediaUrl.isNotEmpty()) listOf(p.mediaType.name) else emptyList() }
            } ?: emptyList()
        )
    }
    var youtubeUrl by remember { mutableStateOf(postToEdit?.youtubeUrl ?: "") }
    var mediaUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var location by remember { mutableStateOf(postToEdit?.location ?: user.assignedMandal ?: "") }
    var category by remember { mutableStateOf(postToEdit?.categories?.firstOrNull { !Constants.ALL_DISTRICTS.contains(it) } ?: "జిల్లా వార్త") }
    var state by remember { mutableStateOf(postToEdit?.state ?: user.state ?: "TS") }
    var district by remember { mutableStateOf(postToEdit?.district ?: user.district ?: "") }
    var isGlobalNews by remember { mutableStateOf(postToEdit?.isGlobal ?: false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var submissionResult by remember { mutableStateOf<NewsSubmissionResult?>(null) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    BackHandler(enabled = isSubmitting) {
        Toast.makeText(context, "వార్త ప్రాసెసింగ్ జరుగుతోంది, దయచేసి వేచి ఉండండి...", Toast.LENGTH_SHORT).show()
    }

    val prefs = remember { com.alfanews.telugu.utils.PreferenceManager.getInstance(context) }
    val effectiveRole = remember(user, activeAuthUser) {
        if (user.role != UserRole.SUBSCRIBER && user.role != UserRole.GUEST) {
            user.role
        } else {
            UserRole.fromStringSafe(prefs.userRole) ?: user.role
        }
    }

    LaunchedEffect(user, activeAuthUser) {
        if (postToEdit == null) {
            if (location.isBlank()) {
                val assigned = user.assignedMandal?.takeIf { it.isNotBlank() } ?: prefs.userAssignedMandal
                if (!assigned.isNullOrBlank()) location = assigned
            }
            if (district.isBlank()) {
                val dist = user.district?.takeIf { it.isNotBlank() } 
                    ?: prefs.userDistrict?.takeIf { it.isNotBlank() }
                    ?: prefs.selectedDistrict?.takeIf { it.isNotBlank() && it != "General" && it != "State" }
                if (!dist.isNullOrBlank()) district = dist
            }
            if (state.isBlank() || state == "TS") {
                val prefDist = district.ifBlank { prefs.userDistrict.orEmpty().ifBlank { prefs.selectedDistrict.orEmpty() } }
                if (Constants.AP_DISTRICTS.contains(prefDist)) {
                    state = "AP"
                } else if (!user.state.isNullOrBlank()) {
                    state = user.state!!
                }
            }
        }
    }
    
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
        if (postToEdit != null) {
            headline = postToEdit.headline.telugu
            content = postToEdit.content.telugu
            youtubeUrl = postToEdit.youtubeUrl ?: ""
            location = postToEdit.location.ifEmpty { user.assignedMandal ?: "" }
            category = postToEdit.categories.firstOrNull { !Constants.ALL_DISTRICTS.contains(it) } ?: postToEdit.category ?: "జిల్లా వార్త"
            state = postToEdit.state ?: user.state ?: "TS"
            district = postToEdit.district ?: user.district ?: ""
            isGlobalNews = postToEdit.isGlobal
            existingMediaUrls = postToEdit.mediaUrls.ifEmpty { if (postToEdit.mediaUrl.isNotEmpty()) listOf(postToEdit.mediaUrl) else emptyList() }
            existingMediaTypes = postToEdit.mediaTypes.map { it.name }.ifEmpty { if (postToEdit.mediaUrl.isNotEmpty()) listOf(postToEdit.mediaType.name) else emptyList() }
            mediaUris = emptyList()
        }
        statusMessage = if (postToEdit != null) updateString else publishString
    }

    val imageLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickMultipleVisualMedia(3)
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            mediaUris = (mediaUris + uris).take(3)
        }
    }

    val videoLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            scope.launch {
                val duration = withContext(Dispatchers.IO) {
                    getVideoDuration(context, uri)
                }
                if (duration > 10 * 60 * 1000) {
                    Toast.makeText(context, "వీడియో నిడివి 10 నిమిషాల కంటే తక్కువ ఉండాలి", Toast.LENGTH_LONG).show()
                } else {
                    val images = mediaUris.filter { context.contentResolver.getType(it)?.startsWith("image/") == true }
                    mediaUris = (listOf(uri) + images).take(3)
                }
            }
        }
    }

    val districts = remember(state, user, effectiveRole) {
        val normState = if (state.equals("TS", ignoreCase = true) || state.equals("Telangana", ignoreCase = true) || state.equals("తెలంగాణ", ignoreCase = true)) "TS" else "AP"
        val baseDistricts = if (normState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
        if (effectiveRole == UserRole.REGIONAL_INCHARGE) {
            val assigned = user.assignedDistricts
            if (assigned.isNotEmpty()) baseDistricts.filter { assigned.contains(it) } else baseDistricts
        } else {
            baseDistricts
        }
    }

    val districtOptions = remember(districts) {
        districts.map { it to it }
    }

    val mandals = remember(district) {
        if (district.isBlank()) emptyList()
        else Constants.MANDAL_DATA[district.trim()]
            ?: Constants.MANDAL_DATA.entries.firstOrNull { it.key.trim().equals(district.trim(), ignoreCase = true) }?.value
            ?: emptyList()
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
            location = ""
        }
    }

    LaunchedEffect(mandals) {
        if (location.isNotEmpty() && mandals.isNotEmpty() && !mandals.contains(location)) {
            location = ""
        }
    }

    fun handleSubmit() {
        val authUser = activeAuthUser ?: FirebaseService.auth.currentUser
        if (authUser == null) {
            isAuthValid = false
            return
        }

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
                
                val finalMediaUrls = existingMediaUrls.toMutableList()
                val finalMediaTypes = existingMediaTypes.toMutableList()

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

                val effectiveAuthUid = authUser.uid
                val reporterPhone = user.phone?.trim() ?: authUser.phoneNumber?.trim() ?: ""
                val reporterData = if (postToEdit != null) {
                    mapOf(
                        "id" to postToEdit.reporter.id.ifBlank { effectiveAuthUid },
                        "name" to postToEdit.reporter.name.ifBlank { user.name },
                        "phone" to (reporterPhone.ifBlank { "" })
                    )
                } else {
                    mapOf(
                        "id" to effectiveAuthUid,
                        "name" to user.name.ifBlank { prefs.userName?.ifBlank { null } ?: authUser.displayName ?: "రిపోర్టర్" },
                        "phone" to (reporterPhone.ifBlank { "" })
                    )
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
                    "content" to mapOf("telugu" to content),
                    "originalReporterId" to (postToEdit?.originalReporterId?.takeIf { it.isNotBlank() } ?: effectiveAuthUid),
                    "reporterId" to (postToEdit?.reporter?.id?.takeIf { it.isNotBlank() } ?: effectiveAuthUid),
                    "userId" to effectiveAuthUid,
                    "reporterPhone" to reporterPhone
                )

                try {
                    val result = FirebaseFunctionsService.processReporterSubmission(
                        postId = postToEdit?.id,
                        postData = postData
                    ).getOrThrow()
                    
                    val serverMessage = result["message"] as? String
                    val newPostId = result["postId"] as? String ?: postToEdit?.id ?: ""

                    if (district.isNotBlank() && !isGlobalNews) {
                        try {
                            val prefs = com.alfanews.telugu.utils.PreferenceManager.getInstance(context)
                            prefs.selectedDistrict = district
                            prefs.saveDistrictNewsCache(district, "")
                            prefs.saveHomeNewsCache("")
                        } catch (e: Exception) { }
                    }

                    if (postToEdit != null && postToEdit.approved) {
                        Toast.makeText(context, "వార్త విజయవంతంగా నవీకరించబడింది!", Toast.LENGTH_LONG).show()
                        onActionComplete(postToEdit.id)
                    } else {
                        val isVideoPost = finalMediaTypes.contains("VIDEO")
                        if (isVideoPost) {
                            Toast.makeText(context, "వార్త అప్‌లోడ్ విజయవంతమైంది! వీడియో తయారీ మరియు ఇతర పనులు నేపథ్యంలో జరుగుతున్నాయి. 10 నిమిషాల తర్వాత చూడండి.", Toast.LENGTH_LONG).show()
                            onActionComplete(newPostId.ifBlank { "HOME_ONLY" }) 
                        } else {
                            // టెక్స్ట్ & ఫోటో వార్త: ఎడిటోరియల్ డెస్క్ సమీక్ష పూర్తయ్యే వరకు ఇక్కడే వేచి ఉండటం
                            statusMessage = "సబ్ ఎడిటర్లు సమీక్షిస్తున్నారు..."

                            val fallbackImg = finalMediaUrls.firstOrNull() ?: mediaUris.firstOrNull()?.toString()

                            val finalResult = waitForNewsProcessing(
                                postId = newPostId,
                                fallbackHeadline = headline,
                                fallbackContent = content,
                                fallbackCategory = category,
                                fallbackLocation = location,
                                fallbackImageUrl = fallbackImg,
                                onStatusUpdate = { liveStatus ->
                                    statusMessage = liveStatus
                                }
                            )

                            submissionResult = finalResult
                        }
                    }
                } catch (e: Exception) {
                    val isCancellation = e is kotlinx.coroutines.CancellationException ||
                                         e.toString().contains("CancellationException") ||
                                         e.message?.contains("left the composition") == true
                    if (isCancellation) throw e as Throwable
                    statusMessage = context.getString(R.string.error)
                    val rawMsg = e.message.orEmpty()
                    val displayMsg = if (rawMsg.contains("unauthenticated", ignoreCase = true) || rawMsg.contains("లాగిన్", ignoreCase = true)) {
                        "మీ లాగిన్ సెషన్ ముగిసింది. దయచేసి మళ్ళీ లాగిన్ చేసి వార్తను సమర్పించండి."
                    } else {
                        context.getString(R.string.error_publishing_news, rawMsg)
                    }
                    Toast.makeText(context, displayMsg, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                val isCancellation = e is kotlinx.coroutines.CancellationException ||
                                     e.toString().contains("CancellationException") ||
                                     e.message?.contains("left the composition") == true
                if (isCancellation) throw e as Throwable
                statusMessage = context.getString(R.string.error)
                Toast.makeText(context, context.getString(R.string.error_publishing_news, e.message ?: ""), Toast.LENGTH_LONG).show()
            } finally {
                isSubmitting = false
            }
        }
    }

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

                        if (effectiveRole == UserRole.ADMIN || effectiveRole == UserRole.NEWS_DESK) {
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
                                Dropdown(
                                    label = stateLabel, 
                                    options = stateOptions, 
                                    selected = state, 
                                    onSelected = { s -> 
                                        if (state != s) {
                                            state = s
                                            district = ""
                                            location = ""
                                        }
                                    }, 
                                    modifier = Modifier.weight(1f)
                                )
                                Dropdown(
                                    label = districtLabel, 
                                    options = districtOptions, 
                                    selected = district, 
                                    onSelected = { d -> 
                                        if (district != d) {
                                            district = d
                                            location = ""
                                        }
                                    }, 
                                    modifier = Modifier.weight(1f)
                                )
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
                        
                        val combinedMediaUrls = remember(existingMediaUrls, mediaUris) {
                            existingMediaUrls + mediaUris.map { it.toString() }
                        }

                        if (combinedMediaUrls.isNotEmpty()) {
                            val pagerState = rememberPagerState(pageCount = { combinedMediaUrls.size })
                            Box(modifier = Modifier.fillMaxWidth().height(250.dp).clip(MaterialTheme.shapes.medium)) {
                                HorizontalPager(
                                    state = pagerState,
                                    modifier = Modifier.fillMaxSize()
                                ) { page ->
                                    val mediaItem = combinedMediaUrls[page]
                                    val isVideo = try {
                                        mediaItem.contains("video", ignoreCase = true) || 
                                        (mediaItem.startsWith("content://") && context.contentResolver.getType(Uri.parse(mediaItem))?.startsWith("video/") == true)
                                    } catch (e: Exception) {
                                        false
                                    }
                                    
                                    if (isVideo) {
                                        VideoPlayerView(videoUrl = mediaItem)
                                    } else {
                                        AsyncImage(
                                            model = mediaItem,
                                            contentDescription = "Selected Media",
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop,
                                            alignment = Alignment.TopCenter
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
                                        val curPage = pagerState.currentPage
                                        if (curPage < existingMediaUrls.size) {
                                            existingMediaUrls = existingMediaUrls.filterIndexed { index, _ -> index != curPage }
                                            existingMediaTypes = existingMediaTypes.filterIndexed { index, _ -> index != curPage }
                                        } else {
                                            val indexInUris = curPage - existingMediaUrls.size
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
                                onClick = { imageLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                modifier = Modifier.weight(1f),
                                enabled = (mediaUris.size + existingMediaUrls.size) < 3
                            ) {
                                Icon(Icons.Default.Upload, contentDescription = null, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.size(8.dp))
                                Text("Image")
                            }

                            Button(
                                onClick = { videoLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly)) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4285F4)),
                                modifier = Modifier.weight(1f),
                                enabled = mediaUris.none { context.contentResolver.getType(it)?.startsWith("video/") == true } && existingMediaTypes.none { it.uppercase() == "VIDEO" } && (mediaUris.size + existingMediaUrls.size) < 3
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
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                        disabledContainerColor = MaterialTheme.colorScheme.primary,
                        disabledContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                ) {
                    if (isSubmitting) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically, 
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(22.dp), 
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.5.dp
                            )
                            Text(
                                text = statusMessage,
                                color = MaterialTheme.colorScheme.onPrimary,
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    } else {
                        Text(
                            text = if (postToEdit != null) updateString else publishString,
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        submissionResult?.let { result ->
            NewsSubmissionResultDialog(
                result = result,
                onDismiss = {
                    submissionResult = null
                    statusMessage = if (postToEdit != null) updateString else publishString
                },
                onActionComplete = { targetPostId ->
                    submissionResult = null
                    onActionComplete(targetPostId)
                }
            )
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

internal sealed class NewsSubmissionResult {
    data class Success(
        val postId: String,
        val headline: String,
        val snippet: String,
        val imageUrl: String?,
        val category: String,
        val location: String
    ) : NewsSubmissionResult()

    data class Rejected(
        val postId: String,
        val reason: String
    ) : NewsSubmissionResult()

    data class Failed(
        val postId: String,
        val error: String
    ) : NewsSubmissionResult()

    data class Timeout(
        val postId: String
    ) : NewsSubmissionResult()
}

internal suspend fun waitForNewsProcessing(
    postId: String,
    fallbackHeadline: String,
    fallbackContent: String,
    fallbackCategory: String,
    fallbackLocation: String,
    fallbackImageUrl: String?,
    onStatusUpdate: (String) -> Unit = {}
): NewsSubmissionResult {
    if (postId.isBlank()) {
        return NewsSubmissionResult.Failed("", "వార్త ఐడీ లభించలేదు")
    }

    return withTimeoutOrNull(150000L) {
        suspendCancellableCoroutine { continuation ->
            val docRef = FirebaseService.db.collection("news").document(postId)
            var registration: ListenerRegistration? = null
            registration = docRef.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    if (continuation.isActive) {
                        continuation.resume(
                            NewsSubmissionResult.Failed(postId, error.message ?: "నెట్‌వర్క్ కనెక్షన్ లోపం")
                        )
                    }
                    registration?.remove()
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val data = snapshot.data ?: return@addSnapshotListener
                    val status = (data["status"] as? String)?.uppercase() ?: ""
                    val approved = data["approved"] as? Boolean ?: false
                    val rejectionReason = (data["rejectionReason"] as? String)?.trim()
                    val errorMsg = (data["error"] as? String)?.trim()
                        ?: (data["lastProcessingError"] as? String)?.trim()
                    val editorialStatus = (data["editorialStatus"] as? String)?.trim()

                    if (!editorialStatus.isNullOrBlank()) {
                        onStatusUpdate(editorialStatus)
                    } else if (status == "REVIEWING_CONTENT") {
                        onStatusUpdate("సబ్ ఎడిటర్లు వార్తను సమీక్షిస్తున్నారు...")
                    } else if (status == "PENDING") {
                        onStatusUpdate("వార్త ఎడిటోరియల్ డెస్క్‌కు చేరింది...")
                    }

                    if (approved || status == "PUBLISHED") {
                        onStatusUpdate("వార్త ఆమోదించబడింది!")
                        val headlineMap = data["headline"] as? Map<*, *>
                        val finalHeadline = headlineMap?.get("telugu")?.toString()
                            ?: data["headline"]?.toString()
                            ?: fallbackHeadline

                        val contentMap = data["content"] as? Map<*, *>
                        val finalContent = contentMap?.get("telugu")?.toString()
                            ?: data["content"]?.toString()
                            ?: fallbackContent

                        val finalThumbnail = (data["thumbnailUrl"] as? String)?.takeIf { it.isNotBlank() }
                            ?: (data["mediaUrl"] as? String)?.takeIf { it.isNotBlank() }
                            ?: (data["mediaUrls"] as? List<*>)?.firstOrNull()?.toString()
                            ?: fallbackImageUrl

                        val finalCategory = (data["category"] as? String)
                            ?: (data["categories"] as? List<*>)?.firstOrNull()?.toString()
                            ?: fallbackCategory

                        val finalLocation = (data["location"] as? String) ?: fallbackLocation

                        if (continuation.isActive) {
                            continuation.resume(
                                NewsSubmissionResult.Success(
                                    postId = postId,
                                    headline = finalHeadline,
                                    snippet = finalContent.take(160),
                                    imageUrl = finalThumbnail,
                                    category = finalCategory,
                                    location = finalLocation
                                )
                            )
                        }
                        registration?.remove()
                    } else if (status == "REJECTED" || !rejectionReason.isNullOrBlank()) {
                        onStatusUpdate("వార్త సమీక్ష పూర్తయింది")
                        if (continuation.isActive) {
                            continuation.resume(
                                NewsSubmissionResult.Rejected(
                                    postId = postId,
                                    reason = rejectionReason ?: "వార్తా నిబంధనల ప్రకారం ప్రచురణకు ఆమోదించబడలేదు."
                                )
                            )
                        }
                        registration?.remove()
                    } else if (status == "FAILED" || !errorMsg.isNullOrBlank()) {
                        onStatusUpdate("సాంకేతిక సమస్య ఏర్పడింది")
                        if (continuation.isActive) {
                            continuation.resume(
                                NewsSubmissionResult.Failed(
                                    postId = postId,
                                    error = errorMsg ?: "ప్రాసెసింగ్ లోపం"
                                )
                            )
                        }
                        registration?.remove()
                    }
                }
            }

            continuation.invokeOnCancellation {
                registration?.remove()
            }
        }
    } ?: NewsSubmissionResult.Timeout(postId)
}

@Composable
internal fun NewsSubmissionResultDialog(
    result: NewsSubmissionResult,
    onDismiss: () -> Unit,
    onActionComplete: (String) -> Unit
) {
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = {
            when (result) {
                is NewsSubmissionResult.Success -> onActionComplete(result.postId)
                is NewsSubmissionResult.Rejected -> onDismiss()
                is NewsSubmissionResult.Failed -> onActionComplete(result.postId)
                is NewsSubmissionResult.Timeout -> onActionComplete(result.postId)
            }
        },
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        ),
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                when (result) {
                    is NewsSubmissionResult.Success -> {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF2E7D32)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Text(
                            text = "వార్త ప్రచురించబడింది!",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF2E7D32)
                            )
                        )
                    }
                    is NewsSubmissionResult.Rejected -> {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.error),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Text(
                            text = "వార్త ఆమోదించబడలేదు",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.error
                            )
                        )
                    }
                    is NewsSubmissionResult.Failed, is NewsSubmissionResult.Timeout -> {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFED6C02)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Text(
                            text = if (result is NewsSubmissionResult.Timeout) "నెట్‌వర్క్ నెమ్మదిగా ఉంది" else "ప్రాసెసింగ్ లోపం",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFED6C02)
                            )
                        )
                    }
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                when (result) {
                    is NewsSubmissionResult.Success -> {
                        Text(
                            text = "మీ వార్త విజయవంతంగా పబ్లిష్ అయ్యింది. పాఠకులు దీన్ని ఫీడ్‌లో చూడవచ్చు.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                            )
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                if (!result.imageUrl.isNullOrBlank()) {
                                    AsyncImage(
                                        model = result.imageUrl,
                                        contentDescription = "News Image",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(130.dp)
                                            .clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                }

                                if (result.location.isNotBlank() || result.category.isNotBlank()) {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (result.location.isNotBlank()) {
                                            Surface(
                                                shape = RoundedCornerShape(4.dp),
                                                color = MaterialTheme.colorScheme.primaryContainer
                                            ) {
                                                Text(
                                                    text = result.location,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                        if (result.category.isNotBlank()) {
                                            Surface(
                                                shape = RoundedCornerShape(4.dp),
                                                color = MaterialTheme.colorScheme.secondaryContainer
                                            ) {
                                                Text(
                                                    text = result.category,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                }

                                Text(
                                    text = result.headline,
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = Ramabhadra
                                    ),
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )

                                if (result.snippet.isNotBlank()) {
                                    Text(
                                        text = result.snippet,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 3,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }

                    is NewsSubmissionResult.Rejected -> {
                        Text(
                            text = "సమీక్ష అనంతరం మీ వార్త ఆమోదించబడలేదు:",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f)
                            )
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = "తిరస్కరణకు కారణం:",
                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.error
                                )
                                Text(
                                    text = result.reason,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }

                        Text(
                            text = "వార్తలో అవసరమైన మార్పులు చేసి మళ్ళీ సమర్పించవచ్చు.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    is NewsSubmissionResult.Failed -> {
                        Text(
                            text = "వార్త ప్రాసెసింగ్ సమయంలో సాంకేతిక సమస్య ఏర్పడింది:",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                            )
                        ) {
                            Text(
                                text = result.error,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                        Text(
                            text = "వార్త సర్వర్‌లో నమోదైంది. కొద్దిసేపటి తర్వాత హోమ్ ఫీడ్‌లో పరిశీలించండి.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    is NewsSubmissionResult.Timeout -> {
                        Text(
                            text = "నెట్‌వర్క్ నెమ్మదిగా ఉన్నందున వార్త సమీక్షకు కాస్త సమయం పడుతోంది. మీ వార్త సర్వర్‌లో నమోదైంది.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        },
        confirmButton = {
            when (result) {
                is NewsSubmissionResult.Success -> {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = {
                                ShareUtil.shareNewsWhatsAppRichLink(
                                    context = context,
                                    postId = result.postId,
                                    headline = result.headline
                                )
                            }
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("షేర్ చేయండి")
                        }
                        Button(
                            onClick = { onActionComplete(result.postId) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary
                            )
                        ) {
                            Text("వార్తను చూడండి")
                        }
                    }
                }
                is NewsSubmissionResult.Rejected -> {
                    Button(
                        onClick = onDismiss,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("సవరించి మళ్ళీ పంపండి")
                    }
                }
                is NewsSubmissionResult.Timeout, is NewsSubmissionResult.Failed -> {
                    val targetPostId = result.postId.ifBlank { "HOME_ONLY" }
                    Button(
                        onClick = { onActionComplete(targetPostId) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        )
                    ) {
                        Text(if (targetPostId != "HOME_ONLY") "వార్తను చూడండి" else "సరే")
                    }
                }
            }
        },
        dismissButton = {
            when (result) {
                is NewsSubmissionResult.Rejected -> {
                    TextButton(
                        onClick = { onActionComplete("") }
                    ) {
                        Text("రద్దు చేయండి")
                    }
                }
                is NewsSubmissionResult.Success -> {
                    TextButton(
                        onClick = { onActionComplete(result.postId) }
                    ) {
                        Text("సరే")
                    }
                }
                is NewsSubmissionResult.Failed, is NewsSubmissionResult.Timeout -> {
                    if (result.postId.isNotBlank()) {
                        TextButton(
                            onClick = { onActionComplete("HOME_ONLY") }
                        ) {
                            Text("హోమ్‌కి వెళ్ళండి")
                        }
                    }
                }
            }
        }
    )
}
