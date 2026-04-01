const { GoogleGenAI, Type } = require('@google/genai');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize with a known service account for local testing if needed, or stick to normal init
admin.initializeApp({
  projectId: "alfa-news-31bf7"
});
const db = admin.firestore();
const ai = new GoogleGenAI({ apiKey: "AIzaSyAzmrl2_vOhQOhr_YUlS4EsvCriZP1OBxo" });

const BOT_REPORTER_NAMES = [
    'రవి కుమార్', 'సునీల్ వర్మ', 'రాజేష్ యాదవ్', 'ప్రకాష్ రెడ్డి', 'సాయి కిరణ్',
    'విజయ్ భాస్కర్', 'శ్రీనివాస్ రావు', 'నరేష్ కుమార్', 'అరవింద్ స్వామి', 'కార్తీక్ రాజు',
    'సందీప్ శర్మ', 'లోకేష్ నాయుడు', 'వరుణ్ కుమార్', 'కృష్ణ చైతన్య', 'వెంకటేష్ బాబు',
    'ఆదిత్య వర్మ', 'రాహుల్ దేశ్‌ముఖ్', 'అజయ్ సింగ్', 'భరత్ చంద్ర', 'దీపక్ రాజ్',
    'పవన్ కుమార్', 'హరీష్ వర్మ', 'కిశోర్ బాబు', 'మనోజ్ కుమార్', 'సంతోష్ రెడ్డి'
];

function getRandomReporter() {
    const name = BOT_REPORTER_NAMES[Math.floor(Math.random() * BOT_REPORTER_NAMES.length)];
    return { id: `BOT_${crypto.randomBytes(4).toString('hex')}`, name: name };
}

async function run() {
  try {
    const topics = [
      {
         topic: "AI in healthcare saving lives in rural AP",
         imgUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1080&auto=format&fit=crop"
      },
      {
         topic: "New massive solar park inaugurated in Telangana",
         imgUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1080&auto=format&fit=crop"
      }
    ];

    for (let t of topics) {
       console.log("Generating for:", t.topic);

       const schema = {
            type: Type.OBJECT,
            properties: {
                headline: { type: Type.STRING },
                content: { type: Type.STRING },
                headlineEn: { type: Type.STRING },
                contentEn: { type: Type.STRING },
                location: { type: Type.STRING },
                storyFingerprint: { type: Type.STRING },
                refinedCategory: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                entities: {
                    type: Type.OBJECT,
                    properties: {
                        people: { type: Type.ARRAY, items: { type: Type.STRING } },
                        organizations: { type: Type.ARRAY, items: { type: Type.STRING } },
                        locations: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            },
            required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "tags", "entities"],
        };

        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: `Write a news article about: ${t.topic}` }] }],
            config: {
                systemInstruction: `You are a Senior Journalist.
                1. Content must be approximately 50-60 words in Telugu. It should sound like breaking news.
                2. Headline must be a PUNCHY single sentence under 12 words in Telugu.
                3. Identify the primary location of the news.
                4. Create a unique storyFingerprint (3 words joined by hyphens).
                5. refinedCategory: Technology or Local.
                6. Output JSON only.`,
                temperature: 0.6,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const aiRes = JSON.parse((response.text) || "{}");
        const reporter = getRandomReporter();

        const postData = {
                type: 'news',
                headline: { telugu: aiRes.headline, english: aiRes.headlineEn },
                content: { telugu: aiRes.content, english: aiRes.contentEn },
                mediaUrl: t.imgUrl,
                mediaType: 'IMAGE',
                postFormat: 'VERTICAL',
                category: aiRes.refinedCategory,
                location: aiRes.location,
                likes: Math.floor(Math.random() * 200) + 50,
                comments: Math.floor(Math.random() * 50) + 10,
                shares: Math.floor(Math.random() * 100) + 20,
                tags: aiRes.tags,
                entities: aiRes.entities,
                storyFingerprint: aiRes.storyFingerprint,
                reporter: reporter,
                aiProcessed: true,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        const newDocRef = await db.collection('news').add(postData);
        console.log(`Created news post: ${newDocRef.id} with image ${t.imgUrl}`);
    }
  } catch (e) {
    console.error(e);
  }
}
run();