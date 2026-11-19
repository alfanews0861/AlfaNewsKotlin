const admin = require('firebase-admin');

try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error("Could not load firebase-service-account.json:", e.message);
    process.exit(1);
}

const db = admin.firestore();

function toDateObj(ts) {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
}

function fmtIST(ts) {
    const d = toDateObj(ts);
    if (!d) return 'Never';
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

async function checkTwitterStatus() {
    const filterArg = (process.argv.find(a => a.startsWith('--district=')) || '').split('=')[1] || '';

    console.log("\n========================================================");
    console.log(" 🔍 ALFA NEWS - TWITTER / SOCIAL FEEDS HEALTH CHECK");
    console.log("========================================================\n");

    const snap = await db.collection('social_feeds').limit(500).get();
    if (snap.empty) {
        console.log("No social feeds configured in Firestore!");
        process.exit(0);
    }

    const now = Date.now();
    const staleMs = 12 * 60 * 60 * 1000;
    const feeds = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => {
        const p = (f.platform || '').toLowerCase();
        return !p || p === 'twitter' || p === 'x';
    });

    const activeFeeds = feeds.filter(f => !f.isPaused && f.lastStatus !== 'error');
    const errorFeeds = feeds.filter(f => !f.isPaused && f.lastStatus === 'error');
    const pausedFeeds = feeds.filter(f => f.isPaused === true);
    const neverFetched = feeds.filter(f => !f.isPaused && !f.lastFetchTime);
    const staleFeeds = feeds.filter(f => {
        if (f.isPaused) return false;
        const d = toDateObj(f.lastFetchTime);
        return !d || (now - d.getTime()) > staleMs;
    });
    const postedToday = feeds.filter(f => (f.todayProcessedCount || 0) > 0);

    console.log(`Total Twitter/X Feeds : ${feeds.length}`);
    console.log(`✅ Active             : ${activeFeeds.length}`);
    console.log(`❌ Error              : ${errorFeeds.length}`);
    console.log(`⏸️ Paused             : ${pausedFeeds.length}`);
    console.log(`🆕 Never Fetched      : ${neverFetched.length}`);
    console.log(`⏰ Stale (>12h ago)   : ${staleFeeds.length}`);
    console.log(`📰 Posted Today (>0)  : ${postedToday.length}\n`);

    if (errorFeeds.length > 0) {
        console.log("--------------------------------------------------------");
        console.log(` ❌ FEEDS WITH ERRORS (showing up to 25 of ${errorFeeds.length})`);
        console.log("--------------------------------------------------------");
        console.table(errorFeeds.slice(0, 25).map(f => ({
            'Source Name': f.sourceName || 'Unnamed',
            'Handle': f.handle || f.url || '',
            'District': f.district || '-',
            'Last Checked (IST)': fmtIST(f.lastFetchTime),
            'Error': (f.lastError || '-').substring(0, 45)
        })));
    }

    // Highlight Nellore (or custom --district=...) feeds explicitly
    const targetQuery = (filterArg || 'nellore').toLowerCase();
    const districtFeeds = feeds.filter(f => {
        const blob = `${f.district || ''} ${f.sourceName || ''} ${f.handle || ''} ${f.url || ''}`.toLowerCase();
        if (filterArg) return blob.includes(targetQuery);
        return blob.includes('nellore') || blob.includes('నెల్లూరు') || blob.includes('anam') || blob.includes('somireddy') || blob.includes('spsr') || blob.includes('sarvepalli');
    });

    console.log("\n--------------------------------------------------------");
    console.log(` 📍 DISTRICT FEEDS AUDIT (${filterArg || 'Nellore / నెల్లూరు'}: ${districtFeeds.length} feeds)`);
    console.log("--------------------------------------------------------");
    if (districtFeeds.length === 0) {
        console.log("No matching district feeds found.");
    } else {
        console.table(districtFeeds.map(f => ({
            'Source Name': f.sourceName || 'Unnamed',
            'Handle/URL': f.handle || f.url || '',
            'District Field': f.district || '-',
            'Status': f.isPaused ? '⏸️ Paused' : (f.lastStatus === 'error' ? '❌ Error' : '✅ Active'),
            'Today': f.todayProcessedCount || 0,
            'Total': f.totalProcessedCount || 0,
            'Last Checked (IST)': fmtIST(f.lastFetchTime),
            'Error': f.lastError ? f.lastError.substring(0, 32) : '-'
        })));
    }

    // Recently published Twitter news across all feeds
    console.log("\n--------------------------------------------------------");
    console.log(" 📰 RECENTLY PUBLISHED TWEETS (Last 10 in 'news' collection)");
    console.log("--------------------------------------------------------\n");

    const recentNews = await db.collection('news')
        .where('categories', 'array-contains', 'Social')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    if (recentNews.empty) {
        console.log("No news with 'Social' category found.");
    } else {
        recentNews.docs.forEach((d, i) => {
            const data = d.data();
            const timeStr = fmtIST(data.timestamp);
            console.log(`${i + 1}. [${data.sourceName || 'Social'}] (${data.district || 'General'}) | ${timeStr}`);
            console.log(`   Headline: ${data.headline?.telugu || data.headline}`);
            console.log(`   URL: ${data.sourceUrl || data.originalUrl}`);
            console.log(`   Media: ${data.mediaUrl ? '🖼️ Attached' : '❌ None'}\n`);
        });
    }

    process.exit(0);
}

checkTwitterStatus().catch(err => {
    console.error("Error checking Twitter status:", err);
    process.exit(1);
});
