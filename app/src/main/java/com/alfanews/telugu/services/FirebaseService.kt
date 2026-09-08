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
    
    /** ఫైర్‌స్టోర్ (Firestore) డేటాబేస్ ఇన్‌స్టన్స్. */
    val db: FirebaseFirestore by lazy { 
        val instance = FirebaseFirestore.getInstance()
        
        // 🔒 ఖర్చు మరియు మెమరీ రక్షణ:
        // పూర్తి అపరిమిత కాషింగ్ వల్ల ఫోన్ మెమరీ పెరిగిపోకుండా,
        // గరిష్టంగా 30MB కఠిన పరిమితితో కూడిన PersistentCache ని సెట్ చేస్తున్నాము.
        // దీనివల్ల:
        // 1. రీసెంట్ టెక్స్ట్ వార్తలు కాష్ లో ఉండి నెట్‌వర్క్ డ్రాప్ అయినా కనిపిస్తాయి.
        // 2. ఒకే డేటాను మళ్ళీ మళ్ళీ క్లౌడ్ నుండి లాగకుండా ఫైర్‌స్టోర్ రీడ్స్ & ఎగ్రెస్ ఆదా అవుతాయి.
        // 3. 30MB దాటగానే పాత డేటాను ఆటోమేటిక్‌గా డిలీట్ (LRU Eviction) చేసి ఫోన్ మెమరీని రక్షిస్తుంది.
        val cacheSettings = com.google.firebase.firestore.PersistentCacheSettings.newBuilder()
            .setSizeBytes(30L * 1024L * 1024L) // 30 MB strict cache limit
            .build()

        val settings = com.google.firebase.firestore.FirebaseFirestoreSettings.Builder()
            .setLocalCacheSettings(cacheSettings)
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
    val functions: FirebaseFunctions by lazy { FirebaseFunctions.getInstance("asia-south1") }
}
