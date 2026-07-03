const admin = require('firebase-admin');
const db = admin.firestore();

async function insertTrendingNews() {
    console.log("Attempting to insert trending news articles using Admin SDK...");
    try {
        const article1 = {
            type: 'news',
            headline: { telugu: 'ఏపీ గ్రామీణ ప్రాంతాల్లో ఏఐ వైద్యం: ప్రాణాలను కాపాడుతున్న ఆధునిక సాంకేతికత', english: 'AI healthcare in rural AP: Modern technology saving lives' },
            content: { telugu: 'ఆంధ్రప్రదేశ్ మారుమూల గ్రామాల్లో ఏఐ ఆధారిత వైద్య సేవలు విప్లవాత్మక మార్పులు తెస్తున్నాయి. ప్రాథమిక ఆరోగ్య కేంద్రాల్లో కృత్రిమ మేధస్సు ద్వారా రోగులకు వేగంగా వ్యాధి నిర్ధారణ జరుగుతోంది. అత్యవసర సమయాల్లో నిపుణులైన వైద్యుల సలహాలు అందుబాటులోకి రావడంతో మరణాల రేటు గణనీయంగా తగ్గుతోంది. టెక్నాలజీ ద్వారా మెరుగైన వైద్యం సామాన్యులకు చేరువ కావడం పట్ల ప్రజలు సంతోషం వ్యక్తం చేస్తున్నారు.', english: 'AI-based medical services are bringing revolutionary changes in remote villages of Andhra Pradesh. Disease diagnosis is happening rapidly for patients in primary health centers through artificial intelligence.' },
            mediaUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1080&auto=format&fit=crop",
            mediaType: 'IMAGE',
            postFormat: 'VERTICAL',
            category: 'Technology',
            location: 'Kavali', // Mandalam name for testing
            district: 'Nellore',
            likes: 154,
            comments: 23,
            shares: 45,
            tags: ["AI", "Healthcare", "Andhra Pradesh", "Technology", "Rural Health"],
            reporter: { id: 'BOT_MANUAL_AP', name: 'సునీల్ వర్మ' },
            aiProcessed: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        const article2 = {
            type: 'news',
            headline: { telugu: 'తెలంగాణలో భారీ సోలార్ విద్యుత్ పార్క్ ప్రారంభం: శక్తి రంగంలో కొత్త మైలురాయి!', english: 'Massive solar power park inaugurated in Telangana: A new milestone in energy sector!' },
            content: { telugu: 'తెలంగాణ రాష్ట్రంలో మరో భారీ సోలార్ విద్యుత్ ప్రాజెక్టును ప్రభుత్వం ఘనంగా ప్రారంభించింది. అత్యాధునిక సాంకేతికతతో నిర్మించిన ఈ సోలార్ పార్క్ ద్వారా లక్షలాది ఇళ్లకు నిరంతర విద్యుత్ అందుబాటులోకి రానుంది. పర్యావరణ హిత ఇంధన ఉత్పత్తిలో రాష్ట్రం అగ్రగామిగా నిలుస్తోందని అధికారులు ప్రకటించారు. ఈ ప్రాజెక్టు స్థానికంగా అనేక ఉపాధి అవకాశాలు కల్పించనుంది. సౌరశక్తి వినియోగంలో తెలంగాణకు ఇది కీలక మైలురాయి.', english: 'The government has grandly inaugurated another massive solar power project in Telangana. Built with cutting-edge technology, this solar park will provide continuous electricity to lakhs of homes.' },
            mediaUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1080&auto=format&fit=crop",
            mediaType: 'IMAGE',
            postFormat: 'VERTICAL',
            category: 'Technology',
            location: 'Telangana',
            likes: 125,
            comments: 35,
            shares: 96,
            tags: ["Telangana", "Solar Energy", "Green Power", "Technology"],
            reporter: { id: 'BOT_MANUAL_TS', name: 'రవి కుమార్' },
            aiProcessed: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("news").add(article1);
        console.log("Article 1 (AP Trending) added successfully.");

        await db.collection("news").add(article2);
        console.log("Article 2 (TS Trending) added successfully.");

        return "Trending News Insertion Complete.";

    } catch (e) {
        console.error("Error during manual trending news insertion:", e.message);
        return "Trending News Insertion Failed.";
    }
}

insertTrendingNews();