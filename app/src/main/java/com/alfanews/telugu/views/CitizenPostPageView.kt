package com.alfanews.telugu.views

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.uploadMediaToStorage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.Timestamp
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.io.File
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CitizenPostPageView(user: User, onClose: () -> Unit) {
    var content by remember { mutableStateOf("") }
    var mediaUri by remember { mutableStateOf<Uri?>(null) }
    var selectedState by remember { mutableStateOf("TS") }
    var selectedDistrict by remember { mutableStateOf("") }
    var selectedMandal by remember { mutableStateOf("") }
    var isAnonymous by remember { mutableStateOf(false) }
    var agreedToTerms by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("") }
    var showMediaSourceDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val districts = if (selectedState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
    val mandals = Constants.MANDAL_DATA[selectedDistrict] ?: emptyList()

    val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

    val requestCameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
        if (!isGranted) {
            Toast.makeText(context, "కెమెరా అనుమతి అవసరం.", Toast.LENGTH_SHORT).show()
        }
    }

    val requestLocationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
        if (!isGranted) {
            Toast.makeText(context, "లొకేషన్ అనుమతి అవసరం.", Toast.LENGTH_SHORT).show()
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        mediaUri = uri
    }

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (!success) {
            mediaUri = null // Clear URI if camera was cancelled
        }
    }

    fun getAddressFromLocation(lat: Double, lon: Double) {
        val geocoder = Geocoder(context, Locale.getDefault())
        try {
            @Suppress("DEPRECATION")
            val addresses = geocoder.getFromLocation(lat, lon, 1)
            if (addresses?.isNotEmpty() == true) {
                val address = addresses[0]
                val districtName = address.subAdminArea
                val mandalName = address.locality

                if (districtName != null) {
                    var found = false
                    var matchedDistrict = Constants.TS_DISTRICTS.find { it.equals(districtName, ignoreCase = true) }
                    if (matchedDistrict != null) {
                        selectedState = "TS"
                        selectedDistrict = matchedDistrict
                        found = true
                    } else {
                        matchedDistrict = Constants.AP_DISTRICTS.find { it.equals(districtName, ignoreCase = true) }
                        if (matchedDistrict != null) {
                            selectedState = "AP"
                            selectedDistrict = matchedDistrict
                            found = true
                        }
                    }

                    if (found && mandalName != null) {
                        val currentMandals = Constants.MANDAL_DATA[selectedDistrict] ?: emptyList()
                        selectedMandal = currentMandals.find { it.equals(mandalName, ignoreCase = true) } ?: ""
                    } else if (found) {
                        selectedMandal = ""
                    } else {
                        Toast.makeText(context, "మీ జిల్లాను గుర్తించలేకపోయాము.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        } catch (e: Exception) {
            Toast.makeText(context, "చిరునామాను పొందడంలో విఫలమైంది.", Toast.LENGTH_SHORT).show()
        }
    }

    fun fetchCurrentLocation() {
        when (PackageManager.PERMISSION_GRANTED) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) -> {
                scope.launch {
                    try {
                        val location = fusedLocationClient.getCurrentLocation(
                            com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                            null
                        ).await()
                        if (location != null) {
                            getAddressFromLocation(location.latitude, location.longitude)
                        } else {
                            Toast.makeText(context, "లొకేషన్‌ను తిరిగి పొందడం సాధ్యం కాలేదు.", Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(context, "లొకేషన్ పొందడంలో లోపం.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            else -> {
                requestLocationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
    }

    fun launchCamera() {
        when (PackageManager.PERMISSION_GRANTED) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) -> {
                val photoFile = File(context.externalCacheDir, "photo.jpg")
                val newPhotoUri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", photoFile)
                mediaUri = newPhotoUri
                cameraLauncher.launch(newPhotoUri)
            }
            else -> {
                requestCameraPermission.launch(Manifest.permission.CAMERA)
            }
        }
    }

    fun handleSubmit() {
        if (content.isBlank() || selectedDistrict.isBlank()) {
            Toast.makeText(context, "దయచేసి అవసరమైన అన్ని ఫీల్డ్‌లను పూరించండి.", Toast.LENGTH_SHORT).show()
            return
        }
        if (!agreedToTerms) {
            Toast.makeText(context, "దయచేసి నిబంధనలను అంగీకరించండి.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                var mediaUrl = ""
                val localMediaUri = mediaUri
                if (localMediaUri != null) {
                    statusMessage = "మీడియా అప్‌లోడ్ చేయబడుతోంది..."
                    val isVideo = context.contentResolver.getType(localMediaUri)?.startsWith("video/") == true
                    mediaUrl = uploadMediaToStorage(context, localMediaUri, "citizen-media", isVideo)
                }

                statusMessage = "వార్త సిద్ధం చేయబడుతోంది..."
                val finalCategories = listOf("జనరల్", selectedDistrict).filter { it.isNotBlank() }

                val newsData = hashMapOf(
                    "headline" to mapOf("telugu" to (if (content.length > 50) content.take(50) + "..." else content), "english" to ""),
                    "content" to mapOf("telugu" to content, "english" to ""),
                    "mediaUrl" to mediaUrl,
                    "mediaType" to if (mediaUrl.contains("video")) "VIDEO" else "IMAGE",
                    "location" to selectedMandal,
                    "categories" to finalCategories,
                    "reporter" to mapOf("id" to user.id, "name" to if (isAnonymous) "అజ్ఞాత పౌరుడు" else user.name),
                    "timestamp" to Timestamp.now(),
                    "category" to "జనరల్",
                    "district" to selectedDistrict,
                    "state" to selectedState,
                    "likes" to 0,
                    "comments" to 0,
                    "shares" to 0,
                    "verificationStatus" to "VERIFIED",
                    "verificationReason" to "పౌరుడి ద్వారా ధృవీకరించబడింది",
                    "isCitizen" to true,
                    "isReporter" to false,
                    "userConfirmed" to true
                )

                val docRef = FirebaseService.db.collection("news").add(newsData).await()
                
                // Background Processing
                statusMessage = "వార్తను పంపిస్తున్నాము..."
                try {
                    FirebaseFunctionsService.processNewsPost(docRef.id)
                } catch (e: Exception) {
                    println("Background Processing failed: ${e.message}")
                }

                Toast.makeText(context, "ధన్యవాదాలు! మీ ప్రజా సమస్య విజయవంతంగా పబ్లిష్ చేయబడింది.", Toast.LENGTH_LONG).show()
                onClose()
            } catch (e: Exception) {
                Toast.makeText(context, "లోపం: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                isSubmitting = false
            }
        }
    }

    if (showMediaSourceDialog) {
        AlertDialog(
            onDismissRequest = { showMediaSourceDialog = false },
            title = { Text("మీడియాను ఎంచుకోండి") },
            text = { Text("మీరు ఫోటో తీయాలనుకుంటున్నారా లేదా గ్యాలరీ నుండి ఎంచుకోవాలనుకుంటున్నారా?") },
            confirmButton = {
                Button(onClick = { showMediaSourceDialog = false; launchCamera() }) { Text("కెమెరా") }
            },
            dismissButton = {
                Button(onClick = { showMediaSourceDialog = false; galleryLauncher.launch("image/*,video/*") }) { Text("గ్యాలరీ") }
            }
        )
    }

    AlfaNewsTheme {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("సిటిజెన్ జర్నలిజం") },
                    navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.Default.Close, contentDescription = "Close") } },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary,
                        navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            },
            content = {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(it)
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Card(
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("ముఖ్య గమనిక:", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onErrorContainer)
                            Text("• ప్రజా సమస్యలు, రోడ్లు, డ్రైనేజీ సమస్యల వంటివి మాత్రమే పంపండి.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
                            Text("• పుట్టినరోజులు, పెళ్లిళ్లు, వ్యక్తిగత వార్తలు నిషిద్ధం.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
                            Text("• మా సిస్టమ్ వ్యక్తిగత వార్తలను గుర్తించి తిరస్కరిస్తుంది.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
                        }
                    }

                    Card(elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text("సమస్య వివరాలు", style = MaterialTheme.typography.titleLarge)
                            OutlinedTextField(
                                value = content,
                                onValueChange = { content = it },
                                label = { Text("ఇక్కడ సమస్యను వివరించండి") },
                                placeholder = { Text("రోడ్లు బాలేవు, నీటి సమస్య ఉంది వంటి వివరాలు రాయండి...") },
                                modifier = Modifier.fillMaxWidth().height(150.dp),
                            )
                        }
                    }

                    Card(elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("ప్రాంతం వివరాలు", style = MaterialTheme.typography.titleLarge)
                                TextButton(onClick = { fetchCurrentLocation() }) {
                                    Icon(Icons.Default.MyLocation, contentDescription = "Get Location", modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.size(4.dp))
                                    Text("Get Location")
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                Dropdown(label = "రాష్ట్రం", options = listOf("TS", "AP"), selected = selectedState, onSelected = { s -> selectedState = s; selectedDistrict = ""; selectedMandal = "" }, modifier = Modifier.weight(1f)) { if (it == "TS") "తెలంగాణ" else "ఆంధ్రప్రదేశ్" }
                                Dropdown(label = "జిల్లా", options = districts, selected = selectedDistrict, onSelected = { d -> selectedDistrict = d; selectedMandal = "" }, modifier = Modifier.weight(1f))
                            }
                            Dropdown(label = "మండలం / పట్టణం", options = mandals, selected = selectedMandal, onSelected = { selectedMandal = it }, enabled = mandals.isNotEmpty())
                        }
                    }

                    Card(elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("ఫోటో లేదా వీడియో (ఐచ్ఛికం)", style = MaterialTheme.typography.titleLarge)
                            if (mediaUri != null) {
                                AsyncImage(
                                    model = mediaUri,
                                    contentDescription = "Selected Media",
                                    modifier = Modifier.fillMaxWidth().height(200.dp).clip(MaterialTheme.shapes.medium),
                                    contentScale = ContentScale.Crop
                                )
                            }
                            Button(onClick = { showMediaSourceDialog = true }) {
                                Text(if (mediaUri != null) "మీడియాను మార్చండి" else "మీడియాను ఎంచుకోండి")
                            }
                        }
                    }

                    Card(elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { isAnonymous = !isAnonymous }) {
                                Checkbox(checked = isAnonymous, onCheckedChange = { isAnonymous = it })
                                Text("పేరు వెల్లడించవద్దు (Anonymous)")
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { agreedToTerms = !agreedToTerms }) {
                                Checkbox(checked = agreedToTerms, onCheckedChange = { agreedToTerms = it })
                                Text("నిబంధనలు మరియు షరతులు అంగీకరిస్తున్నాను")
                            }
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
                            Text("సమస్యను పంపండి", fontSize = 18.sp)
                        }
                    }
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Dropdown(
    label: String,
    options: List<String>,
    selected: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    displayTransform: (String) -> String = { it }
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded && enabled,
        onExpandedChange = { if (enabled) expanded = !expanded },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = if (selected.isNotEmpty()) displayTransform(selected) else "",
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
            enabled = enabled
        )
        ExposedDropdownMenu(
            expanded = expanded && enabled,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(displayTransform(option)) },
                    onClick = {
                        onSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}
