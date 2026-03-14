package com.alfanews.telugu.utils

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import com.alfanews.telugu.services.FirebaseService
import kotlinx.coroutines.tasks.await
import java.util.UUID

suspend fun uploadImageToStorage(
    uri: Uri,
    folder: String = "uploads"
): String {
    val storageRef = FirebaseService.storage.reference
    val fileName = "${folder}/${UUID.randomUUID()}_${System.currentTimeMillis()}.jpg"
    val imageRef = storageRef.child(fileName)
    
    val uploadTask = imageRef.putFile(uri).await()
    return imageRef.downloadUrl.await().toString()
}

suspend fun uploadVideoToStorage(
    uri: Uri,
    folder: String = "uploads"
): String {
    val storageRef = FirebaseService.storage.reference
    val fileName = "${folder}/${UUID.randomUUID()}_${System.currentTimeMillis()}.mp4"
    val videoRef = storageRef.child(fileName)
    
    val uploadTask = videoRef.putFile(uri).await()
    return videoRef.downloadUrl.await().toString()
}

suspend fun uploadMediaToStorage(
    uri: Uri,
    folder: String = "uploads",
    isVideo: Boolean = false
): String {
    return if (isVideo) {
        uploadVideoToStorage(uri, folder)
    } else {
        uploadImageToStorage(uri, folder)
    }
}

@Composable
fun rememberMediaPicker(onMediaPicked: (Uri) -> Unit): () -> Unit {
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
        onResult = { uri: Uri? ->
            uri?.let { onMediaPicked(it) }
        }
    )

    return { launcher.launch("image/* video/*") }
}
