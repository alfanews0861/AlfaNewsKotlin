package com.alfanews.telugu.views

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Html
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.UploadFile
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
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberDateRangePickerState
import com.alfanews.telugu.models.AdMediaType
import com.alfanews.telugu.models.AdStatus
import com.alfanews.telugu.models.AdType
import com.alfanews.telugu.models.LocalAd
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.rememberMediaPicker
import com.alfanews.telugu.utils.uploadMediaToStorage
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.max

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdsManagerPageView(currentUser: User) {
    var activeTab by remember { mutableStateOf("create") }

    AlfaNewsTheme {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("స్థానిక ప్రకటనలు") },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }
        ) {
            Column(modifier = Modifier.fillMaxSize().padding(it)) {
                TabRow(
                    selectedTabIndex = when (activeTab) {
                        "create" -> 0
                        "my_ads" -> 1
                        else -> if (currentUser.role == UserRole.ADMIN) 2 else 0
                    },
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Tab(selected = activeTab == "create", onClick = { activeTab = "create" }) {
                        Text("కొత్త యాడ్", modifier = Modifier.padding(16.dp))
                    }
                    Tab(selected = activeTab == "my_ads", onClick = { activeTab = "my_ads" }) {
                        Text("నా యాడ్స్", modifier = Modifier.padding(16.dp))
                    }
                    if (currentUser.role == UserRole.ADMIN) {
                        Tab(selected = activeTab == "admin", onClick = { activeTab = "admin" }) {
                            Text("అడ్మిన్", modifier = Modifier.padding(16.dp))
                        }
                    }
                }

                when (activeTab) {
                    "create" -> CreateAdView(currentUser) { activeTab = "my_ads" }
                    "my_ads" -> MyAdsView(currentUser)
                    "admin" -> if (currentUser.role == UserRole.ADMIN) AdminAdsView() else Text("Access Denied")
                }
            }
        }
    }
}

