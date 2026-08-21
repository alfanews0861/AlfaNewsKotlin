package com.alfanews.telugu.utils

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import com.alfanews.telugu.services.FirebaseService
import android.util.Log
import coil3.SingletonImageLoader
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
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
        
        // 📏 SAFE DOWNSAMPLING: Load and downsample via Coil 3 ImageLoader (disable memory cache to avoid mutating UI cache)
        val imageRequest = ImageRequest.Builder(context)
            .data(uri)
            .size(1280, 1280)
            .allowHardware(false)
            .memoryCachePolicy(CachePolicy.DISABLED)
            .build()

        val result = SingletonImageLoader.get(context).execute(imageRequest)
        val bitmap = if (result is SuccessResult) {
            result.image.toBitmap()
        } else {
            throw IllegalArgumentException("చిత్రం సరిగ్గా లేదు. వేరే ఫోటో ప్రయత్నించండి.")
        }
            
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

        val data = baos.toByteArray()
        
        Log.d("StorageUtils", "Starting byte upload to: $fileName (${data.size} bytes)")
        try {
            val metadata = com.google.firebase.storage.StorageMetadata.Builder()
                .setContentType("image/webp")
                .setCacheControl("public, max-age=31536000, immutable")
                .build()
            val uploadTask = imageRef.putBytes(data, metadata).await()
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
    context: Context,
    uri: Uri,
    folder: String = "uploads",
    onProgress: (Double) -> Unit = {}
): String {
    try {
        // 📏 VALIDATE VIDEO SIZE: Max 100 MB limit
        val MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024L // 100 MB
        var fileSize = -1L
        try {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                if (sizeIndex != -1 && cursor.moveToFirst()) {
                    fileSize = cursor.getLong(sizeIndex)
                }
            }
        } catch (e: Exception) {
            Log.w("StorageUtils", "Could not determine file size via cursor: ${e.message}")
        }

        if (fileSize > MAX_VIDEO_SIZE_BYTES) {
            val sizeMB = (fileSize / (1024 * 1024)).toInt()
            throw IllegalArgumentException("ఎంచుకున్న వీడియో సైజు (${sizeMB} MB) చాలా ఎక్కువగా ఉంది. వీడియో సైజు గరిష్టంగా 100 MB లోపు మాత్రమే ఉండాలి.")
        }

        val storageRef = FirebaseService.storage.reference
        val fileName = "${folder}/${UUID.randomUUID()}_${System.currentTimeMillis()}.mp4"
        val videoRef = storageRef.child(fileName)
        
        Log.d("StorageUtils", "Starting video upload to: $fileName for URI: $uri")
        val uploadTask = videoRef.putFile(uri)
        
        uploadTask.addOnProgressListener { snapshot ->
            val totalBytes = snapshot.totalByteCount
            if (totalBytes > MAX_VIDEO_SIZE_BYTES) {
                uploadTask.cancel()
            }
            val progress = if (totalBytes > 0) (100.0 * snapshot.bytesTransferred) / totalBytes else 0.0
            onProgress(progress)
        }
        
        uploadTask.await()
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
    isVideo: Boolean = false,
    onProgress: (Double) -> Unit = {}
): String {
    return if (isVideo) {
        uploadVideoToStorage(context, uri, folder, onProgress)
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
