package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.utils.Constants
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinReporterPageView(
    onClose: () -> Unit,
    onNavigateToLogin: () -> Unit
) {
    val currentUser = FirebaseService.auth.currentUser
    val isUserLoggedIn = currentUser != null

    var hasAgreedToRules by remember { mutableStateOf(false) }
    var rulesCheckboxChecked by remember { mutableStateOf(false) }

    var fullName by remember { mutableStateOf("") }
    var fatherName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var position by remember { mutableStateOf("") }
    var interestedArea by remember { mutableStateOf("") }
    var education by remember { mutableStateOf("") }
    var currentOrg by remember { mutableStateOf("") }
    
    var selectedState by remember { mutableStateOf("TS") }
    var selectedDistrict by remember { mutableStateOf("") }
    var selectedMandal by remember { mutableStateOf("") }
    var additionalMessage by remember { mutableStateOf("") }
    
    var occupiedMandals by remember { mutableStateOf<Set<String>>(emptySet()) }
    var isLoadingOccupied by remember { mutableStateOf(true) }
    
    val scrollState = rememberScrollState()
    
    // Dropdown expanded states
    var districtExpanded by remember { mutableStateOf(false) }
    var mandalExpanded by remember { mutableStateOf(false) }

    var isSubmitting by remember { mutableStateOf(false) }
    var hasPendingApplication by remember { mutableStateOf(false) }
    var showSuccessDialog by remember { mutableStateOf<String?>(null) }
    
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val defaultPosition = stringResource(R.string.mandal_reporter)
    
    val districtsList = remember(selectedState) {
        if (selectedState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
    }

    val mandalsList = remember(selectedDistrict) {
        Constants.MANDAL_DATA[selectedDistrict] ?: emptyList<String>()
    }

    val availableMandalsList = remember(selectedDistrict, mandalsList, occupiedMandals) {
        val trimmedDistrict = selectedDistrict.trim()
        mandalsList.filter { mandal -> 
            !occupiedMandals.contains("$trimmedDistrict|${mandal.trim()}") 
        }
    }

    // Validation focus markers (Positions relative to scrollable content)
    var fullNameY by remember { mutableFloatStateOf(0f) }
    var fatherNameY by remember { mutableFloatStateOf(0f) }
    var phoneY by remember { mutableFloatStateOf(0f) }
    var addressY by remember { mutableFloatStateOf(0f) }
    var districtY by remember { mutableFloatStateOf(0f) }
    var positionY by remember { mutableFloatStateOf(0f) }
    var areaY by remember { mutableFloatStateOf(0f) }
    var educationY by remember { mutableFloatStateOf(0f) }
    var orgY by remember { mutableFloatStateOf(0f) }
    var messageY by remember { mutableFloatStateOf(0f) }

    // Coordinates of the scrollable content for relative calculation
    var contentCoordinates by remember { mutableStateOf<androidx.compose.ui.layout.LayoutCoordinates?>(null) }

    LaunchedEffect(Unit) {
        try {
            // Check if current logged in user already has a PENDING application or pre-fill info
            val currentUid = currentUser?.uid
            if (!currentUid.isNullOrEmpty()) {
                val pendingSnap = FirebaseService.db.collection("reporter_applications")
                    .whereEqualTo("userId", currentUid)
                    .whereEqualTo("status", "PENDING")
                    .get()
                    .await()
                hasPendingApplication = !pendingSnap.isEmpty

                // Pre-fill user profile info if available
                val userDoc = FirebaseService.db.collection("users").document(currentUid).get().await()
                if (userDoc.exists()) {
                    if (fullName.isEmpty()) fullName = userDoc.getString("name") ?: ""
                    if (phone.isEmpty()) {
                        val p = userDoc.getString("phone") ?: currentUser.phoneNumber ?: ""
                        phone = p.replace("+91", "").trim()
                    }
                    if (address.isEmpty()) address = userDoc.getString("address") ?: ""
                    if (selectedDistrict.isEmpty()) {
                        val dist = userDoc.getString("district") ?: ""
                        if (dist.isNotEmpty()) selectedDistrict = dist
                    }
                }
            }

            // 1. Fetch from users collection (Active Reporters) - Single Source of Truth
            val usersSnapshot = FirebaseService.db.collection("users")
                .whereIn("role", listOf("REPORTER", 2, 2.0, "2"))
                .get()
                .await()
            
            val userMandals = usersSnapshot.documents.mapNotNull { doc ->
                val dist = (doc.get("district") as? String)?.trim() ?: ""
                val mandal = (doc.get("assignedMandal") as? String)?.trim() ?: 
                             (doc.get("mandal") as? String)?.trim() ?: ""
                if (dist.isNotEmpty() && mandal.isNotEmpty()) "$dist|$mandal" else null
            }

            occupiedMandals = userMandals.toSet()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoadingOccupied = false
        }
    }

    LaunchedEffect(selectedState) {
        districtExpanded = false
        mandalExpanded = false
    }

    LaunchedEffect(selectedDistrict) {
        mandalExpanded = false
    }

    Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = when {
                                !isUserLoggedIn -> stringResource(R.string.reporter_login_required_title)
                                !hasAgreedToRules -> stringResource(R.string.reporter_rules_title)
                                else -> stringResource(R.string.join_reporter)
                            },
                            fontFamily = Ramabhadra,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onClose) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface
                    )
                )
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp)
                        .onGloballyPositioned { contentCoordinates = it }
                        .verticalScroll(scrollState),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Spacer(modifier = Modifier.height(4.dp))

                    // 1. GATE 1: User Not Logged In
                    if (!isUserLoggedIn) {
                        ElevatedCard(
                            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.elevatedCardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            ),
                            elevation = CardDefaults.elevatedCardElevation(defaultElevation = 3.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(72.dp)
                                        .background(
                                            color = MaterialTheme.colorScheme.primaryContainer,
                                            shape = CircleShape
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AccountCircle,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(44.dp)
                                    )
                                }

                                Text(
                                    text = stringResource(R.string.reporter_login_required_title),
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = Ramabhadra,
                                    color = MaterialTheme.colorScheme.primary,
                                    textAlign = TextAlign.Center
                                )

                                Text(
                                    text = stringResource(R.string.reporter_login_required_desc),
                                    fontSize = 15.sp,
                                    fontFamily = Mallanna,
                                    lineHeight = 22.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = TextAlign.Center
                                )

                                Spacer(modifier = Modifier.height(8.dp))

                                Button(
                                    onClick = onNavigateToLogin,
                                    modifier = Modifier.fillMaxWidth().height(50.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.primary
                                    )
                                ) {
                                    Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = stringResource(R.string.reporter_login_button),
                                        fontSize = 16.sp,
                                        fontFamily = Ramabhadra
                                    )
                                }

                                OutlinedButton(
                                    onClick = onClose,
                                    modifier = Modifier.fillMaxWidth().height(48.dp),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text(
                                        text = "రద్దు చేయి (Close)",
                                        fontFamily = Mallanna,
                                        fontSize = 15.sp
                                    )
                                }
                            }
                        }
                    } 
                    // 2. GATE 2: Rules Agreement Screen
                    else if (!hasAgreedToRules) {
                        ElevatedCard(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(20.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Gavel,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(28.dp)
                                    )
                                    Text(
                                        text = stringResource(R.string.reporter_rules_title),
                                        fontSize = 19.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = Ramabhadra,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }

                                Text(
                                    text = stringResource(R.string.reporter_rules_subtitle),
                                    fontSize = 14.sp,
                                    fontFamily = Mallanna,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                                // Rule 1
                                RuleItem(
                                    number = "1",
                                    title = stringResource(R.string.reporter_rule_1_title),
                                    description = stringResource(R.string.reporter_rule_1_desc)
                                )

                                // Rule 2
                                RuleItem(
                                    number = "2",
                                    title = stringResource(R.string.reporter_rule_2_title),
                                    description = stringResource(R.string.reporter_rule_2_desc)
                                )

                                // Rule 3
                                RuleItem(
                                    number = "3",
                                    title = stringResource(R.string.reporter_rule_3_title),
                                    description = stringResource(R.string.reporter_rule_3_desc)
                                )

                                // Rule 4
                                RuleItem(
                                    number = "4",
                                    title = stringResource(R.string.reporter_rule_4_title),
                                    description = stringResource(R.string.reporter_rule_4_desc)
                                )

                                Spacer(modifier = Modifier.height(4.dp))

                                // Agreement Checkbox
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { rulesCheckboxChecked = !rulesCheckboxChecked }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Checkbox(
                                            checked = rulesCheckboxChecked,
                                            onCheckedChange = { rulesCheckboxChecked = it }
                                        )
                                        Text(
                                            text = stringResource(R.string.reporter_rules_agree_checkbox),
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Medium,
                                            fontFamily = Mallanna,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                    }
                                }

                                Button(
                                    onClick = { hasAgreedToRules = true },
                                    enabled = rulesCheckboxChecked,
                                    modifier = Modifier.fillMaxWidth().height(52.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.primary
                                    )
                                ) {
                                    Text(
                                        text = stringResource(R.string.reporter_agree_and_continue),
                                        fontSize = 16.sp,
                                        fontFamily = Ramabhadra
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    } 
                    // 3. STEP 3: Actual Application Form
                    else {
                        if (hasPendingApplication) {
                            ElevatedCard(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(Icons.Default.Info, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                        Text(
                                            text = "పరిశీలనలో ఉంది (PENDING)",
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = Ramabhadra,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                    Text(
                                        text = "మీరు ఇప్పటికే ఒక దరఖాస్తును సమర్పించారు. అది ప్రస్తుతం పరిశీలనలో ఉంది. మా ప్రతినిధులు త్వరలోనే మీ దరఖాస్తును పరిశీలిస్తారు.",
                                        fontSize = 14.sp,
                                        fontFamily = Mallanna,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer
                                    )
                                }
                            }
                        }

                        ElevatedCard(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Text(
                                    text = stringResource(R.string.reporter_app_form),
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = Ramabhadra,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                
                                OutlinedTextField(
                                    value = fullName,
                                    onValueChange = { fullName = it },
                                    label = { Text(stringResource(R.string.full_name), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> fullNameY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    singleLine = true,
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                                
                                OutlinedTextField(
                                    value = fatherName,
                                    onValueChange = { fatherName = it },
                                    label = { Text(stringResource(R.string.father_name), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> fatherNameY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    singleLine = true,
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                                
                                OutlinedTextField(
                                    value = phone,
                                    onValueChange = { phone = it },
                                    label = { Text(stringResource(R.string.phone_number_label), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> phoneY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Phone
                                    ),
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )

                                OutlinedTextField(
                                    value = address,
                                    onValueChange = { address = it },
                                    label = { Text("చిరునామా (Address)", fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> addressY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    singleLine = true,
                                    shape = MaterialTheme.shapes.medium,
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
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Text(stringResource(R.string.region_details), fontWeight = FontWeight.Bold, fontFamily = Ramabhadra)
                                
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FilterChip(
                                        selected = selectedState == "TS",
                                        onClick = { selectedState = "TS"; selectedDistrict = ""; selectedMandal = "" },
                                        label = { Text(stringResource(R.string.telangana)) },
                                        modifier = Modifier.weight(1f),
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = MaterialTheme.colorScheme.primary,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                    FilterChip(
                                        selected = selectedState == "AP",
                                        onClick = { selectedState = "AP"; selectedDistrict = ""; selectedMandal = "" },
                                        label = { Text(stringResource(R.string.andhra_pradesh)) },
                                        modifier = Modifier.weight(1f),
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = MaterialTheme.colorScheme.primary,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                }
                                
                                ExposedDropdownMenuBox(
                                    expanded = districtExpanded,
                                    onExpandedChange = { districtExpanded = !districtExpanded },
                                    modifier = Modifier.onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> districtY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    }
                                ) {
                                    OutlinedTextField(
                                        value = selectedDistrict,
                                        onValueChange = {},
                                        readOnly = true,
                                        label = { Text(stringResource(R.string.select_district)) },
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) },
                                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                                        shape = MaterialTheme.shapes.medium,
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                                            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = districtExpanded,
                                        onDismissRequest = { districtExpanded = false }
                                    ) {
                                        districtsList.forEach { districtName: String ->
                                            DropdownMenuItem(
                                                text = { Text(districtName) },
                                                onClick = {
                                                    selectedDistrict = districtName
                                                    selectedMandal = ""
                                                    districtExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                                
                                if (selectedDistrict.isNotEmpty()) {
                                    ExposedDropdownMenuBox(
                                        expanded = mandalExpanded,
                                        onExpandedChange = { mandalExpanded = !mandalExpanded }
                                    ) {
                                        OutlinedTextField(
                                            value = selectedMandal,
                                            onValueChange = {},
                                            readOnly = true,
                                            label = { Text(stringResource(R.string.select_mandal)) },
                                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mandalExpanded) },
                                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                                            shape = MaterialTheme.shapes.medium,
                                            colors = OutlinedTextFieldDefaults.colors(
                                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                            )
                                        )
                                        ExposedDropdownMenu(
                                            expanded = mandalExpanded,
                                            onDismissRequest = { mandalExpanded = false }
                                        ) {
                                            if (isLoadingOccupied) {
                                                DropdownMenuItem(text = { Text(stringResource(R.string.loading)) }, onClick = {})
                                            } else if (mandalsList.isEmpty()) {
                                                DropdownMenuItem(text = { Text(stringResource(R.string.no_mandals_available)) }, onClick = {})
                                            } else {
                                                mandalsList.forEach { mandalName: String ->
                                                    val isOccupied = occupiedMandals.contains("${selectedDistrict.trim()}|${mandalName.trim()}")
                                                    DropdownMenuItem(
                                                        text = {
                                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                                if (isOccupied) {
                                                                    Text("🟠 $mandalName (ఇప్పటికే ఉన్నారు - పోటీ/పరిశీలన)", color = Color(0xFFE65100), fontSize = 13.sp)
                                                                } else {
                                                                    Text("🟢 $mandalName", color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp)
                                                                }
                                                            }
                                                        },
                                                        onClick = {
                                                            selectedMandal = mandalName
                                                            mandalExpanded = false
                                                        }
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    if (selectedMandal.isNotEmpty()) {
                                        val isOccupiedSelected = occupiedMandals.contains("${selectedDistrict.trim()}|${selectedMandal.trim()}")
                                        if (isOccupiedSelected) {
                                            Surface(
                                                color = Color(0xFFFFF3E0),
                                                shape = RoundedCornerShape(8.dp),
                                                border = BorderStroke(1.dp, Color(0xFFFF9800)),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                                    Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFFE65100), modifier = Modifier.size(18.dp))
                                                    Spacer(Modifier.width(8.dp))
                                                    Text(
                                                        text = "ఈ మండలానికి ఇప్పటికే విలేకరి ఉన్నారు. మీరు దరఖాస్తు చేసుకుంటే అడ్మిన్ ప్రత్యేక పరిశీలనకు (పోటీ / ప్రొబేషన్) పంపబడుతుంది.",
                                                        fontSize = 12.sp,
                                                        color = Color(0xFFE65100),
                                                        fontFamily = Mallanna,
                                                        lineHeight = 16.sp
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        ElevatedCard(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                OutlinedTextField(
                                    value = defaultPosition,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text(stringResource(R.string.position), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> positionY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                                
                                OutlinedTextField(
                                    value = interestedArea,
                                    onValueChange = { interestedArea = it },
                                    label = { Text(stringResource(R.string.interested_category), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> areaY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    singleLine = true,
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                                
                                OutlinedTextField(
                                    value = education,
                                    onValueChange = { education = it },
                                    label = { Text(stringResource(R.string.education_qualification), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> educationY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    singleLine = true,
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                                
                                OutlinedTextField(
                                    value = currentOrg,
                                    onValueChange = { currentOrg = it },
                                    label = { Text(stringResource(R.string.current_organization), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> orgY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    singleLine = true,
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                                
                                OutlinedTextField(
                                    value = additionalMessage,
                                    onValueChange = { additionalMessage = it },
                                    label = { Text(stringResource(R.string.additional_message), fontFamily = Mallanna) },
                                    modifier = Modifier.fillMaxWidth().onGloballyPositioned { 
                                        contentCoordinates?.let { parent -> messageY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                    },
                                    minLines = 3,
                                    placeholder = { Text(stringResource(R.string.message_placeholder)) },
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        Button(
                            onClick = {
                                val targetPosition = if (position.isNotBlank()) position else defaultPosition
                                val emptyField = when {
                                    fullName.isBlank() -> "పూర్తి పేరు" to fullNameY
                                    fatherName.isBlank() -> "తండ్రి పేరు" to fatherNameY
                                    phone.isBlank() -> "ఫోన్ నంబర్" to phoneY
                                    address.isBlank() -> "చిరునామా" to addressY
                                    selectedDistrict.isBlank() -> "జిల్లా" to districtY
                                    selectedMandal.isBlank() -> "మండలం" to districtY
                                    interestedArea.isBlank() -> "ఆసక్తి ఉన్న కేటగిరీ" to areaY
                                    education.isBlank() -> "విద్యార్హత" to educationY
                                    currentOrg.isBlank() -> "ప్రస్తుత సంస్థ" to orgY
                                    additionalMessage.isBlank() -> "సందేశం" to messageY
                                    else -> null
                                }

                                if (emptyField != null) {
                                    Toast.makeText(context, "${emptyField.first} నింపండి", Toast.LENGTH_SHORT).show()
                                    scope.launch {
                                        scrollState.animateScrollTo(maxOf(0, emptyField.second.toInt() - 50))
                                    }
                                    return@Button
                                }
                                
                                scope.launch {
                                    isSubmitting = true
                                    var submittedSuccessfully = false
                                    var wasAutoApproved = false
                                    var isReapplication = false

                                    // 1. Try Cloud Function first (handles notifications & auto-approval)
                                    try {
                                        val result = FirebaseFunctionsService.submitReporterApplication(
                                            fullName = fullName,
                                            fatherName = fatherName,
                                            phone = phone,
                                            address = address,
                                            position = targetPosition,
                                            interestedArea = interestedArea,
                                            education = education,
                                            currentOrg = currentOrg,
                                            state = selectedState,
                                            district = selectedDistrict,
                                            mandal = selectedMandal,
                                            message = additionalMessage,
                                            userId = FirebaseService.auth.currentUser?.uid
                                        )
                                        if (result.isSuccess) {
                                            submittedSuccessfully = true
                                            wasAutoApproved = result.getOrNull()?.get("autoApproved") == true
                                            isReapplication = result.getOrNull()?.get("isPreviouslyDowngraded") == true
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }

                                    // 2. Fallback: Save directly to Firestore if Cloud Function didn't confirm success
                                    if (!submittedSuccessfully) {
                                        try {
                                            val currentUid = FirebaseService.auth.currentUser?.uid ?: ""
                                            var isPrevDown = false
                                            if (currentUid.isNotEmpty()) {
                                                val uDoc = FirebaseService.db.collection("users").document(currentUid).get().await()
                                                isPrevDown = uDoc.getBoolean("previouslyDowngraded") == true || uDoc.getBoolean("suspended") == true
                                            }
                                            isReapplication = isPrevDown
                                            val isVacant = !occupiedMandals.contains("${selectedDistrict.trim()}|${selectedMandal.trim()}")
                                            val finalStatus = if (currentUid.isNotEmpty() && !isPrevDown && isVacant) "JOINED" else "PENDING"
                                            val autoApp = (finalStatus == "JOINED")

                                            val appData = mapOf(
                                                "fullName" to fullName,
                                                "fatherName" to fatherName,
                                                "phone" to phone,
                                                "address" to address,
                                                "position" to targetPosition,
                                                "interestedArea" to interestedArea,
                                                "education" to education,
                                                "currentOrg" to currentOrg,
                                                "state" to selectedState,
                                                "district" to selectedDistrict,
                                                "mandal" to selectedMandal,
                                                "message" to additionalMessage,
                                                "status" to finalStatus,
                                                "autoApproved" to autoApp,
                                                "isReapplication" to isPrevDown,
                                                "previouslyDowngraded" to isPrevDown,
                                                "agreedToRules" to true,
                                                "userId" to currentUid,
                                                "timestamp" to com.google.firebase.Timestamp.now()
                                            )
                                            FirebaseService.db.collection("reporter_applications").add(appData).await()

                                            if (autoApp && currentUid.isNotEmpty()) {
                                                val userRef = FirebaseService.db.collection("users").document(currentUid)
                                                val updates = mapOf(
                                                    "role" to "REPORTER",
                                                    "district" to selectedDistrict.trim(),
                                                    "assignedMandal" to selectedMandal.trim(),
                                                    "mandal" to selectedMandal.trim(),
                                                    "promotedBy" to "AUTO_APPROVAL_SYSTEM",
                                                    "agreedToRules" to true,
                                                    "joinedAt" to com.google.firebase.Timestamp.now(),
                                                    "name" to fullName,
                                                    "phone" to phone
                                                )
                                                userRef.set(updates, com.google.firebase.firestore.SetOptions.merge()).await()
                                            }

                                            submittedSuccessfully = true
                                            wasAutoApproved = autoApp
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }
                                    
                                    isSubmitting = false
                                    if (submittedSuccessfully) {
                                        if (wasAutoApproved) {
                                            showSuccessDialog = context.getString(R.string.app_auto_approved_success, selectedMandal)
                                        } else if (isReapplication) {
                                            showSuccessDialog = context.getString(R.string.app_reapplication_review_pending)
                                        } else {
                                            showSuccessDialog = context.getString(R.string.app_success_logged_in)
                                        }
                                    } else {
                                        Toast.makeText(context, context.getString(R.string.submission_failed, "సమర్పించడం విఫలమైంది."), Toast.LENGTH_LONG).show()
                                    }
                                }
                            },
                            enabled = !isSubmitting,
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = MaterialTheme.shapes.large,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.9f)
                            ),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                            } else {
                                Text(stringResource(R.string.submit), fontSize = 18.sp, fontFamily = Ramabhadra)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }

        showSuccessDialog?.let { message ->
            AlertDialog(
                onDismissRequest = { /* Prevent dismissal by clicking outside */ },
                title = { Text(stringResource(R.string.congratulations), fontFamily = Ramabhadra) },
                text = { Text(message, fontFamily = Mallanna) },
                confirmButton = {
                    Button(
                        onClick = {
                            showSuccessDialog = null
                            onClose()
                        }
                    ) {
                        Text(stringResource(R.string.ok))
                    }
                }
            )
        }
    }

@Composable
private fun RuleItem(
    number: String,
    title: String,
    description: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                shape = RoundedCornerShape(12.dp)
            )
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .background(
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                fontFamily = Ramabhadra,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = description,
                fontSize = 13.sp,
                fontFamily = Mallanna,
                lineHeight = 18.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
