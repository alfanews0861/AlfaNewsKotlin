package com.alfanews.telugu.views

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.alfanews.telugu.models.ClassifiedCategories
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.utils.rememberImagePicker
import com.alfanews.telugu.utils.uploadImageToStorage
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostClassifiedAdView(
    currentUser: User,
    onSuccess: () -> Unit,
    onCancel: () -> Unit
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(ClassifiedCategories.categories[0]) }
    var location by remember { mutableStateOf("") }
    var contactPhone by remember { mutableStateOf("") }
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun handleSubmit() {
        if (title.isEmpty() || price.isEmpty() || imageUri == null) {
            Toast.makeText(context, "ప్రకటన వివరాలు పూర్తి చేయండి.", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isSubmitting = true
            try {
                val imageUrl = if (imageUri != null) {
                    uploadImageToStorage(imageUri!!, "classifieds-media")
                } else {
                    ""
                }

                if (imageUrl.isEmpty()) {
                    Toast.makeText(context, "దయచేసి ఫోటోను అప్‌లోడ్ చేయండి.", Toast.LENGTH_SHORT).show()
                    isSubmitting = false
                    return@launch
                }

                val adData = hashMapOf(
                    "userId" to currentUser.id,
                    "userName" to currentUser.name,
                    "title" to title,
                    "description" to description,
                    "price" to (price.toDoubleOrNull() ?: 0.0),
                    "category" to category,
                    "location" to location,
                    "contactPhone" to contactPhone,
                    "imageUrl" to imageUrl,
                    "timestamp" to com.google.firebase.Timestamp.now()
                )

                FirebaseService.db.collection("classifieds")
                    .add(adData)
                    .await()

                Toast.makeText(context, "ప్రకటన పబ్లిష్ అయింది!", Toast.LENGTH_SHORT).show()
                onSuccess()
            } catch (e: Exception) {
                Toast.makeText(context, "ప్రకటన పోస్ట్ చేయడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSubmitting = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "కొత్త ప్రకటన",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            TextButton(onClick = onCancel) {
                Text("రద్దు", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

        // Form
        OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            label = { Text("వస్తువు పేరు") },
            placeholder = { Text("ఉదా: బైక్ అమ్మబడును") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = price,
                onValueChange = { price = it },
                label = { Text("ధర (₹)") },
                placeholder = { Text("ధర") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )

            var categoryExpanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = categoryExpanded,
                onExpandedChange = {
                    categoryExpanded = !categoryExpanded
                },
                modifier = Modifier.weight(1f)
            ) {
                OutlinedTextField(
                    modifier = Modifier.menuAnchor().fillMaxWidth(),
                    readOnly = true,
                    value = category,
                    onValueChange = {},
                    label = { Text("కేటగిరి") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                    colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
                )
                ExposedDropdownMenu(
                    expanded = categoryExpanded,
                    onDismissRequest = { categoryExpanded = false }
                ) {
                    ClassifiedCategories.categories.forEach { cat ->
                        DropdownMenuItem(
                            text = { Text(cat) },
                            onClick = {
                                category = cat
                                categoryExpanded = false
                            }
                        )
                    }
                }
            }
        }

        OutlinedTextField(
            value = location,
            onValueChange = { location = it },
            label = { Text("లొకేషన్") },
            placeholder = { Text("మీ ఊరు/నగరం") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        OutlinedTextField(
            value = contactPhone,
            onValueChange = { contactPhone = it },
            label = { Text("ఫోన్ నెంబర్") },
            placeholder = { Text("9876543210") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        // Image Upload
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
        ) {
            val pickImage = rememberImagePicker { uri ->
                imageUri = uri
            }

            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("ఫోటో", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(8.dp))

                if (imageUri != null) {
                    AsyncImage(
                        model = imageUri,
                        contentDescription = "Selected Image",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.Crop
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                Button(onClick = { pickImage() }) {
                    Text(if (imageUri != null) "ఫోటోను మార్చండి" else "ఫోటోను ఎంచుకోండి")
                }
            }
        }

        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("వివరాలు") },
            placeholder = { Text("పూర్తి వివరాలు ఇక్కడ రాయండి...") },
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            maxLines = 4
        )

        Button(
            onClick = { handleSubmit() },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isSubmitting,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
        ) {
            if (isSubmitting) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(if (isSubmitting) "పబ్లిష్ అవుతోంది..." else "ప్రకటనను పోస్ట్ చేయి", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
    }
}
