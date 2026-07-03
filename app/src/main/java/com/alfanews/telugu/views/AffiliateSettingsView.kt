package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AffiliateSettingsView(onBack: () -> Unit) {
    var amazonAccessKey by remember { mutableStateOf("") }
    var amazonSecretKey by remember { mutableStateOf("") }
    var amazonAssociateTag by remember { mutableStateOf("") }
    var flipkartId by remember { mutableStateOf("") }
    var flipkartToken by remember { mutableStateOf("") }
    
    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }
    
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            val doc = FirebaseService.db.collection("configs").document("affiliateApi").get().await()
            if (doc.exists()) {
                amazonAccessKey = doc.getString("amazonAccessKey") ?: ""
                amazonSecretKey = doc.getString("amazonSecretKey") ?: ""
                amazonAssociateTag = doc.getString("amazonAssociateTag") ?: ""
                flipkartId = doc.getString("flipkartId") ?: ""
                flipkartToken = doc.getString("flipkartToken") ?: ""
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    fun handleSave() {
        scope.launch {
            isSaving = true
            try {
                val data = mapOf(
                    "amazonAccessKey" to amazonAccessKey,
                    "amazonSecretKey" to amazonSecretKey,
                    "amazonAssociateTag" to amazonAssociateTag,
                    "flipkartId" to flipkartId,
                    "flipkartToken" to flipkartToken,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                FirebaseService.db.collection("configs").document("affiliateApi").set(data).await()
                Toast.makeText(context, "Settings saved successfully", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSaving = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Affiliate News API Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.padding(32.dp))
        } else {
            // Amazon Section
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Amazon India API (PA API 5.0)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    OutlinedTextField(value = amazonAccessKey, onValueChange = { amazonAccessKey = it }, label = { Text("Access Key") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = amazonSecretKey, onValueChange = { amazonSecretKey = it }, label = { Text("Secret Key") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = amazonAssociateTag, onValueChange = { amazonAssociateTag = it }, label = { Text("Associate Tag (e.g. tag-21)") }, modifier = Modifier.fillMaxWidth())
                }
            }
            
            // Flipkart Section
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Flipkart Affiliate API", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    OutlinedTextField(value = flipkartId, onValueChange = { flipkartId = it }, label = { Text("Affiliate ID") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = flipkartToken, onValueChange = { flipkartToken = it }, label = { Text("API Token") }, modifier = Modifier.fillMaxWidth())
                }
            }
            
            Button(
                onClick = ::handleSave,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = !isSaving
            ) {
                if (isSaving) CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                else {
                    Icon(Icons.Default.Save, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Save Configuration")
                }
            }
        }
    }
}
