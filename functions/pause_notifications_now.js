const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const token = JSON.parse(fs.readFileSync(configPath, 'utf8')).tokens.access_token;
const projectId = 'alfa-news-31bf7';

async function updateSettings() {
  const { default: fetch } = await import('node-fetch');

  const pauseUntil = Date.now() + 48 * 60 * 60 * 1000; // 48 hours from now
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  // 1. Update settings/notifications
  const notifUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/notifications?updateMask.fieldPaths=breakingNotificationsEnabled&updateMask.fieldPaths=pauseBreakingUntil&updateMask.fieldPaths=scheduledNotificationsEnabled&updateMask.fieldPaths=pauseScheduledUntil`;
  const notifBody = {
    fields: {
      breakingNotificationsEnabled: { booleanValue: false },
      pauseBreakingUntil: { integerValue: String(pauseUntil) },
      scheduledNotificationsEnabled: { booleanValue: false },
      pauseScheduledUntil: { integerValue: String(pauseUntil) }
    }
  };

  const res1 = await fetch(notifUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(notifBody)
  });
  console.log('Updated settings/notifications status:', res1.status);

  // 2. Set count: 999 on notif_daily_breaking for today
  const breakUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/notif_daily_breaking?updateMask.fieldPaths=count&updateMask.fieldPaths=date`;
  const breakBody = {
    fields: {
      date: { stringValue: todayIST },
      count: { integerValue: '999' }
    }
  };

  const res2 = await fetch(breakUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(breakBody)
  });
  console.log('Updated settings/notif_daily_breaking status:', res2.status);
}

updateSettings().catch(console.error);
