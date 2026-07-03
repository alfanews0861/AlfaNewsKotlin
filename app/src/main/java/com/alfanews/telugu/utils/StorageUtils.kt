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
import android.util.Log
import kotlinx.coroutines.tasks.await
import java.io.ByteArrayOutputStream
import java.util.UUID

suspend fun uploadImageToStorage(
    context: Context,
    uri: Uri,
    folder: String = "uploads"
): String {
    try {
        val storageRef = FirebaseService.storage.reference
        val fileName = "${folder}/${UUID.randomUUID()}_${System.currentTimeMillis()}.webp"
        val imageRef = storageRef.child(fileName)
        
        val inputStream = context.contentResolver.openInputStream(uri) 
            ?: throw IllegalArgumentException("చిత్రం చదవలేకపోతున్నాము. దయచేసి మళ్ళీ ప్రయత్నించండి.")
            
        val bitmap = BitmapFactory.decodeStream(inputStream)
            ?: throw IllegalArgumentException("చిత్రం సరిగ్గా లేదు. వేరే ఫోటో ప్రయత్నించండి.")
            
        // 📏 RESIZE LOGIC: Max 1280px to save bandwidth
        val resizedBitmap = if (bitmap.width > 1280 || bitmap.height > 1280) {
            val ratio = bitmap.width.toFloat() / bitmap.height.toFloat()
            val (targetWidth, targetHeight) = if (ratio > 1) {
                1280 to (1280 / ratio).toInt()
            } else {
                (1280 * ratio).toInt() to 1280
            }
            Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
        } else {
            bitmap
        }

        val baos = ByteArrayOutputStream()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            resizedBitmap.compress(Bitmap.CompressFormat.WEBP_LOSSY, 80, baos)
        } else {
            @Suppress("DEPRECATION")
            resizedBitmap.compress(Bitmap.CompressFormat.WEBP, 80, baos)
        }
        
        // Recycle if scaled
        if (resizedBitmap != bitmap) {
            resizedBitmap.recycle()
        }
        bitmap.recycle()

        val data = baos.toByteArray()
        
        Log.d("StorageUtils", "Starting byte upload to: $fileName (${data.size} bytes)")
        try {
            val uploadTask = imageRef.putBytes(data).await()
            Log.d("StorageUtils", "Byte upload successful: $fileName")
            return imageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            val msg = e.message ?: ""
            if (msg.contains("permission", ignoreCase = true) || msg.contains("403")) {
                Log.e("StorageUtils", "Firebase Storage Permission Error: $msg at $fileName", e)
                throw Exception("ఈ ఫోల్డర్ లో ఫోటో అప్‌లోడ్ చేసే అనుమతి మీకు లేదు. ($folder)", e)
            } else {
                Log.e("StorageUtils", "Unexpected upload error: $msg at $fileName", e)
                throw e
            }
        }
    } catch (e: Exception) {
        Log.e("StorageUtils", "Image upload failed: ${e.message}", e)
        throw e
    }
}

suspend fun uploadVideoToStorage(
    uri: Uri,
    folder: String = "uploads"
): String {
    try {
        val storageRef = FirebaseService.storage.reference
        val fileName = "${folder}/${UUID.randomUUID()}_${System.currentTimeMillis()}.mp4"
        val videoRef = storageRef.child(fileName)
        
        Log.d("StorageUtils", "Starting video upload to: $fileName")
        val uploadTask = videoRef.putFile(uri).await()
        Log.d("StorageUtils", "Video upload successful: $fileName")
        return videoRef.downloadUrl.await().toString()
    } catch (e: Exception) {
        val msg = e.message ?: ""
        if (msg.contains("permission", ignoreCase = true) || msg.contains("403")) {
            Log.e("StorageUtils", "Firebase Storage Permission Error: $msg at $folder", e)
            throw Exception("ఈ ఫోల్డర్ లో వీడియో అప్‌లోడ్ చేసే అనుమతి మీకు లేదు. ($folder)", e)
        } else {
            Log.e("StorageUtils", "Error uploading video: $msg", e)
            throw e
        }
    }
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

object StorageUtils {
    // Keep object for backward compatibility if needed, but better to use top-level
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
