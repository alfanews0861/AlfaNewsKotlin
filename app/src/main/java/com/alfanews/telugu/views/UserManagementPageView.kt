package com.alfanews.telugu.views

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.toUserObject
import com.google.firebase.firestore.Query
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserManagementPageView(currentUser: User) {
    var users by remember { mutableStateOf<List<User>>(emptyList()) }
    var filteredUsers by remember { mutableStateOf<List<User>>(emptyList()) }
    var editors by remember { mutableStateOf<List<User>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var searchTerm by remember { mutableStateOf("") }
    var updatingUsers by remember { mutableStateOf<Set<String>>(emptySet()) }
    
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    fun applyFilter(userList: List<User>, query: String): List<User> {
        val lowercasedFilter = query.lowercase().trim()
        if (lowercasedFilter.isBlank()) return userList
        return userList.filter { u ->
            u.name.lowercase().contains(lowercasedFilter) ||
            (u.email?.lowercase()?.contains(lowercasedFilter) == true) ||
            (u.phone?.lowercase()?.contains(lowercasedFilter) == true)
        }
    }

    fun refreshUsers() {
        scope.launch {
            loading = true
            try {
                // ✅ Optimized: Role-based queries instead of fetching all users
                val queries = when (currentUser.role) {
                    UserRole.EDITOR -> {
                        val subscribers = FirebaseService.db.collection("users")
                            .whereEqualTo("role", "SUBSCRIBER")
                            .get().await().documents.mapNotNull { doc -> doc.toUserObject() }

                        val reporters = FirebaseService.db.collection("users")
                            .whereEqualTo("role", "REPORTER")
                            .get().await().documents.mapNotNull { doc -> doc.toUserObject() }

                        subscribers + reporters.filter { it.promotedBy == currentUser.id || it.promotedBy.isNullOrBlank() || it.promotedBy == "ADMIN" }
                    }
                    UserRole.REGIONAL_INCHARGE -> {
                        val roles = listOf("SUBSCRIBER", "REPORTER")
                        roles.flatMap { role ->
                            FirebaseService.db.collection("users")
                                .whereEqualTo("role", role)
                                .get().await().documents.mapNotNull { doc ->
                                    doc.toUserObject()
                                }
                        }.filter { u -> u.district != null && currentUser.assignedDistricts.contains(u.district) }
                    }
                    else -> {
                        FirebaseService.db.collection("users")
                            .orderBy("name", Query.Direction.ASCENDING)
                            .get()
                            .await()
                            .documents.mapNotNull { doc -> doc.toUserObject() }
                    }
                }

                users = queries
                editors = queries.filter { it.role == UserRole.EDITOR }
                filteredUsers = applyFilter(queries, searchTerm)

            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        refreshUsers()
    }

    LaunchedEffect(searchTerm, users) {
        filteredUsers = applyFilter(users, searchTerm)
    }

    fun handleUserUpdate(userId: String, data: Map<String, Any>) {
        scope.launch {
            updatingUsers = updatingUsers + userId
            try {
                FirebaseService.db.collection("users").document(userId).update(data).await()
                snackbarHostState.showSnackbar("వినియోగదారు వివరాలు విజయవంతంగా అప్‌డేట్ అయ్యాయి.")
                refreshUsers()
            } catch (e: Exception) {
                e.printStackTrace()
                snackbarHostState.showSnackbar("అప్‌డేట్ ఫెయిల్ అయింది: ${e.message?.take(50)}...")
            } finally {
                updatingUsers = updatingUsers - userId
            }
        }
    }

    Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp)
            ) {
                OutlinedTextField(
                    value = searchTerm,
                    onValueChange = { searchTerm = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("పేరు, ఈమెయిల్ లేదా ఫోన్ నంబర్ ద్వారా శోధించండి...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(16.dp))

                if (loading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (filteredUsers.isEmpty()) {
                            item {
                                Text(
                                    text = "వినియోగదారులు ఎవరూ కనుగొనబడలేదు.",
                                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                                    textAlign = TextAlign.Center,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        } else {
                            items(filteredUsers, key = { it.id }) { user ->
                                UserManagementCard(
                                    user = user,
                                    editors = editors,
                                    currentUser = currentUser,
                                    isUpdating = updatingUsers.contains(user.id),
                                    onUpdate = { data -> handleUserUpdate(user.id, data) }
                                )
                            }
                        }
                    }
                }
            }
        }
}

@Composable
private fun UserManagementCard(
    user: User,
    editors: List<User>,
    currentUser: User,
    isUpdating: Boolean,
    onUpdate: (Map<String, Any>) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            // User Info Section
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AsyncImage(
                    model = user.photoUrl ?: "https://i.pravatar.cc/128?u=${user.id}",
                    contentDescription = user.name,
                    modifier = Modifier.size(56.dp).clip(CircleShape)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(user.name, style = MaterialTheme.typography.titleLarge)
                    Text(
                        user.email ?: user.phone ?: "వివరాలు లేవు",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Role Management Section
            if (currentUser.role == UserRole.ADMIN) {
                AdminRoleManager(user, isUpdating, onUpdate, editors)
            } else if ((currentUser.role == UserRole.EDITOR || currentUser.role == UserRole.REGIONAL_INCHARGE) && 
                (user.role == UserRole.SUBSCRIBER || user.role == UserRole.REPORTER)) {
                EditorRoleManager(user, currentUser, isUpdating, onUpdate)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdminRoleManager(user: User, isUpdating: Boolean, onUpdate: (Map<String, Any>) -> Unit, editors: List<User>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        var roleExpanded by remember { mutableStateOf(false) }
        val availableRoles = listOf(UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.EDITOR, UserRole.ADMIN)
        
        ExposedDropdownMenuBox(expanded = roleExpanded, onExpandedChange = { if (!isUpdating) roleExpanded = it }) {
            OutlinedTextField(
                value = user.role.name,
                onValueChange = {},
                readOnly = true,
                label = { Text("User Role") },
                modifier = Modifier.fillMaxWidth().menuAnchor(),
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = roleExpanded) },
                enabled = !isUpdating
            )
            ExposedDropdownMenu(expanded = roleExpanded, onDismissRequest = { roleExpanded = false }) {
                availableRoles.forEach { role ->
                    DropdownMenuItem(text = { Text(role.name) }, onClick = { 
                        val updates = mutableMapOf<String, Any>("role" to role.name)
                        if (role == UserRole.REPORTER) {
                            updates["warningLevel"] = 0
                            updates["inProbation"] = false
                            updates["previouslyDowngraded"] = false
                            updates["suspended"] = false
                            updates["downgradedReason"] = com.google.firebase.firestore.FieldValue.delete()
                            updates["downgradedAt"] = com.google.firebase.firestore.FieldValue.delete()
                            updates["lastWarningDate"] = com.google.firebase.firestore.FieldValue.delete()
                            updates["promotedAt"] = com.google.firebase.Timestamp.now()
                            updates["lastPostTimestamp"] = com.google.firebase.Timestamp.now()
                            updates["rejoinedAt"] = com.google.firebase.Timestamp.now()
                        }
                        onUpdate(updates)
                        roleExpanded = false 
                    })
                }
            }
        }

        if (user.role == UserRole.REGIONAL_INCHARGE) {
            MultiDistrictSelector(
                selectedDistricts = user.assignedDistricts,
                isUpdating = isUpdating,
                onSave = { newList ->
                    onUpdate(mapOf("assignedDistricts" to newList))
                }
            )
        }

        if (user.role == UserRole.REPORTER) {
            var district by remember(user.id, user.district) { mutableStateOf(user.district ?: "") }
            var mandal by remember(user.id, user.assignedMandal) { mutableStateOf(user.assignedMandal ?: "") }

            LocationSelector(
                selectedDistrict = district,
                selectedMandal = mandal,
                onLocationChange = { d, m -> 
                    district = d
                    mandal = m
                }
            )
            
            Button(
                onClick = { 
                    onUpdate(mapOf(
                        "district" to district,
                        "assignedMandal" to mandal
                    ))
                },
                enabled = !isUpdating && (district != (user.district ?: "") || mandal != (user.assignedMandal ?: "")),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save Location")
            }

            var editorExpanded by remember { mutableStateOf(false) }
            val assignedEditorName = editors.find { it.id == user.promotedBy }?.name ?: "ADMIN"

            ExposedDropdownMenuBox(expanded = editorExpanded, onExpandedChange = { if (!isUpdating) editorExpanded = it }) {
                OutlinedTextField(
                    value = assignedEditorName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Assigned to Editor") },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = editorExpanded) },
                    enabled = !isUpdating
                )
                ExposedDropdownMenu(expanded = editorExpanded, onDismissRequest = { editorExpanded = false }) {
                    DropdownMenuItem(text = { Text("ADMIN") }, onClick = {
                        onUpdate(mapOf("promotedBy" to "ADMIN"))
                        editorExpanded = false
                    })
                    editors.forEach { editor ->
                        DropdownMenuItem(text = { Text(editor.name) }, onClick = { 
                            onUpdate(mapOf("promotedBy" to editor.id))
                            editorExpanded = false
                        })
                    }
                }
            }
        }
    }
}

@Composable
private fun EditorRoleManager(user: User, currentUser: User, isUpdating: Boolean, onUpdate: (Map<String, Any>) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (user.role == UserRole.SUBSCRIBER) {
            Button(
                onClick = { onUpdate(mapOf("role" to UserRole.REPORTER.name, "promotedBy" to currentUser.id)) },
                enabled = !isUpdating,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isUpdating) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text("Promote to Reporter")
                }
            }
        } else if (user.role == UserRole.REPORTER) {
            var district by remember(user.id, user.district) { mutableStateOf(user.district ?: "") }
            var mandal by remember(user.id, user.assignedMandal) { mutableStateOf(user.assignedMandal ?: "") }

            LocationSelector(
                selectedDistrict = district,
                selectedMandal = mandal,
                onLocationChange = { d, m -> 
                    district = d
                    mandal = m
                }
            )
            
            Button(
                onClick = { onUpdate(mapOf("district" to district, "assignedMandal" to mandal)) },
                enabled = !isUpdating && (district != (user.district ?: "") || mandal != (user.assignedMandal ?: "")),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Update Location")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun MultiDistrictSelector(
    selectedDistricts: List<String>,
    isUpdating: Boolean,
    onSave: (List<String>) -> Unit
) {
    var currentList by remember(selectedDistricts) { mutableStateOf(selectedDistricts) }
    var dropdownExpanded by remember { mutableStateOf(false) }
    var filterText by remember { mutableStateOf("") }
    
    val allDistricts = Constants.ALL_DISTRICTS
    val filteredDistricts = remember(filterText) {
        if (filterText.isBlank()) allDistricts
        else allDistricts.filter { it.contains(filterText.trim(), ignoreCase = true) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "కేటాయించిన జిల్లాలు (Assigned Districts):",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (currentList.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                currentList.forEach { district ->
                    InputChip(
                        selected = true,
                        onClick = {
                            if (!isUpdating) {
                                currentList = currentList - district
                            }
                        },
                        label = { Text(district) },
                        trailingIcon = {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "తొలగించు",
                                modifier = Modifier.size(16.dp)
                            )
                        },
                        enabled = !isUpdating
                    )
                }
            }
        } else {
            Text(
                text = "ఏ జిల్లా కేటాయించబడలేదు. కింద డ్రాప్‌డౌన్ నుండి ఎంచుకోండి.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        ExposedDropdownMenuBox(
            expanded = dropdownExpanded,
            onExpandedChange = { if (!isUpdating) dropdownExpanded = it }
        ) {
            OutlinedTextField(
                value = "",
                onValueChange = {},
                readOnly = true,
                label = { Text("జిల్లాను ఎంచుకోండి (Select District)") },
                placeholder = { Text("జిల్లా ఎంచుకోవడానికి నొక్కండి...") },
                modifier = Modifier.fillMaxWidth().menuAnchor(),
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                enabled = !isUpdating
            )
            ExposedDropdownMenu(
                expanded = dropdownExpanded,
                onDismissRequest = { 
                    dropdownExpanded = false
                    filterText = ""
                }
            ) {
                OutlinedTextField(
                    value = filterText,
                    onValueChange = { filterText = it },
                    placeholder = { Text("జిల్లా శోధించండి...") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    singleLine = true
                )

                filteredDistricts.forEach { district ->
                    val isSelected = currentList.contains(district)
                    DropdownMenuItem(
                        text = {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(district)
                                if (isSelected) {
                                    Text("✓", color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        },
                        onClick = {
                            currentList = if (isSelected) {
                                currentList - district
                            } else {
                                currentList + district
                            }
                        }
                    )
                }
            }
        }

        Button(
            onClick = { onSave(currentList) },
            enabled = !isUpdating && (currentList != selectedDistricts),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("జిల్లాల కేటాయింపు సేవ్ చేయి (Save Districts)")
        }
    }
}
