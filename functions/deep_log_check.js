const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const projectId = 'alfa-news-31bf7';

async function fetchAuditLogs(startTimeIso, endTimeIso) {
    const filter = `timestamp >= "${startTimeIso}" AND timestamp <= "${endTimeIso}"`;
    const body = JSON.stringify({
        resourceNames: [`projects/${projectId}`],
        filter: filter,
        orderBy: 'timestamp desc',
        pageSize: 500
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
    // Oct 23 around 14:30 to 15:00 IST (09:00 to 09:30 UTC)
    console.log('Querying all logs 09:15 to 09:30 UTC on Oct 23...');
    const logs = await fetchAuditLogs('2026-10-23T09:15:00Z', '2026-10-23T09:30:00Z');
    console.log('Found total log entries:', logs.length);
    
    const summary = {};
    logs.forEach(e => {
        const key = `${e.resource?.type || 'no-res'} | ${e.logName?.split('/').pop() || 'no-log'}`;
        summary[key] = (summary[key] || 0) + 1;
    });
    console.log('Log distribution:', summary);

    // Let's filter out standard noisy logs and see what else exists
    const interesting = logs.filter(e => {
        const log = e.logName || '';
        return !log.includes('syslog') && !log.includes('ops-agent-fluent-bit');
    });
    console.log('Non-syslog logs count:', interesting.length);
    interesting.slice(0, 30).forEach(e => {
        const time = new Date(e.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        const res = e.resource?.type || 'unknown';
        const msg = String(e.textPayload || e.jsonPayload?.message || JSON.stringify(e.jsonPayload) || '');
        console.log(`[${time} IST] [${res}] ${msg.substring(0, 160)}`);
    });
}

run().catch(console.error);
