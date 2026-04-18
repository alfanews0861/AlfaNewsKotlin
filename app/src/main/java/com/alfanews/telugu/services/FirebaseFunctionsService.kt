package com.alfanews.telugu.services

import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.HttpsCallableResult
import kotlinx.coroutines.tasks.await

object FirebaseFunctionsService {
    private val functions = FirebaseFunctions.getInstance("asia-south1")
    
    suspend fun callFunction(name: String, data: Map<String, Any>? = null): Result<Map<String, Any>> {
        return try {
            val callable = functions.getHttpsCallable(name)
            val result: HttpsCallableResult = if (data != null) {
                callable.call(data).await()
            } else {
                callable.call().await()
            }
            @Suppress("UNCHECKED_CAST")
            val resultData = result.getData() as? Map<String, Any> ?: emptyMap()
            Result.success(resultData)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun triggerPushBroadcast(
        title: String,
        body: String,
        actionUrl: String,
        topic: String = "all_users",
        silent: Boolean = false,
        channelId: String? = null
    ): Result<Map<String, Any>> {
        val data = mutableMapOf<String, Any>(
            "title" to title,
            "body" to body,
            "actionUrl" to actionUrl,
            "topic" to topic,
            "silent" to silent
        )
        channelId?.let { data["channelId"] = it }
        return callFunction("triggerPushBroadcast", data)
    }

    suspend fun processNewsPost(
        postId: String? = null,
        headline: String? = null,
        content: String? = null,
        postData: Map<String, Any>? = null
    ): Result<Map<String, Any>> {
        val data = mutableMapOf<String, Any>()
        postId?.let { data["postId"] = it }
        headline?.let { data["headline"] = it }
        content?.let { data["content"] = it }
        postData?.let { data["postData"] = it }
        
        return callFunction("processNewsPost", data)
    }

    suspend fun processReporterSubmission(
        postId: String? = null,
        headline: String? = null,
        content: String? = null,
        postData: Map<String, Any>? = null
    ): Result<Map<String, Any>> {
        val data = mutableMapOf<String, Any>()
        postId?.let { data["postId"] = it }
        headline?.let { data["headline"] = it }
        content?.let { data["content"] = it }
        postData?.let { data["postData"] = it }

        return callFunction("processReporterSubmission", data)
    }

    suspend fun processSocialFeeds(): Result<Map<String, Any>> {
        return callFunction("processSocialFeeds")
    }
    
    suspend fun processScrapingSources(group: Int? = null): Result<Map<String, Any>> {
        val data = if (group != null) mapOf("group" to group) else null
        return callFunction("processScrapingSources", data)
    }

    suspend fun fetchGNews(apiKey: String? = null): Result<Map<String, Any>> {
        val data = if (apiKey != null) mapOf("apiKey" to apiKey) else null
        return callFunction("fetchGNews", data)
    }
    
    
    suspend fun sendContactEmail(name: String, phone: String, message: String): Result<Map<String, Any>> {
        return callFunction("sendContactEmail", mapOf(
            "name" to name,
            "phone" to phone,
            "message" to message
        ))
    }

    suspend fun submitReporterApplication(
        fullName: String,
        fatherName: String,
        phone: String,
        address: String,
        position: String,
        interestedArea: String,
        education: String,
        currentOrg: String,
        state: String,
        district: String,
        mandal: String,
        message: String,
        userId: String? = null
    ): Result<Map<String, Any>> {
        return callFunction("submitReporterApplication", mapOf(
            "fullName" to fullName,
            "fatherName" to fatherName,
            "phone" to phone,
            "address" to address,
            "position" to position,
            "interestedArea" to interestedArea,
            "education" to education,
            "currentOrg" to currentOrg,
            "state" to state,
            "district" to district,
            "mandal" to mandal,
            "message" to message,
            "userId" to (userId ?: "")
        ))
    }
}
