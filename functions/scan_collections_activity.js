const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

const collections = [
  'anonymous_devices',
  'apify_facebook_feeds',
  'app_installs',
  'classifieds',
  'district_images',
  'facebook_feeds',
  'facebook_tokens',
  'gnews_fetch_logs',
  'gnews_sync_logs',
  'local_ads',
  'monthly_leaderboard',
  'news',
  'reporter_applications',
  'reporter_conversations',
  'reporters_whatsapp',
  'scanned_urls',
  'scraper_state',
  'scraping_sources',
  'scraping_stats',
  'settings',
  'social_auto_post_configs',
  'social_auto_post_logs',
  'social_feeds',
  'system_logs',
  'system_settings',
  'user_analytics',
  'users'
];

async function checkCollection(col) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}?pageSize=20`;
    return new Promise((resolve) => {
        https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const p = JSON.parse(d);
                    const docs = p.documents || [];
                    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
                    const recent = docs.filter(doc => doc.updateTime && new Date(doc.updateTime) > twoHoursAgo);
                    resolve({ col, totalSampled: docs.length, recentCount: recent.length, sampleTime: docs[0]?.updateTime });
                } catch (e) {
                    resolve({ col, error: e.message });
                }
            });
        }).on('error', err => resolve({ col, error: err.message }));
    });
}

async function run() {
    console.log('Scanning all collections for recent updates...');
    const results = await Promise.all(collections.map(c => checkCollection(c)));
    results.forEach(r => {
        if (r.recentCount > 0 || r.error) {
            console.log(`[${r.col}] RECENT UPDATES: ${r.recentCount}/${r.totalSampled} (Latest: ${r.sampleTime})`);
        } else {
            console.log(`[${r.col}] No recent updates in sample (Latest: ${r.sampleTime || 'none'})`);
        }
    });
}

run().catch(console.error);
