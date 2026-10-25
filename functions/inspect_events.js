const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

async function fetchLogs(startTimeIso, endTimeIso, filterExtra = '') {
    const filter = `timestamp >= "${startTimeIso}" AND timestamp <= "${endTimeIso}" ${filterExtra}`;
    const body = JSON.stringify({
        resourceNames: [`projects/${projectId}`],
        filter: filter,
        orderBy: 'timestamp desc',
        pageSize: 50
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
    console.log('=== Event 1: Oct 23 around 14:30 to 15:30 IST (09:00 to 10:00 UTC) ===');
    const logsOct23 = await fetchLogs('2026-10-23T09:00:00Z', '2026-10-23T10:00:00Z', 'AND (resource.type="cloud_run_revision" OR resource.type="cloud_function")');
    console.log(`Found ${logsOct23.length} entries for Oct 23 14:30-15:30 IST`);
    logsOct23.slice(0, 25).forEach(e => {
        const time = new Date(e.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        const fn = e.resource?.labels?.service_name || e.resource?.labels?.function_name || 'unknown';
        const msg = String(e.textPayload || e.jsonPayload?.message || JSON.stringify(e.jsonPayload) || '');
        console.log(`[${time} IST] [${fn}] ${msg.substring(0, 150)}`);
    });

    console.log('\n=== Event 2: Oct 21 around 11:30 to 12:30 IST (06:00 to 07:00 UTC) ===');
    const logsOct21 = await fetchLogs('2026-10-21T06:00:00Z', '2026-10-21T07:00:00Z', 'AND (resource.type="cloud_run_revision" OR resource.type="cloud_function")');
    console.log(`Found ${logsOct21.length} entries for Oct 21 11:30-12:30 IST`);
    logsOct21.slice(0, 25).forEach(e => {
        const time = new Date(e.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        const fn = e.resource?.labels?.service_name || e.resource?.labels?.function_name || 'unknown';
        const msg = String(e.textPayload || e.jsonPayload?.message || JSON.stringify(e.jsonPayload) || '');
        console.log(`[${time} IST] [${fn}] ${msg.substring(0, 150)}`);
    });
}

run().catch(console.error);
