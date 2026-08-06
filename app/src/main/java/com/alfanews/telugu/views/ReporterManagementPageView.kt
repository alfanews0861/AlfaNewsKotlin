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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
fun ReporterManagementPageView(
    currentUser: User,
    onOpenProfile: ((String) -> Unit)? = null
) {
    val context = LocalContext.current
    val reportersViewModel: ReportersViewModel = viewModel()
    val reporterStats by reportersViewModel.reporterStats.collectAsStateWithLifecycle()
    val reporters by reportersViewModel.filteredReporters.collectAsStateWithLifecycle()
    val searchQuery by reportersViewModel.searchQuery.collectAsStateWithLifecycle()
    val sortOrder by reportersViewModel.sortOrder.collectAsStateWithLifecycle()

    var selectedReporterIdForProfile by remember { mutableStateOf<String?>(null) }

    if (selectedReporterIdForProfile != null) {
        ReporterProfileView(
            reporterId = selectedReporterIdForProfile!!,
            language = com.alfanews.telugu.models.Language.TELUGU,
            currentUser = currentUser,
            onBack = { selectedReporterIdForProfile = null }
        )
        return
    }

    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("దరఖాస్తులు", "రిపోర్టర్లు")

    var appFilterState by remember { mutableStateOf("PENDING") } // "PENDING", "ALL", "JOINED", "REJECTED"
    var applications by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun fetchData() {
        scope.launch {
            loading = true
            try {
                if (selectedTab == 0) {
                    val rawSnapshot = FirebaseService.db.collection("reporter_applications")
                        .get().await()

                    var fetchedList = rawSnapshot.documents.mapNotNull { doc ->
                        doc.data?.plus("id" to doc.id)
                    }

                    if (currentUser.role == UserRole.REGIONAL_INCHARGE && currentUser.assignedDistricts.isNotEmpty()) {
                        fetchedList = fetchedList.filter { app ->
                            val appDist = (app["district"] as? String) 
                                ?: (app["state_district"] as? String) 
                                ?: ""
                            currentUser.assignedDistricts.any { assigned ->
                                assigned.equals(appDist, ignoreCase = true) || appDist.isEmpty()
                            }
                        }
                    }

                    // Auto-delete pending applications older than 10 days (10 days = 864,000,000 ms)
                    val TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000L
                    val now = System.currentTimeMillis()

                    val (validApps, expiredPendingApps) = fetchedList.partition { app ->
                        val status = app["status"]?.toString()?.uppercase() ?: "PENDING"
                        val isPending = status != "JOINED" && status != "APPROVED" && status != "REJECTED"
                        if (!isPending) return@partition true

                        val ts = app["timestamp"]
                        val timeMs = when (ts) {
                            is com.google.firebase.Timestamp -> ts.toDate().time
                            is Number -> ts.toLong()
                            is java.util.Date -> ts.time
                            else -> 0L
                        }
                        val isExpired = timeMs > 0L && (now - timeMs) > TEN_DAYS_MS
                        !isExpired
                    }

                    if (expiredPendingApps.isNotEmpty()) {
                        scope.launch {
                            try {
                                for (chunk in expiredPendingApps.chunked(400)) {
                                    val batch = FirebaseService.db.batch()
                                    for (app in chunk) {
                                        val docId = app["id"] as? String ?: continue
                                        batch.delete(FirebaseService.db.collection("reporter_applications").document(docId))
                                    }
                                    batch.commit().await()
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }

                    // Keep ALL valid fetched applications in state (sort newest first)
                    applications = validApps.sortedByDescending { doc ->
                        val ts = doc["timestamp"]
                        when (ts) {
                            is com.google.firebase.Timestamp -> ts.toDate().time
                            is Number -> ts.toLong()
                            else -> 0L
                        }
                    }
                } else {
                    reportersViewModel.fetchReporters(currentUser)
                    // ReportersViewModel updates the 'reporters' state flow, which we observe
                }
            } catch (e: Exception) {
                e.printStackTrace()
                if (selectedTab == 0) {
                    Toast.makeText(context, "Error fetching applications: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } finally {
                if (selectedTab == 0) loading = false
            }
        }
    }

    var hideDuplicates by remember { mutableStateOf(true) }
    var appSearchQuery by remember { mutableStateOf("") }

    val filteredApplications = remember(applications, appFilterState, hideDuplicates, appSearchQuery) {
        val baseList = when (appFilterState) {
            "PENDING" -> applications.filter { doc ->
                val status = doc["status"]?.toString()?.uppercase() ?: ""
                status != "JOINED" && status != "APPROVED" && status != "REJECTED"
            }
            "JOINED" -> applications.filter { doc ->
                val status = doc["status"]?.toString()?.uppercase() ?: ""
                status == "JOINED" || status == "APPROVED"
            }
            "REJECTED" -> applications.filter { doc ->
                val status = doc["status"]?.toString()?.uppercase() ?: ""
                status == "REJECTED"
            }
            else -> applications // "ALL"
        }

        val deduplicated = if (hideDuplicates) {
            deduplicateApplicationsList(baseList)
        } else {
            baseList
        }

        if (appSearchQuery.isBlank()) {
            deduplicated
        } else {
            val q = appSearchQuery.trim()
            deduplicated.filter { doc ->
                val name = (doc["name"] as? String) ?: ""
                val phone = (doc["phone"] as? String) ?: ""
                val district = (doc["district"] as? String) ?: (doc["state_district"] as? String) ?: ""
                val mandal = (doc["mandal"] as? String) ?: ""
                val org = (doc["organization"] as? String) ?: ""
                
                name.contains(q, ignoreCase = true) ||
                phone.contains(q, ignoreCase = true) ||
                district.contains(q, ignoreCase = true) ||
                mandal.contains(q, ignoreCase = true) ||
                org.contains(q, ignoreCase = true)
            }
        }
    }

    LaunchedEffect(selectedTab) {
        fetchData()
    }
    
    // Sync loading state with ViewModel when on reporters tab
    val vmLoading by reportersViewModel.loading.collectAsStateWithLifecycle()
    val effectiveLoading = if (selectedTab == 1) vmLoading else loading

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
            indicator = { tabPositions ->
                TabRowDefaults.Indicator(
                    Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title, fontFamily = Ramabhadra, color = if (selectedTab == index) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant) }
                )
            }
        }

        if (selectedTab == 0) {
            OutlinedTextField(
                value = appSearchQuery,
                onValueChange = { appSearchQuery = it },
                placeholder = { Text("పేరు, ఫోన్, జిల్లా, మండలం వెతుకు...", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    if (appSearchQuery.isNotEmpty()) {
                        IconButton(onClick = { appSearchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(18.dp))
                        }
                    }
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = MaterialTheme.colorScheme.onSurface,
                    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
                    cursorColor = MaterialTheme.colorScheme.primary
                ),
                shape = RoundedCornerShape(24.dp)
            )

            val displayList = remember(applications, hideDuplicates) {
                if (hideDuplicates) deduplicateApplicationsList(applications) else applications
            }
            val pendingCount = remember(displayList) {
                displayList.count { (it["status"]?.toString()?.uppercase() ?: "") !in listOf("JOINED", "APPROVED", "REJECTED") }
            }
            val joinedCount = remember(displayList) {
                displayList.count { (it["status"]?.toString()?.uppercase() ?: "") in listOf("JOINED", "APPROVED") }
            }
            val rejectedCount = remember(displayList) {
                displayList.count { (it["status"]?.toString()?.uppercase() ?: "") == "REJECTED" }
            }
            val allCount = displayList.size

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = appFilterState == "PENDING",
                        onClick = { appFilterState = "PENDING" },
                        label = { Text("పెండింగ్ ($pendingCount)", fontSize = 12.sp) }
                    )
                    FilterChip(
                        selected = appFilterState == "ALL",
                        onClick = { appFilterState = "ALL" },
                        label = { Text("అన్ని ($allCount)", fontSize = 12.sp) }
                    )
                    FilterChip(
                        selected = appFilterState == "JOINED",
                        onClick = { appFilterState = "JOINED" },
                        label = { Text("అప్రూవ్డ్ ($joinedCount)", fontSize = 12.sp) }
                    )
                    FilterChip(
                        selected = appFilterState == "REJECTED",
                        onClick = { appFilterState = "REJECTED" },
                        label = { Text("రిజెక్టెడ్ ($rejectedCount)", fontSize = 12.sp) }
                    )
                }
                
                IconButton(onClick = { fetchData() }, modifier = Modifier.size(36.dp)) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Deduplication controls for Admins and Editors
            if (currentUser.role == UserRole.ADMIN || currentUser.role == UserRole.EDITOR) {
                var isCleaningDuplicates by remember { mutableStateOf(false) }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(
                        selected = hideDuplicates,
                        onClick = { hideDuplicates = !hideDuplicates },
                        label = { Text(if (hideDuplicates) "డూప్లికేట్స్ దాచు" else "అన్ని డూప్లికేట్స్ చూపు", fontSize = 11.sp) },
                        leadingIcon = {
                            Icon(
                                imageVector = if (hideDuplicates) Icons.Default.FilterList else Icons.Default.Visibility,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    )

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                isCleaningDuplicates = true
                                try {
                                    val deletedCount = cleanDuplicateApplicationsFromDb()
                                    Toast.makeText(context, "$deletedCount డూప్లికేట్ దరఖాస్తులు తొలగించబడ్డాయి!", Toast.LENGTH_LONG).show()
                                    fetchData()
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                                } finally {
                                    isCleaningDuplicates = false
                                }
                            }
                        },
                        enabled = !isCleaningDuplicates,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        if (isCleaningDuplicates) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.DeleteSweep, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                        Spacer(Modifier.width(4.dp))
                        Text("డూప్లికేట్లు క్లీన్ చేయి", fontSize = 11.sp)
                    }
                }
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
                    placeholder = { Text("పేరు, ఫోన్, జిల్లా, మండలం వెతుకు...", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp)) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { reportersViewModel.setSearchQuery("") }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(18.dp))
                            }
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
                        cursorColor = MaterialTheme.colorScheme.primary
                    ),
                    shape = RoundedCornerShape(24.dp)
                )

                var sortExpanded by remember { mutableStateOf(false) }
                Box {
                    IconButton(
                        onClick = { sortExpanded = true },
                        modifier = Modifier
                            .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape)
                            .size(40.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Sort, contentDescription = "Sort", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    DropdownMenu(
                        expanded = sortExpanded,
                        onDismissRequest = { sortExpanded = false },
                        modifier = Modifier.background(MaterialTheme.colorScheme.surface)
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
                                text = { Text(label, color = if (sortOrder == key) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant) },
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
                    if (filteredApplications.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier.fillParentMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.padding(16.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Inbox,
                                        contentDescription = null,
                                        modifier = Modifier.size(48.dp),
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                                    )
                                    Text(
                                        text = when (appFilterState) {
                                            "PENDING" -> "ఎటువంటి పెండింగ్ దరఖాస్తులు లేవు."
                                            "JOINED" -> "అప్రూవ్ అయిన దరఖాస్తులు లేవు."
                                            "REJECTED" -> "తిరస్కరించిన దరఖాస్తులు లేవు."
                                            else -> "ఎటువంటి దరఖాస్తులు లభించలేదు."
                                        },
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onBackground
                                    )
                                    if (applications.isNotEmpty()) {
                                        Text(
                                            text = "మొత్తం ${applications.size} దరఖాస్తులు లభించాయి ('అన్ని' ట్యాబ్ నొక్కండి).",
                                            fontSize = 13.sp,
                                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                                        )
                                    }
                                }
                            }
                        }
                    } else {
                        items(filteredApplications, key = { it["id"].toString() }) { app ->
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
                                onRefresh = { fetchData() },
                                onCardClick = { reporterId ->
                                    if (onOpenProfile != null) {
                                        onOpenProfile(reporterId)
                                    } else {
                                        selectedReporterIdForProfile = reporterId
                                    }
                                }
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
    
    val appDistrict = (app["district"] as? String)?.takeIf { it.isNotBlank() }
        ?: (app["selectedDistrict"] as? String)?.takeIf { it.isNotBlank() }
        ?: (app["state_district"] as? String)?.takeIf { it.isNotBlank() }
        ?: (app["dist"] as? String)?.takeIf { it.isNotBlank() }
        ?: "N/A"

    val appMandal = (app["mandal"] as? String)?.takeIf { it.isNotBlank() }
        ?: (app["selectedMandal"] as? String)?.takeIf { it.isNotBlank() }
        ?: (app["assignedMandal"] as? String)?.takeIf { it.isNotBlank() }
        ?: (app["mandalam"] as? String)?.takeIf { it.isNotBlank() }
        ?: "N/A"

    val appTimestamp = app["timestamp"]
    val formattedDate = remember(appTimestamp) {
        val timeMs = when (appTimestamp) {
            is com.google.firebase.Timestamp -> appTimestamp.toDate().time
            is Number -> appTimestamp.toLong()
            is java.util.Date -> appTimestamp.time
            else -> 0L
        }
        if (timeMs > 0L) {
            val sdf = com.alfanews.telugu.utils.DateTimeUtils.getSimpleDateFormat("dd MMM yyyy, hh:mm a", java.util.Locale.getDefault())
            sdf.format(java.util.Date(timeMs))
        } else null
    }

    var editDistrict by remember { mutableStateOf(if (appDistrict != "N/A") appDistrict else "") }
    var editMandal by remember { mutableStateOf(if (appMandal != "N/A") appMandal else "") }
    var showLocationEdit by remember { mutableStateOf(false) }

    val rawStatus = (app["status"] as? String)?.uppercase() ?: "PENDING"
    val isPending = rawStatus != "JOINED" && rawStatus != "APPROVED" && rawStatus != "REJECTED"

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                val applicantName = (app["fullName"] as? String)?.takeIf { it.isNotBlank() }
                    ?: (app["name"] as? String)?.takeIf { it.isNotBlank() }
                    ?: "No Name"
                Text(applicantName, fontWeight = FontWeight.Bold, fontSize = 18.sp, fontFamily = Ramabhadra)
                StatusBadge(rawStatus)
            }

            if (!formattedDate.isNullOrEmpty()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Schedule, contentDescription = null, modifier = Modifier.size(13.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(4.dp))
                    Text("అప్లై చేసిన తేది: $formattedDate", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            val phoneNum = (app["phone"] as? String)?.takeIf { it.isNotBlank() }
                ?: (app["phoneNumber"] as? String)?.takeIf { it.isNotBlank() }
                ?: "N/A"
            Text("Phone: $phoneNum", fontSize = 14.sp)
            
            if ((app["education"] as? String)?.isNotBlank() == true) {
                Text("Education: ${app["education"]}", fontSize = 14.sp)
            }
            if ((app["position"] as? String)?.isNotBlank() == true) {
                Text("Position: ${app["position"]}", fontSize = 14.sp)
            }
            if ((app["interestedArea"] as? String)?.isNotBlank() == true) {
                Text("Category: ${app["interestedArea"]}", fontSize = 14.sp)
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Place, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(4.dp))
                Text("కోరిన ప్రాంతం (Requested): $appDistrict - $appMandal", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium)
            }
            
            if ((app["message"] as? String)?.isNotEmpty() == true) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Text("Message: ${app["message"]}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                                val appUserId = app["userId"]?.toString()?.trim()
                                val digitsOnly = phoneNum.filter { it.isDigit() }
                                val clean10Digits = if (digitsOnly.length >= 10) digitsOnly.takeLast(10) else digitsOnly

                                var userDoc: com.google.firebase.firestore.DocumentSnapshot? = null
                                if (!appUserId.isNullOrEmpty()) {
                                    val doc = FirebaseService.db.collection("users").document(appUserId).get().await()
                                    if (doc.exists()) userDoc = doc
                                }

                                if (userDoc == null && clean10Digits.length == 10) {
                                    val phoneFormats = listOf(
                                        "+91$clean10Digits",
                                        clean10Digits,
                                        "0$clean10Digits",
                                        "91$clean10Digits"
                                    )
                                    for (fmt in phoneFormats) {
                                        val q = FirebaseService.db.collection("users")
                                            .whereEqualTo("phone", fmt)
                                            .limit(1)
                                            .get().await()
                                        if (!q.isEmpty) {
                                            userDoc = q.documents.first()
                                            break
                                        }
                                    }
                                }

                                if (userDoc == null) {
                                    Toast.makeText(context, "యూజర్ అకౌంట్ లభించలేదు ($phoneNum).", Toast.LENGTH_LONG).show()
                                } else {
                                    processJoin(userDoc.id, app["id"] as String, editDistrict, editMandal, currentUser.id, phoneNum)
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
                    enabled = !isProcessing && isPending
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
                    enabled = !isProcessing && isPending
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
                        Icon(Icons.Default.Delete, contentDescription = "Remove", tint = MaterialTheme.colorScheme.onSurfaceVariant)
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
    onRefresh: () -> Unit,
    onCardClick: (String) -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var isEditingLocation by remember { mutableStateOf(false) }
    var editDistrict by remember { mutableStateOf(reporter.district ?: "") }
    var editMandal by remember { mutableStateOf(reporter.assignedMandal ?: "") }
    var isSaving by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCardClick(reporter.id) },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = reporter.photoUrl ?: "https://ui-avatars.com/api/?name=${reporter.name}&background=random",
                    contentDescription = null,
                    modifier = Modifier.size(56.dp).clip(CircleShape).border(1.5.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape),
                    contentScale = ContentScale.Crop
                )
                
                Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(reporter.name, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface)
                    
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
                        Text("${reporter.district} - ${reporter.assignedMandal}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        IconButton(onClick = { isEditingLocation = !isEditingLocation }, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.EditLocation, contentDescription = "Edit Location", modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                IconButton(onClick = {
                    scope.launch {
                        try {
                            val isSuspending = reporter.role == UserRole.REPORTER
                            val newRole = if (isSuspending) UserRole.SUBSCRIBER else UserRole.REPORTER
                            val updates = mutableMapOf<String, Any>("role" to newRole.toString())
                            if (newRole == UserRole.REPORTER) {
                                updates["warningLevel"] = 0
                                updates["inProbation"] = false
                                updates["promotedAt"] = com.google.firebase.Timestamp.now()
                                updates["lastPostTimestamp"] = com.google.firebase.Timestamp.now()
                            } else {
                                // Suspend చేసినప్పుడు assignedMandal clear చేయాలి
                                // — mandal free అవుతుంది, వేరే reporter apply చేయగలరు
                                updates["assignedMandal"] = ""
                            }
                            FirebaseService.db.collection("users").document(reporter.id).update(updates).await()

                            // reporter_applications లో కూడా status update చేయాలి
                            // Suspend → SUSPENDED (mandal free అవుతుంది)
                            // Restore → JOINED (mandal block అవుతుంది)
                            val district = reporter.district?.trim() ?: ""
                            val mandal = reporter.assignedMandal?.trim() ?: ""
                            if (district.isNotEmpty() && mandal.isNotEmpty()) {
                                val appSnap = FirebaseService.db.collection("reporter_applications")
                                    .whereEqualTo("userId", reporter.id)
                                    .whereIn("status", listOf("JOINED", "SUSPENDED"))
                                    .get()
                                    .await()
                                val newAppStatus = if (isSuspending) "SUSPENDED" else "JOINED"
                                for (doc in appSnap.documents) {
                                    doc.reference.update("status", newAppStatus).await()
                                }
                            }

                            Toast.makeText(context, if (isSuspending) "Suspended" else "Restored", Toast.LENGTH_SHORT).show()
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
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ఈ రోజు", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${stats?.todayPosts ?: 0}", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("గత వారం", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${stats?.weekPosts ?: 0}", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("పాయింట్లు", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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

private suspend fun processJoin(
    userId: String,
    appId: String,
    district: String,
    mandal: String,
    promoterId: String,
    phoneNum: String = ""
) {
    val userDoc = FirebaseService.db.collection("users").document(userId).get().await()
    val existingPoints = userDoc.getLong("points")
    val existingBadges = userDoc.get("badges")

    val updates = mutableMapOf<String, Any>(
        "role" to "REPORTER",
        "district" to district,
        "assignedMandal" to mandal,
        "promotedBy" to promoterId
    )
    if (existingPoints == null) {
        updates["points"] = 0
    }
    if (existingBadges == null) {
        updates["badges"] = emptyList<String>()
    }

    FirebaseService.db.collection("users").document(userId).update(updates).await()
    FirebaseService.db.collection("reporter_applications").document(appId).update("status", "JOINED").await()

    // Also mark any other pending duplicate applications for this user or phone as JOINED
    try {
        val digitsOnly = phoneNum.filter { it.isDigit() }
        val clean10 = if (digitsOnly.length >= 10) digitsOnly.takeLast(10) else ""

        val allPendingSnap = FirebaseService.db.collection("reporter_applications")
            .whereEqualTo("status", "PENDING")
            .get().await()

        for (doc in allPendingSnap.documents) {
            if (doc.id == appId) continue
            val docPhone = (doc.getString("phone") ?: doc.getString("phoneNumber") ?: "").filter { it.isDigit() }
            val docClean10 = if (docPhone.length >= 10) docPhone.takeLast(10) else ""
            val docUserId = doc.getString("userId") ?: ""

            if ((clean10.isNotEmpty() && docClean10 == clean10) || (userId.isNotEmpty() && docUserId == userId)) {
                FirebaseService.db.collection("reporter_applications").document(doc.id).update("status", "JOINED").await()
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

private suspend fun processReject(appId: String) {
    FirebaseService.db.collection("reporter_applications").document(appId).update("status", "REJECTED").await()
}

fun deduplicateApplicationsList(rawList: List<Map<String, Any>>): List<Map<String, Any>> {
    val seenKeys = mutableSetOf<String>()
    val result = mutableListOf<Map<String, Any>>()

    for (app in rawList) {
        val phone = (app["phone"] as? String) ?: (app["phoneNumber"] as? String) ?: ""
        val digits = phone.filter { it.isDigit() }
        val clean10 = if (digits.length >= 10) digits.takeLast(10) else ""

        val email = (app["email"] as? String)?.trim()?.lowercase() ?: ""
        val userId = (app["userId"] as? String)?.trim() ?: ""

        val key = when {
            clean10.isNotEmpty() -> "phone:$clean10"
            email.isNotEmpty() -> "email:$email"
            userId.isNotEmpty() -> "user:$userId"
            else -> "doc:${app["id"]}"
        }

        if (seenKeys.add(key)) {
            result.add(app)
        }
    }
    return result
}

private suspend fun cleanDuplicateApplicationsFromDb(): Int {
    val snapshot = FirebaseService.db.collection("reporter_applications").get().await()
    val allDocs = snapshot.documents

    val groups = mutableMapOf<String, MutableList<com.google.firebase.firestore.DocumentSnapshot>>()
    for (doc in allDocs) {
        val data = doc.data ?: continue
        val phone = (data["phone"] as? String) ?: (data["phoneNumber"] as? String) ?: ""
        val digits = phone.filter { it.isDigit() }
        val clean10 = if (digits.length >= 10) digits.takeLast(10) else ""
        val email = (data["email"] as? String)?.trim()?.lowercase() ?: ""
        val userId = (data["userId"] as? String)?.trim() ?: ""

        val key = when {
            clean10.isNotEmpty() -> "phone:$clean10"
            email.isNotEmpty() -> "email:$email"
            userId.isNotEmpty() -> "user:$userId"
            else -> null
        }

        if (key != null) {
            groups.getOrPut(key) { mutableListOf() }.add(doc)
        }
    }

    var deletedCount = 0
    val docsToDelete = mutableListOf<com.google.firebase.firestore.DocumentReference>()

    for ((_, docs) in groups) {
        if (docs.size > 1) {
            val sortedDocs = docs.sortedByDescending { doc ->
                val ts = doc.get("timestamp")
                when (ts) {
                    is com.google.firebase.Timestamp -> ts.toDate().time
                    is Number -> ts.toLong()
                    else -> 0L
                }
            }
            // Keep index 0 (newest), mark indices 1..N for deletion
            for (i in 1 until sortedDocs.size) {
                docsToDelete.add(sortedDocs[i].reference)
            }
        }
    }

    for (chunk in docsToDelete.chunked(400)) {
        val batch = FirebaseService.db.batch()
        for (ref in chunk) {
            batch.delete(ref)
        }
        batch.commit().await()
        deletedCount += chunk.size
    }

    return deletedCount
}
