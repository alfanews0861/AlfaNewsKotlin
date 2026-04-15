package com.alfanews.telugu.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import com.alfanews.telugu.services.FirebaseService
import kotlinx.coroutines.tasks.await
import java.io.ByteArrayOutputStream
import java.util.UUID

suspend fun uploadImageToStorage(
    context: Context,
    uri: Uri,
    folder: String = "uploads"
): String {
    val storageRef = FirebaseService.storage.reference
    val fileName = "${folder}/${UUID.randomUUID()}_${System.currentTimeMillis()}.webp"
    val imageRef = storageRef.child(fileName)
    
    val inputStream = context.contentResolver.openInputStream(uri)
    val bitmap = BitmapFactory.decodeStream(inputStream)
    val baos = ByteArrayOutputStream()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        bitmap?.compress(Bitmap.CompressFormat.WEBP_LOSSY, 80, baos)
    } else {
        @Suppress("DEPRECATION")
        bitmap?.compress(Bitmap.CompressFormat.WEBP, 80, baos)
    }
    val data = baos.toByteArray()
    
    val uploadTask = imageRef.putBytes(data).await()
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
    context: Context,
    uri: Uri,
    folder: String = "uploads",
    isVideo: Boolean = false
): String {
    return if (isVideo) {
        uploadVideoToStorage(uri, folder)
    } else {
        uploadImageToStorage(context, uri, folder)
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
