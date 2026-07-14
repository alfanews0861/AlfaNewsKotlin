package com.alfanews.telugu.views

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
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
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.toUserObject
import com.alfanews.telugu.viewmodels.ReportersViewModel
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReporterManagementPageView(currentUser: User) {
    val context = LocalContext.current
    val reportersViewModel: ReportersViewModel = viewModel()
    val reporterStats by reportersViewModel.reporterStats.collectAsStateWithLifecycle()
    val reporters by reportersViewModel.filteredReporters.collectAsStateWithLifecycle()
    val searchQuery by reportersViewModel.searchQuery.collectAsStateWithLifecycle()
    val sortOrder by reportersViewModel.sortOrder.collectAsStateWithLifecycle()

    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("దరఖాస్తులు", "రిపోర్టర్లు")

    var applications by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun fetchData() {
        scope.launch {
            loading = true
            try {
                if (selectedTab == 0) {
                    val baseQuery = FirebaseService.db.collection("reporter_applications")
                        .orderBy("status", Query.Direction.ASCENDING)
                        .orderBy("timestamp", Query.Direction.DESCENDING)

                    val snapshot = if (currentUser.role == UserRole.REGIONAL_INCHARGE) {
                        baseQuery.whereIn("district", currentUser.assignedDistricts).get().await()
                    } else {
                        baseQuery.get().await()
                    }
                    applications = snapshot.documents.map { doc -> doc.data?.plus("id" to doc.id) ?: emptyMap() }
                    loading = false
                } else {
                    reportersViewModel.fetchReporters(currentUser)
                    // ReportersViewModel updates the 'reporters' state flow, which we observe
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // Show toast if on applications tab where fetching might fail due to index/rules
                if (selectedTab == 0) {
                    Toast.makeText(context, "Error fetching applications: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } finally {
                if (selectedTab == 0) loading = false
            }
        }
    }

    LaunchedEffect(selectedTab) {
        fetchData()
    }
    
    // Sync loading state with ViewModel when on reporters tab
    val vmLoading by reportersViewModel.loading.collectAsStateWithLifecycle()
    val effectiveLoading = if (selectedTab == 1) vmLoading else loading

    Column(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color(0xFF121212),
            contentColor = Color.White,
            indicator = { tabPositions ->
                TabRowDefaults.Indicator(
                    Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = Color.White
                )
            }
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title, fontFamily = Ramabhadra, color = if (selectedTab == index) Color.White else Color.Gray) }
                )
            }
        }

        if (selectedTab == 1) {
            // Search and Sort Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { reportersViewModel.setSearchQuery(it) },
                    placeholder = { Text("పేరు లేదా ఫోన్ నంబర్", fontSize = 12.sp, color = Color.Gray) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(18.dp)) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color.White.copy(alpha = 0.5f),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                        cursorColor = Color.White
                    ),
                    shape = RoundedCornerShape(24.dp)
                )

                var sortExpanded by remember { mutableStateOf(false) }
                Box {
                    IconButton(
                        onClick = { sortExpanded = true },
                        modifier = Modifier
                            .background(Color.White.copy(alpha = 0.1f), CircleShape)
                            .size(40.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Sort, contentDescription = "Sort", tint = Color.White)
                    }
                    DropdownMenu(
                        expanded = sortExpanded,
                        onDismissRequest = { sortExpanded = false },
                        modifier = Modifier.background(Color(0xFF1E1E1E))
                    ) {
                        val options = listOf(
                            "Recent" to "ఇటీవలి",
                            "Points" to "పాయింట్లు",
                            "Today" to "ఈ రోజు పోస్ట్లు",
                            "Week" to "వారపు పోస్ట్లు",
                            "Name" to "పేరు"
                        )
                        options.forEach { (key, label) ->
                            DropdownMenuItem(
                                text = { Text(label, color = if (sortOrder == key) Color.White else Color.Gray) },
                                onClick = {
                                    reportersViewModel.setSortOrder(key)
                                    sortExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        // Admin Backfill Button
        if (currentUser.role == UserRole.ADMIN && selectedTab == 1) {
            val context = LocalContext.current
            var isBackfilling by remember { mutableStateOf(false) }
            
            Button(
                onClick = {
                    scope.launch {
                        isBackfilling = true
                        try {
                            val result = FirebaseFunctionsService.backfillReporterPoints()
                            if (result.isSuccess) {
                                Toast.makeText(context, "డేటా విజయవంతంగా అప్‌డేట్ చేయబడింది!", Toast.LENGTH_SHORT).show()
                                fetchData()
                            } else {
                                Toast.makeText(context, "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                            }
                        } catch (e: Exception) {
                            Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                        } finally {
                            isBackfilling = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary),
                enabled = !isBackfilling
            ) {
                if (isBackfilling) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                } else {
                    Icon(Icons.Default.Sync, contentDescription = null)
                }
                Spacer(Modifier.width(8.dp))
                Text("లీడర్ బోర్డ్ డేటా సింక్ (Admin)")
            }
        }

        if (effectiveLoading && (selectedTab == 0 || (selectedTab == 1 && reporters.isEmpty()))) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (selectedTab == 0) {
                    if (applications.isEmpty()) {
                        item { Box(modifier = Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) { Text("ఎటువంటి దరఖాస్తులు లేవు.") } }
                    } else {
                        items(applications, key = { it["id"].toString() }) { app ->
                            ApplicationCard(
                                app = app,
                                currentUser = currentUser,
                                onRefresh = { fetchData() }
                            )
                        }
                    }
                } else {
                    if (reporters.isEmpty()) {
                        item { Box(modifier = Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) { Text(if (searchQuery.isEmpty()) "రిపోర్టర్లు ఎవరూ లేరు." else "సరిపోలే రిపోర్టర్లు లేరు.") } }
                    } else {
                        items(reporters, key = { it.id }) { reporter ->
                            ReporterListCard(
                                reporter = reporter,
                                currentUser = currentUser,
                                stats = reporterStats[reporter.id],
                                onRefresh = { fetchData() }
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApplicationCard(
    app: Map<String, Any>,
    currentUser: User,
    onRefresh: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isProcessing by remember { mutableStateOf(false) }
    
    var editDistrict by remember { mutableStateOf(app["district"] as? String ?: "") }
    var editMandal by remember { mutableStateOf(app["mandal"] as? String ?: "") }
    var showLocationEdit by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(app["fullName"] as? String ?: "No Name", fontWeight = FontWeight.Bold, fontSize = 18.sp, fontFamily = Ramabhadra)
                val status = app["status"] as? String ?: "PENDING"
                StatusBadge(status)
            }

            Text("Phone: ${app["phone"]}", fontSize = 14.sp)
            Text("Education: ${app["education"]}", fontSize = 14.sp)
            Text("Requested: ${app["district"]} - ${app["mandal"]}", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium)
            
            if ((app["message"] as? String)?.isNotEmpty() == true) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Text("Message: ${app["message"]}", fontSize = 13.sp, color = Color.Gray)
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("నియమించాల్సిన ప్రాంతం: $editDistrict - $editMandal", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                IconButton(onClick = { showLocationEdit = !showLocationEdit }) {
                    Icon(Icons.Default.EditLocation, contentDescription = "Edit", modifier = Modifier.size(20.dp))
                }
            }

            if (showLocationEdit) {
                LocationSelector(
                    selectedDistrict = editDistrict,
                    selectedMandal = editMandal,
                    onLocationChange = { d, m -> editDistrict = d; editMandal = m }
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        scope.launch {
                            isProcessing = true
                            try {
                                val phone = app["phone"]?.toString() ?: ""
                                val userQuery = FirebaseService.db.collection("users").whereEqualTo("phone", phone).get().await()
                                val userDoc = if (userQuery.isEmpty) {
                                    FirebaseService.db.collection("users").whereEqualTo("phone", "+91$phone").get().await().documents.firstOrNull()
                                } else userQuery.documents.firstOrNull()

                                if (userDoc == null) {
                                    Toast.makeText(context, "ఈ యూజర్ ఇంకా లాగిన్ అవ్వలేదు.", Toast.LENGTH_LONG).show()
                                } else {
                                    processJoin(userDoc.id, app["id"] as String, editDistrict, editMandal, currentUser.id)
                                    Toast.makeText(context, "అప్రూవ్ చేయబడింది!", Toast.LENGTH_SHORT).show()
                                    onRefresh()
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isProcessing = false
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
                    enabled = !isProcessing && (app["status"] as? String == "PENDING")
                ) {
                    if (isProcessing) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                    else Text("Approve")
                }

                Button(
                    onClick = {
                        scope.launch {
                            isProcessing = true
                            try {
                                processReject(app["id"] as String)
                                Toast.makeText(context, "తిరస్కరించబడింది (Rejected)", Toast.LENGTH_SHORT).show()
                                onRefresh()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isProcessing = false
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828)),
                    enabled = !isProcessing && (app["status"] as? String == "PENDING")
                ) {
                    if (isProcessing) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                    else Text("Reject")
                }

                if (currentUser.role == UserRole.ADMIN || currentUser.role == UserRole.EDITOR) {
                    IconButton(
                        onClick = {
                            scope.launch {
                                FirebaseService.db.collection("reporter_applications").document(app["id"] as String).delete().await()
                                onRefresh()
                            }
                        }
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = "Remove", tint = Color.Gray)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReporterListCard(
    reporter: User,
    currentUser: User,
    stats: com.alfanews.telugu.viewmodels.ReporterStats? = null,
    onRefresh: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var isEditingLocation by remember { mutableStateOf(false) }
    var editDistrict by remember { mutableStateOf(reporter.district ?: "") }
    var editMandal by remember { mutableStateOf(reporter.assignedMandal ?: "") }
    var isSaving by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1E1E1E), // Dark grey/black theme
            contentColor = Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        border = BorderStroke(1.dp, Color.Gray.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = reporter.photoUrl ?: "https://ui-avatars.com/api/?name=${reporter.name}&background=random",
                    contentDescription = null,
                    modifier = Modifier.size(56.dp).clip(CircleShape).border(1.5.dp, Color.Gray, CircleShape),
                    contentScale = ContentScale.Crop
                )
                
                Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(reporter.name, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.White)
                    
                    // Phone number with click-to-call
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable {
                            if (!reporter.phone.isNullOrEmpty()) {
                                try {
                                    val intent = Intent(Intent.ACTION_DIAL).apply {
                                        data = Uri.parse("tel:${reporter.phone}")
                                    }
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    Toast.makeText(context, "కాల్ చేయలేకపోతున్నాము.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    ) {
                        Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFF4CAF50))
                        Spacer(Modifier.width(4.dp))
                        Text(reporter.phone ?: "No Phone", fontSize = 14.sp, color = Color(0xFF4CAF50), fontWeight = FontWeight.Medium)
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${reporter.district} - ${reporter.assignedMandal}", fontSize = 12.sp, color = Color.LightGray)
                        IconButton(onClick = { isEditingLocation = !isEditingLocation }, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.EditLocation, contentDescription = "Edit Location", modifier = Modifier.size(16.dp), tint = Color.Gray)
                        }
                    }
                }

                IconButton(onClick = {
                    scope.launch {
                        try {
                            val newRole = if (reporter.role == UserRole.REPORTER) UserRole.SUBSCRIBER else UserRole.REPORTER
                            FirebaseService.db.collection("users").document(reporter.id).update("role", newRole.toString()).await()
                            Toast.makeText(context, if (newRole == UserRole.SUBSCRIBER) "Suspended" else "Restored", Toast.LENGTH_SHORT).show()
                            onRefresh()
                        } catch (e: Exception) {
                            Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }) {
                    Icon(
                        if (reporter.role == UserRole.REPORTER) Icons.Default.Block else Icons.Default.CheckCircle,
                        contentDescription = "Toggle Status",
                        tint = if (reporter.role == UserRole.REPORTER) Color(0xFFEF5350) else Color(0xFF66BB6A)
                    )
                }
            }

            // Statistics Row
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ఈ రోజు", fontSize = 10.sp, color = Color.Gray)
                    Text("${stats?.todayPosts ?: 0}", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color.White)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("గత వారం", fontSize = 10.sp, color = Color.Gray)
                    Text("${stats?.weekPosts ?: 0}", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color.White)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("పాయింట్లు", fontSize = 10.sp, color = Color.Gray)
                    Text("${reporter.points}", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFFFFA000))
                }
            }

            if (isEditingLocation) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                LocationSelector(
                    selectedDistrict = editDistrict,
                    selectedMandal = editMandal,
                    onLocationChange = { d, m -> editDistrict = d; editMandal = m }
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = {
                        scope.launch {
                            isSaving = true
                            try {
                                val updates = mapOf(
                                    "district" to editDistrict,
                                    "assignedMandal" to editMandal
                                )
                                FirebaseService.db.collection("users").document(reporter.id).update(updates).await()
                                Toast.makeText(context, "Location updated", Toast.LENGTH_SHORT).show()
                                isEditingLocation = false
                                onRefresh()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isSaving = false
                            }
                        }
                    },
                    modifier = Modifier.align(Alignment.End),
                    enabled = !isSaving
                ) {
                    if (isSaving) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                    else Text("Save Location")
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    Surface(
        color = when(status) {
            "JOINED" -> Color(0xFFE8F5E9)
            "SUSPENDED" -> Color(0xFFFFEBEE)
            "REJECTED" -> Color(0xFFFFEBEE)
            else -> Color(0xFFFFF3E0)
        },
        shape = RoundedCornerShape(4.dp)
    ) {
        Text(status, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = when(status){
            "JOINED" -> Color(0xFF2E7D32)
            "SUSPENDED" -> Color(0xFFC62828)
            "REJECTED" -> Color(0xFFC62828)
            else -> Color(0xFFE65100)
        })
    }
}

@Composable
fun BadgeChip(text: String, color: Color) {
    Surface(
        color = color.copy(alpha = 0.1f),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, color.copy(alpha = 0.5f))
    ) {
        Text(text, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSelector(
    selectedDistrict: String,
    selectedMandal: String,
    onLocationChange: (String, String) -> Unit
) {
    var distExpanded by remember { mutableStateOf(false) }
    var mandExpanded by remember { mutableStateOf(false) }
    val districts = Constants.ALL_DISTRICTS

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ExposedDropdownMenuBox(expanded = distExpanded, onExpandedChange = { distExpanded = it }) {
            OutlinedTextField(
                value = selectedDistrict,
                onValueChange = {},
                readOnly = true,
                label = { Text("District") },
                modifier = Modifier.fillMaxWidth().menuAnchor(),
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = distExpanded) },
                colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
            )
            ExposedDropdownMenu(expanded = distExpanded, onDismissRequest = { distExpanded = false }) {
                districts.forEach { districtName: String ->
                    DropdownMenuItem(
                        text = { Text(districtName) }, 
                        onClick = { 
                            onLocationChange(districtName, "")
                            distExpanded = false 
                        }
                    )
                }
            }
        }

        if (selectedDistrict.isNotEmpty()) {
            val mandals = Constants.MANDAL_DATA[selectedDistrict] ?: emptyList<String>()
            ExposedDropdownMenuBox(expanded = mandExpanded, onExpandedChange = { mandExpanded = it }) {
                OutlinedTextField(
                    value = selectedMandal,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Mandal") },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mandExpanded) },
                    colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
                )
                ExposedDropdownMenu(expanded = mandExpanded, onDismissRequest = { mandExpanded = false }) {
                    mandals.forEach { mandalName: String ->
                        DropdownMenuItem(
                            text = { Text(mandalName) }, 
                            onClick = { 
                                onLocationChange(selectedDistrict, mandalName)
                                mandExpanded = false 
                            }
                        )
                    }
                }
            }
        }
    }
}

private suspend fun processJoin(userId: String, appId: String, district: String, mandal: String, promoterId: String) {
    val updates = mapOf(
        "role" to "REPORTER",
        "district" to district,
        "assignedMandal" to mandal,
        "promotedBy" to promoterId,
        "points" to 0,
        "badges" to emptyList<String>()
    )
    FirebaseService.db.collection("users").document(userId).update(updates).await()
    FirebaseService.db.collection("reporter_applications").document(appId).update("status", "JOINED").await()
}

private suspend fun processReject(appId: String) {
    FirebaseService.db.collection("reporter_applications").document(appId).update("status", "REJECTED").await()
}
