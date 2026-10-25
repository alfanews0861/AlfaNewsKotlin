const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

async function fetchLogs(startTimeIso, endTimeIso, extraFilter = '') {
    const filter = `timestamp >= "${startTimeIso}" AND timestamp <= "${endTimeIso}" ${extraFilter}`;
    const body = JSON.stringify({
        resourceNames: [`projects/${projectId}`],
        filter: filter,
        orderBy: 'timestamp desc',
        pageSize: 100
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'logging.googleapis.com',
            path: '/v2/entries:list',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const p = JSON.parse(d);
                    resolve(p.entries || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
        req.write(body);
        req.end();
    });
}

async function run() {
    // Check 14:00 to 15:15 IST (08:30 to 09:45 UTC) on Oct 23
    console.log('Fetching logs for Oct 23 14:00 to 15:15 IST...');
    const logs = await fetchLogs('2026-10-23T08:30:00Z', '2026-10-23T09:45:00Z', 'AND (resource.type="cloud_run_revision" OR resource.type="cloud_function")');
    console.log(`Found ${logs.length} Cloud Function / Run logs:`);
    
    // Group by service / function
    const services = {};
    logs.forEach(e => {
        const s = e.resource?.labels?.service_name || e.resource?.labels?.function_name || 'unknown';
        services[s] = (services[s] || 0) + 1;
    });
    console.log('Services breakdown:', services);

    logs.forEach(e => {
        const msg = String(e.textPayload || e.jsonPayload?.message || JSON.stringify(e.jsonPayload) || '');
        const time = new Date(e.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        const s = e.resource?.labels?.service_name || e.resource?.labels?.function_name || 'unknown';
        if (msg.trim()) {
            console.log(`[${time} IST] [${s}] ${msg.substring(0, 160)}`);
        }
    });
}

run().catch(console.error);
