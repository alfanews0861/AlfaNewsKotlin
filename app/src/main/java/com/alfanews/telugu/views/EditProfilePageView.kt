package com.alfanews.telugu.views

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.glassmorphism

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfilePageView(
    user: User,
    onClose: () -> Unit,
    onSave: (name: String, phone: String, address: String, district: String, photoUri: Uri?, signatureUri: Uri?) -> Unit,
    saving: Boolean = false,
    showTitle: Boolean = true
) {
    var editName by remember { mutableStateOf(user.name) }
    var editPhone by remember { mutableStateOf(user.phone ?: "") }
    var editAddress by remember { mutableStateOf(user.address ?: "") }
    var editDistrict by remember { mutableStateOf(user.district ?: "") }
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    var signatureUri by remember { mutableStateOf<Uri?>(null) }

    val isAdmin = user.role == UserRole.ADMIN
    val allDistricts = remember {
        (Constants.TS_DISTRICTS + Constants.AP_DISTRICTS).sorted()
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
            .padding(16.dp)
            .glassmorphism(cornerRadius = 24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Header Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onClose) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onBackground
                    )
                }
                
                Text(
                    text = stringResource(R.string.edit_profile),
                    fontSize = 20.sp,
                    fontFamily = Ramabhadra,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 8.dp),
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
                                    editDistrict = district
                                    districtExpanded = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                            )
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
                        color = Color(0xFFFEE2E2),
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
                                color = Color(0xFF991B1B),
                                modifier = Modifier.padding(bottom = 4.dp)
                            )
                            Text(
                                text = stringResource(R.string.auth_signature_desc),
                                fontSize = 10.sp,
                                color = Color(0xFFDC2626),
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
                                    color = Color.White,
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        Color(0xFFFCA5A5)
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
                            onSave(editName, editPhone, editAddress, editDistrict, photoUri, signatureUri)
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
