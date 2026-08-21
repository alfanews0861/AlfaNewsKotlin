import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Read firebase-applet-config.json
import fs from 'fs';
const configPath = './firebase-applet-config.json';
if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = initializeApp(config);
    const db = getFirestore(app, config.firestoreDatabaseId);

    async function check() {
        const snapshot = await getDocs(collection(db, 'web_scraping_sources'));
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.url.includes('eenadu')) {
                console.log(doc.id, '=>', data.url, 'District:', data.district);
            }
        });
    }
    check();
} else {
    console.log('No firebase config found');
}
