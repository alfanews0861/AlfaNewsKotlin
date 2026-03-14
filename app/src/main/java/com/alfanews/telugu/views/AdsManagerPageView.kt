package com.alfanews.telugu.views

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.AdStatus
import com.alfanews.telugu.models.LocalAd
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.rememberImagePicker
import com.alfanews.telugu.utils.uploadImageToStorage
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.NumberFormat
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
    var viewsOrdered by remember { mutableStateOf(10000) }
    var isSubmitting by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val MIN_AMOUNT = 2000
    val COST_PER_VIEW = 0.20
    val totalAmount = max(MIN_AMOUNT.toDouble(), viewsOrdered * COST_PER_VIEW)

    fun handleCreateAd() {
        if (adImageUri == null) {
            Toast.makeText(context, "దయచేసి యాడ్ బ్యానర్‌ను అప్‌లోడ్ చేయండి.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                val bannerUrl = uploadImageToStorage(adImageUri!!, "ad-banners")

                val newAd = hashMapOf(
                    "userId" to currentUser.id,
                    "userName" to currentUser.name,
                    "bannerUrl" to bannerUrl,
                    "targetState" to targetState,
                    "targetDistrict" to targetDistrict,
                    "viewsOrdered" to viewsOrdered,
                    "viewsCurrent" to 0,
                    "costPerView" to COST_PER_VIEW,
                    "totalAmount" to totalAmount,
                    "status" to AdStatus.PENDING_PAYMENT.name,
                    "createdAt" to System.currentTimeMillis()
                )

                FirebaseService.db.collection("local_ads").add(newAd).await()
                Toast.makeText(context, "యాడ్ రిక్వెస్ట్ సబ్మిట్ చేయబడింది! పేమెంట్ కోసం అడ్మిన్ మిమ్మల్ని సంప్రదిస్తారు.", Toast.LENGTH_LONG).show()
                onAdCreated()
            } catch (e: Exception) {
                Toast.makeText(context, "యాడ్ సబ్మిట్ చేయడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSubmitting = false
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("నిబంధనలు:", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onTertiaryContainer)
                Text("• కనీస ఛార్జీ ₹$MIN_AMOUNT.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                Text("• ప్రతి వ్యూ కి ₹${String.format("%.2f", COST_PER_VIEW)} ఛార్జ్ చేయబడుతుంది.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
            }
        }

        Card(elevation = CardDefaults.cardElevation(2.dp)) {
            val pickImage = rememberImagePicker { adImageUri = it }
            Column(Modifier.padding(16.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("యాడ్ బ్యానర్ అప్‌లోడ్", style = MaterialTheme.typography.titleLarge)
                if (adImageUri != null) {
                    AsyncImage(model = adImageUri, contentDescription = "Ad Banner", modifier = Modifier.fillMaxWidth().height(200.dp).clip(MaterialTheme.shapes.medium), contentScale = ContentScale.Crop)
                }
                Button(onClick = { pickImage() }) {
                    Text(if (adImageUri != null) "బ్యానర్‌ను మార్చండి" else "బ్యానర్‌ను ఎంచుకోండి")
                }
            }
        }
        
        Card(elevation = CardDefaults.cardElevation(2.dp)) {
             Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("టార్గెట్ ఆడియెన్స్", style = MaterialTheme.typography.titleLarge)
                 Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                     TargetingDropdown(label = "రాష్ట్రం", options = mapOf("ALL" to "అందరికీ", "TS" to "తెలంగాణ", "AP" to "ఆంధ్రప్రదేశ్"), selected = targetState, onSelected = { 
                         targetState = it
                         targetDistrict = "ALL"
                     })
                     TargetingDropdown(label = "జిల్లా", options = (if(targetState == "ALL") emptyMap() else (if(targetState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS).associateWith { it }), selected = targetDistrict, onSelected = { targetDistrict = it }, enabled = targetState != "ALL")
                 }
             }
        }

        Card(elevation = CardDefaults.cardElevation(2.dp)) {
            Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("వ్యూస్ మరియు బడ్జెట్", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(value = viewsOrdered.toString(), onValueChange = { viewsOrdered = it.filter { c -> c.isDigit() }.toIntOrNull() ?: 1000 }, label = { Text("ఎన్ని వ్యూస్ కావాలి?") }, modifier = Modifier.fillMaxWidth())
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("మొత్తం చెల్లించాల్సినది:", style = MaterialTheme.typography.titleMedium)
                    Text("₹ ${NumberFormat.getNumberInstance(Locale.US).format(totalAmount)}", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { handleCreateAd() },
            modifier = Modifier.fillMaxWidth().height(56.dp),
            enabled = !isSubmitting
        ) {
            if (isSubmitting) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Text("ప్రకటనను సబ్మిట్ చేయండి", fontSize = 18.sp)
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
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AsyncImage(model = ad.bannerUrl, contentDescription = "Ad", modifier = Modifier.size(100.dp, 60.dp).clip(MaterialTheme.shapes.small))
                Column {
                    Text("User: ${ad.userName}", style = MaterialTheme.typography.titleSmall)
                    Text(ad.getTargetAudience(), style = MaterialTheme.typography.bodySmall)
                }
            }
            
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (ad.status == AdStatus.PENDING_PAYMENT || ad.status == AdStatus.REJECTED) {
                    Button(onClick = { 
                        scope.launch {
                            FirebaseService.db.collection("local_ads").document(ad.id).update("status", AdStatus.ACTIVE.name).await()
                            onUpdate()
                        }
                    }) { Text("అప్రూవ్ & యాక్టివేట్") }
                }
                if (ad.status == AdStatus.ACTIVE) {
                     Button(onClick = { 
                        scope.launch {
                            FirebaseService.db.collection("local_ads").document(ad.id).update("status", AdStatus.COMPLETED.name).await()
                            onUpdate()
                        }
                    }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)) { Text("కంప్లీట్") }
                }
                Button(onClick = { 
                    scope.launch {
                        FirebaseService.db.collection("local_ads").document(ad.id).update("status", AdStatus.REJECTED.name).await()
                        onUpdate()
                    }
                }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("రిజెక్ట్") }
            }
        }
    }
}

@Composable
private fun AdListItem(ad: LocalAd) {
    Card(modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            AsyncImage(model = ad.bannerUrl, contentDescription = "Ad", modifier = Modifier.size(120.dp, 75.dp).clip(MaterialTheme.shapes.small))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(ad.getTargetAudience(), style = MaterialTheme.typography.titleMedium)
                Surface(color = ad.status.toColor(), shape = MaterialTheme.shapes.small) {
                    Text(ad.status.name, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = Color.White)
                }
                LinearProgressIndicator(progress = ad.progress, modifier = Modifier.fillMaxWidth())
                Text("${NumberFormat.getNumberInstance(Locale.US).format(ad.viewsCurrent)} / ${NumberFormat.getNumberInstance(Locale.US).format(ad.viewsOrdered)} వ్యూస్", style = MaterialTheme.typography.labelSmall)
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
