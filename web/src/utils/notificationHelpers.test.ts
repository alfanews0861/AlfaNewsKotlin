import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBroadcastPayload,
  evaluateNotificationHealth,
  getCanonicalDistrict,
  getDistrictTopicName,
  getEdgeProxiedImageUrl,
  getTodayIstDateString,
  slugifyTopic,
} from './notificationHelpers.ts';

test('getCanonicalDistrict and getDistrictTopicName match backend & Android topic naming', () => {
  assert.equal(getCanonicalDistrict('విజయవాడ'), 'ఎన్టీఆర్');
  assert.equal(getCanonicalDistrict('Nellore'), 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు');
  assert.equal(getDistrictTopicName('విజయవాడ'), `district_${slugifyTopic('ఎన్టీఆర్')}`);
  assert.match(slugifyTopic('హైదరాబాద్'), /^[a-f0-9]+$/);
});

test('getEdgeProxiedImageUrl proxies Firebase Storage URLs through wsrv.nl', () => {
  const fb = 'https://firebasestorage.googleapis.com/v0/b/alfa.appspot.com/o/a.jpg?alt=media';
  const proxied = getEdgeProxiedImageUrl(fb);
  assert.ok(proxied.startsWith('https://wsrv.nl/?url='));
  assert.equal(getEdgeProxiedImageUrl('https://cdn.eenadu.net/photo.jpg'), 'https://cdn.eenadu.net/photo.jpg');
  assert.equal(getEdgeProxiedImageUrl(''), '');
});

test('buildBroadcastPayload generates valid alfanews://news/{id} deep link and canonical district topic', () => {
  const payload = buildBroadcastPayload({
    mode: 'post',
    audience: 'district',
    district: 'విజయవాడ',
    channelId: 'local_news_v2',
    silent: false,
    post: {
      id: 'post_99',
      headlineTelugu: 'విజయవాడలో ట్రాఫిక్ మార్పులు',
      mediaUrl: 'https://firebasestorage.googleapis.com/v0/b/alfa.appspot.com/o/img.jpg?alt=media',
      district: 'విజయవాడ',
    },
  });

  assert.equal(payload.actionUrl, 'alfanews://news/post_99');
  assert.equal(payload.newsId, 'post_99');
  assert.equal(payload.district, 'ఎన్టీఆర్');
  assert.equal(payload.topic, getDistrictTopicName('ఎన్టీఆర్'));
  assert.ok(payload.imageUrl.startsWith('https://wsrv.nl/?url='));
  assert.equal(payload.silent, false);
});

test('evaluateNotificationHealth detects disabled kill-switches, active pauses, and stuck daily quotas', () => {
  const now = Date.now();
  const todayIst = getTodayIstDateString(now);

  const healthy = evaluateNotificationHealth(
    {
      scheduledNotificationsEnabled: true,
      breakingNotificationsEnabled: true,
      pauseScheduledUntil: now - 10_000,
      pauseBreakingUntil: 0,
      lastScheduledSummary: { headline: 'ఉదయం ప్రధాన వార్త', slotHour: 8 },
    },
    { date: todayIst, count: 2 },
    now
  );
  assert.equal(healthy.needsAttention, false);
  assert.equal(healthy.scheduledPaused, false);
  assert.equal(healthy.dailyBreakingCount, 2);

  const stuck = evaluateNotificationHealth(
    {
      scheduledNotificationsEnabled: false,
      breakingNotificationsEnabled: false,
      pauseBreakingUntil: now + 3_600_000,
    },
    { date: todayIst, count: 999 },
    now
  );
  assert.equal(stuck.needsAttention, true);
  assert.equal(stuck.breakingPaused, true);
  assert.equal(stuck.dailyBreakingCount, 999);
});
