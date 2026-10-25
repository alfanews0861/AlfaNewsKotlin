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
    // Oct 23 peak was at 14:53 IST (09:23 UTC). Let's check 09:10 UTC to 09:40 UTC (14:40 to 15:10 IST)
    console.log('=== Checking Oct 23 14:40-15:10 IST across all log names and resources ===');
    const logs = await fetchLogs('2026-10-23T09:10:00Z', '2026-10-23T09:40:00Z');
    console.log(`Total entries returned: ${logs.length}`);

    const resTypes = {};
    const logNames = {};
    logs.forEach(e => {
        resTypes[e.resource?.type] = (resTypes[e.resource?.type] || 0) + 1;
        const shortLog = e.logName ? e.logName.split('/').pop() : 'none';
        logNames[shortLog] = (logNames[shortLog] || 0) + 1;
    });
    console.log('Resource Types:', resTypes);
    console.log('Log Names:', logNames);

    console.log('\nSample logs around 14:50-14:55 IST:');
    logs.slice(0, 30).forEach(e => {
        const time = new Date(e.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        const res = e.resource?.type || 'unknown';
        const msg = String(e.textPayload || e.jsonPayload?.message || JSON.stringify(e.jsonPayload) || '');
        console.log(`[${time} IST] [${res}] ${msg.substring(0, 160)}`);
    });
}

run().catch(console.error);
