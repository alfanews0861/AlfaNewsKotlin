const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

async function inspectMetricDescriptors() {
    const startTime = new Date('2026-10-23T09:00:00Z');
    const endTime = new Date('2026-10-23T10:00:00Z');
    const filter = 'metric.type="firestore.googleapis.com/document/read_count"';
    const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=${encodeURIComponent(filter)}&interval.startTime=${startTime.toISOString()}&interval.endTime=${endTime.toISOString()}&aggregation.alignmentPeriod=3600s&aggregation.perSeriesAligner=ALIGN_SUM`;

    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const p = JSON.parse(d);
                    console.log(`Found ${p.timeSeries?.length} timeSeries for read_count`);
                    (p.timeSeries || []).forEach(ts => {
                        console.log('Labels:', JSON.stringify(ts.metric.labels), 'Resource:', JSON.stringify(ts.resource.labels), 'Points:', ts.points?.map(pt => pt.value));
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

inspectMetricDescriptors().catch(console.error);
