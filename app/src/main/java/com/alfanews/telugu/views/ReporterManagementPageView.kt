package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.utils.Constants
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReporterManagementPageView(currentUser: User) {
    var applications by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun fetchApplications() {
        scope.launch {
            loading = true
            try {
                val snapshot = FirebaseService.db.collection("reporter_applications")
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .get()
                    .await()
                
                val allApps = snapshot.documents.map { doc -> 
                    doc.data?.plus("id" to doc.id) ?: emptyMap<String, Any>() 
                }
                
                // Filtering based on role
                val filteredApps = if (currentUser.role == UserRole.REGIONAL_INCHARGE) {
                    allApps.filter { app -> 
                        val dist = app["district"] as? String
                        currentUser.assignedDistricts.contains(dist)
                    }
                } else {
                    allApps
                }
                
                // Sort to keep PENDING at top
                applications = filteredApps.sortedBy { app -> 
                    val status = app["status"] as? String ?: "PENDING"
                    if (status == "PENDING") 0 else 1
                }
                
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchApplications()
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("రిపోర్టర్ అప్లికేషన్ల నిర్వహణ", style = MaterialTheme.typography.headlineSmall, fontFamily = Ramabhadra)
        Spacer(modifier = Modifier.height(16.dp))

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (applications.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("ఎటువంటి దరఖాస్తులు లేవు.")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(applications, key = { it["id"].toString() }) { app ->
                    ApplicationCard(
                        app = app,
                        currentUser = currentUser,
                        onRefresh = { fetchApplications() }
                    )
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
    
    // Editable Location Fields
    var editDistrict by remember { mutableStateOf(app["district"] as? String ?: "") }
    var editMandal by remember { mutableStateOf(app["mandal"] as? String ?: "") }
    var showLocationEdit by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(app["fullName"] as? String ?: "No Name", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                val status = app["status"] as? String ?: "PENDING"
                Surface(
                    color = when(status) {
                        "JOINED" -> Color(0xFFE8F5E9)
                        "SUSPENDED" -> Color(0xFFFFEBEE)
                        else -> Color(0xFFFFF3E0)
                    },
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(status, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = when(status){
                        "JOINED" -> Color(0xFF2E7D32)
                        "SUSPENDED" -> Color(0xFFC62828)
                        else -> Color(0xFFE65100)
                    })
                }
            }

            Text("Phone: ${app["phone"]}", fontSize = 14.sp)
            Text("Address: ${app["address"]}", fontSize = 14.sp)
            Text("Requested: ${app["district"]} - ${app["mandal"]}", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium)
            
            if ((app["message"] as? String)?.isNotEmpty() == true) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Text("Message: ${app["message"]}", fontSize = 13.sp, color = Color.Gray)
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)

            // Location Assignment
            Text("నియమించాల్సిన ప్రాంతం:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("$editDistrict - $editMandal", color = Color.DarkGray, fontWeight = FontWeight.Bold)
                IconButton(onClick = { showLocationEdit = !showLocationEdit }) {
                    Icon(Icons.Default.EditLocation, contentDescription = "Edit Location", modifier = Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
                }
            }

            if (showLocationEdit) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.padding(vertical = 8.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        LocationSelector(
                            selectedDistrict = editDistrict,
                            selectedMandal = editMandal,
                            onLocationChange = { d, m -> editDistrict = d; editMandal = m }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Action Buttons
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        scope.launch {
                            isProcessing = true
                            try {
                                val phone = app["phone"] as String
                                // Find user by phone
                                val userQuery = FirebaseService.db.collection("users").whereEqualTo("phone", phone).get().await()
                                if (userQuery.isEmpty) {
                                    val userQuery2 = FirebaseService.db.collection("users").whereEqualTo("phone", "+91$phone").get().await()
                                    if (userQuery2.isEmpty) {
                                        Toast.makeText(context, "ఈ యూజర్ ఇంకా లాగిన్ అవ్వలేదు.", Toast.LENGTH_LONG).show()
                                        isProcessing = false
                                        return@launch
                                    } else {
                                        processJoin(userQuery2.documents[0].id, app["id"] as String, editDistrict, editMandal, currentUser.id)
                                    }
                                } else {
                                    processJoin(userQuery.documents[0].id, app["id"] as String, editDistrict, editMandal, currentUser.id)
                                }
                                Toast.makeText(context, "రిపోర్టర్‌గా చేర్చుకోబడ్డారు!", Toast.LENGTH_SHORT).show()
                                onRefresh()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isProcessing = false
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
                    enabled = !isProcessing && (app["status"] as? String != "JOINED")
                ) {
                    if (isProcessing) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                    else Text("Join")
                }

                Button(
                    onClick = {
                        scope.launch {
                            isProcessing = true
                            try {
                                FirebaseService.db.collection("reporter_applications").document(app["id"] as String).update("status", "SUSPENDED").await()
                                Toast.makeText(context, "Suspended", Toast.LENGTH_SHORT).show()
                                onRefresh()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isProcessing = false
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
                    enabled = !isProcessing
                ) {
                    Text("Suspend")
                }

                if (currentUser.role == UserRole.ADMIN) {
                    IconButton(onClick = {
                        scope.launch {
                            FirebaseService.db.collection("reporter_applications").document(app["id"] as String).delete().await()
                            onRefresh()
                        }
                    }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.Red)
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
        "promotedBy" to promoterId
    )
    FirebaseService.db.collection("users").document(userId).update(updates).await()
    FirebaseService.db.collection("reporter_applications").document(appId).update("status", "JOINED").await()
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
