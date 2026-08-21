
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA-tbQSwOlQvwJTQz9nKH-Fo8pI0ZLTW8c",
  authDomain: "alfa-news-31bf7.firebaseapp.com",
  projectId: "alfa-news-31bf7",
  storageBucket: "alfa-news-31bf7.firebasestorage.app",
  messagingSenderId: "930598073690",
  appId: "1:930598073690:web:d8e361bf98e422ace92f63",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    try {
        console.log("Checking news collection...");
        const newsSnap = await getDocs(query(collection(db, 'news'), limit(5)));
        console.log(`News count (sampled): ${newsSnap.size}`);
        newsSnap.forEach(doc => {
            const data = doc.data();
            console.log(`- ${doc.id}: ${data.headline?.telugu} (District: ${data.district}, Category: ${data.category}, Status: ${data.status})`);
        });

        console.log("\nChecking scraping_sources...");
        const sourcesSnap = await getDocs(collection(db, 'scraping_sources'));
        console.log(`Sources count: ${sourcesSnap.size}`);
        sourcesSnap.forEach(doc => {
            const data = doc.data();
            console.log(`- ${doc.id}: ${data.siteName} (URL: ${data.url}, District: ${data.district}, Paused: ${data.isPaused})`);
            console.log(`  Stats: Today: ${data.todayProcessedCount}, Total: ${data.totalProcessedCount}`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

check();
