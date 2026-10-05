package com.alfanews.telugu.views

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.glassmorphism
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfilePageView(
    user: User,
    onClose: () -> Unit,
    onSave: (name: String, phone: String, address: String, district: String, mandal: String, photoUri: Uri?, signatureUri: Uri?) -> Unit,
    saving: Boolean = false,
    showTitle: Boolean = true
) {
    var editName by remember { mutableStateOf(user.name) }
    var editPhone by remember { mutableStateOf(user.phone ?: "") }
    var editAddress by remember { mutableStateOf(user.address ?: "") }
    var editDistrict by remember { mutableStateOf(user.district ?: "") }
    var editMandal by remember { mutableStateOf(user.assignedMandal ?: user.mandal ?: "") }
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    var signatureUri by remember { mutableStateOf<Uri?>(null) }

    var occupiedMandalsMap by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var occupiedReporterIds by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var isLoadingOccupied by remember { mutableStateOf(true) }
    var conflictMessage by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    val isAdmin = user.role == UserRole.ADMIN
    val allDistricts = remember {
        (Constants.TS_DISTRICTS + Constants.AP_DISTRICTS).sorted()
    }

    LaunchedEffect(Unit) {
        isLoadingOccupied = true
        try {
            val usersSnap = withTimeoutOrNull(5000L) {
                FirebaseService.db.collection("users")
                    .whereIn("role", listOf("REPORTER", "reporter", "STAFF_REPORTER", "REGIONAL_INCHARGE", 2, 2.0, "2", 3, 3.0, "3"))
                    .limit(400)
                    .get().await()
            }
            if (usersSnap != null) {
                val occMap = mutableMapOf<String, String>()
                val occIdMap = mutableMapOf<String, String>()
                for (uDoc in usersSnap.documents) {
                    val isSuspended = uDoc.getBoolean("suspended") == true || uDoc.getBoolean("previouslyDowngraded") == true
                    val roleStr = uDoc.get("role")?.toString()?.uppercase() ?: ""
                    if (isSuspended || roleStr == "SUBSCRIBER" || roleStr == "GUEST" || roleStr == "1" || roleStr == "1.0") continue

                    val dist = (uDoc.getString("district") ?: uDoc.getString("state_district") ?: "").trim()
                    val mandal = (uDoc.getString("assignedMandal") ?: uDoc.getString("mandal") ?: uDoc.getString("mandalam") ?: uDoc.getString("selectedMandal") ?: "").trim()
                    val name = uDoc.getString("name") ?: "విలేకరి"
                    val phone = uDoc.getString("phone") ?: ""
                    if (dist.isNotEmpty() && mandal.isNotEmpty()) {
                        val occupantInfo = if (phone.isNotBlank()) "$name ($phone)" else name
                        val key = "$dist|$mandal"
                        occMap[key] = occupantInfo
                        occIdMap[key] = uDoc.id
                    }
                }
                occupiedMandalsMap = occMap
                occupiedReporterIds = occIdMap
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoadingOccupied = false
        }
    }

    fun checkOccupant(dist: String, mndl: String): String? {
        if (dist.isBlank() || mndl.isBlank()) return null
        val key = "${dist.trim()}|${mndl.trim()}"
        val occId = occupiedReporterIds[key]
        if (occId != null && occId == user.id) return null // User's own assignment is not a conflict
        return occupiedMandalsMap[key]
    }

    val pickPhotoLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
        onResult = { uri: Uri? -> photoUri = uri }
    )

    val pickSignatureLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
        onResult = { uri: Uri? -> signatureUri = uri }
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .glassmorphism(cornerRadius = 24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Name Edit
                Column {
                    Text(
                        text = stringResource(R.string.display_name),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(fontFamily = Poppins),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = Color.Gray.copy(alpha = 0.3f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                }

                // Phone Edit
                Column {
                    Text(
                        text = stringResource(R.string.phone_whatsapp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    OutlinedTextField(
                        value = editPhone,
                        onValueChange = { editPhone = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        placeholder = { Text(stringResource(R.string.mobile_placeholder)) },
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Phone),
                        textStyle = androidx.compose.ui.text.TextStyle(fontFamily = Poppins),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = Color.Gray.copy(alpha = 0.3f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                }

                // District Selection
                var districtExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = districtExpanded,
                    onExpandedChange = { districtExpanded = !districtExpanded },
                ) {
                    OutlinedTextField(
                        value = editDistrict,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.district)) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) },
                    )
                    ExposedDropdownMenu(
                        expanded = districtExpanded,
                        onDismissRequest = { districtExpanded = false },
                    ) {
                        allDistricts.forEach { district ->
                            DropdownMenuItem(
                                text = { Text(district) },
                                onClick = {
                                    if (editDistrict != district) {
                                        editDistrict = district
                                        editMandal = ""
                                        conflictMessage = null
                                    }
                                    districtExpanded = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                            )
                        }
                    }
                }

                // Mandal Selection (విలేకరి కేటాయించిన మండలం)
                val mandalsList = remember(editDistrict) {
                    if (editDistrict.isBlank()) emptyList()
                    else Constants.MANDAL_DATA[editDistrict] ?: emptyList()
                }
                var mandalExpanded by remember { mutableStateOf(false) }

                if (editDistrict.isNotBlank()) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "కేటాయించిన మండలం (విలేకరి మండలం)",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Gray
                            )
                            if (isLoadingOccupied) {
                                Text(
                                    text = "పరిశీలిస్తోంది...",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }

                        ExposedDropdownMenuBox(
                            expanded = mandalExpanded,
                            onExpandedChange = {
                                if (mandalsList.isNotEmpty()) {
                                    mandalExpanded = !mandalExpanded
                                }
                            },
                        ) {
                            OutlinedTextField(
                                value = editMandal,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text(if (mandalsList.isEmpty()) "మండలాలు అందుబాటులో లేవు" else "మండలాన్ని ఎంచుకోండి (Select Mandal)") },
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mandalExpanded) },
                                isError = conflictMessage != null,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = if (conflictMessage != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = if (conflictMessage != null) MaterialTheme.colorScheme.error else Color.Gray.copy(alpha = 0.3f),
                                    errorBorderColor = MaterialTheme.colorScheme.error
                                ),
                                shape = RoundedCornerShape(12.dp)
                            )
                            ExposedDropdownMenu(
                                expanded = mandalExpanded,
                                onDismissRequest = { mandalExpanded = false },
                            ) {
                                if (mandalsList.isEmpty()) {
                                    DropdownMenuItem(
                                        text = { Text("మండలాలు అందుబాటులో లేవు") },
                                        onClick = { mandalExpanded = false }
                                    )
                                } else {
                                    mandalsList.forEach { mandalName ->
                                        val occupant = checkOccupant(editDistrict, mandalName)
                                        val isOccupied = occupant != null
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Text(
                                                        text = mandalName,
                                                        color = if (isOccupied) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                                                        fontWeight = if (isOccupied) FontWeight.SemiBold else FontWeight.Normal
                                                    )
                                                    if (isOccupied) {
                                                        Surface(
                                                            color = MaterialTheme.colorScheme.error.copy(alpha = 0.12f),
                                                            shape = RoundedCornerShape(4.dp)
                                                        ) {
                                                            Text(
                                                                text = "విలేకరి ఉన్నారు",
                                                                fontSize = 10.sp,
                                                                fontWeight = FontWeight.Bold,
                                                                color = MaterialTheme.colorScheme.error,
                                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                            )
                                                        }
                                                    }
                                                }
                                            },
                                            onClick = {
                                                editMandal = mandalName
                                                mandalExpanded = false
                                                if (isOccupied) {
                                                    val msg = "ఇప్పటికే ఈ మండలానికి విలేకరి ఉన్నారు: $occupant"
                                                    conflictMessage = msg
                                                    Toast.makeText(context, "ఇప్పటికే ఈ మండలానికి విలేకరి వున్నారు ($occupant)", Toast.LENGTH_LONG).show()
                                                } else {
                                                    conflictMessage = null
                                                }
                                            },
                                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                                        )
                                    }
                                }
                            }
                        }

                        // Conflict Warning Banner
                        if (conflictMessage != null) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Surface(
                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.35f),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Warning,
                                        contentDescription = "Warning",
                                        tint = MaterialTheme.colorScheme.error,
                                        modifier = Modifier.size(24.dp)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(
                                            text = "ఇప్పటికే ఈ మండలానికి విలేకరి వున్నారు!",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.error,
                                            fontFamily = Ramabhadra
                                        )
                                        Text(
                                            text = conflictMessage ?: "",
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.onErrorContainer
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Address Edit
                Column {
                    Text(
                        text = stringResource(R.string.address_full),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    OutlinedTextField(
                        value = editAddress,
                        onValueChange = { editAddress = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text(stringResource(R.string.address_placeholder), fontFamily = Poppins) },
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(fontFamily = Poppins),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = Color.Gray.copy(alpha = 0.3f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                }

                // Photo Upload
                Column {
                    Text(
                        text = stringResource(R.string.profile_photo),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(
                            model = photoUri ?: user.photoUrl ?: "https://ui-avatars.com/api/?name=${user.name}&background=random",
                            contentDescription = "Profile Photo",
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                        TextButton(onClick = { pickPhotoLauncher.launch("image/*") }) {
                            Text(stringResource(R.string.choose_photo))
                        }
                    }
                }

                // Signature Upload (Admin Only)
                if (isAdmin) {
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.auth_signature_admin),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(bottom = 4.dp)
                            )
                            Text(
                                text = stringResource(R.string.auth_signature_desc),
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            Row(
                                horizontalArrangement = Arrangement.spacedBy(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    modifier = Modifier
                                        .width(128.dp)
                                        .height(48.dp),
                                    color = MaterialTheme.colorScheme.surface,
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        MaterialTheme.colorScheme.outlineVariant
                                    ),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Box(
                                        modifier = Modifier.fillMaxSize(),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        AsyncImage(
                                            model = signatureUri ?: user.signatureUrl ?: "https://via.placeholder.com/150?text=Signature",
                                            contentDescription = "Signature",
                                            modifier = Modifier
                                                .fillMaxWidth(0.9f)
                                                .fillMaxHeight(0.9f)
                                                .clip(RoundedCornerShape(4.dp)),
                                            contentScale = ContentScale.Fit
                                        )
                                    }
                                }
                                TextButton(onClick = { pickSignatureLauncher.launch("image/*") }) {
                                    Text(stringResource(R.string.choose_signature))
                                }
                            }
                        }
                    }
                }

                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Next/Skip Button
                    OutlinedButton(
                        onClick = onClose,
                        modifier = Modifier.weight(1f).height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(stringResource(R.string.skip), fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            val occupant = checkOccupant(editDistrict, editMandal)
                            if (editMandal.isNotBlank() && occupant != null) {
                                Toast.makeText(
                                    context,
                                    "ఈ మండలానికి ఇప్పటికే విలేకరి ($occupant) ఉన్నారు! దయచేసి వేరే మండలాన్ని ఎంచుకోండి.",
                                    Toast.LENGTH_LONG
                                ).show()
                                return@Button
                            }
                            onSave(editName, editPhone, editAddress, editDistrict, editMandal, photoUri, signatureUri)
                        },
                        modifier = Modifier.weight(1f).height(50.dp),
                        enabled = !saving,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        ),
                        shape = MaterialTheme.shapes.medium,
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
                    ) {
                        if (saving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.save),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
