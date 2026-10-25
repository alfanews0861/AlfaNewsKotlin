const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const token = JSON.parse(fs.readFileSync(configPath, 'utf8')).tokens.access_token;
const projectId = 'alfa-news-31bf7';

async function fetchLogs(startTime, endTime, label) {
  const query = `timestamp >= "${startTime}" AND timestamp <= "${endTime}"`;
  const postData = JSON.stringify({
    resourceNames: [`projects/${projectId}`],
    filter: query,
    orderBy: 'timestamp asc',
    pageSize: 100
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'logging.googleapis.com',
      port: 443,
      path: '/v2/entries:list',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(d);
          console.log(`\n=== LOGS: ${label} (${data.entries?.length || 0} entries) ===`);
          const fnMap = {};
          (data.entries || []).forEach(e => {
            const fn = e.resource?.labels?.function_name || e.resource?.labels?.service_name || e.resource?.type || 'unknown';
            fnMap[fn] = (fnMap[fn] || 0) + 1;
          });
          console.log('Services active:', fnMap);
          (data.entries || []).filter(e => {
            const txt = e.textPayload || JSON.stringify(e.jsonPayload || {});
            return !txt.includes('virtio') && !txt.includes('rsyslogd') && !txt.includes('LogPingOpsAgent');
          }).slice(0, 25).forEach(e => {
            const fn = e.resource?.labels?.function_name || e.resource?.labels?.service_name || e.resource?.type || 'unknown';
            const msg = e.textPayload || (e.jsonPayload ? JSON.stringify(e.jsonPayload) : '');
            console.log(`[${e.timestamp}] [${fn}] ${msg.substring(0, 160)}`);
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  // 1. 20:00 - 20:15 IST (14:30 - 14:45 UTC) -> Spike 1 (281k reads)
  await fetchLogs('2026-10-18T14:30:00Z', '2026-10-18T14:45:00Z', 'Spike 1 (20:00-20:15 IST, 281k reads)');

  // 2. 22:20 - 22:35 IST (16:50 - 17:05 UTC) -> Spike 2 (261k reads)
  await fetchLogs('2026-10-18T16:50:00Z', '2026-10-18T17:05:00Z', 'Spike 2 (22:20-22:35 IST, 261k reads)');

  // 3. 22:35 - 23:25 IST (17:05 - 17:55 UTC) -> 63k writes burst
  await fetchLogs('2026-10-18T17:05:00Z', '2026-10-18T17:55:00Z', 'Write Burst (22:35-23:25 IST, 63k writes)');
}

run().catch(console.error);
