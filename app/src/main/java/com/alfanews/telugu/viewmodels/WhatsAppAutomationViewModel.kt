package com.alfanews.telugu.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alfanews.telugu.models.WhatsAppGroup
import com.alfanews.telugu.models.WhatsAppSettings
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * రిపోర్టర్ల కోసం వాట్సాప్ ఆటోమేషన్ సెట్టింగ్‌లను నిర్వహించే వ్యూ మోడల్.
 */
class WhatsAppAutomationViewModel(application: Application) : AndroidViewModel(application) {
    private val db = FirebaseService.db
    private var settingsListener: ListenerRegistration? = null
    
    private val _settings = MutableStateFlow<WhatsAppSettings?>(null)
    val settings: StateFlow<WhatsAppSettings?> = _settings.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    /**
     * యూజర్ యొక్క వాట్సాప్ సెట్టింగ్‌లను ఫైర్‌స్టోర్ నుండి వినడం ప్రారంభిస్తుంది.
     */
    fun startListening(userId: String) {
        if (userId.isEmpty()) return
        
        settingsListener?.remove()
        settingsListener = db.collection("reporters_whatsapp").document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    _errorMessage.value = "డేటాను లోడ్ చేయడంలో లోపం: ${error.localizedMessage}"
                    return@addSnapshotListener
                }
                
                if (snapshot != null && snapshot.exists()) {
                    _settings.value = snapshot.toObject(WhatsAppSettings::class.java)
                } else {
                    _settings.value = WhatsAppSettings()
                }
            }
    }

    /**
     * వాట్సాప్‌ను కనెక్ట్ చేయడానికి అభ్యర్థనను పంపుతుంది.
     */
    fun connectWhatsApp(userId: String, phoneNumber: String) {
        if (phoneNumber.isBlank()) {
            _errorMessage.value = "దయచేసి ఫోన్ నంబర్‌ను నమోదు చేయండి."
            return
        }
        
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val data = mapOf(
                    "phoneNumber" to phoneNumber,
                    "status" to "connecting",
                    "pairingCode" to null // పాత కోడ్ ఉంటే తొలగించడం
                )
                db.collection("reporters_whatsapp").document(userId)
                    .set(data, SetOptions.merge()).await()
            } catch (e: Exception) {
                _errorMessage.value = "కనెక్ట్ చేయడంలో లోపం: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * ఎంచుకున్న గ్రూపులను ఫైర్‌స్టోర్‌లో అప్‌డేట్ చేస్తుంది.
     */
    fun updateSelectedGroups(userId: String, groups: List<WhatsAppGroup>) {
        if (groups.size > 15) {
            _errorMessage.value = "భద్రత కోసం మీరు గరిష్టంగా 15 గ్రూపులను మాత్రమే ఎంచుకోగలరు."
            return
        }
        
        viewModelScope.launch {
            _isLoading.value = true
            try {
                db.collection("reporters_whatsapp").document(userId)
                    .update("selectedGroups", groups).await()
            } catch (e: Exception) {
                _errorMessage.value = "గ్రూపులను సేవ్ చేయడంలో లోపం: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * ఎర్రర్ మెసేజ్‌ను క్లియర్ చేస్తుంది.
     */
    fun clearError() {
        _errorMessage.value = null
    }

    override fun onCleared() {
        super.onCleared()
        settingsListener?.remove()
    }
}