@Composable
private fun CreateAdView(currentUser: User, onAdCreated: () -> Unit) {
    var adImageUri by remember { mutableStateOf<Uri?>(null) }
    var targetState by remember { mutableStateOf("ALL") }
    var targetDistrict by remember { mutableStateOf("ALL") }
    
    var adType by remember { mutableStateOf(AdType.VIEWS_BASED) }
    var adMediaType by remember { mutableStateOf(AdMediaType.IMAGE) }
    
    var viewsOrdered by remember { mutableStateOf(10000) }
    var durationDays by remember { mutableStateOf(1) }
    var startDate by remember { mutableStateOf(System.currentTimeMillis()) }
    var endDate by remember { mutableStateOf(System.currentTimeMillis() + (24 * 60 * 60 * 1000L)) }

    var phoneNumber by remember { mutableStateOf("") }
    var actionUrl by remember { mutableStateOf("") }
    var actionText by remember { mutableStateOf("మరిన్ని వివరాలు") }
    var htmlContent by remember { mutableStateOf("") }

    var isSubmitting by remember { mutableStateOf(false) }
    var showPreview by remember { mutableStateOf(false) }
    var showDateRangePicker by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val COST_PER_VIEW = 0.20
    
    // Custom Ad Pricing Logic
    fun getRatePerDay(state: String, district: String): Double {
        if (state == "ALL") return 75000.0
        if (district == "ALL") return 50000.0
        
        // Large Cities/Districts (6000/day)
        val largeCities = listOf("విశాఖపట్నం", "హైదరాబాద్", "విజయవాడ", "ఎన్టీఆర్")
        if (largeCities.contains(district)) return 6000.0
        
        // Medium Cities/Districts (3000/day)
        val mediumDistricts = listOf("వరంగల్", "కరీంనగర్", "గుంటూరు", "నెల్లూరు")
        if (mediumDistricts.contains(district) || district.contains("నెల్లూరు")) return 3000.0
        
        // Small Districts (2000/day)
        return 2000.0
    }

    val costPerDay = getRatePerDay(targetState, targetDistrict)

    // Calculate duration based on dates if in TIME_BASED mode
    val effectiveDuration = if (adType == AdType.TIME_BASED_FIXED) {
        val diff = endDate - startDate
        max(1L, diff / (24 * 60 * 60 * 1000L))
    } else {
        1L
    }

    val totalAmount = if (adType == AdType.VIEWS_BASED) {
        max(2000.0, viewsOrdered * COST_PER_VIEW)
    } else {
        effectiveDuration * costPerDay
    }

    fun handleCreateAd() {
        if (adMediaType != AdMediaType.HTML && adImageUri == null) {
            Toast.makeText(context, "దయచేసి మీడియాను అప్‌లోడ్ చేయండి.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                val bannerUrl = if (adMediaType != AdMediaType.HTML) {
                    uploadMediaToStorage(context, adImageUri!!, "local-ads", isVideo = adMediaType == AdMediaType.VIDEO)
                } else ""

                val initialStatus = if (currentUser.role == UserRole.ADMIN) AdStatus.ACTIVE else AdStatus.PENDING_PAYMENT

                val newAd = hashMapOf(
                    "userId" to currentUser.id,
                    "userName" to currentUser.name,
                    "bannerUrl" to bannerUrl,
                    "htmlContent" to htmlContent,
                    "adMediaType" to adMediaType.name,
                    "targetState" to targetState,
                    "targetDistrict" to targetDistrict,
                    "actionUrl" to actionUrl,
                    "phoneNumber" to phoneNumber,
                    "actionText" to actionText,
                    "adType" to adType.name,
                    "viewsOrdered" to (if (adType == AdType.VIEWS_BASED) viewsOrdered else -1),
                    "viewsCurrent" to 0,
                    "clicksCurrent" to 0,
                    "costPerView" to COST_PER_VIEW,
                    "startDate" to startDate,
                    "endDate" to endDate,
                    "totalAmount" to totalAmount,
                    "status" to initialStatus.name,
                    "createdAt" to System.currentTimeMillis(),
                    "approvedAt" to (if (currentUser.role == UserRole.ADMIN) System.currentTimeMillis() else null)
                )

                FirebaseService.db.collection("local_ads").add(newAd).await()
                Toast.makeText(context, "యాడ్ రిక్వెస్ట్ సబ్మిట్ చేయబడింది!", Toast.LENGTH_LONG).show()
                onAdCreated()
            } catch (e: Exception) {
                Toast.makeText(context, "లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSubmitting = false
            }
        }
    }

    if (showDateRangePicker) {
        val dateRangePickerState = rememberDateRangePickerState(
            initialSelectedStartDateMillis = startDate,
            initialSelectedEndDateMillis = endDate
        )
        DatePickerDialog(
            onDismissRequest = { showDateRangePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    dateRangePickerState.selectedStartDateMillis?.let { startDate = it }
                    dateRangePickerState.selectedEndDateMillis?.let { endDate = it }
                    showDateRangePicker = false
                }) { Text("ఓకే") }
            },
            dismissButton = {
                TextButton(onClick = { showDateRangePicker = false }) { Text("రద్దు") }
            }
        ) {
            DateRangePicker(
                state = dateRangePickerState,
                title = { Text("ప్రకటన కాలపరిమితి ఎంచుకోండి", modifier = Modifier.padding(16.dp)) },
                modifier = Modifier.height(500.dp)
            )
        }
    }

    if (showPreview) {
        AlertDialog(
            onDismissRequest = { showPreview = false },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false),
            text = {
                Box(Modifier.fillMaxWidth().aspectRatio(9f/16f).clip(RoundedCornerShape(12.dp))) {
                    LocalAdCardView(ad = LocalAd(
                        id = "preview_${System.currentTimeMillis()}",
                        bannerUrl = adImageUri?.toString() ?: "",
                        adMediaType = adMediaType,
                        actionText = actionText,
                        phoneNumber = phoneNumber,
                        actionUrl = actionUrl,
                        htmlContent = htmlContent
                    ))
                }
            },
            confirmButton = { Button(onClick = { showPreview = false }) { Text("Close Preview") } }
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("నిబంధనలు & ధరలు:", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onTertiaryContainer)
                Text("• వ్యూస్ ఆధారంగా: ₹${String.format("%.2f", COST_PER_VIEW)} ప్రతి వ్యూ కి (కనీసం ₹2,000).", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                Text("• సమయం ఆధారంగా (ఈ ప్రాంతానికి): ₹${costPerDay.toInt()} ప్రతి రోజుకు (అన్‌లిమిటెడ్ వ్యూస్).", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                Text("  (చిన్న జిల్లా: ₹2000, మీడియం: ₹3000, పెద్ద నగరం: ₹6000, స్టేట్: ₹50,000)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f))
            }
        }

        Card(elevation = CardDefaults.cardElevation(2.dp)) {
            Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("ప్రకటన రకం & మీడియా", style = MaterialTheme.typography.titleLarge)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = adType == AdType.VIEWS_BASED, onClick = { adType = AdType.VIEWS_BASED }, label = { Text("వ్యూస్") })
                    FilterChip(selected = adType == AdType.TIME_BASED_FIXED, onClick = { adType = AdType.TIME_BASED_FIXED }, label = { Text("రోజులు") })
                }
                HorizontalDivider()
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = adMediaType == AdMediaType.IMAGE, onClick = { adMediaType = AdMediaType.IMAGE }, label = { Text("Image") })
                    FilterChip(selected = adMediaType == AdMediaType.VIDEO, onClick = { adMediaType = AdMediaType.VIDEO }, label = { Text("Video") })
                    FilterChip(selected = adMediaType == AdMediaType.HTML, onClick = { adMediaType = AdMediaType.HTML }, label = { Text("HTML") })
                }
            }
        }

        if (adMediaType == AdMediaType.HTML) {
            OutlinedTextField(value = htmlContent, onValueChange = { htmlContent = it }, label = { Text("HTML Code") }, modifier = Modifier.fillMaxWidth().height(150.dp))
        } else {
            val launcher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.GetContent()
            ) { uri -> adImageUri = uri }

            Card(elevation = CardDefaults.cardElevation(2.dp)) {
                Column(Modifier.padding(16.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (adImageUri != null) {
                        Box(modifier = Modifier.fillMaxWidth().height(200.dp).clip(MaterialTheme.shapes.medium)) {
                            if (adMediaType == AdMediaType.VIDEO) {
                                VideoPlayerView(
                                    videoUrl = adImageUri.toString(), 
                                    modifier = Modifier.fillMaxSize(),
                                    autoPlay = true
                                )
                            } else {
                                AsyncImage(model = adImageUri, contentDescription = "Preview", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                            }
                        }
                    }
                    Button(onClick = { 
                        val mimeType = if (adMediaType == AdMediaType.VIDEO) "video/*" else "image/*"
                        launcher.launch(mimeType) 
                    }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.UploadFile, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (adImageUri != null) "మీడియా మార్చండి" else if (adMediaType == AdMediaType.VIDEO) "వీడియో ఎంచుకోండి (MP4)" else "ఫోటో ఎంచుకోండి")
                    }
                }
            }
        }

        Card(elevation = CardDefaults.cardElevation(2.dp)) {
            Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Call to Action (బటన్ వివరాలు)", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(value = actionText, onValueChange = { actionText = it }, label = { Text("బటన్ టెక్స్ట్ (ఉదా: Call Now)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = phoneNumber, onValueChange = { phoneNumber = it }, label = { Text("ఫోన్ నంబర్ (ఐచ్ఛికం)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = actionUrl, onValueChange = { actionUrl = it }, label = { Text("వెబ్‌సైట్/వాట్సాప్ లింక్ (ఐచ్ఛికం)") }, modifier = Modifier.fillMaxWidth())
            }
        }

        Card(elevation = CardDefaults.cardElevation(2.dp)) {
             Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("టార్గెట్ ఆడియెన్స్", style = MaterialTheme.typography.titleLarge)
                 Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                     TargetingDropdown(
                         label = "రాష్ట్రం", 
                         options = mapOf("ALL" to "అందరికీ", "TS" to "TS", "AP" to "AP"), 
                         selected = targetState, 
                         onSelected = { targetState = it; targetDistrict = "ALL" },
                         modifier = Modifier.weight(1f)
                     )
                     TargetingDropdown(
                         label = "జిల్లా", 
                         options = (if(targetState == "ALL") emptyMap() else (if(targetState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS).associateWith { it }), 
                         selected = targetDistrict, 
                         onSelected = { targetDistrict = it }, 
                         enabled = targetState != "ALL",
                         modifier = Modifier.weight(1f)
                     )
                 }
             }
        }

        if (adType == AdType.VIEWS_BASED) {
            Card(elevation = CardDefaults.cardElevation(2.dp)) {
                Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("వ్యూస్ వివరాలు", style = MaterialTheme.typography.titleLarge)
                    OutlinedTextField(value = viewsOrdered.toString(), onValueChange = { viewsOrdered = it.filter { c -> c.isDigit() }.toIntOrNull() ?: 1000 }, label = { Text("ఎన్ని వ్యూస్ కావాలి?") }, modifier = Modifier.fillMaxWidth())
                }
            }
        } else {
             Card(elevation = CardDefaults.cardElevation(2.dp)) {
                Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("సమయం మరియు తేదీలు", style = MaterialTheme.typography.titleLarge)
                    
                    OutlinedButton(onClick = { showDateRangePicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.DateRange, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        val sdf = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
                        Text("${sdf.format(Date(startDate))} - ${sdf.format(Date(endDate))}")
                    }

                    if (adType == AdType.TIME_BASED_FIXED) {
                        Text("మొత్తం రోజులు: $effectiveDuration", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
        }
        
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("మొత్తం చెల్లించాల్సినది:", style = MaterialTheme.typography.titleMedium)
            Text("₹ ${NumberFormat.getNumberInstance(Locale.US).format(totalAmount)}", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
        }

        Button(onClick = { showPreview = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) {
            Text("Preview Ad")
        }

        Button(onClick = { handleCreateAd() }, modifier = Modifier.fillMaxWidth().height(56.dp), enabled = !isSubmitting) {
            if (isSubmitting) {
                CircularProgressIndicator(color = Color.White)
            } else {
                Text(if (currentUser.role == UserRole.ADMIN) "ప్రకటనను ప్రచురించు (Publish)" else "యాడ్ రిక్వెస్ట్ పంపండి")
            }
        }
    }
}


@Composable
private fun MyAdsView(currentUser: User) { 
    var myAds by remember { mutableStateOf<List<LocalAd>>(emptyList()) }
    var loadingMyAds by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun fetchMyAds() {
        scope.launch {
            loadingMyAds = true
            try {
                val snapshot = FirebaseService.db.collection("local_ads").whereEqualTo("userId", currentUser.id).orderBy("createdAt", Query.Direction.DESCENDING).get().await()
                myAds = snapshot.documents.mapNotNull { LocalAd.fromSnapshot(it) }
            } catch (e: Exception) { e.printStackTrace() } 
            finally { loadingMyAds = false }
        }
    }

    LaunchedEffect(Unit) { fetchMyAds() }

    if (loadingMyAds) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    } else if (myAds.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("మీరు ఇంకా ఏ యాడ్స్ పోస్ట్ చేయలేదు.") }
    } else {
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(myAds, key = { it.id }) { ad -> AdListItem(ad) }
        }
    }
}

