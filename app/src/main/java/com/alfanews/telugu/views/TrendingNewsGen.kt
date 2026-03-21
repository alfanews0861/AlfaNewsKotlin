package com.alfanews.telugu.views

import android.os.Bundle
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.alfanews.telugu.models.*
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue

@Composable
fun TrendingNewsGen() {
   LaunchedEffect(Unit) {
        val db = FirebaseFirestore.getInstance()
        
        val article1 = NewsPost(
            type = "news",
            headline = Headline(telugu = "ఏపీ గ్రామీణ ప్రాంతాల్లో ఏఐ వైద్యం: మారుమూల పల్లెల్లో టెక్నాలజీతో ప్రాణాలు కాపాడుతున్న వైనం", english = "AI healthcare in rural AP: Modern technology saving lives"),
            content = Content(telugu = "ఆంధ్రప్రదేశ్ మారుమూల గ్రామాల్లో ఏఐ ఆధారిత వైద్య సేవలు విప్లవాత్మక మార్పులు తెస్తున్నాయి. ప్రాథమిక ఆరోగ్య కేంద్రాల్లో కృత్రిమ మేధస్సు ద్వారా రోగులకు వేగంగా వ్యాధి నిర్ధారణ జరుగుతోంది. అత్యవసర సమయాల్లో నిపుణులైన వైద్యుల సలహాలు అందుబాటులోకి రావడంతో మరణాల రేటు గణనీయంగా తగ్గుతోంది. టెక్నాలజీ ద్వారా మెరుగైన వైద్యం సామాన్యులకు చేరువ కావడం పట్ల ప్రజలు సంతోషం వ్యక్తం చేస్తున్నారు.", english = "AI-based medical services are bringing revolutionary changes in remote villages of Andhra Pradesh. Disease diagnosis is happening rapidly for patients in primary health centers through artificial intelligence."),
            mediaUrl = "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1080&auto=format&fit=crop",
            mediaType = MediaType.IMAGE,
            postFormat = PostFormat.VERTICAL,
            category = "Technology",
            location = "Andhra Pradesh",
            likes = 103,
            comments = 22,
            shares = 100,
            tags = listOf("AI", "Healthcare", "Andhra Pradesh", "Technology", "Rural Health"),
            reporter = Reporter(id = "BOT_6fb1b979", name = "సునీల్ వర్మ")
        )
        
        val article2 = NewsPost(
            type = "news",
            headline = Headline(telugu = "తెలంగాణలో భారీ సోలార్ విద్యుత్ పార్క్ ప్రారంభం: విద్యుత్ రంగంలో కొత్త చరిత్ర!", english = "Massive solar power park inaugurated in Telangana: A new milestone in energy sector!"),
            content = Content(telugu = "తెలంగాణ రాష్ట్రంలో మరో భారీ సోలార్ విద్యుత్ ప్రాజెక్టును ప్రభుత్వం ఘనంగా ప్రారంభించింది. అత్యాధునిక సాంకేతికతతో నిర్మించిన ఈ సోలార్ పార్క్ ద్వారా లక్షలాది ఇళ్లకు నిరంతర విద్యుత్ అందుబాటులోకి రానుంది. పర్యావరణ హిత ఇంధన ఉత్పత్తిలో రాష్ట్రం అగ్రగామిగా నిలుస్తోందని అధికారులు ప్రకటించారు. ఈ ప్రాజెక్టు స్థానికంగా అనేక ఉపాధి అవకాశాలు కల్పించనుంది. సౌరశక్తి వినియోగంలో తెలంగాణకు ఇది కీలక మైలురాయి.", english = "The government has grandly inaugurated another massive solar power project in Telangana. Built with cutting-edge technology, this solar park will provide continuous electricity to lakhs of homes."),
            mediaUrl = "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1080&auto=format&fit=crop",
            mediaType = MediaType.IMAGE,
            postFormat = PostFormat.VERTICAL,
            category = "Technology",
            location = "Telangana",
            likes = 125,
            comments = 35,
            shares = 96,
            tags = listOf("Telangana", "Solar Energy", "Green Power", "Technology"),
            reporter = Reporter(id = "BOT_f6a1edf3", name = "రవి కుమార్")
        )
        
        db.collection("news").add(article1).addOnSuccessListener { Log.d("TRENDING", "A1 added") }
        db.collection("news").add(article2).addOnSuccessListener { Log.d("TRENDING", "A2 added") }
   }
}