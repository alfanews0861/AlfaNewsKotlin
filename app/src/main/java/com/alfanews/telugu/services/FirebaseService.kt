package com.alfanews.telugu.services

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.functions.FirebaseFunctions

/**
 * ఫైర్‌బేస్ (Firebase) సేవలను సులభంగా యాక్సెస్ చేయడానికి ఉపయోగించే ఆబ్జెక్ట్.
 * 
 * ఇది అథెంటికేషన్, ఫైర్‌స్టోర్ డేటాబేస్, స్టోరేజ్ మరియు క్లౌడ్ ఫంక్షన్ల యొక్క 
 * ఇన్‌స్టన్స్‌లను ఒకే చోట అందిస్తుంది.
 */
object FirebaseService {
    /** ఫైర్‌బేస్ అథెంటికేషన్ (Authentication) ఇన్‌స్టన్స్. */
    val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    
    /** ఫైర్‌స్టోర్ (Firestore) డేటాబేస్ ఇన్‌స్టన్స్. ఆఫ్ లైన్ డేటా సేవ్ అవ్వకుండా నిలిపివేస్తున్నాము. */
    val db: FirebaseFirestore by lazy { 
        val instance = FirebaseFirestore.getInstance()
        
        // యూసర్ కోరిన విధంగా ఆఫ్ లైన్ లో డేటా సేవ్ చేయకుండా నిలిపివేస్తున్నాము.
        // దీనివల్ల యాప్ సైజ్ పెరగదు (GBs లోకి వెళ్ళదు) మరియు చాలా వేగంగా ఉంటుంది.
        @Suppress("DEPRECATION")
        val settings = com.google.firebase.firestore.FirebaseFirestoreSettings.Builder()
            .setPersistenceEnabled(false)
            .build()

        try {
            instance.firestoreSettings = settings
        } catch (_: Exception) {
            // Already initialized, ignore
        }
        instance
    }
    
    /** ఫైర్‌బేస్ స్టోరేజ్ (Storage) ఇన్‌స్టンス. */
    val storage: FirebaseStorage by lazy { FirebaseStorage.getInstance() }
    
    /** ఫైర్‌బేస్ క్లౌడ్ ఫంక్షన్స్ (Cloud Functions) ఇన్‌స్టన్స్. */
    val functions: FirebaseFunctions by lazy { FirebaseFunctions.getInstance() }
}
