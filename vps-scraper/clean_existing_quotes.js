/**
 * AlfaNews - Clean Existing News Headlines Script
 * 
 * Scans recent articles in Firestore and strips quotation marks ('...', "...", ‘...’, “...”, `...`),
 * colons, and double-dots from headlines to make them clean, professional, and consistent.
 * 
 * Usage on VPS:
 *   node clean_existing_quotes.js
 */

const admin = require('firebase-admin');

try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized Successfully.");
} catch (error) {
    console.error("Failed to initialize Firebase Admin. Ensure firebase-service-account.json is in this directory.", error.message);
    process.exit(1);
}

const db = admin.firestore();

function sanitizeTeluguText(text) {
    if (!text) return "";
    return text
        .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/g, '')
        .replace(/[\u0900-\u0BFF\u0C80-\u0DFF\u0E00-\u109F]/g, '')
        .replace(/[\u25CC\uFFFD]/g, '')
        .replace(/[\u200B\uFEFF]/g, '')
        .replace(/(?:^|[\s.,;:!?'"“”‘’\(\)\[\]\{\}\-\/])[\u0C01-\u0C03\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63]+/g, ' ')
        .replace(/\s+([\u0C01-\u0C03\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63])/g, '$1')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function cleanTeluguHeadline(headline) {
    if (!headline || typeof headline !== 'string') return "";
    let clean = headline.trim();
    clean = clean.replace(/['"“‘”’`\\/]/g, '');
    clean = clean.replace(/\s*[:;]\s*/g, ' ');
    clean = clean.replace(/\.{2,}/g, ' ');
    clean = clean.replace(/^[\s.,:;!?'"“”‘’\-\—]+|[\s.,:;!?'"“”‘’\-\—]+$/g, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    return sanitizeTeluguText(clean);
}

function cleanEnglishHeadline(headline) {
    if (!headline || typeof headline !== 'string') return "";
    let clean = headline.trim();
    clean = clean.replace(/['"“‘”’`\\/]/g, '');
    clean = clean.replace(/\s*[:;]\s*/g, ' ');
    clean = clean.replace(/\.{2,}/g, ' ');
    clean = clean.replace(/^[\s.,:;!?'"“”‘’\-\—]+|[\s.,:;!?'"“”‘’\-\—]+$/g, '');
    return clean.replace(/\s+/g, ' ').trim();
}

async function cleanExistingHeadlines() {
    console.log("Scanning recent news articles in Firestore (up to 2000)...");

    const snap = await db.collection('news')
        .orderBy('timestamp', 'desc')
        .limit(2000)
        .get();

    if (snap.empty) {
        console.log("No news found.");
        process.exit(0);
    }

    console.log(`Fetched ${snap.size} articles. Checking for quotes/colons in headlines...`);

    let updatedCount = 0;
    let batch = db.batch();
    let batchSize = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        let currentTe = "";
        let currentEn = "";

        if (typeof data.headline === 'string') {
            currentTe = data.headline;
        } else if (data.headline && typeof data.headline === 'object') {
            currentTe = data.headline.telugu || "";
            currentEn = data.headline.english || "";
        }

        const newTe = cleanTeluguHeadline(currentTe);
        const newEn = cleanEnglishHeadline(currentEn);

        if ((currentTe && newTe !== currentTe) || (currentEn && newEn !== currentEn)) {
            console.log(`[UPDATE] Doc ID: ${doc.id}`);
            console.log(`   Old TE: ${currentTe}`);
            console.log(`   New TE: ${newTe}`);
            if (currentEn && newEn !== currentEn) {
                console.log(`   Old EN: ${currentEn}`);
                console.log(`   New EN: ${newEn}`);
            }

            const updatePayload = {};
            if (typeof data.headline === 'string') {
                updatePayload.headline = newTe;
            } else {
                updatePayload['headline.telugu'] = newTe;
                if (currentEn) updatePayload['headline.english'] = newEn;
            }

            batch.update(doc.ref, updatePayload);
            batchSize++;
            updatedCount++;

            if (batchSize >= 450) {
                await batch.commit();
                console.log(`Committed batch of ${batchSize} updates...`);
                batch = db.batch();
                batchSize = 0;
            }
        }
    }

    if (batchSize > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchSize} updates.`);
    }

    console.log(`\nDone! Successfully updated ${updatedCount} articles out of ${snap.size} scanned.`);
    process.exit(0);
}

cleanExistingHeadlines().catch(err => {
    console.error("Error cleaning headlines:", err);
    process.exit(1);
});
