package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alfanews.telugu.models.WhatsAppGroup
import com.alfanews.telugu.viewmodels.WhatsAppAutomationViewModel
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.utils.glassmorphism

/**
 * రిపోర్టర్ల కోసం వాట్సాప్ ఆటోమేషన్ సెట్టింగ్స్ స్క్రీన్.
 * ఇది రిపోర్టర్లు తమ వాట్సాప్ ఖాతాను అనుసంధానించడానికి మరియు గ్రూపులను ఎంచుకోవడానికి అనుమతిస్తుంది.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WhatsAppAutomationView(
    userId: String,
    onBack: () -> Unit,
    viewModel: WhatsAppAutomationViewModel = viewModel()
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    
    val context = LocalContext.current

    LaunchedEffect(userId) {
        viewModel.startListening(userId)
    }

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            Toast.makeText(context, it, Toast.LENGTH_LONG).show()
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("వాట్సాప్ ఆటోమేషన్", fontFamily = Poppins, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            when (settings?.status) {
                "disconnected" -> {
                    DisconnectedUI(
                        onConnect = { phone -> viewModel.connectWhatsApp(userId, phone) },
                        isLoading = isLoading
                    )
                }
                "connecting" -> {
                    ConnectingUI(
                        pairingCode = settings?.pairingCode
                    )
                }
                "connected" -> {
                    ConnectedUI(
                        availableGroups = settings?.availableGroups ?: emptyList(),
                        selectedGroups = settings?.selectedGroups ?: emptyList(),
                        onSave = { selected -> viewModel.updateSelectedGroups(userId, selected) },
                        isLoading = isLoading
                    )
                }
                else -> {
                    // Initial loading state
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            }
        }
    }
}

@Composable
fun DisconnectedUI(
    onConnect: (String) -> Unit,
    isLoading: Boolean
) {
    var phone by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .glassmorphism(cornerRadius = 16.dp)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.Link,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            "మీ వాట్సాప్‌ను కనెక్ట్ చేయండి",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = Poppins,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "మీ వార్తలను ఆటోమేటిక్‌గా వాట్సాప్ గ్రూపుల్లో పోస్ట్ చేయడానికి మీ ఖాతాను అనుసంధానించండి.",
            fontSize = 14.sp,
            color = Color.Gray,
            fontFamily = Poppins,
            modifier = Modifier.padding(bottom = 24.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        
        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("వాట్సాప్ ఫోన్ నంబర్", fontFamily = Poppins) },
            placeholder = { Text("e.g. 91xxxxxxxxxx", fontFamily = Poppins) },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            shape = RoundedCornerShape(12.dp),
            singleLine = true
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = { onConnect(phone) },
            modifier = Modifier.fillMaxWidth().height(54.dp),
            enabled = !isLoading && phone.isNotBlank(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Text("కనెక్ట్ చేయండి", fontWeight = FontWeight.Bold, fontSize = 16.sp, fontFamily = Poppins)
            }
        }
    }
}

@Composable
fun ConnectingUI(pairingCode: String?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .glassmorphism(cornerRadius = 16.dp)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (pairingCode == null) {
            CircularProgressIndicator(modifier = Modifier.size(48.dp))
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                "పెయిరింగ్ కోడ్ కోసం వేచి చూస్తున్నాము...", 
                fontFamily = Poppins,
                fontWeight = FontWeight.Medium
            )
            Text(
                "ఇది కొన్ని క్షణాలు పట్టవచ్చు.",
                fontSize = 12.sp,
                color = Color.Gray,
                fontFamily = Poppins
            )
        } else {
            Icon(
                Icons.Default.QrCode,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "వాట్సాప్ పెయిరింగ్ కోడ్",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = Poppins
            )
            Spacer(modifier = Modifier.height(24.dp))
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(bottom = 24.dp)
            ) {
                Text(
                    text = pairingCode,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(horizontal = 40.dp, vertical = 20.dp),
                    letterSpacing = 6.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    fontFamily = Poppins
                )
            }
            
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Gray.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
                    .padding(16.dp)
            ) {
                Text(
                    "ఎలా కనెక్ట్ చేయాలి:",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    fontFamily = Poppins,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                InstructionRow(number = "1", text = "మీ ఫోన్‌లో వాట్సాప్ ఓపెన్ చేయండి.")
                InstructionRow(number = "2", text = "'Linked Devices' ఆప్షన్‌కు వెళ్ళండి.")
                InstructionRow(number = "3", text = "'Link with Phone Number' పై క్లిక్ చేయండి.")
                InstructionRow(number = "4", text = "పైన ఉన్న 8 అంకెల కోడ్‌ను అక్కడ ఎంటర్ చేయండి.")
            }
        }
    }
}

@Composable
fun InstructionRow(number: String, text: String) {
    Row(modifier = Modifier.padding(vertical = 4.dp)) {
        Text("$number.", fontWeight = FontWeight.Bold, fontSize = 13.sp, fontFamily = Poppins)
        Spacer(modifier = Modifier.width(8.dp))
        Text(text, fontSize = 13.sp, fontFamily = Poppins)
    }
}

@Composable
fun ConnectedUI(
    availableGroups: List<WhatsAppGroup>,
    selectedGroups: List<WhatsAppGroup>,
    onSave: (List<WhatsAppGroup>) -> Unit,
    isLoading: Boolean
) {
    var searchQuery by remember { mutableStateOf("") }
    val filteredGroups = availableGroups.filter { it.name.contains(searchQuery, ignoreCase = true) }
    
    val currentSelected = remember { mutableStateListOf<WhatsAppGroup>() }
    
    LaunchedEffect(selectedGroups) {
        currentSelected.clear()
        currentSelected.addAll(selectedGroups)
    }

    val context = LocalContext.current

    Column(modifier = Modifier.fillMaxSize()) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(bottom = 20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF2E7D32))
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    "వాట్సాప్ విజయవంతంగా కనెక్ట్ చేయబడింది", 
                    fontWeight = FontWeight.Bold, 
                    color = Color(0xFF2E7D32),
                    fontSize = 14.sp,
                    fontFamily = Poppins
                )
            }
        }

        Text(
            "ఆటో-పోస్ట్ కోసం గ్రూపులను ఎంచుకోండి",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 4.dp),
            fontFamily = Poppins
        )
        Text(
            "గరిష్టంగా 15 గ్రూపులను మాత్రమే ఎంచుకోగలరు.",
            fontSize = 12.sp,
            color = Color.Gray,
            modifier = Modifier.padding(bottom = 12.dp),
            fontFamily = Poppins
        )

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("గ్రూప్ పేరుతో వెతకండి...", fontFamily = Poppins) },
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear")
                    }
                }
            },
            shape = RoundedCornerShape(12.dp),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                .padding(horizontal = 8.dp)
        ) {
            if (filteredGroups.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("గ్రూపులు ఏవీ లేవు", color = Color.Gray, fontFamily = Poppins)
                    }
                }
            }
            
            items(filteredGroups) { group ->
                val isSelected = currentSelected.any { it.id == group.id }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (isSelected) {
                                currentSelected.removeAll { it.id == group.id }
                            } else {
                                if (currentSelected.size < 15) {
                                    currentSelected.add(group)
                                } else {
                                    Toast.makeText(context, "మీరు గరిష్టంగా 15 గ్రూపులను మాత్రమే ఎంచుకోగలరు.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                        .padding(vertical = 14.dp, horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = isSelected,
                        onCheckedChange = null,
                        colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        group.name, 
                        fontSize = 15.sp, 
                        fontFamily = Poppins,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
                HorizontalDivider(color = Color.Gray.copy(alpha = 0.1f))
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = { onSave(currentSelected.toList()) },
            modifier = Modifier.fillMaxWidth().height(54.dp),
            enabled = !isLoading,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Text(
                    "మార్పులను సేవ్ చేయండి (${currentSelected.size}/15)", 
                    fontWeight = FontWeight.Bold, 
                    fontSize = 16.sp,
                    fontFamily = Poppins
                )
            }
        }
    }
}
