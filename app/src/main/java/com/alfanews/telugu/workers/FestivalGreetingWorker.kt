package com.alfanews.telugu.workers

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.ai.client.generativeai.GenerativeModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.tasks.await
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.Calendar
import java.util.UUID

/**
 * రోజువారీ పండుగ గ్రీటింగ్స్ ను ఆటోమేటిక్ గా చెక్ చేసి, అవసరమైతే పోస్ట్ చేసే వర్కర్.
 */
class FestivalGreetingWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val tag = "FestivalGreetingWorker"

    override suspend fun doWork(): Result {
        return withContext(Dispatchers.IO) {
            try {
                // 1. ఈరోజు పండుగ ఉందా లేదా అనేది జెమినీ తో చెక్ చేయడం
                val apiKey = com.alfanews.telugu.BuildConfig.GEMINI_API_KEY
                if (apiKey.isEmpty() || apiKey == "YOUR_GEMINI_API_KEY_HERE") {
                    Log.e(tag, "API Key missing")
                    return@withContext Result.failure()
                }

                val calendar = Calendar.getInstance()
                val today = "${calendar.get(Calendar.DAY_OF_MONTH)}-${calendar.get(Calendar.MONTH) + 1}-${calendar.get(Calendar.YEAR)}"
                
                // Prompt asks specifically to check for Indian festivals today.
                val checkPrompt = "Today is $today in India. Is there any major Indian festival (Hindu, Muslim, Christian, Sikh, etc.) today? If yes, respond ONLY with the exact English name of the festival. If no, respond ONLY with 'NO'."
                
                val textModel = GenerativeModel(
                    modelName = "gemini-3-flash-preview",
                    apiKey = apiKey
                )
                
                val festivalResponse = textModel.generateContent(checkPrompt).text?.trim() ?: "NO"
                Log.d(tag, "Festival check response: $festivalResponse")

                if (festivalResponse.equals("NO", ignoreCase = true) || festivalResponse.isEmpty()) {
                    // పండుగ లేదు
                    Log.d(tag, "No festival today.")
                    return@withContext Result.success()
                }

                // పండుగ ఉంది, దానికి ఇమేజ్ జనరేట్ చేయాలి
                val festivalName = festivalResponse
                val success = generateAndPostGreetingImage(festivalName, apiKey)
                
                if (success) Result.success() else Result.retry()
            } catch (e: Exception) {
                Log.e(tag, "Error in doWork", e)
                Result.retry()
            }
        }
    }

    private suspend fun generateAndPostGreetingImage(festivalName: String, apiKey: String): Boolean {
        return try {
            val client = OkHttpClient()
            
            // తెలుగులో గ్రీటింగ్ ఉండాలని ప్రాంప్ట్ ఇస్తున్నాం, 9:16 aspect ratio
            val prompt = "Create a high quality, beautiful festival greeting card image for $festivalName in India, 9:16 aspect ratio, warm and festive atmosphere. Include some beautiful decorations. Center the visual elements to leave space for text. Add 'Happy $festivalName' in beautiful Telugu script."
            
            val jsonRequest = JSONObject().apply {
                put("instances", org.json.JSONArray().put(
                    JSONObject().put("prompt", prompt)
                ))
                put("parameters", JSONObject().apply {
                    put("sampleCount", 1)
                    put("aspectRatio", "9:16")
                })
            }

            val requestBody = jsonRequest.toString().toRequestBody("application/json".toMediaType())
            
            // NOTE: The v1/models/imagen API is generally NOT yet public, meaning you must use v1beta for Imagen!
            // If v1 doesn't work, this remains v1beta.
            val request = Request.Builder()
                .url("https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=$apiKey")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.e(tag, "Image generation failed: ${response.code} ${response.message}")
                return false
            }

            val responseBody = response.body?.string() ?: return false
            val jsonObject = JSONObject(responseBody)
            val predictions = jsonObject.optJSONArray("predictions")
            
            if (predictions != null && predictions.length() > 0) {
                val base64Image = predictions.getJSONObject(0).getString("bytesBase64Encoded")
                val imageBytes = android.util.Base64.decode(base64Image, android.util.Base64.DEFAULT)
                
                // ఇమేజ్ ని ఫైర్ బేస్ స్టోరేజ్ లో అప్లోడ్ చేయడం
                uploadToFirebaseAndPost(imageBytes, festivalName)
                return true
            }
            false
        } catch (e: Exception) {
            Log.e(tag, "Error generating image", e)
            false
        }
    }

    private suspend fun uploadToFirebaseAndPost(imageBytes: ByteArray, festivalName: String) {
        val storageRef = FirebaseStorage.getInstance().reference
        val fileName = "festival_greetings/${System.currentTimeMillis()}_${UUID.randomUUID()}.png"
        val imageRef = storageRef.child(fileName)
        
        // అప్లోడ్
        imageRef.putBytes(imageBytes).await()
        val downloadUrl = imageRef.downloadUrl.await().toString()
        
        // ఫైర్‌స్టోర్ లో పోస్ట్ చేయడం (news collection)
        val firestore = FirebaseFirestore.getInstance()
        val post = hashMapOf(
            "headline" to hashMapOf("telugu" to "$festivalName శుభాకాంక్షలు!", "english" to "Happy $festivalName!"),
            "content" to hashMapOf("telugu" to "", "english" to ""),
            "mediaUrl" to downloadUrl,
            "mediaType" to "IMAGE",
            // 9:16 ని చూపించడానికి ఇది తప్పనిసరిగా ఉండాలి 
            "postFormat" to "VERTICAL",
            // ఇది స్పెషల్ కార్డుగా ట్రీట్ చేయబడటానికి ఉపయోగపడుతుంది, తద్వారా పైన కింద టెక్స్ట్‌లు రావు
            "type" to "greeting",
            "timestamp" to com.google.firebase.Timestamp.now(),
            "likes" to 0, 
            "comments" to 0,
            "shares" to 0,
            "categories" to listOf("పండుగలు", "భక్తి"),
            "district" to "",
            "reporter" to hashMapOf("id" to "system", "name" to "Alfa News")
        )
        
        firestore.collection("news").add(post).await()
        Log.d(tag, "Successfully posted greeting for $festivalName")
    }
}
