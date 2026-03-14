package com.alfanews.telugu.utils

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import java.io.File

@Composable
fun rememberMediaPicker(onMediaSelected: (Uri?) -> Unit): () -> Unit {
    val context = LocalContext.current
    var showDialog by remember { mutableStateOf(false) }
    var tempImageUri by remember { mutableStateOf<Uri?>(null) }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
        onResult = { uri: Uri? -> onMediaSelected(uri) }
    )

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture(),
        onResult = { success ->
            if (success) {
                onMediaSelected(tempImageUri)
            }
        }
    )

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text("మీడియాను ఎంచుకోండి") },
            text = {
                Column {
                    ListItem(
                        headlineContent = { Text("కెమెరా") },
                        leadingContent = { Icon(Icons.Default.CameraAlt, contentDescription = "Camera") },
                        modifier = Modifier.clickable {
                            showDialog = false
                            val uri = createImageUri(context)
                            tempImageUri = uri
                            cameraLauncher.launch(uri)
                        }
                    )
                    ListItem(
                        headlineContent = { Text("గ్యాలరీ") },
                        leadingContent = { Icon(Icons.Default.PhotoLibrary, contentDescription = "Gallery") },
                        modifier = Modifier.clickable {
                            showDialog = false
                            imagePickerLauncher.launch("image/* video/*") // Allow both image and video
                        }
                    )
                }
            },
            confirmButton = { },
            dismissButton = { TextButton(onClick = { showDialog = false }) { Text("రద్దు చేయి") } },
            containerColor = MaterialTheme.colorScheme.surface,
            textContentColor = MaterialTheme.colorScheme.onSurface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    }

    return { showDialog = true }
}

// A simpler picker for only images, to be used in AdsManager for example
@Composable
fun rememberImagePicker(onImageSelected: (Uri?) -> Unit): () -> Unit {
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
        onResult = { uri: Uri? -> onImageSelected(uri) }
    )
    return { launcher.launch("image/*") }
}


private fun createImageUri(context: Context): Uri {
    val imageFile = File.createTempFile("JPEG_${System.currentTimeMillis()}_", ".jpg", context.cacheDir)
    return FileProvider.getUriForFile(context, "${context.packageName}.provider", imageFile)
}
