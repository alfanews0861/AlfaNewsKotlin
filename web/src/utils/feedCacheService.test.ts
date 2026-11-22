import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCachedFeedUrl,
  resolveFeedApiBaseUrl,
} from '../services/feedCacheService.ts';

test('resolveFeedApiBaseUrl uses same-origin /api/feed on production Firebase Hosting domains', () => {
  assert.equal(resolveFeedApiBaseUrl('alfanews.app'), '/api/feed');
  assert.equal(resolveFeedApiBaseUrl('www.alfanews.app'), '/api/feed');
  assert.equal(resolveFeedApiBaseUrl('alfa-news-31bf7.web.app'), '/api/feed');
  assert.equal(resolveFeedApiBaseUrl('alfa-news-31bf7.firebaseapp.com'), '/api/feed');
  assert.equal(resolveFeedApiBaseUrl('localhost'), 'https://alfanews.app/api/feed');
});

test('buildCachedFeedUrl builds normalized query strings without user-specific cache-busting params', () => {
  const homeUrl = buildCachedFeedUrl(
    { type: 'home', col: 'news', state: 'AP', district: 'గుంటూరు', limit: 25 },
    'alfanews.app'
  );
  assert.ok(homeUrl.startsWith('/api/feed?'));
  assert.ok(homeUrl.includes('type=home'));
  assert.ok(homeUrl.includes('col=news'));
  assert.ok(homeUrl.includes('state=AP'));
  assert.ok(homeUrl.includes('limit=25'));

  const localUrl = buildCachedFeedUrl(
    { type: 'local', col: 'news_hi', state: 'UP', district: 'Lucknow', limit: 20 },
    'localhost'
  );
  assert.ok(localUrl.startsWith('https://alfanews.app/api/feed?'));
  assert.ok(localUrl.includes('type=local'));
  assert.ok(localUrl.includes('col=news_hi'));
  assert.ok(localUrl.includes('district=Lucknow'));
});
