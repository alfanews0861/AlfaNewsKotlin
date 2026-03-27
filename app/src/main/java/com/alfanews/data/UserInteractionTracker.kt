package com.alfanews.data

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore

object UserInteractionTracker {
    private val db = FirebaseFirestore.getInstance()

    // నెగటివ్ సిగ్నల్ (3 సెకన్ల లోపు స్వైప్)
    fun trackNegativeSignal(userId: String, category: String) {
        val userRef = db.collection("users").document(userId)
        // నెగటివ్ స్కోర్ తగ్గించడం
        userRef.update("interests.$category", FieldValue.increment(-10))
        
        // షాడో మోడ్ లాజిక్ (ఉదాహరణ: ఒక కేటగిరీలో ఎక్కువ నెగటివ్ ఉంటే షాడో మోడ్ ఆన్)
        // ఇది బ్యాకెండ్ క్లౌడ్ ఫంక్షన్‌లో మెరుగ్గా హ్యాండిల్ చేయవచ్చు
    }

    // పాజిటివ్ సిగ్నల్ (ఫుల్ రీడ్)
    fun trackPositiveSignal(userId: String, category: String) {
        val userRef = db.collection("users").document(userId)
        userRef.update("interests.$category", FieldValue.increment(5))
    }
    
    // న్యూట్రల్ సిగ్నల్ (క్లిక్ చేసి 5-10 సెకన్లు ఉంటే)
    fun trackNeutralSignal(userId: String, category: String) {
        val userRef = db.collection("users").document(userId)
        userRef.update("interests.$category", FieldValue.increment(1))
    }
}
