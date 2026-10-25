const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

async function fetchJson(url) {
    return new Promise(resolve => {
        https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(d));
                } catch(e) {
                    resolve({});
                }
            });
        }).on('error', () => resolve({}));
    });
}

async function scanCollection(colName) {
    console.log(`Scanning collection: ${colName}...`);
    let pageToken = '';
    const updatedDocs = [];
    // Oct 18 00:00 to 03:30 AM IST = Oct 17 18:30:00Z to 22:00:00Z
    const startT = '2026-10-17T18:30:00Z';
    const endT = '2026-10-17T22:30:00Z';
    
    let totalScanned = 0;
    do {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colName}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
        const res = await fetchJson(url);
        if (res.documents) {
            totalScanned += res.documents.length;
            res.documents.forEach(doc => {
                const u = doc.updateTime;
                if (u >= startT && u <= endT) {
                    updatedDocs.push({
                        id: doc.name.split('/').pop(),
                        name: doc.fields?.name?.stringValue || doc.fields?.title?.stringValue,
                        phone: doc.fields?.phone?.stringValue,
                        updateTime: u
                    });
                }
            });
        }
        pageToken = res.nextPageToken;
    } while (pageToken);

    console.log(`Col ${colName}: scanned ${totalScanned}, found ${updatedDocs.length} updated between 00:00 and 04:00 AM IST on Oct 18.`);
    if (updatedDocs.length > 0) {
        console.table(updatedDocs.slice(0, 20));
    }
    return updatedDocs;
}

async function main() {
    await scanCollection('users');
    await scanCollection('news');
    await scanCollection('notifications');
    await scanCollection('settings');
    await scanCollection('reporter_conversations');
}
main();