@Composable
fun AdminAdsView() { 
    var allAds by remember { mutableStateOf<List<LocalAd>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun fetchAllAds() {
        scope.launch {
            loading = true
            try {
                val snapshot = FirebaseService.db.collection("local_ads").orderBy("createdAt", Query.Direction.DESCENDING).get().await()
                allAds = snapshot.documents.mapNotNull { LocalAd.fromSnapshot(it) }
            } catch (e: Exception) { e.printStackTrace() }
            finally { loading = false }
        }
    }

    LaunchedEffect(Unit) { fetchAllAds() }

    if (loading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    } else {
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(allAds, key = { it.id }) { ad -> 
                AdminAdListItem(ad) { fetchAllAds() }
            }
        }
    }
}

@Composable
fun AdminAdListItem(ad: LocalAd, onUpdate: () -> Unit) {
    val scope = rememberCoroutineScope()
    var showDetails by remember { mutableStateOf(false) }

    if (showDetails) {
        AlertDialog(
            onDismissRequest = { showDetails = false },
            properties = DialogProperties(usePlatformDefaultWidth = false),
            text = {
                Box(Modifier.fillMaxWidth().aspectRatio(9f/16f).clip(RoundedCornerShape(12.dp))) {
                    LocalAdCardView(ad = ad)
                }
            },
            confirmButton = { Button(onClick = { showDetails = false }) { Text("Close") } }
        )
    }

    Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(2.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(100.dp, 60.dp).clip(MaterialTheme.shapes.small).background(Color.LightGray)) {
                    if (ad.adMediaType == AdMediaType.IMAGE) {
                        AsyncImage(model = ad.bannerUrl, contentDescription = "Ad", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    } else {
                        Icon(if(ad.adMediaType == AdMediaType.VIDEO) Icons.Default.PlayCircle else Icons.Default.Html, contentDescription = null, modifier = Modifier.align(Alignment.Center), tint = Color.Gray)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text("User: ${ad.userName}", style = MaterialTheme.typography.titleMedium)
                    Text("Target: ${ad.getTargetAudience()}", style = MaterialTheme.typography.bodySmall)
                    Text("Amount: ₹${NumberFormat.getNumberInstance(Locale.US).format(ad.totalAmount)}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    // Admin can see the tracking stats
                    Text("Views: ${ad.viewsCurrent} | Clicks: ${ad.clicksCurrent}", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                }
                Surface(color = ad.status.toColor(), shape = MaterialTheme.shapes.small) {
                    Text(ad.status.name, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = Color.White)
                }
            }
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { showDetails = true }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) {
                    Text("Preview")
                }

                if (ad.status != AdStatus.ACTIVE && ad.status != AdStatus.COMPLETED) {
                    Button(onClick = { 
                        scope.launch {
                            FirebaseService.db.collection("local_ads").document(ad.id).update("status", AdStatus.ACTIVE.name, "approvedAt", System.currentTimeMillis()).await()
                            onUpdate()
                        }
                    }, modifier = Modifier.weight(1f)) { Text("Approve") }
                }

                if (ad.status != AdStatus.REJECTED && ad.status != AdStatus.COMPLETED) {
                    Button(onClick = { 
                        scope.launch {
                            FirebaseService.db.collection("local_ads").document(ad.id).update("status", AdStatus.REJECTED.name).await()
                            onUpdate()
                        }
                    }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Reject") }
                }
            }
        }
    }
}

