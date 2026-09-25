const fs = require('fs');

async function inspectAP() {
    const cfg = JSON.parse(fs.readFileSync('C:\\Users\\alfan\\.config\\configstore\\firebase-tools.json', 'utf8'));
    let token = cfg.tokens?.access_token;
    let docs = [];
    let pageToken = '';
    do {
        const url = 'https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (data.documents) docs.push(...data.documents);
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    const apDocs = docs.filter(d => d.fields?.state?.stringValue === 'Andhra Pradesh');
    console.log('Total AP feeds:', apDocs.length);
    const byDist = {};
    apDocs.forEach(d => {
        const dist = d.fields?.district?.stringValue || 'Unknown';
        const name = d.fields?.sourceName?.stringValue || '';
        const handle = d.fields?.url?.stringValue || '';
        const cat = d.fields?.category?.stringValue || '';
        if (!byDist[dist]) byDist[dist] = [];
        byDist[dist].push({ name, handle, cat });
    });
    console.log('\n--- AP DISTRICT SUMMARY COUNTS ---');
    Object.entries(byDist).sort((a,b) => b[1].length - a[1].length).forEach(([dist, list]) => {
        console.log(dist + ': ' + list.length);
    });
    console.log('\n--- FULL LIST BY DISTRICT ---');
    for (const [dist, list] of Object.entries(byDist).sort()) {
        console.log('\n📍 ' + dist + ' (' + list.length + '):');
        list.forEach(item => console.log('   - ' + item.handle + ': ' + item.name + ' [' + item.cat + ']'));
    }
}
inspectAP();
