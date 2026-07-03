package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
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
    
    // Dropdown expanded states - moved to top to prevent recreation
    var districtExpanded by remember { mutableStateOf(false) }
    var mandalExpanded by remember { mutableStateOf(false) }

    var isSubmitting by remember { mutableStateOf(false) }
    var showSuccessDialog by remember { mutableStateOf<String?>(null) }
    
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val positions = listOf(
        stringResource(R.string.district_staff_reporter),
        stringResource(R.string.mandal_reporter)
    )
    
    // Memoize district list based on selected state
    val districtsList = remember(selectedState) {
        if (selectedState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
    }

    // Memoize mandal list based on selected district
    val mandalsList = remember(selectedDistrict) {
        Constants.MANDAL_DATA[selectedDistrict] ?: emptyList<String>()
    }

    // Memoize available mandals list based on occupied mandals
    val availableMandalsList = remember(selectedDistrict, mandalsList, occupiedMandals) {
        mandalsList.filter { !occupiedMandals.contains("$selectedDistrict|$it") }
    }

    // Fetch occupied mandals from Firebase
    LaunchedEffect(Unit) {
        try {
            val snapshot = FirebaseService.db.collection("users")
                .whereEqualTo("role", "REPORTER")
                .get()
                .await()
            val mandals = snapshot.documents.mapNotNull { doc ->
                val dist = (doc.get("district") as? String) ?: ""
                val mandal = (doc.get("assignedMandal") as? String) ?: ""
                if (dist != "" && mandal != "") "$dist|$mandal" else null
            }.toSet()
            occupiedMandals = mandals
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoadingOccupied = false
        }
    }

    // Close dropdowns when state changes
    LaunchedEffect(selectedState) {
        districtExpanded = false
        mandalExpanded = false
    }

    // Close mandal dropdown when district changes
    LaunchedEffect(selectedDistrict) {
        mandalExpanded = false
    }

    AlfaNewsTheme {
        Scaffold(
            topBar = {
                CenterAlignedTopAppBar(
                    title = { 
                        Text(
                            stringResource(R.string.join_reporter), 
                            fontFamily = Ramabhadra,
                            fontSize = 20.sp
                        ) 
                    },
                    navigationIcon = { 
                        IconButton(onClick = onClose) { 
                            Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.back)) 
                        } 
                    },
                    colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary,
                        navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            },
            content = { paddingValues ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
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
                                modifier = Modifier.fillMaxWidth(),
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
                                modifier = Modifier.fillMaxWidth(),
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
                                modifier = Modifier.fillMaxWidth(),
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
                                onExpandedChange = { districtExpanded = !districtExpanded }
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
                                        } else if (availableMandalsList.isEmpty()) {
                                            DropdownMenuItem(text = { Text(stringResource(R.string.no_mandals_available)) }, onClick = {})
                                        } else {
                                            availableMandalsList.forEach { mandalName: String ->
                                                DropdownMenuItem(
                                                    text = { Text(mandalName) },
                                                    onClick = {
                                                        selectedMandal = mandalName
                                                        mandalExpanded = false
                                                    }
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
                            var posExpanded by remember { mutableStateOf(false) }
                            ExposedDropdownMenuBox(
                                expanded = posExpanded,
                                onExpandedChange = { posExpanded = !posExpanded }
                            ) {
                                OutlinedTextField(
                                    value = position,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text(stringResource(R.string.position), fontFamily = Mallanna) },
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = posExpanded) },
                                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                    )
                                )
                                ExposedDropdownMenu(
                                    expanded = posExpanded,
                                    onDismissRequest = { posExpanded = false }
                                ) {
                                    positions.forEach { selectionOption: String ->
                                        DropdownMenuItem(
                                            text = { Text(selectionOption, fontFamily = Mallanna) },
                                            onClick = {
                                                position = selectionOption
                                                posExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                            
                            OutlinedTextField(
                                value = interestedArea,
                                onValueChange = { interestedArea = it },
                                label = { Text(stringResource(R.string.interested_category), fontFamily = Mallanna) },
                                modifier = Modifier.fillMaxWidth(),
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
                                modifier = Modifier.fillMaxWidth(),
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
                                modifier = Modifier.fillMaxWidth(),
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
                                modifier = Modifier.fillMaxWidth(),
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
                            if (fullName.isBlank() || fatherName.isBlank() || phone.isBlank() || address.isBlank() || 
                                position.isBlank() || interestedArea.isBlank() || education.isBlank() || 
                                currentOrg.isBlank() || selectedDistrict.isBlank() || selectedMandal.isBlank() || 
                                additionalMessage.isBlank()) {
                                Toast.makeText(context, context.getString(R.string.fill_all_details), Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            
                            scope.launch {
                                isSubmitting = true
                                val result = FirebaseFunctionsService.submitReporterApplication(
                                    fullName = fullName,
                                    fatherName = fatherName,
                                    phone = phone,
                                    address = address,
                                    position = position,
                                    interestedArea = interestedArea,
                                    education = education,
                                    currentOrg = currentOrg,
                                    state = selectedState,
                                    district = selectedDistrict,
                                    mandal = selectedMandal,
                                    message = additionalMessage,
                                    userId = FirebaseService.auth.currentUser?.uid
                                )
                                
                                isSubmitting = false
                                if (result.isSuccess) {
                                    val isLoggedIn = FirebaseService.auth.currentUser != null
                                    if (isLoggedIn) {
                                        showSuccessDialog = context.getString(R.string.app_success_logged_in)
                                    } else {
                                        showSuccessDialog = context.getString(R.string.app_success_guest)
                                    }
                                } else {
                                    Toast.makeText(context, context.getString(R.string.submission_failed, result.exceptionOrNull()?.message ?: ""), Toast.LENGTH_LONG).show()
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
            }
        )

        showSuccessDialog?.let { message ->
            AlertDialog(
                onDismissRequest = { /* Prevent dismissal by clicking outside */ },
                title = { Text(stringResource(R.string.congratulations), fontFamily = Ramabhadra) },
                text = { Text(message, fontFamily = Mallanna) },
                confirmButton = {
                    Button(
                        onClick = {
                            val isLoggedIn = FirebaseService.auth.currentUser != null
                            showSuccessDialog = null
                            onClose()
                            if (!isLoggedIn) {
                                onNavigateToLogin()
                            }
                        }
                    ) {
                        Text(stringResource(R.string.ok))
                    }
                }
            )
        }
    }
}
