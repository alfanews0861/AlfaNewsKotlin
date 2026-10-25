const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

async function listMetrics() {
    const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/metricDescriptors?filter=${encodeURIComponent('metric.type = starts_with("firestore.googleapis.com")')}`;

    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const p = JSON.parse(d);
                    (p.metricDescriptors || []).forEach(m => {
                        console.log(`${m.type} (${m.valueType}) - ${m.description || m.displayName}`);
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

listMetrics().catch(console.error);
