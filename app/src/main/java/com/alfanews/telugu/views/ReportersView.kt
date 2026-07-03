package com.alfanews.telugu.views

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.alfanews.telugu.R
import com.alfanews.telugu.ViewModelFactory
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.viewmodels.ReportersViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportersView(
    language: Language,
    onBack: () -> Unit,
    onReporterClick: (String) -> Unit,
    onMenuClick: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val viewModel: ReportersViewModel = viewModel(
        factory = ViewModelFactory(context.applicationContext as Application)
    )
    val reporters by viewModel.reporters.collectAsStateWithLifecycle()
    val loading by viewModel.loading.collectAsStateWithLifecycle()

    var selectedState by remember { mutableStateOf("") }
    var selectedDistrict by remember { mutableStateOf("") }
    var selectedMandal by remember { mutableStateOf("") }
    
    var stateExpanded by remember { mutableStateOf(false) }
    var districtExpanded by remember { mutableStateOf(false) }
    var mandalExpanded by remember { mutableStateOf(false) }

    val states = listOf(
        stringResource(R.string.telangana) to "TS",
        stringResource(R.string.andhra_pradesh) to "AP"
    )

    val districts = if (selectedState == "TS") Constants.TS_DISTRICTS else if (selectedState == "AP") Constants.AP_DISTRICTS else emptyList()
    val mandals = if (selectedDistrict.isNotEmpty()) Constants.MANDAL_DATA[selectedDistrict] ?: emptyList() else emptyList()

    LaunchedEffect(selectedDistrict, selectedMandal) {
        if (selectedDistrict.isNotEmpty()) {
            viewModel.fetchReporters(selectedDistrict, selectedMandal.ifEmpty { null })
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.reporters_directory), fontFamily = Ramabhadra) },
                navigationIcon = {
                    if (onMenuClick != null) {
                        IconButton(onClick = onMenuClick) {
                            Icon(Icons.Default.Menu, contentDescription = stringResource(R.string.menu))
                        }
                    } else {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.back))
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Selection Boxes
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // State Selector
                ExposedDropdownMenuBox(
                    expanded = stateExpanded,
                    onExpandedChange = { stateExpanded = it }
                ) {
                    OutlinedTextField(
                        value = states.find { it.second == selectedState }?.first ?: stringResource(R.string.select_state),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.state)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = stateExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
                    )
                    ExposedDropdownMenu(
                        expanded = stateExpanded,
                        onDismissRequest = { stateExpanded = false }
                    ) {
                        states.forEach { state ->
                            DropdownMenuItem(
                                text = { Text(state.first) },
                                onClick = {
                                    selectedState = state.second
                                    selectedDistrict = ""
                                    selectedMandal = ""
                                    stateExpanded = false
                                }
                            )
                        }
                    }
                }

                // District Selector
                if (selectedState.isNotEmpty()) {
                    ExposedDropdownMenuBox(
                        expanded = districtExpanded,
                        onExpandedChange = { districtExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = selectedDistrict.ifEmpty { stringResource(R.string.select_district) },
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(stringResource(R.string.district)) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
                        )
                        ExposedDropdownMenu(
                            expanded = districtExpanded,
                            onDismissRequest = { districtExpanded = false }
                        ) {
                            districts.forEach { district ->
                                DropdownMenuItem(
                                    text = { Text(district) },
                                    onClick = {
                                        selectedDistrict = district
                                        selectedMandal = ""
                                        districtExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                // Mandal Selector
                if (selectedDistrict.isNotEmpty()) {
                    ExposedDropdownMenuBox(
                        expanded = mandalExpanded,
                        onExpandedChange = { mandalExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = selectedMandal.ifEmpty { stringResource(R.string.select_mandal) },
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(stringResource(R.string.mandal)) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mandalExpanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
                        )
                        ExposedDropdownMenu(
                            expanded = mandalExpanded,
                            onDismissRequest = { mandalExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.all_district_reporters)) },
                                onClick = {
                                    selectedMandal = ""
                                    mandalExpanded = false
                                }
                            )
                            mandals.forEach { mandal ->
                                DropdownMenuItem(
                                    text = { Text(mandal) },
                                    onClick = {
                                        selectedMandal = mandal
                                        mandalExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Results Title
            if (selectedDistrict.isNotEmpty()) {
                Text(
                    text = if (selectedMandal.isEmpty()) 
                        stringResource(R.string.all_district_reporters) 
                    else 
                        stringResource(R.string.mandal_reporter_details),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Reporters List
            if (loading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (reporters.isEmpty() && selectedDistrict.isNotEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        stringResource(R.string.no_reporters_found),
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(reporters) { reporter ->
                        ReporterCard(
                            reporter = reporter,
                            onClick = { onReporterClick(reporter.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ReporterCard(
    reporter: User,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = reporter.photoUrl ?: "https://ui-avatars.com/api/?name=${reporter.name}&background=random",
                contentDescription = null,
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )
            
            Column(
                modifier = Modifier
                    .padding(start = 16.dp)
                    .weight(1f)
            ) {
                Text(
                    text = reporter.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                if (!reporter.address.isNullOrEmpty()) {
                    Row(
                        modifier = Modifier.padding(top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.LocationOn,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = reporter.address,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Text(
                    text = "${reporter.district} - ${reporter.assignedMandal ?: ""}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.outline
            )
        }
    }
}
