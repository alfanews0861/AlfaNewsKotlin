const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

async function getRecentDocs(collection, pageSize = 100) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=${pageSize}`;
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const p = JSON.parse(d);
                    resolve(p.documents || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    console.log(`Checking documents updated since: ${twoHoursAgo.toISOString()}`);

    // Check users
    const users = await getRecentDocs('users', 300);
    const updatedUsers = users.filter(u => u.updateTime && new Date(u.updateTime) > twoHoursAgo);
    console.log(`\nUsers updated in last 2 hours: ${updatedUsers.length}/${users.length}`);
    updatedUsers.slice(0, 10).forEach(u => {
        const id = u.name.split('/').pop();
        console.log(`User ${id} updated at ${u.updateTime}`);
    });

    // Check news
    const news = await getRecentDocs('news', 200);
    const updatedNews = news.filter(n => n.updateTime && new Date(n.updateTime) > twoHoursAgo);
    console.log(`\nNews updated in last 2 hours: ${updatedNews.length}/${news.length}`);
    updatedNews.slice(0, 10).forEach(n => {
        const id = n.name.split('/').pop();
        console.log(`News ${id} updated at ${n.updateTime}, longViews: ${n.fields?.longViews?.integerValue}`);
    });

    // Check anonymous_devices
    const anon = await getRecentDocs('anonymous_devices', 200);
    const updatedAnon = anon.filter(a => a.updateTime && new Date(a.updateTime) > twoHoursAgo);
    console.log(`\nAnonymous devices updated in last 2 hours: ${updatedAnon.length}/${anon.length}`);
    updatedAnon.slice(0, 10).forEach(a => {
        const id = a.name.split('/').pop();
        console.log(`Anon ${id} updated at ${a.updateTime}`);
    });
}

run().catch(console.error);
