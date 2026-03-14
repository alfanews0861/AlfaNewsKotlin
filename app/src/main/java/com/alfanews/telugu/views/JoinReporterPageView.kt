package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.ui.theme.AlfaNewsTheme
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinReporterPageView(onClose: () -> Unit) {
    var fullName by remember { mutableStateOf("") }
    var fatherName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var position by remember { mutableStateOf("") }
    var interestedArea by remember { mutableStateOf("") }
    var education by remember { mutableStateOf("") }
    var currentOrg by remember { mutableStateOf("") }
    
    var isSubmitting by remember { mutableStateOf(false) }
    
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val positions = listOf("జిల్లా స్టాఫ్ రిపోర్టర్", "మండల రిపోర్టర్")
    var expanded by remember { mutableStateOf(false) }

    AlfaNewsTheme {
        Scaffold(
            topBar = {
                CenterAlignedTopAppBar(
                    title = { 
                        Text(
                            "విలేకరి గా చేరండి", 
                            fontFamily = Ramabhadra,
                            fontSize = 20.sp
                        ) 
                    },
                    navigationIcon = { 
                        IconButton(onClick = onClose) { 
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back") 
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
                    Text(
                        text = "రిపోర్టర్ అప్లికేషన్ ఫారం",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = Ramabhadra,
                        color = MaterialTheme.colorScheme.primary
                    )
                    
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text("పూర్తి పేరు", fontFamily = Mallanna) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = fatherName,
                        onValueChange = { fatherName = it },
                        label = { Text("తండ్రిపేరు", fontFamily = Mallanna) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("ఫోన్ నెంబర్", fontFamily = Mallanna) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Phone
                        )
                    )
                    
                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        label = { Text("అడ్రస్", fontFamily = Mallanna) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                    
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = position,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("పోసిషన్", fontFamily = Mallanna) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            positions.forEach { selectionOption ->
                                DropdownMenuItem(
                                    text = { Text(selectionOption, fontFamily = Mallanna) },
                                    onClick = {
                                        position = selectionOption
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                    
                    OutlinedTextField(
                        value = interestedArea,
                        onValueChange = { interestedArea = it },
                        label = { Text("ఆసక్తి వున్నా ప్రాంతం", fontFamily = Mallanna) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = education,
                        onValueChange = { education = it },
                        label = { Text("విద్య అర్హత", fontFamily = Mallanna) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = currentOrg,
                        onValueChange = { currentOrg = it },
                        label = { Text("ప్రస్తుతం పనిచేస్తున్న సంస్థ", fontFamily = Mallanna) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Button(
                        onClick = {
                            if (fullName.isBlank() || phone.isBlank() || position.isBlank()) {
                                Toast.makeText(context, "దయచేసి ముఖ్యమైన వివరాలు నింపండి", Toast.LENGTH_SHORT).show()
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
                                    currentOrg = currentOrg
                                )
                                
                                isSubmitting = false
                                if (result.isSuccess) {
                                    Toast.makeText(context, "మీ అప్లికేషన్ విజయవంతంగా పంపబడింది. మేము మిమ్మల్ని సంప్రదిస్తాము.", Toast.LENGTH_LONG).show()
                                    onClose()
                                } else {
                                    Toast.makeText(context, "సమర్పించడంలో విఫలమైంది: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        enabled = !isSubmitting,
                        modifier = Modifier.fillMaxWidth().height(56.dp)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                        } else {
                            Text("సబ్మిట్ చేయండి", fontSize = 18.sp, fontFamily = Ramabhadra)
                        }
                    }
                }
            }
        )
    }
}