@Composable
private fun AdListItem(ad: LocalAd) {
    Card(modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(120.dp, 75.dp)) {
                AsyncImage(model = ad.bannerUrl, contentDescription = "Ad", modifier = Modifier.fillMaxSize().clip(MaterialTheme.shapes.small))
                if (ad.adMediaType != AdMediaType.IMAGE) {
                    Surface(color = Color.Black.copy(alpha = 0.5f), shape = RoundedCornerShape(4.dp), modifier = Modifier.align(Alignment.BottomEnd).padding(4.dp)) {
                        Text(ad.adMediaType.name, color = Color.White, fontSize = 8.sp, modifier = Modifier.padding(2.dp))
                    }
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(ad.getTargetAudience(), style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = ad.status.toColor(), shape = MaterialTheme.shapes.small) {
                        Text(ad.status.name, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = Color.White)
                    }
                    Text(if (ad.adType == AdType.VIEWS_BASED) "వ్యూస్ మోడ్" else "రోజుల మోడ్", style = MaterialTheme.typography.labelSmall)
                }
                
                if (ad.adType != AdType.VIEWS_BASED) {
                    val sdf = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
                    Text("వ్యవధి: ${sdf.format(Date(ad.startDate ?: 0))} - ${sdf.format(Date(ad.endDate ?: 0))}", style = MaterialTheme.typography.labelSmall)
                }
                
                // Tracking stats hidden from user in initial stage
                /*
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("క్లిక్స్: ${ad.clicksCurrent}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    val ctr = if (ad.viewsCurrent > 0) (ad.clicksCurrent.toDouble() / ad.viewsCurrent.toDouble()) * 100 else 0.0
                    Text("CTR: ${String.format("%.2f", ctr)}%", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                }
                */
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TargetingDropdown(label: String, options: Map<String, String>, selected: String, onSelected: (String) -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded && enabled, onExpandedChange = { if(enabled) expanded = !expanded }, modifier = modifier) {
        OutlinedTextField(
            value = options[selected] ?: selected,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
            enabled = enabled
        )
        ExposedDropdownMenu(expanded = expanded && enabled, onDismissRequest = { expanded = false }) {
            options.forEach { (key, value) ->
                DropdownMenuItem(text = { Text(value) }, onClick = { onSelected(key); expanded = false })
            }
        }
    }
}

// Helper extension functions for LocalAd model
fun LocalAd.getTargetAudience(): String = if (targetDistrict == "ALL") (if (targetState == "ALL") "అందరికీ" else "${targetState} మొత్తం") else targetDistrict
val LocalAd.progress: Float get() = if (viewsOrdered > 0) (viewsCurrent.toFloat() / viewsOrdered.toFloat()).coerceIn(0f, 1f) else 0f

@Composable
fun AdStatus.toColor(): Color = when (this) {
    AdStatus.ACTIVE -> Color(0xFF10B981) // Green
    AdStatus.COMPLETED -> Color.Gray
    AdStatus.REJECTED -> MaterialTheme.colorScheme.error
    else -> Color(0xFFF59E0B) // Amber
}
