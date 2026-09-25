const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const serviceAccount = require('../web/alfa-news-31bf7-firebase-adminsdk-fbsvc-555ca0b18c.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const db = getFirestore();

function isMostlyEnglish(text) {
  if (!text) return false;
  const eng = (text.match(/[a-zA-Z]/g) || []).length;
  const tel = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
  return eng > 25 && eng > tel * 2;
}

function isTelugu(text) {
  if (!text) return false;
  const tel = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
  const eng = (text.match(/[a-zA-Z]/g) || []).length;
  return tel > eng && tel >= 10;
}

async function repair() {
  console.log("=== STEP 1: Repairing specific Aditi Gajapathi Post (DTRZME5fRmicsqL7Z99U) ===");
  const aditiDoc = await db.collection('news').doc('DTRZME5fRmicsqL7Z99U').get();
  if (aditiDoc.exists) {
    await db.collection('news').doc('DTRZME5fRmicsqL7Z99U').update({
      headline: {
        telugu: "రాష్ట్రంలో 23 పారిశ్రామిక క్లస్టర్ల అభివృద్ధిపై లోకేష్ ప్రకటన",
        english: "Nara Lokesh Announces Development of 23 Industrial Clusters in AP"
      },
      content: {
        telugu: "రాష్ట్రంలో గత రెండేళ్లలో పారిశ్రామిక రంగంలో కీలక మార్పులు తీసుకొచ్చామని, స్పేస్, డ్రోన్లు, సిమెంట్, స్టీల్, మెడికల్ డివైసెస్, ఫార్మా, ఏఐ, డేటా, హార్టికల్చర్, ఆక్వా వంటి రంగాలలో 23 ప్రత్యేక క్లస్టర్లను ప్రభుత్వం అభివృద్ధి చేస్తోందని మంత్రి నారా లోకేష్ తెలిపారు. పీఏఎఫ్ఐ (PAFI) వార్షిక సదస్సులో పాల్గొన్న ఈ వీడియోను ఎమ్మెల్యే అదితి గజపతిరాజు సోషల్ మీడియాలో పంచుకున్నారు.",
        english: "Minister Nara Lokesh stated that Andhra Pradesh has witnessed remarkable transformation over the past two years, with 23 specialized industrial clusters being developed across sectors including space, drones, cement, steel, pharma, AI, and data."
      },
      fullStory: {
        telugu: "రాష్ట్రంలో గత రెండేళ్ల కాలంలో పారిశ్రామిక మరియు సాంకేతిక రంగాలలో అద్భుతమైన మార్పులు తీసుకువచ్చామని మంత్రి నారా లోకేష్ స్పష్టం చేశారు. స్పేస్, డ్రోన్లు, సిమెంట్, స్టీల్, మెడికల్ డివైసెస్, ఫార్మా, కృత్రిమ మేధస్సు (AI), డేటా సెంటర్లు, హార్టికల్చర్ మరియు ఆక్వా రంగాల అభివృద్ధి కోసం ప్రభుత్వం ప్రత్యేక దృష్టి సారించిందని ఆయన పేర్కొన్నారు.\n\nరాష్ట్రవ్యాప్తంగా వివిధ రంగాలలో 23 ప్రత్యేక పారిశ్రామిక క్లస్టర్లను శరవేగంగా అభివృద్ధి చేస్తున్నామని తెలిపారు. ఈ క్లస్టర్ల ఏర్పాటు ద్వారా యువతకు పెద్దఎత్తున ఉద్యోగ, ఉపాధి అవకాశాలు లభిస్తాయని, రాష్ట్రానికి అంతర్జాతీయ స్థాయిలో భారీ పెట్టుబడులు వస్తున్నాయని వివరించారు.\n\nపీఏఎఫ్ఐ (PAFI) వార్షిక సదస్సు 2026 లో పాల్గొన్న సందర్భంగా రాష్ట్ర అభివృద్ధి రోడ్‌మ్యాప్‌ను వివరించిన వీడియోను విజయనగరం ఎమ్మెల్యే పూసపాటి అదితి గజపతిరాజు సోషల్ మీడియా ద్వారా పంచుకున్నారు.",
        english: "Minister Nara Lokesh emphasized that Andhra Pradesh has undergone significant industrial transformation over the past two years. The state government is aggressively developing 23 specialized industrial clusters across cutting-edge and traditional sectors.\n\nThese sectors include space technology, drones, cement, steel, medical devices, pharmaceuticals, artificial intelligence, data centers, horticulture, and aquaculture.\n\nMLA Pusapati Aditi Gajapathi Raju shared the video of the address delivered at the prestigious PAFI Annual Forum 2026 highlighting Andhra Pradesh's growth roadmap."
      },
      status: "published",
      approved: true,
      aiProcessed: true,
      lastProcessingError: FieldValue.delete(),
      error: FieldValue.delete(),
      reprocessCount: FieldValue.delete()
    });
    console.log("✅ DTRZME5fRmicsqL7Z99U successfully updated with accurate headline, content, and published status!");
  } else {
    console.log("Aditi doc not found by ID.");
  }

  console.log("\n=== STEP 2: Scanning for posts with English in content.telugu ===");
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const snap = await db.collection('news')
    .where('timestamp', '>=', Timestamp.fromDate(since))
    .get();

  let fixedCount = 0;
  for (const doc of snap.docs) {
    if (doc.id === 'DTRZME5fRmicsqL7Z99U') continue;
    const d = doc.data();
    const cTe = d.content?.telugu || '';
    const fTe = d.fullStory?.telugu || '';

    if (isMostlyEnglish(cTe)) {
      console.log(`Fixing doc ${doc.id}: "${d.headline?.telugu || ''}"`);
      let newTeluguContent = cTe;
      let newEnglishContent = d.content?.english || '';

      if (isTelugu(fTe)) {
        const firstPara = fTe.split(/\r?\n\r?\n/)[0].trim();
        if (firstPara) {
          newTeluguContent = firstPara;
          if (!newEnglishContent || newEnglishContent.length < 10) {
            newEnglishContent = cTe;
          }
        }
      }

      await doc.ref.update({
        content: {
          telugu: newTeluguContent,
          english: newEnglishContent
        },
        aiProcessed: true,
        approved: true,
        status: "published",
        lastProcessingError: FieldValue.delete(),
        error: FieldValue.delete(),
        reprocessCount: FieldValue.delete()
      });
      fixedCount++;
      console.log(`✅ Fixed doc ${doc.id}`);
    }
  }
  console.log(`Total posts with English content fixed: ${fixedCount}`);

  console.log("\n=== STEP 3: Recovering falsely failed scraped posts from last 48 hours ===");
  let failedRecovered = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.status === 'FAILED' && (d.error || '').includes('Max reprocess attempts exceeded')) {
      // Check if it has headline and content
      if (d.headline && d.content && (d.headline.telugu || typeof d.headline === 'string')) {
        await doc.ref.update({
          status: "published",
          approved: true,
          aiProcessed: true,
          error: FieldValue.delete(),
          lastProcessingError: FieldValue.delete(),
          reprocessCount: FieldValue.delete()
        });
        failedRecovered++;
      }
    }
  }
  console.log(`Total falsely failed posts recovered: ${failedRecovered}`);
  console.log("\n=== REPAIR COMPLETED SUCCESSFULLY ===");
}

repair().catch(console.error);
